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
    if (themeIcon) themeIcon.textContent = '💡';
    if (themeLabel) themeLabel.textContent = 'Light Mode';
    themeToggle.title = 'Light Mode';
  } else {
    if (themeIcon) themeIcon.textContent = '🌓';
    if (themeLabel) themeLabel.textContent = 'Dark Mode';
    themeToggle.title = 'Dark Mode';
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
    state.backgroundType = settings.background_type || 'none';
    state.backgroundUrl = settings.background_url || '';

    document.title = `${state.appTitle} - Family Management`;
    document.querySelectorAll('.logo-text').forEach((el) => (el.textContent = state.appTitle));

    const settingAppTitle = document.getElementById('settingAppTitle');
    const settingTasksPerPage = document.getElementById('settingTasksPerPage');
    const settingWeatherApiKey = document.getElementById('settingWeatherApiKey');
    const settingPasswordEnabled = document.getElementById('settingPasswordEnabled');
    const settingAppPassword = document.getElementById('settingAppPassword');
    const settingBackgroundUrl = document.getElementById('settingBackgroundUrl');

    if (settingAppTitle) settingAppTitle.value = state.appTitle;
    if (settingTasksPerPage) settingTasksPerPage.value = state.tasksPerPage;
    if (settingWeatherApiKey) settingWeatherApiKey.value = settings.weather_apikey || '';
    if (settingPasswordEnabled) settingPasswordEnabled.checked = !!settings.password_protection_enabled;
    if (settingAppPassword) settingAppPassword.value = settings.app_password || '';
    if (settingBackgroundUrl) settingBackgroundUrl.value = state.backgroundUrl;

    applyBackground();

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

export function applyBackground() {
  const bgType = state.backgroundType || 'none';
  const settingBackgroundType = document.getElementById('settingBackgroundType');
  const customBackgroundOptions = document.getElementById('customBackgroundOptions');
  const backgroundPreviewPlaceholder = document.getElementById('backgroundPreviewPlaceholder');
  const backgroundPreviewImg = document.getElementById('backgroundPreviewImg');
  const clearBackgroundBtn = document.getElementById('clearBackgroundBtn');

  if (settingBackgroundType) settingBackgroundType.value = bgType;

  if (bgType === 'custom') {
    document.body.classList.add('has-background');
    const timestamp = localStorage.getItem('background_ts') || Date.now();
    const password = localStorage.getItem('app_password') || '';
    const pwParam = password ? `&pw=${encodeURIComponent(password)}` : '';
    document.body.style.backgroundImage = `linear-gradient(rgba(15, 23, 42, 0.35), rgba(15, 23, 42, 0.35)), url('/api/settings/background?t=${timestamp}${pwParam}')`;

    if (customBackgroundOptions) customBackgroundOptions.classList.remove('hidden');
    if (backgroundPreviewPlaceholder) backgroundPreviewPlaceholder.classList.add('hidden');
    if (backgroundPreviewImg) {
      backgroundPreviewImg.src = `/api/settings/background?t=${timestamp}${pwParam}`;
      backgroundPreviewImg.classList.remove('hidden');
    }
    if (clearBackgroundBtn) clearBackgroundBtn.classList.remove('hidden');
  } else {
    document.body.classList.remove('has-background');
    document.body.style.backgroundImage = 'none';

    if (customBackgroundOptions) customBackgroundOptions.classList.add('hidden');
    if (backgroundPreviewPlaceholder) backgroundPreviewPlaceholder.classList.remove('hidden');
    if (backgroundPreviewImg) {
      backgroundPreviewImg.src = '';
      backgroundPreviewImg.classList.add('hidden');
    }
    if (clearBackgroundBtn) clearBackgroundBtn.classList.add('hidden');
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
      let tempVal = Math.round(data.current.main.temp);
      if (state.weatherUnit === 'F') {
        tempVal = Math.round((data.current.main.temp * 9) / 5 + 32);
      }
      const descVal = data.current.weather[0].description;
      const iconCode = data.current.weather[0].icon;
      const emoji = getWeatherEmoji(iconCode);

      if (sidebarWeatherWidget) {
        sidebarWeatherWidget.innerHTML = `
          <div class="sidebar-weather-info">
            <span class="sidebar-weather-temp">${tempVal}°${state.weatherUnit}</span>
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

// --- Collapsible Layout & Responsive UI Toggles ---
function updateFilterBadge() {
  const searchInput = document.getElementById('searchInput');
  const filterStatus = document.getElementById('filterStatus');
  const filterCategory = document.getElementById('filterCategory');
  const filterSize = document.getElementById('filterSize');
  const filterAssignee = document.getElementById('filterAssignee');
  const mobileFilterBadge = document.getElementById('mobileFilterBadge');

  if (!mobileFilterBadge) return;

  let count = 0;
  if (searchInput && searchInput.value.trim() !== '') count++;
  if (filterStatus && filterStatus.value !== 'pending') count++;
  if (filterCategory && filterCategory.value !== 'all') count++;
  if (filterSize && filterSize.value !== 'all') count++;
  if (filterAssignee && filterAssignee.value !== 'all') count++;

  if (count > 0) {
    mobileFilterBadge.textContent = count;
    mobileFilterBadge.classList.remove('hidden');
  } else {
    mobileFilterBadge.classList.add('hidden');
  }
}

function initSidebarToggles() {
  // 1. Desktop Collapsible Sidebar
  const isCollapsed = localStorage.getItem('sidebar_collapsed') === 'true';
  const appContainer = document.querySelector('.app-container');
  if (isCollapsed && appContainer) {
    appContainer.classList.add('sidebar-collapsed');
  }

  const desktopSidebarToggle = document.getElementById('desktopSidebarToggle');
  if (desktopSidebarToggle && appContainer) {
    desktopSidebarToggle.addEventListener('click', () => {
      appContainer.classList.toggle('sidebar-collapsed');
      const collapsed = appContainer.classList.contains('sidebar-collapsed');
      localStorage.setItem('sidebar_collapsed', collapsed);
    });
  }

  // 2. Mobile Collapsible Navigation Menu Drawer
  const mobileMenuToggle = document.getElementById('mobileMenuToggle');
  const sidebarContentWrapper = document.getElementById('sidebarContentWrapper');
  if (mobileMenuToggle && sidebarContentWrapper) {
    mobileMenuToggle.addEventListener('click', () => {
      mobileMenuToggle.classList.toggle('active');
      sidebarContentWrapper.classList.toggle('open');
    });

    // Close menu when clicking nav items on mobile
    const navItems = document.querySelectorAll('.sidebar-nav .nav-item');
    navItems.forEach((item) => {
      item.addEventListener('click', () => {
        if (window.innerWidth < 768) {
          mobileMenuToggle.classList.remove('active');
          sidebarContentWrapper.classList.remove('open');
        }
      });
    });
  }

  // 3. Mobile Page Controls (Actions & Filters toggling)
  const mobileActionsToggle = document.getElementById('mobileActionsToggle');
  const mobileFiltersToggle = document.getElementById('mobileFiltersToggle');
  const tasksActionsCollapse = document.getElementById('tasksActionsCollapse');
  const tasksFiltersCollapse = document.getElementById('tasksFiltersCollapse');

  if (mobileActionsToggle && tasksActionsCollapse) {
    mobileActionsToggle.addEventListener('click', () => {
      const isOpen = tasksActionsCollapse.classList.contains('open');
      mobileActionsToggle.classList.toggle('active', !isOpen);
      tasksActionsCollapse.classList.toggle('open', !isOpen);

      // Close filters if actions is opened
      if (!isOpen && tasksFiltersCollapse) {
        mobileFiltersToggle.classList.remove('active');
        tasksFiltersCollapse.classList.remove('open');
      }
    });
  }

  if (mobileFiltersToggle && tasksFiltersCollapse) {
    mobileFiltersToggle.addEventListener('click', () => {
      const isOpen = tasksFiltersCollapse.classList.contains('open');
      mobileFiltersToggle.classList.toggle('active', !isOpen);
      tasksFiltersCollapse.classList.toggle('open', !isOpen);

      // Close actions if filters is opened
      if (!isOpen && tasksActionsCollapse) {
        mobileActionsToggle.classList.remove('active');
        tasksActionsCollapse.classList.remove('open');
      }
    });
  }

  // 4. Update filters count badge on change
  const searchInput = document.getElementById('searchInput');
  const filterStatus = document.getElementById('filterStatus');
  const filterCategory = document.getElementById('filterCategory');
  const filterSize = document.getElementById('filterSize');
  const filterAssignee = document.getElementById('filterAssignee');

  const filterInputs = [searchInput, filterStatus, filterCategory, filterSize, filterAssignee];
  filterInputs.forEach((input) => {
    if (input) {
      const eventName = input.tagName === 'INPUT' ? 'input' : 'change';
      input.addEventListener(eventName, updateFilterBadge);
    }
  });

  updateFilterBadge();
}

// --- Lock Screen Authentication ---
async function initAuthCheck() {
  const lockScreen = document.getElementById('lockScreen');
  const lockForm = document.getElementById('lockForm');
  const lockCard = document.getElementById('lockCard');
  const lockPasswordInput = document.getElementById('lockPasswordInput');
  const lockUnlockBtn = document.getElementById('lockUnlockBtn');
  const lockErrorMsg = document.getElementById('lockErrorMsg');

  try {
    const auth = await api.getAuthStatus();
    if (!auth.enabled || auth.authenticated) {
      if (lockScreen) lockScreen.classList.add('hidden');
      return true; // Authorized, proceed
    }

    // Show custom lock screen overlay
    if (lockScreen) lockScreen.classList.remove('hidden');
    if (lockPasswordInput) lockPasswordInput.focus();

    let attempts = 0;

    if (lockForm) {
      lockForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        if (!lockPasswordInput) return;

        const password = lockPasswordInput.value.trim();
        if (!password) return;

        // Disable input elements during validation
        lockPasswordInput.disabled = true;
        if (lockUnlockBtn) lockUnlockBtn.disabled = true;
        if (lockErrorMsg) lockErrorMsg.classList.add('hidden');

        try {
          const result = await api.authenticate(password);
          if (result && result.success) {
            localStorage.setItem('app_password', password);
            window.location.reload(); // Reload to fetch initial data with headers
          } else {
            throw new Error('Incorrect password');
          }
        } catch (err) {
          console.error('Authentication attempt failed:', err);

          if (err.message === 'Incorrect password') {
            attempts++;

            // Shake card animation on failure
            if (lockCard) {
              lockCard.classList.remove('shake');
              void lockCard.offsetWidth; // Trigger reflow
              lockCard.classList.add('shake');
            }

            if (attempts >= 3) {
              let cooldown = 30;
              if (lockErrorMsg) {
                lockErrorMsg.textContent = `Too many failed attempts. Try again in ${cooldown} seconds.`;
                lockErrorMsg.classList.remove('hidden');
              }

              const timer = window.setInterval(() => {
                cooldown--;
                if (cooldown <= 0) {
                  window.clearInterval(timer);
                  attempts = 0;
                  if (lockPasswordInput) {
                    lockPasswordInput.disabled = false;
                    lockPasswordInput.value = '';
                    lockPasswordInput.focus();
                  }
                  if (lockUnlockBtn) lockUnlockBtn.disabled = false;
                  if (lockErrorMsg) lockErrorMsg.classList.add('hidden');
                } else {
                  if (lockErrorMsg) {
                    lockErrorMsg.textContent = `Too many failed attempts. Try again in ${cooldown} seconds.`;
                  }
                }
              }, 1000);
            } else {
              // Reset input for next attempt
              if (lockPasswordInput) {
                lockPasswordInput.disabled = false;
                lockPasswordInput.value = '';
                lockPasswordInput.focus();
              }
              if (lockUnlockBtn) lockUnlockBtn.disabled = false;
              if (lockErrorMsg) {
                lockErrorMsg.textContent = `Incorrect password. Please try again. (Attempt ${attempts}/3)`;
                lockErrorMsg.classList.remove('hidden');
              }
            }
          } else {
            // Actual connection/server error
            if (lockPasswordInput) lockPasswordInput.disabled = false;
            if (lockUnlockBtn) lockUnlockBtn.disabled = false;
            if (lockErrorMsg) {
              lockErrorMsg.textContent = err.message || 'Server error. Please try again later.';
              lockErrorMsg.classList.remove('hidden');
            }
          }
        }
      });
    }

    return false; // Lock screen active, hold boot sequence
  } catch (err) {
    console.error('Error during authorization verification:', err);
    return true; // Let it load on error, requests will fail gracefully
  }
}

// --- App Bootstrap ---
document.addEventListener('DOMContentLoaded', async () => {
  initTheme();

  // Verify authorization before doing anything else
  const isAuthorized = await initAuthCheck();
  if (!isAuthorized) {
    return; // Halt boot sequence
  }

  initSidebarToggles();
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
