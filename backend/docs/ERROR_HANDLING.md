# Error Handling & Logging

## Overview

The Content Studio backend implements comprehensive error handling and logging to ensure reliability and debuggability.

## Error Handler

**Location:** `backend/src/presentation/middleware/errorHandler.js`

### Error Types Handled

1. **Validation Errors (400)**
   - Missing required fields
   - Invalid data format
   - Template validation failures

2. **Not Found Errors (404)**
   - Course not found
   - Topic not found
   - Content not found
   - Template not found
   - Version not found

3. **Conflict Errors (409)**
   - Duplicate entries (unique constraint violations)

4. **Foreign Key Violations (400)**
   - Referenced resource does not exist

5. **AI Service Errors (503)**
   - OpenAI API unavailable
   - Gemini API unavailable
   - AI generation failures

6. **Internal Errors (500)**
   - Unexpected server errors
   - Database connection issues

### Error Response Format

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "timestamp": "2024-01-15T10:30:00.000Z",
    "stack": "Error stack trace (development only)"
  }
}
```

## Logging

**Location:** `backend/src/infrastructure/logging/Logger.js`

### Log Levels

- **ERROR (0):** Critical errors that require attention
- **WARN (1):** Warnings about potential issues
- **INFO (2):** General informational messages
- **DEBUG (3):** Detailed debugging information

### Configuration

Set log level via environment variable:
```env
LOG_LEVEL=INFO  # ERROR, WARN, INFO, DEBUG
```

### Logging Features

1. **Structured Logging**
   - Timestamp
   - Log level
   - Message
   - Metadata (optional)

2. **Request Logging**
   - HTTP method
   - Path
   - Status code
   - Response time
   - Client IP

3. **Error Logging**
   - Error message
   - Stack trace
   - Request context (method, path, body, params, query)

### Usage Examples

```javascript
import { logger } from './infrastructure/logging/Logger.js';

// Info log
logger.info('User created', { userId: 123 });

// Error log with context
logger.logError(error, {
  method: req.method,
  path: req.path,
  userId: req.user?.id,
});

// Request log (automatic via middleware)
// Logs: [timestamp] [INFO] HTTP Request {"method":"GET","path":"/api/courses","status":200,"responseTime":"45ms"}
```

## Request Logger Middleware

**Location:** `backend/src/presentation/middleware/requestLogger.js`

Logs all incoming requests with:
- HTTP method
- Request path
- Response status
- Response time
- Client IP

**Enabled by default in development**, or set `LOG_REQUESTS=true` in production.

## Error Handling Best Practices

### 1. Use Specific Error Codes

```javascript
throw new Error('Course not found');
// Will be caught as 404 with code 'NOT_FOUND'
```

### 2. Provide Context

```javascript
logger.logError(error, {
  userId: req.user?.id,
  action: 'create_course',
  data: req.body,
});
```

### 3. Don't Expose Sensitive Information

- Never log passwords, API keys, or tokens
- Stack traces only in development
- Sanitize user input in error messages

### 4. Handle Async Errors

```javascript
// Use try-catch in async functions
try {
  await someAsyncOperation();
} catch (error) {
  logger.logError(error, { context: 'operation_name' });
  throw error; // Let errorHandler handle it
}
```

## Production Considerations

### 1. External Logging Service

Replace simple logger with:
- **Winston** - Popular Node.js logger
- **Pino** - Fast JSON logger
- **Bunyan** - Structured logger

Example with Winston:
```javascript
import winston from 'winston';

const logger = winston.createLogger({
  level: 'info',
  format: winston.format.json(),
  transports: [
    new winston.transports.File({ filename: 'error.log', level: 'error' }),
    new winston.transports.File({ filename: 'combined.log' }),
  ],
});
```

### 2. Error Monitoring

Integrate with:
- **Sentry** - Error tracking
- **Rollbar** - Error monitoring
- **LogRocket** - Session replay + logging

### 3. Rate Limiting

Add rate limiting to prevent abuse:
```javascript
import rateLimit from 'express-rate-limit';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100 // limit each IP to 100 requests per windowMs
});
```

### 4. Request ID Tracking

Add request IDs for tracing:
```javascript
import { v4 as uuidv4 } from 'uuid';

app.use((req, res, next) => {
  req.id = uuidv4();
  res.setHeader('X-Request-ID', req.id);
  next();
});
```

## Testing Error Handling

### Unit Tests

```javascript
describe('Error Handler', () => {
  it('should return 400 for validation errors', async () => {
    const response = await request(app)
      .post('/api/courses')
      .send({});
    
    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe('VALIDATION_ERROR');
  });
});
```

### Integration Tests

Test error scenarios:
- Invalid input
- Missing resources
- Database errors
- External service failures

## Monitoring

### Key Metrics to Monitor

1. **Error Rate** - Percentage of requests that fail
2. **Response Time** - P50, P95, P99 latencies
3. **Error Types** - Distribution of error codes
4. **API Availability** - Uptime percentage

### Alerts

Set up alerts for:
- Error rate > 5%
- Response time > 1s (P95)
- 5xx errors
- Database connection failures

## Future Enhancements

1. **Structured Logging** - JSON format for log aggregation
2. **Log Aggregation** - ELK Stack, Datadog, etc.
3. **Error Tracking** - Sentry integration
4. **Performance Monitoring** - APM tools
5. **Request Tracing** - Distributed tracing with OpenTelemetry

