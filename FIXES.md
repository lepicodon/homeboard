# Cleanliness & Performance Remediation Plan

This plan details the steps to address the cleanliness and performance issues identified during the security and quality scan of `HomeBoard`.

## User Review Required

> [!IMPORTANT]
> **Architectural Refactoring:** We are splitting the monolithic backend `server.js` and frontend `public/js/app.js` into modular files. While this improves maintainability and cleanliness, it changes the files being deployed.
>
> **Runtime Impact:**
>
> - Backend changes will require additional packages (e.g. `compression` for asset minification, and updating dependencies).
> - Frontend changes will transition the app to use native ES Modules (`<script type="module">`).

---

## Proposed Changes

### Component 1: Dependency Updates & Build Config

We will introduce style checks, testing framework stubs, and compression middleware.

#### [MODIFY] [package.json](file:///Users/jc/Documents/code/!github/home-todo/package.json)

- Add `compression` dependency to compress static assets.
- Add ESLint, Prettier, and Jest as development dependencies.
- Add run scripts for `lint`, `format`, and `test`.

---

### Component 2: Backend Modularization (`server.js`)

We will split the 1,129-line monolithic `server.js` into modules.

#### [NEW] [db.js](file:///Users/jc/Documents/code/!github/home-todo/src/config/db.js)

- Move database initialization, PRAGMA foreign keys setup, and database schema migration/updates checks here.
- Export the database connection instance (`db`).

#### [NEW] [Route Modules](file:///Users/jc/Documents/code/!github/home-todo/src/routes/)

Create separate Express router modules under `src/routes/`:

- `tasks.js`: CRUD endpoints for tasks and members assigned.
- `members.js`: CRUD endpoints for family members.
- `categories.js`: CRUD endpoints for task categories.
- `memos.js`: CRUD endpoints for sticky board memos.
- `shopping.js`: CRUD endpoints for shopping lists and items.
- `settings.js`: Settings endpoints (includes masking `weather_apikey` in GET response).

#### [MODIFY] [server.js](file:///Users/jc/Documents/code/!github/home-todo/server.js)

- Import router modules and database configuration.
- Integrate `compression` middleware to optimize asset delivery.
- Set up static folder routing.
- Initialize the server listener.

---

### Component 3: Frontend Modularization (`app.js`)

We will refactor the 81KB monolithic client script into ES6 Modules.

#### [MODIFY] [index.html](file:///Users/jc/Documents/code/!github/home-todo/public/index.html)

- Change `<script src="js/app.js"></script>` to `<script type="module" src="js/app.js"></script>`.
- Change remote Google Fonts links to local stylesheets serving self-hosted font files (downloaded in `public/fonts/`).

#### [NEW] [api.js](file:///Users/jc/Documents/code/!github/home-todo/public/js/api.js)

- Standardize all backend network requests (`fetch` API calls) into a helper module.

#### [NEW] [UI Modules](file:///Users/jc/Documents/code/!github/home-todo/public/js/modules/)

Create separate Javascript modules to handle individual dashboard views:

- `tasks.js`: Rendering task boards, filters, and modals.
- `calendar.js`: Render monthly calendar grids and mobile agenda lists.
- `memos.js`: Render the stickies memos wall and edit modals.
- `shopping.js`: Render categorized checklist tables.
- `settings.js`: Render setting controls and form submits.

#### [MODIFY] [app.js](file:///Users/jc/Documents/code/!github/home-todo/public/js/app.js)

- Serve as the orchestration entrypoint, importing individual UI modules and routing dashboard sections on hash change (`window.onhashchange`).

---

### Component 4: Local Font Self-Hosting (Performance)

#### [NEW] [Outfit Fonts Folder](file:///Users/jc/Documents/code/!github/home-todo/public/fonts/)

- Serve the Outfit font `.woff2` files locally to eliminate external, render-blocking fetches from Google servers.

---

## Verification Plan

### Automated Tests

- Run `npm run lint` to verify code style matches Prettier/ESLint configs.
- Launch the application locally and verify no console errors are reported in Node.js or browser developer tools.

### Manual Verification

- Verify that GZIP compression works by inspecting Network response headers (`Content-Encoding: gzip`).
- Verify that local fonts load correctly in offline mode (simulate offline in Chrome DevTools).
- Verify database migrations run cleanly on first start by running with an empty database directory.
