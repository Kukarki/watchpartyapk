import { logger } from '../utils/logger.js';

export function errorHandler(err, req, res, next) {
  const status  = err.status || err.statusCode || 500;
  const isDev    = process.env.NODE_ENV !== 'production';

  // Always log the full detail server-side.
  logger.error('HTTP error', {
    status,
    message: err.message,
    path:    req.path,
    method:  req.method,
    stack:   err.stack,
  });

  // SECURITY: never leak internal error text to clients on 500 in production.
  // 4xx errors carry intentional, safe messages, so those pass through.
  const clientMessage =
    status === 500 && !isDev
      ? 'Internal server error'
      : (err.message || 'Internal server error');

  res.status(status).json({
    error: clientMessage,
    ...(isDev && { stack: err.stack }),
  });
}

export function notFound(req, res) {
  // Don't echo the raw method/path back (minor info-leak hardening).
  res.status(404).json({ error: 'Not found' });
}
