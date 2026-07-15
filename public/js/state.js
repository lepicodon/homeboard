export const state = {
  tasks: [],
  categories: [],
  members: [],
  memos: [],
  shoppingItems: [],
  shoppingCategories: [],
  shoppingLists: [],
  activeShoppingListId: 1,
  weatherLocations: [],
  activeWeatherLocationId: null,
  viewMode: localStorage.getItem('view-mode') || 'grid',
  shoppingSortMode: 'category',
  currentCalendarDate: new Date(),
  appTitle: 'HomeBoard',
  tasksPerPage: 10,
  currentPage: 1,
  filters: {
    search: '',
    status: 'pending',
    category: 'all',
    size: 'all',
    assignee: 'all'
  },
  currentEditingTaskId: null,
  currentDeletingItem: { type: null, id: null }
};
