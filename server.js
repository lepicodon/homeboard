const express = require('express');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Initialize Database immediately on startup
require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

// Trust reverse proxy headers (e.g. Docker ingress, Nginx, Cloudflare)
app.set('trust proxy', 1);

// Middleware
app.use(compression());
app.use(express.json({ limit: '10mb' }));
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1d',
    etag: true
  })
);

// Import Routers
const categoriesRouter = require('./src/routes/categories');
const membersRouter = require('./src/routes/members');
const tasksRouter = require('./src/routes/tasks');
const memosRouter = require('./src/routes/memos');
const shoppingRouter = require('./src/routes/shopping');
const settingsRouter = require('./src/routes/settings');
const weatherRouter = require('./src/routes/weather');
const backupRouter = require('./src/routes/backup');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('./src/middleware/auth');
const errorHandler = require('./src/middleware/errorHandler');

const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const RATE_LIMIT_MAX_REQUESTS = 100;
const RATE_LIMIT_MAX_TEST_REQUESTS = 10000;

const isTestMode = process.env.NODE_ENV === 'test' || process.env.TEST_MODE === 'true';

// Configure API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: RATE_LIMIT_WINDOW_MS,
  max: isTestMode ? RATE_LIMIT_MAX_TEST_REQUESTS : RATE_LIMIT_MAX_REQUESTS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' }
});

// Apply rate limiter and auth middleware to all API routes
app.use('/api', apiLimiter);
app.use('/api', authMiddleware);

// API Routes
app.use('/api/categories', categoriesRouter);
app.use('/api/members', membersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/memos', memosRouter);
app.use('/api/shopping', shoppingRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/settings', backupRouter);
app.use('/api/weather', weatherRouter);

// Centralized Error Handling Middleware
app.use(errorHandler);

// Start Server conditionally
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
