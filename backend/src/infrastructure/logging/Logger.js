/**
 * Simple Logger Implementation
 * Can be replaced with Winston/Pino in production
 */

const LOG_LEVELS = {
  ERROR: 0,
  WARN: 1,
  INFO: 2,
  DEBUG: 3,
};

class Logger {
  constructor() {
    this.level = process.env.LOG_LEVEL || 'INFO';
    this.levelValue = LOG_LEVELS[this.level] || LOG_LEVELS.INFO;
  }

  formatMessage(level, message, meta = {}) {
    const timestamp = new Date().toISOString();
    const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : '';
    return `[${timestamp}] [${level}] ${message}${metaStr}`;
  }

  error(message, meta = {}) {
    if (LOG_LEVELS.ERROR <= this.levelValue) {
      console.error(this.formatMessage('ERROR', message, meta));
    }
  }

  warn(message, meta = {}) {
    if (LOG_LEVELS.WARN <= this.levelValue) {
      console.warn(this.formatMessage('WARN', message, meta));
    }
  }

  info(message, meta = {}) {
    if (LOG_LEVELS.INFO <= this.levelValue) {
      console.log(this.formatMessage('INFO', message, meta));
    }
  }

  debug(message, meta = {}) {
    if (LOG_LEVELS.DEBUG <= this.levelValue) {
      console.log(this.formatMessage('DEBUG', message, meta));
    }
  }

  // Request logging
  logRequest(req, res, responseTime) {
    this.info('HTTP Request', {
      method: req.method,
      path: req.path,
      status: res.statusCode,
      responseTime: `${responseTime}ms`,
      ip: req.ip || req.connection.remoteAddress,
    });
  }

  // Error logging with context
  logError(error, context = {}) {
    this.error(error.message || 'Unknown error', {
      ...context,
      stack: error.stack,
      name: error.name,
    });
  }
}

// Singleton instance
export const logger = new Logger();

