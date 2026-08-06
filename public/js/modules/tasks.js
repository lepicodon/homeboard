import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHTML, formatTimestamp, showToast } from '../utils.js';
import { fetchTasks, confirmDelete } from '../app.js';

export function renderTasks() {
  const tasksGrid = document.getElementById('tasksGrid');
  const progressBar = document.getElementById('progressBar');
  const progressText = document.getElementById('progressText');
  const tasksPagination = document.getElementById('tasksPagination');
  const paginationInfo = document.getElementById('paginationInfo');
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');
  const emptyState = document.getElementById('emptyState');

  if (!tasksGrid) return;
  tasksGrid.innerHTML = '';

  const filteredTasks = state.tasks.filter((task) => {
    const matchesSearch =
      !state.filters.search ||
      task.title.toLowerCase().includes(state.filters.search) ||
      (task.description && task.description.toLowerCase().includes(state.filters.search));

    const matchesStatus =
      state.filters.status === 'all' ||
      (state.filters.status === 'completed' && task.completed) ||
      (state.filters.status === 'pending' && !task.completed);

    const matchesCategory = state.filters.category === 'all' || task.category_id == state.filters.category;
    const matchesSize = state.filters.size === 'all' || task.size === state.filters.size;

    let matchesAssignee = false;
    if (state.filters.assignee === 'all') {
      matchesAssignee = true;
    } else if (state.filters.assignee === 'unassigned') {
      matchesAssignee = task.assigned_type === 'unassigned';
    } else if (state.filters.assignee === 'other') {
      matchesAssignee = task.assigned_type === 'other';
    } else {
      matchesAssignee = task.assigned_type === 'members' && task.assignees.some((m) => m.id == state.filters.assignee);
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesSize && matchesAssignee;
  });

  const totalCount = state.tasks.length;
  const completedCount = state.tasks.filter((t) => t.completed).length;
  const percentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  if (progressBar) progressBar.style.width = `${percentage}%`;
  if (progressText) progressText.textContent = `${completedCount} of ${totalCount} tasks completed`;

  // Pagination check
  let displayTasks = filteredTasks;
  if (state.tasksPerPage !== 'all') {
    const limit = Number(state.tasksPerPage);
    const totalTasksCount = filteredTasks.length;
    const totalPages = Math.max(1, Math.ceil(totalTasksCount / limit));

    if (state.currentPage > totalPages) {
      state.currentPage = totalPages;
    }

    const startIndex = (state.currentPage - 1) * limit;
    const endIndex = startIndex + limit;
    displayTasks = filteredTasks.slice(startIndex, endIndex);

    if (tasksPagination) {
      if (totalTasksCount > limit) {
        tasksPagination.classList.remove('hidden');
        if (paginationInfo) paginationInfo.textContent = `Page ${state.currentPage} of ${totalPages}`;
        if (prevPageBtn) prevPageBtn.disabled = state.currentPage === 1;
        if (nextPageBtn) nextPageBtn.disabled = state.currentPage === totalPages;
      } else {
        tasksPagination.classList.add('hidden');
      }
    }
  } else {
    if (tasksPagination) tasksPagination.classList.add('hidden');
  }

  if (displayTasks.length === 0) {
    if (emptyState) emptyState.classList.remove('hidden');
  } else {
    if (emptyState) emptyState.classList.add('hidden');

    if (state.viewMode === 'assignee') {
      const columns = [];

      // 1. Family member columns
      if (state.members && state.members.length > 0) {
        state.members.forEach((member) => {
          const memberTasks = displayTasks.filter(
            (t) => t.assigned_type === 'members' && t.assignees && t.assignees.some((m) => m.id == member.id)
          );
          columns.push({
            id: `member_${member.id}`,
            name: member.name,
            avatar: member.avatar,
            color: member.color || '#3b82f6',
            tasks: memberTasks
          });
        });
      }

      // 2. Unassigned column (always present)
      const unassignedTasks = displayTasks.filter((t) => t.assigned_type === 'unassigned');
      columns.push({
        id: 'unassigned',
        name: 'Unassigned',
        avatar: null,
        color: '#6b7280',
        tasks: unassignedTasks,
        icon: '❓'
      });

      // 3. Other / external column (always present)
      const otherTasks = displayTasks.filter((t) => t.assigned_type === 'other');
      columns.push({
        id: 'other',
        name: 'Other / External',
        avatar: null,
        color: '#8b5cf6',
        tasks: otherTasks,
        icon: '👤'
      });

      // Filter out columns with 0 tasks so only assignees/categories with active tasks are shown
      const activeColumns = columns.filter((col) => col.tasks.length > 0);

      if (activeColumns.length === 0) {
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        activeColumns.forEach((col) => {
          const colEl = document.createElement('div');
          colEl.className = 'assignee-column';

          const initials = col.name ? col.name.charAt(0).toUpperCase() : '?';
          let avatarHTML = '';
          if (col.avatar) {
            avatarHTML = `<img class="assignee-avatar" src="${escapeHTML(col.avatar)}" alt="${escapeHTML(col.name)}">`;
          } else if (col.icon) {
            avatarHTML = `<div class="assignee-avatar assignee-avatar-icon" style="--avatar-bg: ${col.color}">${col.icon}</div>`;
          } else {
            avatarHTML = `<div class="assignee-avatar" style="--avatar-bg: ${col.color}">${escapeHTML(initials)}</div>`;
          }

          colEl.innerHTML = `
            <div class="assignee-column-header">
              <div class="assignee-header-info">
                ${avatarHTML}
                <span class="assignee-column-title">${escapeHTML(col.name)}</span>
              </div>
              <span class="assignee-count-badge">${col.tasks.length}</span>
            </div>
            <div class="assignee-column-body"></div>
          `;

          const bodyEl = colEl.querySelector('.assignee-column-body');
          col.tasks.forEach((task) => {
            const card = createTaskCard(task);
            bodyEl.appendChild(card);
          });

          tasksGrid.appendChild(colEl);
        });
      }
    } else {
      displayTasks.forEach((task) => {
        const card = createTaskCard(task);
        tasksGrid.appendChild(card);
      });
    }
  }
}

export function createTaskCard(task) {
  const card = document.createElement('div');
  card.className = `task-card ${task.completed ? 'completed' : ''}`;

  if (task.category_color) {
    card.style.setProperty('--task-card-accent', task.category_color);
  }

  let deadlineHTML = '';
  if (task.deadline) {
    const due = new Date(task.deadline + 'T00:00:00');
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);

    const diffTime = due.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    let badgeClass = 'due-upcoming';
    let badgeText = due.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

    if (diffDays < 0) {
      badgeClass = 'due-overdue';
      badgeText = `Overdue (${Math.abs(diffDays)}d)`;
    } else if (diffDays === 0) {
      badgeClass = 'due-today';
      badgeText = 'Due Today';
    } else if (diffDays === 1) {
      badgeClass = 'due-today';
      badgeText = 'Due Tomorrow';
    }

    deadlineHTML = `<span class="due-badge ${badgeClass}">📅 ${badgeText}</span>`;
  }

  const sizeLabels = { small: '🟢 Small', medium: '🟡 Medium', big: '🔴 Big' };
  const recurrenceLabels = {
    none: '',
    weekly: '🔄 Weekly',
    'bi-weekly': '🔄 Bi-weekly',
    monthly: '🔄 Monthly',
    quarterly: '🔄 Quarterly'
  };

  let assigneeHTML = '';
  if (task.assigned_type === 'members') {
    if (task.assignees && task.assignees.length > 0) {
      assigneeHTML = `<div class="badge-assignees">`;
      task.assignees.forEach((m) => {
        const initials = m.name ? m.name.charAt(0) : '?';
        if (m.avatar) {
          assigneeHTML += `<img class="assignee-avatar" src="${m.avatar}" title="${escapeHTML(m.name)}" alt="${escapeHTML(m.name)}">`;
        } else {
          assigneeHTML += `<div class="assignee-avatar" style="--avatar-bg: ${m.color}" title="${escapeHTML(m.name)}">${escapeHTML(initials)}</div>`;
        }
      });
      assigneeHTML += `</div>`;
    } else {
      assigneeHTML = '<span class="assignee-unassigned">Family (unassigned)</span>';
    }
  } else if (task.assigned_type === 'other') {
    const escOther = escapeHTML(task.other_assignee || 'Other');
    assigneeHTML = `<span class="assignee-external" title="${escOther}">👤 ${escOther}</span>`;
  } else {
    assigneeHTML = '<span class="assignee-unassigned">❔ Unassigned</span>';
  }

  let timestampsHTML = `<div class="task-timestamps">`;
  if (task.created_at || task.assigned_at || task.completed_at) {
    if (task.created_at) {
      timestampsHTML += `
        <div class="timestamp-item">
          <span>Created:</span>
          <span>${formatTimestamp(task.created_at)}</span>
        </div>`;
    }
    if (task.assigned_type !== 'unassigned' && task.assigned_at) {
      timestampsHTML += `
        <div class="timestamp-item">
          <span>Assigned:</span>
          <span>${formatTimestamp(task.assigned_at)}</span>
        </div>`;
    }
    if (task.completed && task.completed_at) {
      timestampsHTML += `
        <div class="timestamp-item">
          <span>Completed:</span>
          <span>${formatTimestamp(task.completed_at)}</span>
        </div>`;
    }
  }
  timestampsHTML += `</div>`;

  const recVal = task.recurrence || 'none';
  const recurrenceHTML = recVal !== 'none' ? `<span class="tag tag-recurrence">${recurrenceLabels[recVal]}</span>` : '';

  card.innerHTML = `
    <div class="task-header">
      <div class="task-tags">
        <span class="tag tag-size-${task.size}">${sizeLabels[task.size]}</span>
        ${task.category_name ? `<span class="tag tag-category" style="--tag-cat-bg: ${task.category_color}1a; --tag-cat-fg: ${task.category_color}">${escapeHTML(task.category_name)}</span>` : ''}
        ${recurrenceHTML}
      </div>
      <div class="task-check-wrapper">
        <input type="checkbox" class="checkbox-custom" ${task.completed ? 'checked' : ''} aria-label="Mark task as complete">
      </div>
    </div>
    
    <div class="task-body">
      <h3 class="task-title">${escapeHTML(task.title)}</h3>
      ${task.description ? `<p class="task-desc">${escapeHTML(task.description)}</p>` : ''}
    </div>
    
    <div class="task-meta">
      <div class="meta-row meta-row-who">
        <span class="meta-label">Who:</span>
        <div>${assigneeHTML}</div>
      </div>
      ${
        task.deadline
          ? `
      <div class="meta-row">
        <span class="meta-label">Deadline:</span>
        <div>${deadlineHTML}</div>
      </div>`
          : ''
      }
    </div>

    ${timestampsHTML}
    
    <div class="task-footer">
      <button class="btn-action edit" title="Edit Task">✏️</button>
      <button class="btn-action delete" title="Delete Task">🗑️</button>
    </div>
  `;

  const checkbox = card.querySelector('.checkbox-custom');
  checkbox.addEventListener('change', () => toggleTaskCompleted(task.id));

  const editBtn = card.querySelector('.btn-action.edit');
  editBtn.addEventListener('click', () => showTaskModal(task));

  const deleteBtn = card.querySelector('.btn-action.delete');
  deleteBtn.addEventListener('click', () => confirmDelete('task', task.id, task.title));

  card.addEventListener('click', (e) => {
    if (
      state.viewMode === 'assignee' &&
      !e.target.closest('.checkbox-custom') &&
      !e.target.closest('.task-check-wrapper')
    ) {
      showTaskModal(task);
    }
  });

  return card;
}

export function showTaskModal(task = null) {
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const taskIdField = document.getElementById('taskIdField');
  const taskTitle = document.getElementById('taskTitle');
  const taskDescription = document.getElementById('taskDescription');
  const taskCategory = document.getElementById('taskCategory');
  const taskAssignedType = document.getElementById('taskAssignedType');
  const taskDeadline = document.getElementById('taskDeadline');
  const taskRecurrence = document.getElementById('taskRecurrence');
  const taskOtherAssignee = document.getElementById('taskOtherAssignee');
  const otherAssigneeGroup = document.getElementById('otherAssigneeGroup');
  const familyAssigneeGroup = document.getElementById('familyAssigneeGroup');

  if (!taskModal || !taskForm) return;

  taskForm.reset();

  if (task) {
    state.currentEditingTaskId = task.id;
    if (taskIdField) taskIdField.value = task.id;
    if (taskTitle) taskTitle.value = task.title;
    if (taskDescription) taskDescription.value = task.description || '';
    if (taskCategory) taskCategory.value = task.category_id || '';
    if (taskAssignedType) taskAssignedType.value = task.assigned_type;
    if (taskDeadline) taskDeadline.value = task.deadline || '';
    if (taskRecurrence) taskRecurrence.value = task.recurrence || 'none';

    const sizeRadio = document.querySelector(`input[name="taskSize"][value="${task.size}"]`);
    if (sizeRadio) sizeRadio.checked = true;

    if (task.assigned_type === 'members') {
      if (otherAssigneeGroup) otherAssigneeGroup.classList.add('hidden');
      if (familyAssigneeGroup) familyAssigneeGroup.classList.remove('hidden');

      document.querySelectorAll('.family-checkbox').forEach((cb) => {
        cb.checked = task.assignees.some((m) => m.id == cb.value);
      });
    } else if (task.assigned_type === 'other') {
      if (otherAssigneeGroup) otherAssigneeGroup.classList.remove('hidden');
      if (familyAssigneeGroup) familyAssigneeGroup.classList.add('hidden');
      if (taskOtherAssignee) taskOtherAssignee.value = task.other_assignee || '';
    } else {
      if (otherAssigneeGroup) otherAssigneeGroup.classList.add('hidden');
      if (familyAssigneeGroup) familyAssigneeGroup.classList.add('hidden');
    }

    const titleHeader = document.getElementById('taskModalTitle');
    if (titleHeader) titleHeader.textContent = 'Edit Task';
  } else {
    state.currentEditingTaskId = null;
    if (taskIdField) taskIdField.value = '';

    const smallRadio = document.querySelector('input[name="taskSize"][value="small"]');
    if (smallRadio) smallRadio.checked = true;

    if (otherAssigneeGroup) otherAssigneeGroup.classList.add('hidden');
    if (familyAssigneeGroup) familyAssigneeGroup.classList.add('hidden');

    const titleHeader = document.getElementById('taskModalTitle');
    if (titleHeader) titleHeader.textContent = 'Create Task';
  }

  taskModal.showModal();
}

export async function handleTaskFormSubmit(e) {
  e.preventDefault();

  const taskIdField = document.getElementById('taskIdField');
  const taskTitle = document.getElementById('taskTitle');
  const taskDescription = document.getElementById('taskDescription');
  const taskCategory = document.getElementById('taskCategory');
  const taskAssignedType = document.getElementById('taskAssignedType');
  const taskOtherAssignee = document.getElementById('taskOtherAssignee');
  const taskDeadline = document.getElementById('taskDeadline');
  const taskRecurrence = document.getElementById('taskRecurrence');
  const taskModal = document.getElementById('taskModal');

  const id = taskIdField ? taskIdField.value : null;
  const title = taskTitle ? taskTitle.value.trim() : '';
  const description = taskDescription ? taskDescription.value.trim() : '';
  const sizeRadio = document.querySelector('input[name="taskSize"]:checked');
  const size = sizeRadio ? sizeRadio.value : 'small';
  const category_id = taskCategory ? taskCategory.value || null : null;
  const assigned_type = taskAssignedType ? taskAssignedType.value : 'unassigned';
  const other_assignee = taskOtherAssignee ? taskOtherAssignee.value.trim() : '';
  const deadline = taskDeadline ? taskDeadline.value || null : null;
  const recurrence = taskRecurrence ? taskRecurrence.value : 'none';

  const member_ids = [];
  if (assigned_type === 'members') {
    document.querySelectorAll('.family-checkbox:checked').forEach((cb) => {
      member_ids.push(cb.value);
    });
  }

  const payload = {
    title,
    description,
    size,
    category_id,
    assigned_type,
    other_assignee,
    deadline,
    recurrence,
    member_ids
  };

  try {
    if (id) {
      const existingTask = state.tasks.find((t) => t.id == id);
      payload.completed = existingTask ? existingTask.completed : false;
    }

    await api.saveTask(id, payload);
    if (taskModal) taskModal.close();
    fetchTasks();
  } catch (err) {
    console.error('Error saving task:', err);
    showToast(err.message || 'Failed to save task.', 'error');
  }
}

export async function toggleTaskCompleted(taskId) {
  try {
    await api.toggleTask(taskId);
    fetchTasks();
  } catch (err) {
    console.error('Error toggling task:', err);
  }
}

export function initFilters() {
  const searchInput = document.getElementById('searchInput');
  const filterStatus = document.getElementById('filterStatus');
  const filterCategory = document.getElementById('filterCategory');
  const filterSize = document.getElementById('filterSize');
  const filterAssignee = document.getElementById('filterAssignee');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.filters.search = e.target.value.toLowerCase().trim();
      state.currentPage = 1;
      renderTasks();
    });
  }

  if (filterStatus) {
    filterStatus.addEventListener('change', (e) => {
      state.filters.status = e.target.value;
      state.currentPage = 1;
      renderTasks();
    });
  }

  if (filterCategory) {
    filterCategory.addEventListener('change', (e) => {
      state.filters.category = e.target.value;
      state.currentPage = 1;
      renderTasks();
    });
  }

  if (filterSize) {
    filterSize.addEventListener('change', (e) => {
      state.filters.size = e.target.value;
      state.currentPage = 1;
      renderTasks();
    });
  }

  if (filterAssignee) {
    filterAssignee.addEventListener('change', (e) => {
      state.filters.assignee = e.target.value;
      state.currentPage = 1;
      renderTasks();
    });
  }
}

export function initModals() {
  const addTaskBtn = document.getElementById('addTaskBtn');
  const closeTaskModalBtn = document.getElementById('closeTaskModalBtn');
  const cancelTaskModalBtn = document.getElementById('cancelTaskModalBtn');
  const taskModal = document.getElementById('taskModal');
  const taskForm = document.getElementById('taskForm');
  const taskAssignedType = document.getElementById('taskAssignedType');
  const otherAssigneeGroup = document.getElementById('otherAssigneeGroup');
  const familyAssigneeGroup = document.getElementById('familyAssigneeGroup');

  if (addTaskBtn) {
    addTaskBtn.addEventListener('click', () => showTaskModal());
  }

  if (closeTaskModalBtn) {
    closeTaskModalBtn.addEventListener('click', () => taskModal && taskModal.close());
  }

  if (cancelTaskModalBtn) {
    cancelTaskModalBtn.addEventListener('click', () => taskModal && taskModal.close());
  }

  if (taskForm) {
    taskForm.addEventListener('submit', handleTaskFormSubmit);
  }

  if (taskAssignedType) {
    taskAssignedType.addEventListener('change', (e) => {
      const type = e.target.value;
      if (type === 'members') {
        if (otherAssigneeGroup) otherAssigneeGroup.classList.add('hidden');
        if (familyAssigneeGroup) familyAssigneeGroup.classList.remove('hidden');
      } else if (type === 'other') {
        if (otherAssigneeGroup) otherAssigneeGroup.classList.remove('hidden');
        if (familyAssigneeGroup) familyAssigneeGroup.classList.add('hidden');
      } else {
        if (otherAssigneeGroup) otherAssigneeGroup.classList.add('hidden');
        if (familyAssigneeGroup) familyAssigneeGroup.classList.add('hidden');
      }
    });
  }
}

export function initPaginationEvents() {
  const prevPageBtn = document.getElementById('prevPageBtn');
  const nextPageBtn = document.getElementById('nextPageBtn');

  if (prevPageBtn) {
    prevPageBtn.addEventListener('click', () => {
      if (state.currentPage > 1) {
        state.currentPage--;
        renderTasks();
      }
    });
  }

  if (nextPageBtn) {
    nextPageBtn.addEventListener('click', () => {
      state.currentPage++;
      renderTasks();
    });
  }
}

export function handlePrintChecklist() {
  const printTableBody = document.getElementById('printTableBody');
  const printTable = document.getElementById('printTable');
  const printAssigneeView = document.getElementById('printAssigneeView');
  const printTitle = document.getElementById('printTitle');
  const printDateLabel = document.getElementById('printDate');

  if (!printTableBody) return;

  const now = new Date();
  if (printDateLabel) {
    printDateLabel.textContent = `Date: ${now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  const filteredTasksForPrint = state.tasks.filter((task) => {
    const matchesSearch =
      !state.filters.search ||
      task.title.toLowerCase().includes(state.filters.search) ||
      (task.description && task.description.toLowerCase().includes(state.filters.search));

    const matchesStatus =
      state.filters.status === 'all' ||
      (state.filters.status === 'completed' && task.completed) ||
      (state.filters.status === 'pending' && !task.completed);

    const matchesCategory = state.filters.category === 'all' || task.category_id == state.filters.category;
    const matchesSize = state.filters.size === 'all' || task.size === state.filters.size;

    let matchesAssignee = false;
    if (state.filters.assignee === 'all') {
      matchesAssignee = true;
    } else if (state.filters.assignee === 'unassigned') {
      matchesAssignee = task.assigned_type === 'unassigned';
    } else if (state.filters.assignee === 'other') {
      matchesAssignee = task.assigned_type === 'other';
    } else {
      matchesAssignee = task.assigned_type === 'members' && task.assignees.some((m) => m.id == state.filters.assignee);
    }

    return matchesSearch && matchesStatus && matchesCategory && matchesSize && matchesAssignee;
  });

  if (state.viewMode === 'assignee') {
    if (printTitle) printTitle.textContent = '🏠 HomeBoard - Tasks by Assignee';
    if (printTable) printTable.style.display = 'none';
    if (printAssigneeView) {
      printAssigneeView.style.display = 'block';
      printAssigneeView.innerHTML = '';

      if (filteredTasksForPrint.length === 0) {
        printAssigneeView.innerHTML =
          '<div style="text-align: center; font-style: italic; padding: 20px;">No tasks found matching current filters.</div>';
      } else {
        const columns = [];
        if (state.members && state.members.length > 0) {
          state.members.forEach((member) => {
            const memberTasks = filteredTasksForPrint.filter(
              (t) => t.assigned_type === 'members' && t.assignees && t.assignees.some((m) => m.id == member.id)
            );
            if (memberTasks.length > 0) {
              columns.push({ name: member.name, tasks: memberTasks });
            }
          });
        }

        const unassignedTasks = filteredTasksForPrint.filter((t) => t.assigned_type === 'unassigned');
        if (unassignedTasks.length > 0) {
          columns.push({ name: 'Unassigned', tasks: unassignedTasks });
        }

        const otherTasks = filteredTasksForPrint.filter((t) => t.assigned_type === 'other');
        if (otherTasks.length > 0) {
          columns.push({ name: 'Other / External', tasks: otherTasks });
        }

        const gridEl = document.createElement('div');
        gridEl.className = 'print-assignee-grid';

        columns.forEach((col) => {
          const sectionEl = document.createElement('div');
          sectionEl.className = 'print-assignee-section';

          let itemsHTML = '';
          col.tasks.forEach((task) => {
            let dueText = '';
            if (task.deadline) {
              dueText = new Date(task.deadline + 'T00:00:00').toLocaleDateString(undefined, {
                month: 'short',
                day: 'numeric'
              });
            }

            itemsHTML += `
              <div class="print-assignee-item">
                <div class="print-checkbox ${task.completed ? 'checked' : ''}"></div>
                <div class="print-assignee-item-details">
                  <div class="print-task-title">${escapeHTML(task.title)}</div>
                  ${task.description ? `<div class="print-task-desc">${escapeHTML(task.description)}</div>` : ''}
                  <div class="print-assignee-meta">
                    ${task.category_name ? `<span class="print-meta-badge">${escapeHTML(task.category_name)}</span>` : ''}
                    <span class="print-meta-badge print-size-badge">${escapeHTML(task.size)}</span>
                    ${dueText ? `<span class="print-meta-badge">📅 ${dueText}</span>` : ''}
                  </div>
                </div>
              </div>
            `;
          });

          sectionEl.innerHTML = `
            <div class="print-assignee-header">
              <h3>${escapeHTML(col.name)}</h3>
              <span class="print-assignee-count">${col.tasks.length} task${col.tasks.length === 1 ? '' : 's'}</span>
            </div>
            <div class="print-assignee-list">
              ${itemsHTML}
            </div>
          `;
          gridEl.appendChild(sectionEl);
        });

        printAssigneeView.appendChild(gridEl);
      }
    }
  } else {
    if (printTitle) printTitle.textContent = '🏠 HomeBoard - Chores & Task List';
    if (printAssigneeView) printAssigneeView.style.display = 'none';
    if (printTable) printTable.style.display = 'table';

    printTableBody.innerHTML = '';
    if (filteredTasksForPrint.length === 0) {
      printTableBody.innerHTML =
        '<tr><td colspan="6" style="text-align: center; font-style: italic; padding: 20px;">No tasks found matching current filters.</td></tr>';
    } else {
      filteredTasksForPrint.forEach((task) => {
        const tr = document.createElement('tr');

        let assigneeText = 'Unassigned';
        if (task.assigned_type === 'other') {
          assigneeText = task.other_assignee || 'Other';
        } else if (task.assigned_type === 'members' && task.assignees && task.assignees.length > 0) {
          assigneeText = task.assignees.map((m) => m.name).join(', ');
        }

        let dueText = '';
        if (task.deadline) {
          dueText = new Date(task.deadline + 'T00:00:00').toLocaleDateString(undefined, {
            month: 'short',
            day: 'numeric'
          });
        }

        tr.innerHTML = `
          <td style="text-align: center;">
            <div class="print-checkbox ${task.completed ? 'checked' : ''}"></div>
          </td>
          <td>
            <div class="print-task-title">${escapeHTML(task.title)}</div>
            ${task.description ? `<div class="print-task-desc">${escapeHTML(task.description)}</div>` : ''}
          </td>
          <td>${task.category_name ? escapeHTML(task.category_name) : '-'}</td>
          <td style="text-transform: capitalize;">
            <span class="print-size-badge">${task.size}</span>
          </td>
          <td>${escapeHTML(assigneeText)}</td>
          <td>${dueText || '-'}</td>
        `;
        printTableBody.appendChild(tr);
      });
    }
  }

  document.body.classList.add('print-mode-tasks');
  window.print();

  setTimeout(() => {
    document.body.classList.remove('print-mode-tasks');
  }, 500);
}
