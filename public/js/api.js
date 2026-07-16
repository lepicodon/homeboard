async function customFetch(url, options = {}) {
  if (!options.headers) {
    options.headers = {};
  }
  options.headers['x-app-password'] = localStorage.getItem('app_password') || '';

  let res = await fetch(url, options);
  if (res.status === 401) {
    // If the check itself was setting/auth status, do not enter an infinite loop
    if (url.includes('/api/settings/auth-status') || url.includes('/api/settings/authenticate')) {
      return res;
    }
    // If we receive a 401, clear local credentials and reload to trigger the Lock Screen
    localStorage.removeItem('app_password');
    window.location.reload();
  }
  return res;
}

export const api = {
  async getAuthStatus() {
    const res = await fetch('/api/settings/auth-status', {
      headers: {
        'x-app-password': localStorage.getItem('app_password') || ''
      }
    });
    if (!res.ok) throw new Error('Failed to fetch auth status');
    return res.json();
  },

  async authenticate(password) {
    const res = await fetch('/api/settings/authenticate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to authenticate');
    }
    return res.json();
  },

  async getSettings() {
    const res = await customFetch('/api/settings');
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  async saveSettings(payload) {
    const res = await customFetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save settings');
    return res.json();
  },

  async getWeather(locationId, isHome) {
    let url = '/api/weather';
    const params = [];
    if (isHome) params.push('is_home=true');
    else if (locationId) params.push(`location_id=${locationId}`);

    if (params.length > 0) {
      url += '?' + params.join('&');
    }
    const res = await customFetch(url);
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || `HTTP error ${res.status}`);
    }
    return res.json();
  },

  async getTasks() {
    const res = await customFetch('/api/tasks');
    if (!res.ok) throw new Error('Failed to fetch tasks');
    return res.json();
  },

  async saveTask(id, payload) {
    const url = id ? `/api/tasks/${id}` : '/api/tasks';
    const method = id ? 'PUT' : 'POST';
    const res = await customFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save task');
    }
    return res.json();
  },

  async toggleTask(id) {
    const res = await customFetch(`/api/tasks/${id}/toggle`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to toggle task');
    return res.json();
  },

  async deleteTask(id) {
    const res = await customFetch(`/api/tasks/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete task');
    return res.json();
  },

  async getCategories() {
    const res = await customFetch('/api/categories');
    if (!res.ok) throw new Error('Failed to fetch categories');
    return res.json();
  },

  async saveCategory(id, payload) {
    const url = id ? `/api/categories/${id}` : '/api/categories';
    const method = id ? 'PUT' : 'POST';
    const res = await customFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const errData = await res.json();
      throw new Error(errData.error || 'Failed to save category');
    }
    return res.json();
  },

  async deleteCategory(id) {
    const res = await customFetch(`/api/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete category');
    return res.json();
  },

  async getMembers() {
    const res = await customFetch('/api/members');
    if (!res.ok) throw new Error('Failed to fetch members');
    return res.json();
  },

  async saveMember(id, payload) {
    const url = id ? `/api/members/${id}` : '/api/members';
    const method = id ? 'PUT' : 'POST';
    const res = await customFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save member');
    }
    return res.json();
  },

  async deleteMember(id) {
    const res = await customFetch(`/api/members/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete member');
    return res.json();
  },

  async getMemos() {
    const res = await customFetch('/api/memos');
    if (!res.ok) throw new Error('Failed to fetch memos');
    return res.json();
  },

  async saveMemo(id, payload) {
    const url = id ? `/api/memos/${id}` : '/api/memos';
    const method = id ? 'PUT' : 'POST';
    const res = await customFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save memo');
    return res.json();
  },

  async deleteMemo(id) {
    const res = await customFetch(`/api/memos/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete memo');
    return res.json();
  },

  async getShoppingCategories() {
    const res = await customFetch('/api/shopping/categories');
    if (!res.ok) throw new Error('Failed to fetch shopping categories');
    return res.json();
  },

  async saveShoppingCategory(id, payload) {
    const url = id ? `/api/shopping/categories/${id}` : '/api/shopping/categories';
    const method = id ? 'PUT' : 'POST';
    const res = await customFetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save shopping category');
    }
    return res.json();
  },

  async deleteShoppingCategory(id) {
    const res = await customFetch(`/api/shopping/categories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete shopping category');
    return res.json();
  },

  async getShoppingLists() {
    const res = await customFetch('/api/shopping/lists');
    if (!res.ok) throw new Error('Failed to fetch shopping lists');
    return res.json();
  },

  async saveShoppingList(payload) {
    const res = await customFetch('/api/shopping/lists', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to save shopping list');
    return res.json();
  },

  async deleteShoppingList(id) {
    const res = await customFetch(`/api/shopping/lists/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete shopping list');
    return res.json();
  },

  async getShoppingItems(listId) {
    const res = await customFetch(`/api/shopping?list_id=${listId}`);
    if (!res.ok) throw new Error('Failed to fetch shopping items');
    return res.json();
  },

  async saveShoppingItem(payload) {
    const res = await customFetch('/api/shopping', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error('Failed to add shopping item');
    return res.json();
  },

  async toggleShoppingItem(id) {
    const res = await customFetch(`/api/shopping/${id}/toggle`, { method: 'PATCH' });
    if (!res.ok) throw new Error('Failed to toggle shopping item');
    return res.json();
  },

  async deleteShoppingItem(id) {
    const res = await customFetch(`/api/shopping/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete shopping item');
    return res.json();
  },

  async clearCompletedShoppingItems(listId) {
    const res = await customFetch(`/api/shopping/clear-completed?list_id=${listId}`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to clear completed items');
    return res.json();
  },

  async getWeatherLocations() {
    const res = await customFetch('/api/weather/locations');
    if (!res.ok) throw new Error('Failed to fetch weather locations');
    return res.json();
  },

  async saveWeatherLocation(payload) {
    const res = await customFetch('/api/weather/locations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save weather location');
    }
    return res.json();
  },

  async deleteWeatherLocation(id) {
    const res = await customFetch(`/api/weather/locations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete weather location');
    return res.json();
  },

  async setHomeWeatherLocation(id) {
    const res = await customFetch(`/api/weather/locations/${id}/set-home`, {
      method: 'PUT'
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to set home weather location');
    }
    return res.json();
  },

  async uploadBackground(image) {
    const res = await customFetch('/api/settings/background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image })
    });
    if (!res.ok) throw new Error('Failed to upload background image');
    return res.json();
  },

  async fetchExternalBackground(url) {
    const res = await customFetch('/api/settings/background/fetch-external', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to import background URL');
    }
    return res.json();
  },

  async deleteBackground() {
    const res = await customFetch('/api/settings/background', { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete background');
    return res.json();
  },

  async downloadBackup(password) {
    const res = await customFetch('/api/settings/backup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to download backup');
    }
    return res.blob();
  },

  async restoreDatabase(fileBase64, password) {
    const res = await customFetch('/api/settings/restore', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ file: fileBase64, password })
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to restore database');
    }
    return res.json();
  }
};
