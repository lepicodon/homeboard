# 🏠 HomeTodo - Family Chores & Task Dashboard

HomeTodo is a lightweight, responsive, and modern dashboard application built to organize household chores, share sticky note memos, and manage family shopping lists. It runs seamlessly on desktop, tablet, and mobile devices with full light/dark theme support.

---

## 🌟 Key Features

### 📋 Task Management
* **Flexible Sizing**: Classify chores as **Small** (green), **Medium** (amber), or **Big** (red).
* **Assignees**: Assign tasks to multiple family members, unassigned, or external names/services.
* **Recurrence Engine**: Support for **weekly, bi-weekly, monthly, or quarterly** chore recurrence. When completed, next occurrence is spawned automatically with advanced deadlines.

### 📅 Calendar Agenda View
* **Desktop Grid**: Monthly calendar grid visualizing tasks and memos categorized by colors on deadline days.
* **Mobile Agenda**: Automatically transforms into a vertical chronological list view. Empty days are hidden dynamically using native `:has()` parent selectors.

### 📌 Memo Sticky Board
* **Visual Notes**: Fridge-board grid using colored pastel memos (8 colors available) randomly rotated for realism.
* **Calendar Deadlines**: Memos can have optional dates linking them directly into calendar days as event notifications.

### 🛒 Shared Shopping List
* **Categorized Checkout**: Sort items by **Category** (Dairy, Produce, Pantry) or flat **Alphabetical Name**.
* **Print Ready**: Dedicated styling layouts and print configurations for checklists.

### 🔒 Access & Security Protection
* **Optional Password Authentication**: Enable username-free page locking directly from the settings panel. If enabled, the server enforces access validation and the client prompts for a passcode using a browser overlay.
* **Lock Dashboard Button**: A dedicated Lock button (🔒) appears in the sidebar footer when passcode protection is active.
* **API Rate Limiting**: Built-in rate limiting middleware protects database endpoints from automated floods.
* **Settings Masking**: Confidential keys (like the OpenWeatherMap API key or access passwords) are masked (`******`) in transit and in developer tools.

### ⚡ Performance & Optimization
* **Font Self-Hosting**: serve the Google Font `Outfit` locally from the repository to remove external render-blocking network requests.
* **Static Assets Compression**: GZIP asset encoding (via `compression` middleware) and daily caching headers configured in the Express server.
* **Weather Proxy Caching**: Weather API requests are cached in memory for 30 minutes to stay within external API rate limits.
* **Database Indexing**: SQLite tables (tasks, members, shopping) use indexes on key query fields (completed, deadline, checked, list_id) for optimal performance.

---

## 🛠️ Technology Stack

* **Frontend**: HTML5, Vanilla ES6 Modules, custom CSS Design Tokens.
* **Backend**: Node.js, Express API server.
* **Database**: SQLite (`better-sqlite3`) with schema migrations and indexes.
* **Containerization**: Docker (alpine Linux images) with volume mounts for persistence.
* **Tooling & Styling**: ESLint for linting, Prettier for formatting.
* **Test Suite**: Jest and `supertest` for database unit tests and API integration routing tests.

---

## 📂 Project Architecture

```
home-todo/
├── src/
│   ├── config/
│   │   └── db.js            # Database setup, migrations, and seeding
│   ├── middleware/
│   │   └── auth.js          # API access protection middleware
│   └── routes/              # Express API Route Handlers
│       ├── categories.js
│       ├── members.js
│       ├── memos.js
│       ├── settings.js      # App configurations & Weather proxies
│       ├── shopping.js
│       └── tasks.js
├── public/                  # Static Frontend Client
│   ├── css/
│   │   └── style.css        # Dashboard stylesheet & self-hosted fonts
│   ├── fonts/               # Self-hosted woff2 Outfit fonts
│   ├── js/                  # ES6 Modular Frontend
│   │   ├── api.js           # AJAX API wrapper & 401 prompt redirect
│   │   ├── app.js           # Bootstrap orchestrator
│   │   ├── state.js         # Shared client state
│   │   ├── utils.js         # DOM escaping utilities
│   │   └── modules/         # Dashboard view managers (calendar, tasks, etc.)
│   └── index.html           # Single Page Layout
├── tests/
│   ├── api.test.js          # Supertest router integration tests
│   └── db.test.js           # SQLite unit database tests
├── Dockerfile               # Node.js alpine container configuration
├── docker-compose.yml       # Dev stack volumes & routing setup
├── package.json
└── server.js                # App listener entrypoint
```

---

## 🚀 Getting Started

### Docker Deployment (Recommended)
1. Clone or download the repository.
2. Build and launch the container stack:
   ```bash
   docker compose up --build -d
   ```
3. Open [http://localhost:3000](http://localhost:3000) inside your web browser.

### Local Development Setup
1. Install dependencies:
   ```bash
   npm install
   ```
2. Start the development server (runs nodemon for auto-reload):
   ```bash
   npm run dev
   ```

---

## 📡 API Overview

* **Access Check**: `GET /api/settings/auth-status` | `POST /api/settings/authenticate`
* **Tasks**: `GET`, `POST`, `PUT`, `DELETE` at `/api/tasks` | Toggle status at `PATCH /api/tasks/:id/toggle`
* **Memos**: `GET`, `POST`, `PUT`, `DELETE` at `/api/memos`
* **Shopping**: `GET`, `POST`, `PATCH`, `DELETE` at `/api/shopping` | Clear checked at `POST /api/shopping/clear-completed`
* **Family Members**: `GET`, `POST`, `PUT`, `DELETE` at `/api/members`
* **System Settings**: `GET`, `PUT` at `/api/settings`
* **Weather Proxy**: `GET /api/weather` | Manage locations at `GET`, `POST`, `DELETE`, `PUT` at `/api/weather/locations`

---

## 🧪 Development Commands

* **Run Tests**: Execute the database and API test suite:
  ```bash
  npm test
  ```
* **Lint Check**: Run style assertions:
  ```bash
  npm run lint
  ```
* **Code Formatter**: Reformat the code using Prettier rules:
  ```bash
  npm run format
  ```
