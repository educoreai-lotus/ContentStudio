import { logger } from '../../infrastructure/logging/Logger.js';

export const errorHandler = (err, req, res, next) => {
  // Log error with context
  logger.logError(err, {
    method: req.method,
    path: req.path,
    body: req.body,
    params: req.params,
    query: req.query,
  });

  // Validation errors
  if (err.message.includes('required') || 
      err.message.includes('must be') || 
      err.message.includes('validation failed') ||
      err.message.includes('Invalid')) {
    return res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: err.message,
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Not found errors
  const notFoundCodes = [
    'COURSE_NOT_FOUND',
    'TOPIC_NOT_FOUND',
    'CONTENT_NOT_FOUND',
    'TEMPLATE_NOT_FOUND',
    'VERSION_NOT_FOUND',
  ];
  
  if (notFoundCodes.includes(err.code) || 
      err.message.includes('not found') ||
      err.message.includes('Not found')) {
    return res.status(404).json({
      success: false,
      error: {
        code: err.code || 'NOT_FOUND',
        message: err.message || 'Resource not found',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Database errors
  if (err.code === '23505') { // Unique constraint violation
    return res.status(409).json({
      success: false,
      error: {
        code: 'DUPLICATE_ENTRY',
        message: 'A record with this information already exists',
        timestamp: new Date().toISOString(),
      },
    });
  }

  if (err.code === '23503') { // Foreign key violation
    return res.status(400).json({
      success: false,
      error: {
        code: 'FOREIGN_KEY_VIOLATION',
        message: 'Referenced resource does not exist',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // AI Service errors
  if (err.message.includes('OpenAI') || 
      err.message.includes('Gemini') || 
      err.message.includes('AI generation failed')) {
    return res.status(503).json({
      success: false,
      error: {
        code: 'AI_SERVICE_UNAVAILABLE',
        message: 'AI service is currently unavailable. Please try again later.',
        timestamp: new Date().toISOString(),
      },
    });
  }

  // Default error
  const statusCode = err.status || err.statusCode || 500;
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(statusCode).json({
    success: false,
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      ...(isDevelopment && { stack: err.stack }),
      timestamp: new Date().toISOString(),
    },
  });
};

