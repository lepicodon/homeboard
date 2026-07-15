const express = require('express');
const compression = require('compression');
const path = require('path');
require('dotenv').config();

// Initialize Database immediately on startup
require('./src/config/db');

const app = express();
const PORT = process.env.PORT || 3000;

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
const { settingsRouter, weatherRouter } = require('./src/routes/settings');
const rateLimit = require('express-rate-limit');
const authMiddleware = require('./src/middleware/auth');

// Configure API Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'test' ? 10000 : 100,
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
app.use('/api/weather', weatherRouter);

// Start Server conditionally
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
  });
}

module.exports = app;
