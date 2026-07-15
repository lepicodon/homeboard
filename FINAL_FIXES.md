# Security & Cleanliness Remediation Plan

This plan details the steps to address the remaining Security and Cleanliness recommendations from our codebase scan.

## User Review Required

> [!IMPORTANT]
> **API Authentication Security:**
> We are adding an optional password protection mechanism. If `APP_PASSWORD` is configured in the `.env` file, the server will enforce authentication for all API endpoints.
>
> - For a simple, zero-frontend-refactor approach, we will use HTTP Basic Authentication. When accessing the app in the browser, the browser will natively prompt for username (any value or blank) and the configured password.
> - If `APP_PASSWORD` is left empty or not defined, the app will continue to run without authentication (open access), preserving backwards compatibility.
>
> **Refactoring `server.js` for Testing:**
> To enable API integration tests with `supertest`, we will export the Express `app` instance from `server.js`. This allows tests to run without binding to a physical network port.

---

## Proposed Changes

### Component 1: Dependency Updates

We will add rate-limiting middleware for production security and HTTP test utility packages.

#### [MODIFY] [package.json](file:///Users/jc/Documents/code/!github/home-todo/package.json)

- Add `express-rate-limit` to `dependencies`.
- Add `supertest` to `devDependencies`.

---

### Component 2: Backend Refactoring (`server.js`)

We will configure rate limiting, authentication middleware, and export `app`.

#### [MODIFY] [server.js](file:///Users/jc/Documents/code/!github/home-todo/server.js)

- Import and configure `express-rate-limit` for all `/api/` endpoints.
- Add basic auth middleware using custom check logic: if `process.env.APP_PASSWORD` is defined, require HTTP Basic Auth validation against it.
- Export `app` at the bottom of the file to support integration tests.

---

### Component 3: API Integration Tests

We will add comprehensive tests for key API endpoints.

#### [NEW] [api.test.js](file:///Users/jc/Documents/code/!github/home-todo/tests/api.test.js)

- Create integration tests using Jest and `supertest`.
- Test cases will verify:
  - Task creation, completion, listing, and deletion.
  - Sticky board memo CRUD operations.
  - Shopping checklist updates.
  - Setting updates and key masking verification.
  - Enforced authentication behavior when `APP_PASSWORD` is mocked in the test environment.

---

## Verification Plan

### Automated Tests

- Run `npm install` to load new packages.
- Run `npm test` to verify that both the existing database unit tests (`db.test.js`) and the new API integration tests (`api.test.js`) pass successfully.
- Run `npm run lint` to verify eslint compliance.

### Manual Verification

1. **Rate Limiting:** Verify that spamming requests to `/api/` triggers an HTTP `429 Too Many Requests` response.
2. **Access Control:** Set `APP_PASSWORD=secret` in a local test `.env` file, reload the app, and verify that the browser requests credentials, rejecting access with `401 Unauthorized` on failure.
