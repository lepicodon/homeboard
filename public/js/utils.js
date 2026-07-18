export function escapeHTML(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function formatDateToISOString(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatTimestamp(isoString) {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

export function showToast(message, type = 'success', duration = 4000) {
  let container = document.getElementById('toastContainer');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toastContainer';
    container.className = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  
  const textNode = document.createElement('span');
  textNode.innerText = message;
  toast.appendChild(textNode);

  const closeBtn = document.createElement('button');
  closeBtn.className = 'toast-close';
  closeBtn.innerHTML = '&times;';
  closeBtn.title = 'Dismiss';
  closeBtn.onclick = (e) => {
    e.stopPropagation();
    dismissToast(toast);
  };
  toast.appendChild(closeBtn);

  toast.onclick = () => dismissToast(toast);

  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('show');
  }, 10);

  const timeoutId = setTimeout(() => {
    dismissToast(toast);
  }, duration);

  function dismissToast(el) {
    if (el.classList.contains('hide')) return;
    clearTimeout(timeoutId);
    el.classList.remove('show');
    el.classList.add('hide');
    el.addEventListener('transitionend', () => {
      el.remove();
      if (container.children.length === 0) {
        container.remove();
      }
    });
  }
}

window.showToast = showToast;
