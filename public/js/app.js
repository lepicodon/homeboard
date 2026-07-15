import { state } from './state.js';
import { api } from './api.js';
import { renderTasks, initFilters, initModals, initPaginationEvents, handlePrintChecklist } from './modules/tasks.js';
import { renderCalendar, initCalendarControls } from './modules/calendar.js';
import { renderMemos, initMemosEvents } from './modules/memos.js';
import {
  renderShopping,
  initShoppingListsEvents,
  initShoppingFormEvents,
  renderShoppingListsDropdown
} from './modules/shopping.js';
import { renderCategories, renderMembers, renderShoppingCategories, initSettingsEvents } from './modules/settings.js';
import {
  renderWeatherLocationsDropdown,
  initWeatherPageControls,
  renderWeatherDashboard,
  renderWeatherError,
  getWeatherEmoji
} from './modules/weather.js';

// --- Theme Configuration ---
function initTheme() {
  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;

  const savedTheme = localStorage.getItem('color-scheme') || 'system';
  applyTheme(savedTheme);

  themeToggle.addEventListener('click', () => {
    const currentTheme = document.documentElement.getAttribute('data-theme');
    let nextTheme = 'light';

    if (currentTheme === 'light') {
      nextTheme = 'dark';
    } else if (currentTheme === 'dark') {
      nextTheme = 'light';
    } else {
      const isSystemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      nextTheme = isSystemDark ? 'light' : 'dark';
    }

    applyTheme(nextTheme);
    localStorage.setItem('color-scheme', nextTheme);
  });

  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const themeConfig = localStorage.getItem('color-scheme') || 'system';
    if (themeConfig === 'system') {
      applyTheme('system');
    }
  });
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);

  let resolvedTheme = theme;
  if (theme === 'system') {
    resolvedTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }

  const metaColorScheme = document.querySelector('meta[name="color-scheme"]');
  if (metaColorScheme) {
    metaColorScheme.content = resolvedTheme;
  }

  const themeToggle = document.getElementById('themeToggle');
  if (!themeToggle) return;
  const themeIcon = themeToggle.querySelector('.theme-icon');
  const themeLabel = themeToggle.querySelector('.theme-label');

  if (resolvedTheme === 'dark') {
    if (themeIcon) themeIcon.textContent = '☀️';
    if (themeLabel) themeLabel.textContent = 'Light Mode';
  } else {
    if (themeIcon) themeIcon.textContent = '🌙';
    if (themeLabel) themeLabel.textContent = 'Dark Mode';
  }
}

// --- SPA Navigation ---
function initNavigation() {
  const navTasks = document.getElementById('navTasks');
  const navCalendar = document.getElementById('navCalendar');
  const navMemos = document.getElementById('navMemos');
  const navShopping = document.getElementById('navShopping');
  const navWeather = document.getElementById('navWeather');
  const navSettings = document.getElementById('navSettings');

  const tasksPage = document.getElementById('tasksPage');
  const calendarPage = document.getElementById('calendarPage');
  const memosPage = document.getElementById('memosPage');
  const shoppingPage = document.getElementById('shoppingPage');
  const weatherPage = document.getElementById('weatherPage');
  const settingsPage = document.getElementById('settingsPage');

  const handleNav = (hash) => {
    document.querySelectorAll('.nav-item').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.page-panel').forEach((page) => page.classList.remove('active'));

    if (hash === '#settings') {
      if (navSettings) navSettings.classList.add('active');
      if (settingsPage) settingsPage.classList.add('active');
    } else if (hash === '#calendar') {
      if (navCalendar) navCalendar.classList.add('active');
      if (calendarPage) calendarPage.classList.add('active');
      renderCalendar();
    } else if (hash === '#memos') {
      if (navMemos) navMemos.classList.add('active');
      if (memosPage) memosPage.classList.add('active');
      fetchMemos();
    } else if (hash === '#shopping') {
      if (navShopping) navShopping.classList.add('active');
      if (shoppingPage) shoppingPage.classList.add('active');
      fetchShoppingLists().then(() => {
        fetchShopping();
      });
    } else if (hash === '#weather') {
      if (navWeather) navWeather.classList.add('active');
      if (weatherPage) weatherPage.classList.add('active');
      fetchWeatherLocations().then(() => {
        fetchWeather();
      });
    } else {
      if (navTasks) navTasks.classList.add('active');
      if (tasksPage) tasksPage.classList.add('active');
      renderTasks();
    }
  };

  if (navTasks) {
    navTasks.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', '#tasks');
      handleNav('#tasks');
    });
  }

  if (navCalendar) {
    navCalendar.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', '#calendar');
      handleNav('#calendar');
    });
  }

  if (navMemos) {
    navMemos.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', '#memos');
      handleNav('#memos');
    });
  }

  if (navShopping) {
    navShopping.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', '#shopping');
      handleNav('#shopping');
    });
  }

  if (navWeather) {
    navWeather.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', '#weather');
      handleNav('#weather');
    });
  }

  if (navSettings) {
    navSettings.addEventListener('click', (e) => {
      e.preventDefault();
      history.pushState(null, '', '#settings');
      handleNav('#settings');
    });
  }

  window.addEventListener('popstate', () => {
    handleNav(window.location.hash);
  });

  if (window.location.hash) {
    handleNav(window.location.hash);
  }
}

// --- Greeting and Date ---
function initGreeting() {
  const greeting = document.getElementById('greeting');
  const currentDateLabel = document.getElementById('currentDate');
  if (!greeting || !currentDateLabel) return;

  const now = new Date();
  const hours = now.getHours();
  let greetText = 'Welcome Home!';

  if (hours < 12) {
    greetText = 'Good morning! ☀️';
  } else if (hours < 18) {
    greetText = 'Good afternoon! 🌤️';
  } else {
    greetText = 'Good evening! 🌙';
  }

  greeting.textContent = greetText;

  const options = { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' };
  currentDateLabel.textContent = now.toLocaleDateString(undefined, options);
}

// --- View Switcher Configuration ---
function initViewSwitcher() {
  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  if (!viewGridBtn || !viewListBtn) return;

  applyViewMode(state.viewMode);

  viewGridBtn.addEventListener('click', () => {
    applyViewMode('grid');
  });

  viewListBtn.addEventListener('click', () => {
    applyViewMode('list');
  });
}

function applyViewMode(mode) {
  state.viewMode = mode;
  localStorage.setItem('view-mode', mode);

  const viewGridBtn = document.getElementById('viewGridBtn');
  const viewListBtn = document.getElementById('viewListBtn');
  const tasksGrid = document.getElementById('tasksGrid');
  if (!viewGridBtn || !viewListBtn || !tasksGrid) return;

  if (mode === 'list') {
    viewGridBtn.classList.remove('active');
    viewListBtn.classList.add('active');
    tasksGrid.classList.remove('grid-view');
    tasksGrid.classList.add('list-view');
  } else {
    viewListBtn.classList.remove('active');
    viewGridBtn.classList.add('active');
    tasksGrid.classList.remove('list-view');
    tasksGrid.classList.add('grid-view');
  }

  renderTasks();
}

// --- Delete Confirmation Handlers ---
export function confirmDelete(type, id, displayName) {
  state.currentDeletingItem = { type, id };
  const deleteMessage = document.getElementById('deleteMessage');
  const deleteConfirmModal = document.getElementById('deleteConfirmModal');
  if (!deleteConfirmModal || !deleteMessage) return;

  if (type === 'task') {
    deleteMessage.textContent = `Are you sure you want to delete the task "${displayName}"?`;
  } else if (type === 'category') {
    deleteMessage.textContent = `Are you sure you want to delete the category "${displayName}"? Tasks in this category will become uncategorized.`;
  } else if (type === 'member') {
    deleteMessage.textContent = `Are you sure you want to delete family member "${displayName}"? They will be unassigned from any tasks.`;
  } else if (type === 'memo') {
    deleteMessage.textContent = `Are you sure you want to delete this memo note?`;
  } else if (type === 'shoppingCategory') {
    deleteMessage.textContent = `Are you sure you want to delete the shopping category "${displayName}"? Items in this category will become uncategorized.`;
  }

  deleteConfirmModal.showModal();
}

async function executeDelete() {
  const { type, id } = state.currentDeletingItem;
  if (!type || !id) return;

  try {
    if (type === 'task') {
      await api.deleteTask(id);
    } else if (type === 'category') {
      await api.deleteCategory(id);
    } else if (type === 'member') {
      await api.deleteMember(id);
    } else if (type === 'memo') {
      await api.deleteMemo(id);
    } else if (type === 'shoppingCategory') {
      await api.deleteShoppingCategory(id);
    }

    const deleteConfirmModal = document.getElementById('deleteConfirmModal');
    if (deleteConfirmModal) deleteConfirmModal.close();

    if (type === 'task') {
      fetchTasks();
    } else if (type === 'category') {
      await fetchCategories();
      fetchTasks();
    } else if (type === 'member') {
      await fetchMembers();
      fetchTasks();
    } else if (type === 'memo') {
      fetchMemos();
    } else if (type === 'shoppingCategory') {
      await fetchShoppingCategories();
      fetchShopping();
    }
  } catch (err) {
    console.error('Error deleting item:', err);
    alert('Failed to delete item.');
  }
}

function initDeleteConfirmEvents() {
  const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
  const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
  const closeDeleteModalBtn = document.getElementById('closeDeleteModalBtn');
  const deleteConfirmModal = document.getElementById('deleteConfirmModal');

  if (confirmDeleteBtn) {
    confirmDeleteBtn.addEventListener('click', executeDelete);
  }
  if (cancelDeleteBtn) {
    cancelDeleteBtn.addEventListener('click', () => deleteConfirmModal && deleteConfirmModal.close());
  }
  if (closeDeleteModalBtn) {
    closeDeleteModalBtn.addEventListener('click', () => deleteConfirmModal && deleteConfirmModal.close());
  }
}

// --- Data Fetching Actions ---
export async function fetchSettings() {
  try {
    const settings = await api.getSettings();
    state.appTitle = settings.app_title || 'HomeBoard';
    state.tasksPerPage = settings.tasks_per_page || '10';

    document.title = `${state.appTitle} - Family Management`;
    document.querySelectorAll('.logo-text').forEach((el) => (el.textContent = state.appTitle));

    const settingAppTitle = document.getElementById('settingAppTitle');
    const settingTasksPerPage = document.getElementById('settingTasksPerPage');
    const settingWeatherApiKey = document.getElementById('settingWeatherApiKey');
    const settingPasswordEnabled = document.getElementById('settingPasswordEnabled');
    const settingAppPassword = document.getElementById('settingAppPassword');

    if (settingAppTitle) settingAppTitle.value = state.appTitle;
    if (settingTasksPerPage) settingTasksPerPage.value = state.tasksPerPage;
    if (settingWeatherApiKey) settingWeatherApiKey.value = settings.weather_apikey || '';
    if (settingPasswordEnabled) settingPasswordEnabled.checked = !!settings.password_protection_enabled;
    if (settingAppPassword) settingAppPassword.value = settings.app_password || '';

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      if (settings.password_protection_enabled && settings.app_password) {
        logoutBtn.classList.remove('hidden');
      } else {
        logoutBtn.classList.add('hidden');
      }
    }
  } catch (err) {
    console.error('Error fetching settings:', err);
  }
}

export async function fetchWeatherLocations() {
  try {
    state.weatherLocations = await api.getWeatherLocations();
    if (!state.activeWeatherLocationId || !state.weatherLocations.some((l) => l.id === state.activeWeatherLocationId)) {
      const homeLoc = state.weatherLocations.find((l) => l.is_home === 1) || state.weatherLocations[0];
      state.activeWeatherLocationId = homeLoc?.id || null;
    }
    renderWeatherLocationsDropdown();
  } catch (err) {
    console.error('Error fetching weather locations:', err);
  }
}

export async function fetchWeather() {
  try {
    const data = await api.getWeather(state.activeWeatherLocationId);
    renderWeatherDashboard(data);
  } catch (err) {
    console.error('Error fetching weather:', err);
    renderWeatherError(err.message);
  }
}

export async function fetchSidebarWeather() {
  const sidebarWeatherWidget = document.getElementById('sidebarWeatherWidget');
  try {
    const data = await api.getWeather(null, true);
    if (data.configured) {
      const tempVal = Math.round(data.current.main.temp);
      const descVal = data.current.weather[0].description;
      const iconCode = data.current.weather[0].icon;
      const emoji = getWeatherEmoji(iconCode);

      if (sidebarWeatherWidget) {
        sidebarWeatherWidget.innerHTML = `
          <div class="sidebar-weather-info">
            <span class="sidebar-weather-temp">${tempVal}°C</span>
            <span class="sidebar-weather-desc">${descVal}</span>
          </div>
          <span class="sidebar-weather-icon">${emoji}</span>
        `;
      }
    } else {
      if (sidebarWeatherWidget) {
        sidebarWeatherWidget.innerHTML = `
          <span class="sidebar-weather-unconfigured">Configure Weather 🌤️</span>
        `;
      }
    }
  } catch (err) {
    console.error('Error fetching sidebar weather:', err);
    if (sidebarWeatherWidget) {
      sidebarWeatherWidget.innerHTML = `
        <span class="sidebar-weather-unconfigured">Weather Error ⚠️</span>
      `;
    }
  }
}

export async function fetchTasks() {
  try {
    state.tasks = await api.getTasks();
    const calendarPage = document.getElementById('calendarPage');
    if (calendarPage && calendarPage.classList.contains('active')) {
      renderCalendar();
    } else {
      renderTasks();
    }
  } catch (err) {
    console.error('Error fetching tasks:', err);
  }
}

export async function fetchCategories() {
  try {
    state.categories = await api.getCategories();
    renderCategories();
  } catch (err) {
    console.error('Error fetching categories:', err);
  }
}

export async function fetchMembers() {
  try {
    state.members = await api.getMembers();
    state.members.sort((a, b) => a.name.localeCompare(b.name));
    renderMembers();
  } catch (err) {
    console.error('Error fetching members:', err);
  }
}

export async function fetchMemos() {
  try {
    state.memos = await api.getMemos();
    renderMemos();
  } catch (err) {
    console.error('Error fetching memos:', err);
  }
}

export async function fetchShoppingCategories() {
  try {
    state.shoppingCategories = await api.getShoppingCategories();
    renderShoppingCategories();
  } catch (err) {
    console.error('Error fetching shopping categories:', err);
  }
}

export async function fetchShoppingLists() {
  try {
    state.shoppingLists = await api.getShoppingLists();
    if (!state.shoppingLists.some((l) => l.id === state.activeShoppingListId)) {
      state.activeShoppingListId = state.shoppingLists[0]?.id || 1;
    }
    renderShoppingListsDropdown();
  } catch (err) {
    console.error('Error fetching shopping lists:', err);
  }
}

export async function fetchShopping() {
  try {
    state.shoppingItems = await api.getShoppingItems(state.activeShoppingListId);
    renderShopping();
  } catch (err) {
    console.error('Error fetching shopping items:', err);
  }
}

// (Weather helpers moved to modules/weather.js)

function initPrintEvents() {
  const printBtn = document.getElementById('printBtn');
  if (printBtn) {
    printBtn.addEventListener('click', handlePrintChecklist);
  }
}

// --- App Bootstrap ---
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initNavigation();
  initGreeting();
  initFilters();
  initModals();
  initViewSwitcher();
  initCalendarControls();
  initPrintEvents();
  initDeleteConfirmEvents();
  initSettingsEvents();
  initShoppingListsEvents();
  initShoppingFormEvents();
  initPaginationEvents();
  initMemosEvents();
  initWeatherPageControls();

  const sidebarWeatherWidget = document.getElementById('sidebarWeatherWidget');
  if (sidebarWeatherWidget) {
    sidebarWeatherWidget.addEventListener('click', () => {
      history.pushState(null, '', '#weather');
      const navItem = document.getElementById('navWeather');
      if (navItem) navItem.click();
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('app_password');
      window.location.reload();
    });
  }

  const goToWeatherSettingsBtn = document.getElementById('goToWeatherSettingsBtn');
  if (goToWeatherSettingsBtn) {
    goToWeatherSettingsBtn.addEventListener('click', () => {
      history.pushState(null, '', '#settings');
      const navItem = document.getElementById('navSettings');
      if (navItem) navItem.click();
      const settingWeatherApiKey = document.getElementById('settingWeatherApiKey');
      setTimeout(() => {
        if (settingWeatherApiKey) settingWeatherApiKey.focus();
      }, 100);
    });
  }

  // Fetch initial data
  fetchSettings().then(() => {
    fetchWeatherLocations().then(() => {
      fetchWeather();
      fetchSidebarWeather();
    });
    Promise.all([fetchCategories(), fetchMembers(), fetchShoppingCategories(), fetchShoppingLists()]).then(() => {
      fetchTasks();
    });
  });
});
