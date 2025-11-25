# Security Implementation Guide

## Overview

This document outlines security enhancements for the Content Studio API.

## Current Status

⚠️ **Warning:** The API currently does not have authentication/authorization implemented. This should be added before production deployment.

## Planned Security Features

### 1. JWT Authentication

#### Implementation

```javascript
// backend/src/infrastructure/auth/JWTAuth.js
import jwt from 'jsonwebtoken';

export class JWTAuth {
  constructor() {
    this.secret = process.env.JWT_SECRET || 'your-secret-key';
    this.expiresIn = process.env.JWT_EXPIRES_IN || '24h';
  }

  generateToken(payload) {
    return jwt.sign(payload, this.secret, {
      expiresIn: this.expiresIn,
    });
  }

  verifyToken(token) {
    try {
      return jwt.verify(token, this.secret);
    } catch (error) {
      throw new Error('Invalid token');
    }
  }
}
```

#### Middleware

```javascript
// backend/src/presentation/middleware/auth.js
import { JWTAuth } from '../../infrastructure/auth/JWTAuth.js';

export const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'UNAUTHORIZED',
        message: 'Authentication required',
      },
    });
  }

  const token = authHeader.substring(7);
  const jwtAuth = new JWTAuth();

  try {
    const decoded = jwtAuth.verifyToken(token);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: {
        code: 'INVALID_TOKEN',
        message: 'Invalid or expired token',
      },
    });
  }
};
```

#### Usage

```javascript
// In routes
import { authenticate } from '../middleware/auth.js';

router.post('/courses', authenticate, courseController.create);
```

### 2. Role-Based Access Control (RBAC)

#### Roles

- **admin** - Full access
- **trainer** - Can create/edit own content
- **learner** - Read-only access

#### Implementation

```javascript
// backend/src/presentation/middleware/rbac.js
export const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'Authentication required',
        },
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'Insufficient permissions',
        },
      });
    }

    next();
  };
};
```

#### Usage

```javascript
// Only trainers and admins can create courses
router.post('/courses', 
  authenticate, 
  authorize('trainer', 'admin'), 
  courseController.create
);

// Only admins can delete courses
router.delete('/courses/:id', 
  authenticate, 
  authorize('admin'), 
  courseController.delete
);
```

### 3. Ownership Validation

#### Middleware

```javascript
// backend/src/presentation/middleware/ownership.js
export const validateOwnership = (resourceType) => {
  return async (req, res, next) => {
    const resourceId = req.params.id;
    const userId = req.user.id;

    // Get resource
    const repository = getRepository(resourceType);
    const resource = await repository.findById(resourceId);

    if (!resource) {
      return res.status(404).json({
        success: false,
        error: {
          code: 'NOT_FOUND',
          message: 'Resource not found',
        },
      });
    }

    // Check ownership (unless admin)
    if (req.user.role !== 'admin' && resource.created_by !== userId) {
      return res.status(403).json({
        success: false,
        error: {
          code: 'FORBIDDEN',
          message: 'You can only modify your own resources',
        },
      });
    }

    req.resource = resource;
    next();
  };
};
```

### 4. Rate Limiting

#### Implementation

```javascript
// Install: npm install express-rate-limit
import rateLimit from 'express-rate-limit';

// General rate limiter
export const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // 100 requests per window
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'Too many requests, please try again later',
    },
  },
});

// Strict rate limiter for AI generation
export const aiGenerationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 20, // 20 requests per hour
  message: {
    success: false,
    error: {
      code: 'RATE_LIMIT_EXCEEDED',
      message: 'AI generation rate limit exceeded',
    },
  },
});
```

#### Usage

```javascript
// Apply to all routes
app.use('/api', generalLimiter);

// Apply to AI generation
app.use('/api/content/ai', aiGenerationLimiter);
```

### 5. Input Validation & Sanitization

#### Validation

```javascript
// Install: npm install express-validator
import { body, validationResult } from 'express-validator';

export const validateCourse = [
  body('course_name')
    .trim()
    .notEmpty()
    .withMessage('Course name is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Course name must be between 3 and 100 characters'),
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description must be less than 1000 characters'),
];

// In route
router.post('/courses', 
  authenticate,
  validateCourse,
  (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: errors.array()[0].msg,
          details: errors.array(),
        },
      });
    }
    next();
  },
  courseController.create
);
```

#### Sanitization

```javascript
// Install: npm install dompurify
import DOMPurify from 'isomorphic-dompurify';

export const sanitizeInput = (req, res, next) => {
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = DOMPurify.sanitize(req.body[key]);
      }
    });
  }
  next();
};
```

### 6. SQL Injection Prevention

✅ **Already Implemented:** All PostgreSQL queries use parameterized queries:

```javascript
// Safe - uses parameters
await db.query('SELECT * FROM courses WHERE course_id = $1', [courseId]);

// Unsafe - never do this
await db.query(`SELECT * FROM courses WHERE course_id = ${courseId}`);
```

### 7. CORS Configuration

```javascript
// In server.js
import cors from 'cors';

const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:5173'],
  credentials: true,
  optionsSuccessStatus: 200,
};

app.use(cors(corsOptions));
```

### 8. Helmet for Security Headers

```javascript
// Install: npm install helmet
import helmet from 'helmet';

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));
```

## Environment Variables

```env
# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=24h

# CORS
ALLOWED_ORIGINS=http://localhost:5173,https://app.educore.ai

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX=100

# Security
NODE_ENV=production
```

## Implementation Checklist

### Phase 1: Basic Security
- [ ] Install security packages (helmet, express-rate-limit, express-validator)
- [ ] Add CORS configuration
- [ ] Add Helmet security headers
- [ ] Implement rate limiting

### Phase 2: Authentication
- [ ] Install JWT package
- [ ] Implement JWT authentication
- [ ] Add authentication middleware
- [ ] Create login endpoint
- [ ] Protect all routes

### Phase 3: Authorization
- [ ] Implement RBAC
- [ ] Add role-based middleware
- [ ] Implement ownership validation
- [ ] Update all routes with authorization

### Phase 4: Input Security
- [ ] Add input validation
- [ ] Add input sanitization
- [ ] Add file upload validation
- [ ] Add XSS prevention

### Phase 5: Monitoring
- [ ] Add security logging
- [ ] Add failed login tracking
- [ ] Add suspicious activity detection
- [ ] Set up security alerts

## Security Best Practices

1. **Never commit secrets** - Use environment variables
2. **Use HTTPS** - Always in production
3. **Validate all input** - Never trust user input
4. **Use parameterized queries** - Prevent SQL injection
5. **Limit request size** - Prevent DoS attacks
6. **Log security events** - Monitor for attacks
7. **Keep dependencies updated** - Regular security updates
8. **Use strong passwords** - For JWT secrets and database
9. **Implement CSRF protection** - For state-changing operations
10. **Regular security audits** - Use tools like npm audit

## Testing Security

### Test Authentication

```javascript
describe('Authentication', () => {
  it('should reject requests without token', async () => {
    const response = await request(app)
      .post('/api/courses')
      .expect(401);
    
    expect(response.body.error.code).toBe('UNAUTHORIZED');
  });

  it('should accept valid token', async () => {
    const token = generateTestToken();
    const response = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .send({ ... })
      .expect(201);
  });
});
```

### Test Authorization

```javascript
describe('Authorization', () => {
  it('should reject learner from creating courses', async () => {
    const token = generateTestToken({ role: 'learner' });
    const response = await request(app)
      .post('/api/courses')
      .set('Authorization', `Bearer ${token}`)
      .expect(403);
  });
});
```

## Future Enhancements

1. **OAuth2 Integration** - Google, GitHub, etc.
2. **2FA** - Two-factor authentication
3. **Session Management** - Redis-based sessions
4. **API Keys** - For programmatic access
5. **Webhook Security** - Signed webhooks
6. **Audit Logging** - Track all security events

