function errorHandler(err, req, res, next) {
  console.error('[Error Handler] Caught error:', err);

  const statusCode = res.statusCode !== 200 ? res.statusCode : 500;
  
  if (err.message && err.message.includes('UNIQUE constraint failed')) {
    return res.status(400).json({ error: err.message });
  }

  res.status(statusCode).json({
    error: err.message || 'Internal Server Error'
  });
}

module.exports = errorHandler;
