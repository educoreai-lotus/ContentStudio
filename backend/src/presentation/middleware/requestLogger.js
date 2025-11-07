import { logger } from '../../infrastructure/logging/Logger.js';

/**
 * Request logging middleware
 * Logs all incoming requests with response time
 */
export const requestLogger = (req, res, next) => {
  const startTime = Date.now();

  // Log request start
  logger.debug('Request started', {
    method: req.method,
    path: req.path,
    ip: req.ip || req.connection.remoteAddress,
  });

  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function (...args) {
    const responseTime = Date.now() - startTime;
    logger.logRequest(req, res, responseTime);
    originalEnd.apply(this, args);
  };

  next();
};

