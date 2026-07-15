import { state } from '../state.js';
import { api } from '../api.js';
import { escapeHTML } from '../utils.js';
import { fetchShopping, fetchShoppingLists } from '../app.js';

export function renderShopping() {
  const shoppingListContainer = document.getElementById('shoppingListContainer');
  const shoppingEmptyState = document.getElementById('shoppingEmptyState');
  const clearCompletedShoppingBtn = document.getElementById('clearCompletedShoppingBtn');

  if (!shoppingListContainer) return;
  shoppingListContainer.innerHTML = '';

  if (state.shoppingItems.length === 0) {
    if (shoppingEmptyState) shoppingEmptyState.classList.remove('hidden');
    if (clearCompletedShoppingBtn) clearCompletedShoppingBtn.classList.add('hidden');
    return;
  }

  if (shoppingEmptyState) shoppingEmptyState.classList.add('hidden');
  const hasCheckedItems = state.shoppingItems.some((i) => i.checked);

  if (clearCompletedShoppingBtn) {
    if (hasCheckedItems) {
      clearCompletedShoppingBtn.classList.remove('hidden');
    } else {
      clearCompletedShoppingBtn.classList.add('hidden');
    }
  }

  // ALPHABETICAL NAME SORT MODE
  if (state.shoppingSortMode === 'name') {
    const listUl = document.createElement('ul');
    listUl.className = 'shopping-items-list';

    state.shoppingItems.forEach((item) => {
      const li = createShoppingListItemElement(item);
      listUl.appendChild(li);
    });

    shoppingListContainer.appendChild(listUl);
    return;
  }

  // GROUPED CATEGORY SORT MODE (Default)
  const grouped = {};
  state.shoppingCategories.forEach((cat) => (grouped[cat.name] = []));
  if (!grouped['Other']) grouped['Other'] = [];

  state.shoppingItems.forEach((item) => {
    const cat = item.category || 'Other';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(item);
  });

  state.shoppingCategories.forEach((cat) => {
    const list = grouped[cat.name] || [];
    if (list.length === 0) return;

    const groupDiv = document.createElement('div');
    groupDiv.className = 'shopping-category-group';

    groupDiv.innerHTML = `
      <h3 class="shopping-category-header">${escapeHTML(cat.name)}</h3>
      <ul class="shopping-items-list"></ul>
    `;

    const listUl = groupDiv.querySelector('ul');
    list.forEach((item) => {
      const li = createShoppingListItemElement(item);
      listUl.appendChild(li);
    });

    shoppingListContainer.appendChild(groupDiv);
  });

  // Handle items in categories that might have been deleted (rendered under "Other" dynamically)
  const otherList = grouped['Other'] || [];
  if (otherList.length > 0 && !state.shoppingCategories.some((c) => c.name === 'Other')) {
    const groupDiv = document.createElement('div');
    groupDiv.className = 'shopping-category-group';
    groupDiv.innerHTML = `
      <h3 class="shopping-category-header">Other</h3>
      <ul class="shopping-items-list"></ul>
    `;
    const listUl = groupDiv.querySelector('ul');
    otherList.forEach((item) => {
      const li = createShoppingListItemElement(item);
      listUl.appendChild(li);
    });
    shoppingListContainer.appendChild(groupDiv);
  }
}

export function createShoppingListItemElement(item) {
  const li = document.createElement('li');
  li.className = `shopping-list-item ${item.checked ? 'checked' : ''}`;

  li.innerHTML = `
    <div class="shopping-item-left">
      <input type="checkbox" class="checkbox-custom" ${item.checked ? 'checked' : ''} aria-label="Mark item as completed">
      <span class="shopping-item-name">${escapeHTML(item.name)}</span>
      ${item.quantity ? `<span class="shopping-item-qty">${escapeHTML(item.quantity)}</span>` : ''}
    </div>
    <button class="btn-action delete shopping-item-delete" title="Delete item">✕</button>
  `;

  li.querySelector('.shopping-item-left').addEventListener('click', (e) => {
    if (e.target.tagName !== 'INPUT') {
      const checkbox = li.querySelector('.checkbox-custom');
      checkbox.checked = !checkbox.checked;
    }
    toggleShoppingItem(item.id);
  });

  li.querySelector('.shopping-item-delete').addEventListener('click', () => {
    deleteShoppingItem(item.id);
  });

  return li;
}

export async function handleShoppingItemFormSubmit(e) {
  e.preventDefault();
  const shoppingItemName = document.getElementById('shoppingItemName');
  const shoppingItemQuantity = document.getElementById('shoppingItemQuantity');
  const shoppingItemCategory = document.getElementById('shoppingItemCategory');
  const addShoppingItemForm = document.getElementById('addShoppingItemForm');

  const name = shoppingItemName ? shoppingItemName.value.trim() : '';
  const quantity = shoppingItemQuantity ? shoppingItemQuantity.value.trim() : '';
  const category = shoppingItemCategory ? shoppingItemCategory.value : 'Other';

  try {
    await api.saveShoppingItem({
      name,
      quantity,
      category,
      list_id: state.activeShoppingListId
    });
    if (addShoppingItemForm) addShoppingItemForm.reset();
    fetchShopping();
  } catch (err) {
    console.error('Error adding shopping item:', err);
    alert('Failed to add shopping item.');
  }
}

export async function toggleShoppingItem(id) {
  try {
    await api.toggleShoppingItem(id);
    fetchShopping();
  } catch (err) {
    console.error('Error toggling shopping item:', err);
  }
}

export async function deleteShoppingItem(id) {
  try {
    await api.deleteShoppingItem(id);
    fetchShopping();
  } catch (err) {
    console.error('Error deleting shopping item:', err);
  }
}

export async function clearCompletedShoppingItems() {
  try {
    await api.clearCompletedShoppingItems(state.activeShoppingListId);
    fetchShopping();
  } catch (err) {
    console.error('Error clearing completed shopping items:', err);
  }
}

export function handlePrintShoppingList() {
  const printShoppingBody = document.getElementById('printShoppingBody');
  const printShoppingDate = document.getElementById('printShoppingDate');
  const printShoppingContainer = document.getElementById('printShoppingContainer');

  if (!printShoppingBody) return;

  printShoppingBody.innerHTML = '';
  const now = new Date();
  if (printShoppingDate) {
    printShoppingDate.textContent = `Date: ${now.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
  }

  const activeList = state.shoppingLists.find((l) => l.id === state.activeShoppingListId);
  const listName = activeList ? activeList.name : 'Shopping List';
  if (printShoppingContainer) {
    const printHeaderH1 = printShoppingContainer.querySelector('h1');
    if (printHeaderH1) {
      printHeaderH1.textContent = `🛒 ${state.appTitle} - ${listName}`;
    }
  }

  if (state.shoppingItems.length === 0) {
    printShoppingBody.innerHTML =
      '<p style="font-style: italic; text-align: center; padding: 20px;">No items on the shopping list.</p>';
  } else {
    // If sorted alphabetically
    if (state.shoppingSortMode === 'name') {
      const wrapper = document.createElement('div');
      state.shoppingItems.forEach((item) => {
        const row = document.createElement('div');
        row.className = 'print-shopping-item';
        row.innerHTML = `
          <div class="print-shopping-item-left">
            <div class="print-checkbox ${item.checked ? 'checked' : ''}"></div>
            <span class="print-shopping-name">${escapeHTML(item.name)}</span>
          </div>
          ${item.quantity ? `<span class="print-shopping-qty">${escapeHTML(item.quantity)}</span>` : ''}
        `;
        wrapper.appendChild(row);
      });
      printShoppingBody.appendChild(wrapper);
    } else {
      // Grouped category print
      const grouped = {};
      state.shoppingCategories.forEach((cat) => (grouped[cat.name] = []));
      if (!grouped['Other']) grouped['Other'] = [];

      state.shoppingItems.forEach((item) => {
        const cat = item.category || 'Other';
        if (!grouped[cat]) grouped[cat] = [];
        grouped[cat].push(item);
      });

      state.shoppingCategories.forEach((cat) => {
        const list = grouped[cat.name] || [];
        if (list.length === 0) return;

        const groupDiv = document.createElement('div');
        groupDiv.className = 'print-shopping-category';
        groupDiv.innerHTML = `<h3 class="print-shopping-header">${escapeHTML(cat.name)}</h3>`;

        list.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'print-shopping-item';
          row.innerHTML = `
            <div class="print-shopping-item-left">
              <div class="print-checkbox ${item.checked ? 'checked' : ''}"></div>
              <span class="print-shopping-name">${escapeHTML(item.name)}</span>
            </div>
            ${item.quantity ? `<span class="print-shopping-qty">${escapeHTML(item.quantity)}</span>` : ''}
          `;
          groupDiv.appendChild(row);
        });
        printShoppingBody.appendChild(groupDiv);
      });

      // Catch legacy Category fallback items
      const otherList = grouped['Other'] || [];
      if (otherList.length > 0 && !state.shoppingCategories.some((c) => c.name === 'Other')) {
        const groupDiv = document.createElement('div');
        groupDiv.className = 'print-shopping-category';
        groupDiv.innerHTML = `<h3 class="print-shopping-header">Other</h3>`;
        otherList.forEach((item) => {
          const row = document.createElement('div');
          row.className = 'print-shopping-item';
          row.innerHTML = `
            <div class="print-shopping-item-left">
              <div class="print-checkbox ${item.checked ? 'checked' : ''}"></div>
              <span class="print-shopping-name">${escapeHTML(item.name)}</span>
            </div>
            ${item.quantity ? `<span class="print-shopping-qty">${escapeHTML(item.quantity)}</span>` : ''}
          `;
          groupDiv.appendChild(row);
        });
        printShoppingBody.appendChild(groupDiv);
      }
    }
  }

  document.body.classList.add('print-mode-shopping');
  window.print();

  // Cleanup printing state
  setTimeout(() => {
    document.body.classList.remove('print-mode-shopping');
  }, 500);
}

export function renderShoppingListsDropdown() {
  const shoppingListSelector = document.getElementById('shoppingListSelector');
  const deleteShoppingListBtn = document.getElementById('deleteShoppingListBtn');

  if (!shoppingListSelector) return;
  shoppingListSelector.innerHTML = '';
  state.shoppingLists.forEach((list) => {
    const option = document.createElement('option');
    option.value = list.id;
    option.textContent = list.name;
    shoppingListSelector.appendChild(option);
  });
  shoppingListSelector.value = state.activeShoppingListId;
  if (deleteShoppingListBtn) {
    deleteShoppingListBtn.disabled = state.activeShoppingListId === 1;
  }
}

export function initShoppingListsEvents() {
  const shoppingListSelector = document.getElementById('shoppingListSelector');
  const addShoppingListBtn = document.getElementById('addShoppingListBtn');
  const deleteShoppingListBtn = document.getElementById('deleteShoppingListBtn');
  const shoppingListModal = document.getElementById('shoppingListModal');
  const shoppingListForm = document.getElementById('shoppingListForm');
  const newShoppingListName = document.getElementById('newShoppingListName');
  const closeShoppingListModalBtn = document.getElementById('closeShoppingListModalBtn');
  const cancelShoppingListModalBtn = document.getElementById('cancelShoppingListModalBtn');

  if (shoppingListSelector) {
    shoppingListSelector.addEventListener('change', (e) => {
      state.activeShoppingListId = parseInt(e.target.value);
      fetchShopping();
      if (deleteShoppingListBtn) {
        deleteShoppingListBtn.disabled = state.activeShoppingListId === 1;
      }
    });
  }

  if (addShoppingListBtn) {
    addShoppingListBtn.addEventListener('click', () => {
      if (newShoppingListName) newShoppingListName.value = '';
      if (shoppingListModal) shoppingListModal.showModal();
    });
  }

  if (closeShoppingListModalBtn) {
    closeShoppingListModalBtn.addEventListener('click', () => {
      if (shoppingListModal) shoppingListModal.close();
    });
  }

  if (cancelShoppingListModalBtn) {
    cancelShoppingListModalBtn.addEventListener('click', () => {
      if (shoppingListModal) shoppingListModal.close();
    });
  }

  if (shoppingListForm) {
    shoppingListForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = newShoppingListName ? newShoppingListName.value.trim() : '';
      if (!name) return;

      try {
        const newList = await api.saveShoppingList({ name });
        if (shoppingListModal) shoppingListModal.close();

        state.activeShoppingListId = newList.id;
        await fetchShoppingLists();
        fetchShopping();
      } catch (err) {
        alert(err.message);
      }
    });
  }

  if (deleteShoppingListBtn) {
    deleteShoppingListBtn.addEventListener('click', async () => {
      if (state.activeShoppingListId === 1) {
        alert('The default shopping list cannot be deleted.');
        return;
      }
      const activeList = state.shoppingLists.find((l) => l.id === state.activeShoppingListId);
      const listName = activeList ? activeList.name : 'this list';

      if (
        confirm(
          `Are you sure you want to delete the shopping list "${listName}"? This will delete all its items too and cannot be undone.`
        )
      ) {
        try {
          await api.deleteShoppingList(state.activeShoppingListId);
          state.activeShoppingListId = 1;
          await fetchShoppingLists();
          fetchShopping();
        } catch (err) {
          alert(err.message);
        }
      }
    });
  }
}
export function initShoppingFormEvents() {
  const addShoppingItemForm = document.getElementById('addShoppingItemForm');
  const clearCompletedShoppingBtn = document.getElementById('clearCompletedShoppingBtn');
  const printShoppingBtn = document.getElementById('printShoppingBtn');
  const sortShopping = document.getElementById('sortShopping');

  if (addShoppingItemForm) {
    addShoppingItemForm.addEventListener('submit', handleShoppingItemFormSubmit);
  }

  if (clearCompletedShoppingBtn) {
    clearCompletedShoppingBtn.addEventListener('click', clearCompletedShoppingItems);
  }

  if (printShoppingBtn) {
    printShoppingBtn.addEventListener('click', handlePrintShoppingList);
  }

  if (sortShopping) {
    sortShopping.addEventListener('change', (e) => {
      state.shoppingSortMode = e.target.value;
      renderShopping();
    });
  }
}
