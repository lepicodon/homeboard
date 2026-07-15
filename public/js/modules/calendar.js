import { state } from '../state.js';
import { formatDateToISOString } from '../utils.js';
import { showTaskModal } from './tasks.js';
import { showMemoModal } from './memos.js';

export function renderCalendar() {
  const calendarGrid = document.getElementById('calendarGrid');
  const calMonthYearLabel = document.getElementById('calMonthYearLabel');
  if (!calendarGrid) return;

  calendarGrid.innerHTML = '';

  const year = state.currentCalendarDate.getFullYear();
  const month = state.currentCalendarDate.getMonth();

  const tempDate = new Date(year, month, 1);
  if (calMonthYearLabel) {
    calMonthYearLabel.textContent = tempDate.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }

  const firstDayIndex = new Date(year, month, 1).getDay();
  const totalDays = new Date(year, month + 1, 0).getDate();
  const prevTotalDays = new Date(year, month, 0).getDate();

  const today = new Date();

  for (let i = firstDayIndex; i > 0; i--) {
    const day = prevTotalDays - i + 1;
    const prevMonthDate = new Date(year, month - 1, day);
    const cell = createCalendarCell(prevMonthDate, day, true);
    calendarGrid.appendChild(cell);
  }

  for (let day = 1; day <= totalDays; day++) {
    const currentDate = new Date(year, month, day);
    const isToday =
      currentDate.getDate() === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear();
    const cell = createCalendarCell(currentDate, day, false, isToday);
    calendarGrid.appendChild(cell);
  }

  const totalCellsWritten = firstDayIndex + totalDays;
  const remainingPadding = (7 - (totalCellsWritten % 7)) % 7;
  const totalGridCapacity = totalCellsWritten + remainingPadding > 35 ? 42 : 35;
  const paddingRequired = totalGridCapacity - totalCellsWritten;

  for (let day = 1; day <= paddingRequired; day++) {
    const nextMonthDate = new Date(year, month + 1, day);
    const cell = createCalendarCell(nextMonthDate, day, true);
    calendarGrid.appendChild(cell);
  }
}

export function createCalendarCell(dateObj, dayNum, isOtherMonth = false, isToday = false) {
  const cell = document.createElement('div');
  cell.className = `calendar-cell ${isOtherMonth ? 'other-month' : ''} ${isToday ? 'today' : ''}`;

  const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const weekdayLabel = weekdays[dateObj.getDay()];

  cell.innerHTML = `
    <span class="cell-day-num">
      <span class="day-number">${dayNum}</span>
      <span class="day-name">${weekdayLabel}</span>
    </span>
    <div class="calendar-tasks-container"></div>
  `;

  const tasksContainer = cell.querySelector('.calendar-tasks-container');
  const dateStr = formatDateToISOString(dateObj);

  // 1. Render event-linked memos
  const dayMemos = state.memos.filter((memo) => memo.event_date === dateStr);
  dayMemos.forEach((memo) => {
    const pill = document.createElement('div');
    pill.className = 'cal-memo-pill';
    pill.style.setProperty('--memo-pill-bg', memo.color);
    pill.textContent = `📌 ${memo.content}`;
    pill.title = memo.content;

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      showMemoModal(memo);
    });

    tasksContainer.appendChild(pill);
  });

  // 2. Render deadline chores
  const dayTasks = state.tasks.filter((task) => task.deadline === dateStr);
  dayTasks.forEach((task) => {
    const pill = document.createElement('div');
    pill.className = `cal-task-pill ${task.completed ? 'completed' : ''}`;
    pill.textContent = task.title;
    pill.title = `${task.title} (${task.size})`;

    if (task.category_color) {
      pill.style.setProperty('--tag-cat-bg', `${task.category_color}1c`);
      pill.style.setProperty('--tag-cat-fg', task.category_color);
    }

    pill.addEventListener('click', (e) => {
      e.stopPropagation();
      showTaskModal(task);
    });

    tasksContainer.appendChild(pill);
  });

  return cell;
}

export function initCalendarControls() {
  const calTodayBtn = document.getElementById('calTodayBtn');
  const calPrevBtn = document.getElementById('calPrevBtn');
  const calNextBtn = document.getElementById('calNextBtn');

  if (calTodayBtn) {
    calTodayBtn.addEventListener('click', () => {
      state.currentCalendarDate = new Date();
      renderCalendar();
    });
  }

  if (calPrevBtn) {
    calPrevBtn.addEventListener('click', () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() - 1);
      renderCalendar();
    });
  }

  if (calNextBtn) {
    calNextBtn.addEventListener('click', () => {
      state.currentCalendarDate.setMonth(state.currentCalendarDate.getMonth() + 1);
      renderCalendar();
    });
  }
}
