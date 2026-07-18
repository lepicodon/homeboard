import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHTML, formatTimestamp, showToast } from '../utils.js';
import { fetchMemos, confirmDelete } from '../app.js';

export function renderMemos() {
  const memosBoard = document.getElementById('memosBoard');
  const memosEmptyState = document.getElementById('memosEmptyState');
  if (!memosBoard) return;

  memosBoard.innerHTML = '';
  if (state.memos.length === 0) {
    if (memosEmptyState) memosEmptyState.classList.remove('hidden');
  } else {
    if (memosEmptyState) memosEmptyState.classList.add('hidden');

    state.memos.forEach((memo, index) => {
      const card = document.createElement('div');
      card.className = 'memo-card';
      card.style.backgroundColor = memo.color;

      const tiltAngle = index % 3 === 0 ? -1.5 : index % 3 === 1 ? 1.2 : -0.8;
      card.style.setProperty('--memo-tilt', `${tiltAngle}deg`);

      let dateBadge = '';
      if (memo.event_date) {
        const evDate = new Date(memo.event_date + 'T00:00:00');
        dateBadge = `
          <div class="memo-card-event-date">
            📅 ${evDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
          </div>`;
      }

      card.innerHTML = `
        <div>
          <div class="memo-card-content">${escapeHTML(memo.content)}</div>
          ${dateBadge}
        </div>
        <div class="memo-card-footer">
          <span>${formatTimestamp(memo.created_at)}</span>
          <div class="memo-card-actions">
            <button class="btn-memo-action edit" title="Edit note">✏️</button>
            <button class="btn-memo-action delete" title="Delete note">🗑️</button>
          </div>
        </div>
      `;

      card.querySelector('.edit').addEventListener('click', () => {
        showMemoModal(memo);
      });
      card.querySelector('.delete').addEventListener('click', () => {
        confirmDelete('memo', memo.id, memo.content.substring(0, 20) + '...');
      });

      memosBoard.appendChild(card);
    });
  }
}

export function showMemoModal(memo = null) {
  const memoForm = document.getElementById('memoForm');
  const memoIdField = document.getElementById('memoIdField');
  const memoContent = document.getElementById('memoContent');
  const memoEventDate = document.getElementById('memoEventDate');
  const memoModal = document.getElementById('memoModal');

  if (!memoForm || !memoModal) return;

  memoForm.reset();
  if (memo) {
    if (memoIdField) memoIdField.value = memo.id;
    if (memoContent) memoContent.value = memo.content;
    if (memoEventDate) memoEventDate.value = memo.event_date || '';
    const titleHeader = document.getElementById('memoModalTitle');
    if (titleHeader) titleHeader.textContent = 'Edit Sticky Note';

    const colorRadio = document.querySelector(`input[name="memoColor"][value="${memo.color}"]`);
    if (colorRadio) colorRadio.checked = true;
  } else {
    if (memoIdField) memoIdField.value = '';
    if (memoEventDate) memoEventDate.value = '';
    const titleHeader = document.getElementById('memoModalTitle');
    if (titleHeader) titleHeader.textContent = 'Add Sticky Note';

    const defaultColorRadio = document.querySelector('input[name="memoColor"][value="#fef08a"]');
    if (defaultColorRadio) defaultColorRadio.checked = true;
  }
  memoModal.showModal();
}

export async function handleMemoFormSubmit(e) {
  e.preventDefault();
  const memoIdField = document.getElementById('memoIdField');
  const memoContent = document.getElementById('memoContent');
  const memoEventDate = document.getElementById('memoEventDate');
  const memoModal = document.getElementById('memoModal');

  const id = memoIdField ? memoIdField.value : null;
  const content = memoContent ? memoContent.value.trim() : '';
  const colorRadio = document.querySelector('input[name="memoColor"]:checked');
  const color = colorRadio ? colorRadio.value : '#fef08a';
  const event_date = memoEventDate ? memoEventDate.value || null : null;

  try {
    const payload = { content, color, event_date };
    await api.saveMemo(id, payload);
    if (memoModal) memoModal.close();
    fetchMemos();
  } catch (err) {
    console.error('Error saving memo:', err);
    showToast('Failed to save memo', 'error');
  }
}

export function initMemosEvents() {
  const addMemoBtn = document.getElementById('addMemoBtn');
  const closeMemoModalBtn = document.getElementById('closeMemoModalBtn');
  const cancelMemoModalBtn = document.getElementById('cancelMemoModalBtn');
  const memoForm = document.getElementById('memoForm');
  const memoModal = document.getElementById('memoModal');

  if (addMemoBtn) {
    addMemoBtn.addEventListener('click', () => showMemoModal());
  }

  if (closeMemoModalBtn) {
    closeMemoModalBtn.addEventListener('click', () => memoModal && memoModal.close());
  }

  if (cancelMemoModalBtn) {
    cancelMemoModalBtn.addEventListener('click', () => memoModal && memoModal.close());
  }

  if (memoForm) {
    memoForm.addEventListener('submit', handleMemoFormSubmit);
  }
}
