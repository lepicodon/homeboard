import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHTML } from '../utils.js';
import {
  fetchCategories,
  fetchMembers,
  fetchShoppingCategories,
  fetchShopping,
  fetchTasks,
  fetchSettings,
  fetchWeather,
  confirmDelete
} from '../app.js';

export function renderCategories() {
  const filterCategory = document.getElementById('filterCategory');
  const taskCategory = document.getElementById('taskCategory');
  const categoriesList = document.getElementById('categoriesList');

  if (filterCategory) {
    const currentVal = filterCategory.value;
    filterCategory.innerHTML = '<option value="all">All Categories</option>';
    state.categories.forEach((cat) => {
      filterCategory.innerHTML += `<option value="${cat.id}">${escapeHTML(cat.name)}</option>`;
    });
    filterCategory.value = currentVal;
  }

  if (taskCategory) {
    taskCategory.innerHTML = '<option value="">-- Select Category --</option>';
    state.categories.forEach((cat) => {
      taskCategory.innerHTML += `<option value="${cat.id}">${escapeHTML(cat.name)}</option>`;
    });
  }

  if (categoriesList) {
    categoriesList.innerHTML = '';
    state.categories.forEach((cat) => {
      const li = document.createElement('li');
      li.className = 'settings-item';
      li.innerHTML = `
        <div class="settings-item-info">
          <span class="color-dot" style="background-color: ${cat.color}"></span>
          <span class="settings-item-name">${escapeHTML(cat.name)}</span>
        </div>
        <div class="settings-item-actions">
          <button class="btn-action edit" title="Edit Category">✏️</button>
          <button class="btn-action delete" title="Delete Category">🗑️</button>
        </div>
      `;

      li.querySelector('.btn-action.edit').addEventListener('click', () => {
        startEditCategory(cat);
      });
      li.querySelector('.btn-action.delete').addEventListener('click', () => {
        confirmDelete('category', cat.id, cat.name);
      });

      categoriesList.appendChild(li);
    });
  }
}

export async function handleCategoryFormSubmit(e) {
  e.preventDefault();
  const categoryIdField = document.getElementById('categoryIdField');
  const categoryNameInput = document.getElementById('categoryName');
  const categoryColorInput = document.getElementById('categoryColor');

  const id = categoryIdField ? categoryIdField.value : null;
  const name = categoryNameInput ? categoryNameInput.value.trim() : '';
  const color = categoryColorInput ? categoryColorInput.value : '';

  try {
    await api.saveCategory(id, { name, color });
    resetCategoryForm();
    await fetchCategories();
    fetchTasks();
  } catch (err) {
    console.error('Error saving category:', err);
    alert(err.message || 'Failed to save category');
  }
}

export function startEditCategory(cat) {
  const categoryIdField = document.getElementById('categoryIdField');
  const categoryNameInput = document.getElementById('categoryName');
  const categoryColorInput = document.getElementById('categoryColor');
  const categoryFormTitle = document.getElementById('categoryFormTitle');
  const categoryFormSubmitBtn = document.getElementById('categoryFormSubmitBtn');
  const cancelCategoryEditBtn = document.getElementById('cancelCategoryEditBtn');

  if (categoryIdField) categoryIdField.value = cat.id;
  if (categoryNameInput) {
    categoryNameInput.value = cat.name;
    categoryNameInput.focus();
  }
  if (categoryColorInput) categoryColorInput.value = cat.color;
  if (categoryFormTitle) categoryFormTitle.textContent = 'Edit Category';
  if (categoryFormSubmitBtn) categoryFormSubmitBtn.textContent = 'Save Changes';
  if (cancelCategoryEditBtn) cancelCategoryEditBtn.classList.remove('hidden');
}

export function resetCategoryForm() {
  const addCategoryForm = document.getElementById('addCategoryForm');
  const categoryIdField = document.getElementById('categoryIdField');
  const categoryFormTitle = document.getElementById('categoryFormTitle');
  const categoryFormSubmitBtn = document.getElementById('categoryFormSubmitBtn');
  const cancelCategoryEditBtn = document.getElementById('cancelCategoryEditBtn');

  if (addCategoryForm) addCategoryForm.reset();
  if (categoryIdField) categoryIdField.value = '';
  if (categoryFormTitle) categoryFormTitle.textContent = 'Task Categories';
  if (categoryFormSubmitBtn) categoryFormSubmitBtn.textContent = 'Add Category';
  if (cancelCategoryEditBtn) cancelCategoryEditBtn.classList.add('hidden');
}

export function renderMembers() {
  const filterAssignee = document.getElementById('filterAssignee');
  const familyCheckboxList = document.getElementById('familyCheckboxList');
  const membersList = document.getElementById('membersList');

  if (filterAssignee) {
    const currentVal = filterAssignee.value;
    filterAssignee.innerHTML = '<option value="all">All Assignees</option>';
    state.members.forEach((m) => {
      filterAssignee.innerHTML += `<option value="${m.id}">${escapeHTML(m.name)}</option>`;
    });
    filterAssignee.innerHTML += `
      <option value="unassigned">Unassigned</option>
      <option value="other">Other</option>
    `;
    filterAssignee.value = currentVal;
  }

  if (familyCheckboxList) {
    familyCheckboxList.innerHTML = '';
    if (state.members.length === 0) {
      familyCheckboxList.innerHTML =
        '<p style="font-size: 13px; color: var(--text-muted); font-style: italic;">No family members defined. Add them in Settings.</p>';
    } else {
      state.members.forEach((m) => {
        familyCheckboxList.innerHTML += `
          <label class="family-check-label">
            <input type="checkbox" class="family-checkbox" value="${m.id}">
            ${
              m.avatar
                ? `
              <img class="settings-item-avatar" style="width:16px; height:16px;" src="${m.avatar}" alt="${m.name}">
            `
                : `
              <span class="color-dot" style="width:10px; height:10px; background-color: ${m.color}"></span>
            `
            }
            <span>${escapeHTML(m.name)}</span>
          </label>
        `;
      });
    }
  }

  if (membersList) {
    membersList.innerHTML = '';
    state.members.forEach((m) => {
      const li = document.createElement('li');
      li.className = 'settings-item';

      let avatarHTML = '';
      if (m.avatar) {
        avatarHTML = `<img class="settings-item-avatar" src="${m.avatar}" alt="${m.name}">`;
      } else {
        avatarHTML = `<div class="settings-item-avatar" style="--avatar-bg: ${m.color}">${m.name.charAt(0)}</div>`;
      }

      li.innerHTML = `
        <div class="settings-item-info">
          ${avatarHTML}
          <span class="settings-item-name">${escapeHTML(m.name)}</span>
        </div>
        <div class="settings-item-actions">
          <button class="btn-action edit" title="Edit Member">✏️</button>
          <button class="btn-action delete" title="Delete Member">🗑️</button>
        </div>
      `;

      li.querySelector('.btn-action.edit').addEventListener('click', () => {
        startEditMember(m);
      });
      li.querySelector('.btn-action.delete').addEventListener('click', () => {
        confirmDelete('member', m.id, m.name);
      });

      membersList.appendChild(li);
    });
  }
}

export async function handleMemberFormSubmit(e) {
  e.preventDefault();
  const memberIdField = document.getElementById('memberIdField');
  const memberNameInput = document.getElementById('memberName');
  const memberColorInput = document.getElementById('memberColor');
  const avatarImage = document.getElementById('avatarImage');

  const id = memberIdField ? memberIdField.value : null;
  const name = memberNameInput ? memberNameInput.value.trim() : '';
  const color = memberColorInput ? memberColorInput.value : '';

  let avatar = null;
  if (avatarImage && !avatarImage.classList.contains('hidden') && avatarImage.src.startsWith('data:image')) {
    avatar = avatarImage.src;
  }

  try {
    await api.saveMember(id, { name, color, avatar });
    resetMemberForm();
    await fetchMembers();
    fetchTasks();
  } catch (err) {
    console.error('Error saving member:', err);
    alert(err.message || 'Failed to save family member');
  }
}

export function startEditMember(m) {
  const memberIdField = document.getElementById('memberIdField');
  const memberNameInput = document.getElementById('memberName');
  const memberColorInput = document.getElementById('memberColor');
  const memberFormTitle = document.getElementById('memberFormTitle');
  const memberFormSubmitBtn = document.getElementById('memberFormSubmitBtn');
  const cancelMemberEditBtn = document.getElementById('cancelMemberEditBtn');
  const avatarImage = document.getElementById('avatarImage');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const removeAvatarBtn = document.getElementById('removeAvatarBtn');

  if (memberIdField) memberIdField.value = m.id;
  if (memberNameInput) {
    memberNameInput.value = m.name;
    memberNameInput.focus();
  }
  if (memberColorInput) memberColorInput.value = m.color;
  if (memberFormTitle) memberFormTitle.textContent = 'Edit Family Member';
  if (memberFormSubmitBtn) memberFormSubmitBtn.textContent = 'Save Changes';
  if (cancelMemberEditBtn) cancelMemberEditBtn.classList.remove('hidden');

  if (avatarImage && avatarPlaceholder && removeAvatarBtn) {
    if (m.avatar) {
      avatarImage.src = m.avatar;
      avatarImage.classList.remove('hidden');
      avatarPlaceholder.classList.add('hidden');
      removeAvatarBtn.classList.remove('hidden');
    } else {
      avatarImage.src = '';
      avatarImage.classList.add('hidden');
      avatarPlaceholder.textContent = m.name.charAt(0) || '?';
      avatarPlaceholder.classList.remove('hidden');
      removeAvatarBtn.classList.add('hidden');
    }
  }
}

export function resetMemberForm() {
  const addMemberForm = document.getElementById('addMemberForm');
  const memberIdField = document.getElementById('memberIdField');
  const memberFormTitle = document.getElementById('memberFormTitle');
  const memberFormSubmitBtn = document.getElementById('memberFormSubmitBtn');
  const cancelMemberEditBtn = document.getElementById('cancelMemberEditBtn');
  const memberAvatar = document.getElementById('memberAvatar');
  const avatarImage = document.getElementById('avatarImage');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const removeAvatarBtn = document.getElementById('removeAvatarBtn');

  if (addMemberForm) addMemberForm.reset();
  if (memberIdField) memberIdField.value = '';
  if (memberFormTitle) memberFormTitle.textContent = 'Family Members';
  if (memberFormSubmitBtn) memberFormSubmitBtn.textContent = 'Add Family Member';
  if (cancelMemberEditBtn) cancelMemberEditBtn.classList.add('hidden');

  if (memberAvatar) memberAvatar.value = '';
  if (avatarImage) {
    avatarImage.src = '';
    avatarImage.classList.add('hidden');
  }
  if (avatarPlaceholder) {
    avatarPlaceholder.textContent = '?';
    avatarPlaceholder.classList.remove('hidden');
  }
  if (removeAvatarBtn) removeAvatarBtn.classList.add('hidden');
}

export function renderShoppingCategories() {
  const shoppingItemCategory = document.getElementById('shoppingItemCategory');
  const shoppingCategoriesList = document.getElementById('shoppingCategoriesList');
  if (!shoppingItemCategory) return;

  const currentVal = shoppingItemCategory.value;
  shoppingItemCategory.innerHTML = '';
  state.shoppingCategories.forEach((cat) => {
    shoppingItemCategory.innerHTML += `<option value="${escapeHTML(cat.name)}">${escapeHTML(cat.name)}</option>`;
  });
  if (currentVal && state.shoppingCategories.some((c) => c.name === currentVal)) {
    shoppingItemCategory.value = currentVal;
  } else {
    shoppingItemCategory.value = 'Other';
  }

  if (shoppingCategoriesList) {
    shoppingCategoriesList.innerHTML = '';
    state.shoppingCategories.forEach((cat) => {
      const li = document.createElement('li');
      li.className = 'settings-item';
      li.innerHTML = `
        <div class="settings-item-info">
          <span class="settings-item-name">${escapeHTML(cat.name)}</span>
        </div>
        <div class="settings-item-actions">
          <button class="btn-action edit" title="Edit Category">✏️</button>
          <button class="btn-action delete" title="Delete Category">🗑️</button>
        </div>
      `;

      li.querySelector('.edit').addEventListener('click', () => {
        startEditShoppingCategory(cat);
      });
      li.querySelector('.delete').addEventListener('click', () => {
        confirmDelete('shoppingCategory', cat.id, cat.name);
      });

      shoppingCategoriesList.appendChild(li);
    });
  }
}

export async function handleShoppingCategoryFormSubmit(e) {
  e.preventDefault();
  const shoppingCategoryIdField = document.getElementById('shoppingCategoryIdField');
  const shoppingCategoryName = document.getElementById('shoppingCategoryName');

  const id = shoppingCategoryIdField ? shoppingCategoryIdField.value : null;
  const name = shoppingCategoryName ? shoppingCategoryName.value.trim() : '';

  try {
    await api.saveShoppingCategory(id, { name });
    resetShoppingCategoryForm();
    await fetchShoppingCategories();
    fetchShopping();
  } catch (err) {
    console.error('Error saving shopping category:', err);
    alert(err.message || 'Failed to save category.');
  }
}

export function startEditShoppingCategory(cat) {
  const shoppingCategoryIdField = document.getElementById('shoppingCategoryIdField');
  const shoppingCategoryName = document.getElementById('shoppingCategoryName');
  const shoppingCategoryFormTitle = document.getElementById('shoppingCategoryFormTitle');
  const shoppingCategoryFormSubmitBtn = document.getElementById('shoppingCategoryFormSubmitBtn');
  const cancelShoppingCategoryEditBtn = document.getElementById('cancelShoppingCategoryEditBtn');

  if (shoppingCategoryIdField) shoppingCategoryIdField.value = cat.id;
  if (shoppingCategoryName) {
    shoppingCategoryName.value = cat.name;
    shoppingCategoryName.focus();
  }
  if (shoppingCategoryFormTitle) shoppingCategoryFormTitle.textContent = 'Edit Shopping Category';
  if (shoppingCategoryFormSubmitBtn) shoppingCategoryFormSubmitBtn.textContent = 'Save Changes';
  if (cancelShoppingCategoryEditBtn) cancelShoppingCategoryEditBtn.classList.remove('hidden');
}

export function resetShoppingCategoryForm() {
  const addShoppingCategoryForm = document.getElementById('addShoppingCategoryForm');
  const shoppingCategoryIdField = document.getElementById('shoppingCategoryIdField');
  const shoppingCategoryFormTitle = document.getElementById('shoppingCategoryFormTitle');
  const shoppingCategoryFormSubmitBtn = document.getElementById('shoppingCategoryFormSubmitBtn');
  const cancelShoppingCategoryEditBtn = document.getElementById('cancelShoppingCategoryEditBtn');

  if (addShoppingCategoryForm) addShoppingCategoryForm.reset();
  if (shoppingCategoryIdField) shoppingCategoryIdField.value = '';
  if (shoppingCategoryFormTitle) shoppingCategoryFormTitle.textContent = 'Shopping Categories';
  if (shoppingCategoryFormSubmitBtn) shoppingCategoryFormSubmitBtn.textContent = 'Add Category';
  if (cancelShoppingCategoryEditBtn) cancelShoppingCategoryEditBtn.classList.add('hidden');
}

export function initAvatarUpload() {
  const uploadAvatarBtn = document.getElementById('uploadAvatarBtn');
  const memberAvatar = document.getElementById('memberAvatar');
  const avatarImage = document.getElementById('avatarImage');
  const avatarPlaceholder = document.getElementById('avatarPlaceholder');
  const removeAvatarBtn = document.getElementById('removeAvatarBtn');

  if (!uploadAvatarBtn || !memberAvatar) return;

  uploadAvatarBtn.addEventListener('click', () => {
    memberAvatar.click();
  });

  memberAvatar.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 120;
        const MAX_HEIGHT = 120;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
        if (avatarImage) {
          avatarImage.src = dataUrl;
          avatarImage.classList.remove('hidden');
        }
        if (avatarPlaceholder) avatarPlaceholder.classList.add('hidden');
        if (removeAvatarBtn) removeAvatarBtn.classList.remove('hidden');
      };
      img.src = event.target.result;
    };
    reader.readAsDataURL(file);
  });

  if (removeAvatarBtn) {
    removeAvatarBtn.addEventListener('click', () => {
      if (memberAvatar) memberAvatar.value = '';
      if (avatarImage) {
        avatarImage.src = '';
        avatarImage.classList.add('hidden');
      }
      if (avatarPlaceholder) {
        avatarPlaceholder.textContent = '?';
        avatarPlaceholder.classList.remove('hidden');
      }
      removeAvatarBtn.classList.add('hidden');
    });
  }
}

export function initSystemSettingsEvents() {
  const systemSettingsForm = document.getElementById('systemSettingsForm');
  if (systemSettingsForm) {
    systemSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const settingAppTitle = document.getElementById('settingAppTitle');
      const settingTasksPerPage = document.getElementById('settingTasksPerPage');
      const settingWeatherCity = document.getElementById('settingWeatherCity');
      const settingWeatherApiKey = document.getElementById('settingWeatherApiKey');

      const app_title = settingAppTitle ? settingAppTitle.value.trim() : '';
      const tasks_per_page = settingTasksPerPage ? settingTasksPerPage.value : '10';
      const weather_city = settingWeatherCity ? settingWeatherCity.value.trim() : '';
      const weather_apikey = settingWeatherApiKey ? settingWeatherApiKey.value.trim() : '';

      try {
        await api.saveSettings({
          app_title,
          tasks_per_page,
          weather_city,
          weather_apikey
        });
        await fetchSettings();
        fetchTasks();
        alert('System settings saved successfully!');
      } catch (err) {
        console.error('Error saving settings:', err);
        alert('Failed to save settings.');
      }
    });
  }
}

export function initWeatherEvents() {
  const weatherSettingsForm = document.getElementById('weatherSettingsForm');
  if (weatherSettingsForm) {
    weatherSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const settingWeatherApiKey = document.getElementById('settingWeatherApiKey');

      const app_title = state.appTitle;
      const tasks_per_page = state.tasksPerPage;
      const weather_apikey = settingWeatherApiKey ? settingWeatherApiKey.value.trim() : '';

      try {
        await api.saveSettings({
          app_title,
          tasks_per_page,
          weather_apikey
        });
        await fetchSettings();
        await fetchWeather();
        alert('Weather API key saved successfully!');
      } catch (err) {
        console.error('Error saving weather settings:', err);
        alert('Failed to save weather settings.');
      }
    });
  }
}

export function initSettingsEvents() {
  const addCategoryForm = document.getElementById('addCategoryForm');
  const cancelCategoryEditBtn = document.getElementById('cancelCategoryEditBtn');
  const addMemberForm = document.getElementById('addMemberForm');
  const cancelMemberEditBtn = document.getElementById('cancelMemberEditBtn');
  const addShoppingCategoryForm = document.getElementById('addShoppingCategoryForm');
  const cancelShoppingCategoryEditBtn = document.getElementById('cancelShoppingCategoryEditBtn');

  if (addCategoryForm) {
    addCategoryForm.addEventListener('submit', handleCategoryFormSubmit);
  }
  if (cancelCategoryEditBtn) {
    cancelCategoryEditBtn.addEventListener('click', resetCategoryForm);
  }

  if (addMemberForm) {
    addMemberForm.addEventListener('submit', handleMemberFormSubmit);
  }
  if (cancelMemberEditBtn) {
    cancelMemberEditBtn.addEventListener('click', resetMemberForm);
  }

  if (addShoppingCategoryForm) {
    addShoppingCategoryForm.addEventListener('submit', handleShoppingCategoryFormSubmit);
  }
  if (cancelShoppingCategoryEditBtn) {
    cancelShoppingCategoryEditBtn.addEventListener('click', resetShoppingCategoryForm);
  }

  initAvatarUpload();
  initSystemSettingsEvents();
  initWeatherEvents();
  initPasswordEvents();
}

export function initPasswordEvents() {
  const passwordSettingsForm = document.getElementById('passwordSettingsForm');
  if (passwordSettingsForm) {
    passwordSettingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const settingPasswordEnabled = document.getElementById('settingPasswordEnabled');
      const settingAppPassword = document.getElementById('settingAppPassword');

      const enabled = settingPasswordEnabled ? settingPasswordEnabled.checked : false;
      const password = settingAppPassword ? settingAppPassword.value.trim() : '';

      if (enabled && !password) {
        alert('Please enter a password to enable password protection.');
        return;
      }

      try {
        const currentSettings = await api.getSettings();
        await api.saveSettings({
          app_title: currentSettings.app_title || state.appTitle,
          tasks_per_page: currentSettings.tasks_per_page || state.tasksPerPage,
          weather_apikey: '******',
          password_protection_enabled: enabled,
          app_password: password || '******'
        });

        // If password was updated, store the new password in localStorage so the client stays authenticated
        if (password && password !== '******') {
          localStorage.setItem('app_password', password);
        } else if (!enabled) {
          // If disabled, clear local app_password
          localStorage.removeItem('app_password');
        }

        alert('Password settings saved successfully!');
      } catch (err) {
        console.error('Error saving password settings:', err);
        alert('Failed to save password settings.');
      }
    });
  }
}
