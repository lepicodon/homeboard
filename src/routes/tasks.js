const express = require('express');
const router = express.Router();
const db = require('../config/db');

// Helpers to fetch full task details
function getTaskById(id) {
  const query = `
    SELECT 
      t.*,
      c.name AS category_name,
      c.color AS category_color,
      (
        SELECT json_group_array(json_object('id', m.id, 'name', m.name, 'color', m.color, 'avatar', m.avatar))
        FROM task_members tm
        JOIN members m ON tm.member_id = m.id
        WHERE tm.task_id = t.id
      ) AS assignees
    FROM tasks t
    LEFT JOIN categories c ON t.category_id = c.id
    WHERE t.id = ?
  `;
  const task = db.prepare(query).get(id);
  if (task) {
    task.assignees = JSON.parse(task.assignees);
    task.completed = !!task.completed;
  }
  return task;
}

// Helper to compute next recurring deadline
function calculateNextDeadline(currentDeadlineStr, recurrence) {
  if (!currentDeadlineStr) {
    currentDeadlineStr = new Date().toISOString().split('T')[0];
  }
  const date = new Date(currentDeadlineStr + 'T00:00:00');
  if (recurrence === 'weekly') {
    date.setDate(date.getDate() + 7);
  } else if (recurrence === 'bi-weekly') {
    date.setDate(date.getDate() + 14);
  } else if (recurrence === 'monthly') {
    date.setMonth(date.getMonth() + 1);
  } else if (recurrence === 'quarterly') {
    date.setMonth(date.getMonth() + 3);
  } else {
    return null;
  }
  return date.toISOString().split('T')[0];
}

// Spawning logic for recurring tasks
function handleRecurringSpawn(taskId, originalTask, dbInstance) {
  if (!originalTask || originalTask.recurrence === 'none') return;

  const nextDeadline = calculateNextDeadline(originalTask.deadline, originalTask.recurrence);
  const assignedAt = originalTask.assigned_type !== 'unassigned' ? new Date().toISOString() : null;

  const info = dbInstance
    .prepare(
      `
    INSERT INTO tasks (title, description, size, category_id, assigned_type, other_assignee, deadline, recurrence, assigned_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `
    )
    .run(
      originalTask.title,
      originalTask.description,
      originalTask.size,
      originalTask.category_id,
      originalTask.assigned_type,
      originalTask.other_assignee,
      nextDeadline,
      originalTask.recurrence,
      assignedAt
    );

  const newTaskId = info.lastInsertRowid;

  if (originalTask.assigned_type === 'members') {
    const members = dbInstance.prepare('SELECT member_id FROM task_members WHERE task_id = ?').all(taskId);
    if (members.length > 0) {
      const insertMember = dbInstance.prepare('INSERT INTO task_members (task_id, member_id) VALUES (?, ?)');
      for (const m of members) {
        insertMember.run(newTaskId, m.member_id);
      }
    }
  }
}

// Router endpoints

router.get('/', (req, res) => {
  try {
    const query = `
      SELECT 
        t.*,
        c.name AS category_name,
        c.color AS category_color,
        (
          SELECT json_group_array(json_object('id', m.id, 'name', m.name, 'color', m.color, 'avatar', m.avatar))
          FROM task_members tm
          JOIN members m ON tm.member_id = m.id
          WHERE tm.task_id = t.id
        ) AS assignees
      FROM tasks t
      LEFT JOIN categories c ON t.category_id = c.id
      ORDER BY t.completed ASC, t.deadline ASC, t.created_at DESC
    `;
    const tasks = db.prepare(query).all();
    const formattedTasks = tasks.map((task) => {
      task.assignees = JSON.parse(task.assignees);
      task.completed = !!task.completed;
      return task;
    });
    res.json(formattedTasks);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/', (req, res) => {
  const { title, description, size, category_id, assigned_type, other_assignee, deadline, recurrence, member_ids } =
    req.body;

  if (!title || !size) {
    return res.status(400).json({ error: 'Title and Size are required.' });
  }
  if (!['small', 'medium', 'big'].includes(size)) {
    return res.status(400).json({ error: 'Size must be small, medium, or big.' });
  }
  if (!['unassigned', 'other', 'members'].includes(assigned_type)) {
    return res.status(400).json({ error: 'Invalid assigned type.' });
  }
  if (recurrence && !['none', 'weekly', 'bi-weekly', 'monthly', 'quarterly'].includes(recurrence)) {
    return res.status(400).json({ error: 'Invalid recurrence value.' });
  }

  try {
    const insertTx = db.transaction(() => {
      const assignedAt = assigned_type !== 'unassigned' ? new Date().toISOString() : null;

      const info = db
        .prepare(
          `
        INSERT INTO tasks (title, description, size, category_id, assigned_type, other_assignee, deadline, recurrence, assigned_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `
        )
        .run(
          title.trim(),
          description ? description.trim() : null,
          size,
          category_id ? Number(category_id) : null,
          assigned_type,
          assigned_type === 'other' ? (other_assignee ? other_assignee.trim() : 'Other') : null,
          deadline || null,
          recurrence || 'none',
          assignedAt
        );

      const taskId = info.lastInsertRowid;

      if (assigned_type === 'members' && Array.isArray(member_ids) && member_ids.length > 0) {
        const insertMember = db.prepare('INSERT INTO task_members (task_id, member_id) VALUES (?, ?)');
        for (const mId of member_ids) {
          insertMember.run(taskId, Number(mId));
        }
      }
      return taskId;
    });

    const taskId = insertTx();
    res.status(201).json(getTaskById(taskId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.put('/:id', (req, res) => {
  const {
    title,
    description,
    size,
    category_id,
    assigned_type,
    other_assignee,
    deadline,
    completed,
    recurrence,
    member_ids
  } = req.body;
  const taskId = req.params.id;

  if (!title || !size) {
    return res.status(400).json({ error: 'Title and Size are required.' });
  }
  if (!['small', 'medium', 'big'].includes(size)) {
    return res.status(400).json({ error: 'Size must be small, medium, or big.' });
  }
  if (!['unassigned', 'other', 'members'].includes(assigned_type)) {
    return res.status(400).json({ error: 'Invalid assigned type.' });
  }
  if (recurrence && !['none', 'weekly', 'bi-weekly', 'monthly', 'quarterly'].includes(recurrence)) {
    return res.status(400).json({ error: 'Invalid recurrence value.' });
  }

  try {
    const task = db
      .prepare('SELECT completed, completed_at, assigned_type, other_assignee, assigned_at FROM tasks WHERE id = ?')
      .get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const isCompleted = completed ? 1 : 0;
    let completedAt = task.completed_at;
    if (isCompleted && !task.completed) {
      completedAt = new Date().toISOString();
    } else if (!isCompleted) {
      completedAt = null;
    }

    const currentMemberRows = db.prepare('SELECT member_id FROM task_members WHERE task_id = ?').all(taskId);
    const currentMemberIds = currentMemberRows
      .map((row) => row.member_id)
      .sort()
      .join(',');
    const newMemberIds = Array.isArray(member_ids) ? member_ids.map(Number).sort().join(',') : '';

    let isAssignmentChanged = false;
    if (task.assigned_type !== assigned_type) {
      isAssignmentChanged = true;
    } else if (assigned_type === 'other' && task.other_assignee !== other_assignee) {
      isAssignmentChanged = true;
    } else if (assigned_type === 'members' && currentMemberIds !== newMemberIds) {
      isAssignmentChanged = true;
    }

    let assignedAt = task.assigned_at;
    if (isAssignmentChanged) {
      assignedAt = assigned_type === 'unassigned' ? null : new Date().toISOString();
    }

    const updateTx = db.transaction(() => {
      db.prepare(
        `
        UPDATE tasks 
        SET title = ?, description = ?, size = ?, category_id = ?, assigned_type = ?, other_assignee = ?, deadline = ?, completed = ?, completed_at = ?, assigned_at = ?, recurrence = ?
        WHERE id = ?
      `
      ).run(
        title.trim(),
        description ? description.trim() : null,
        size,
        category_id ? Number(category_id) : null,
        assigned_type,
        assigned_type === 'other' ? (other_assignee ? other_assignee.trim() : 'Other') : null,
        deadline || null,
        isCompleted,
        completedAt,
        assignedAt,
        recurrence || 'none',
        taskId
      );

      db.prepare('DELETE FROM task_members WHERE task_id = ?').run(taskId);

      if (assigned_type === 'members' && Array.isArray(member_ids) && member_ids.length > 0) {
        const insertMember = db.prepare('INSERT INTO task_members (task_id, member_id) VALUES (?, ?)');
        for (const mId of member_ids) {
          insertMember.run(taskId, Number(mId));
        }
      }

      // If transitioned from incomplete to complete, spawn recurring task copies
      if (isCompleted === 1 && !task.completed && (recurrence || 'none') !== 'none') {
        const updatedTask = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
        handleRecurringSpawn(taskId, updatedTask, db);
      }
    });

    updateTx();
    res.json(getTaskById(taskId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.patch('/:id/toggle', (req, res) => {
  const taskId = req.params.id;
  try {
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(taskId);
    if (!task) {
      return res.status(404).json({ error: 'Task not found.' });
    }

    const nextCompleted = task.completed ? 0 : 1;
    const completedAt = nextCompleted ? new Date().toISOString() : null;

    const toggleTx = db.transaction(() => {
      db.prepare('UPDATE tasks SET completed = ?, completed_at = ? WHERE id = ?').run(
        nextCompleted,
        completedAt,
        taskId
      );

      // Spawn next occurrence if toggled complete
      if (nextCompleted === 1 && task.recurrence !== 'none') {
        handleRecurringSpawn(taskId, task, db);
      }
    });

    toggleTx();
    res.json(getTaskById(taskId));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.delete('/:id', (req, res) => {
  try {
    const info = db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    if (info.changes === 0) {
      return res.status(404).json({ error: 'Task not found.' });
    }
    res.json({ message: 'Task deleted successfully.' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
