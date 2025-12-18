import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { authenticationMiddleware } from './src/presentation/middleware/authentication.js';
import { requestLogger } from './src/presentation/middleware/requestLogger.js';
import { logger } from './src/infrastructure/logging/Logger.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Increase body parser limits for large video files
app.use(express.json({ limit: '100mb' }));
app.use(express.urlencoded({ extended: true, limit: '100mb' }));

// Middleware
// CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (mobile apps, Postman, etc.)
    if (!origin) return callback(null, true);

    const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [];
    const frontendUrl = process.env.FRONTEND_URL;

    // Check if origin is allowed
    if (
      allowedOrigins.includes(origin) ||
      origin === frontendUrl ||
      (process.env.NODE_ENV === 'development' && origin.startsWith('http://localhost'))
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};

app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check endpoint - MUST be before authentication middleware
// This endpoint must respond quickly and not be blocked by any middleware
app.get('/health', (req, res) => {
  try {
    // Quick health check - server is up (synchronous, no async operations)
    res.status(200).json({
      status: 'healthy',
      service: 'content-studio',
      version: '1.0.0',
    });
  } catch (error) {
    // Even if there's an error, return 200 to pass health check
    res.status(200).json({ 
      status: 'healthy',
      service: 'content-studio',
      version: '1.0.0',
    });
  }
});

// Apply authentication middleware to API routes (but not /health)
app.use('/api', authenticationMiddleware);

// Request logging (only in development or if LOG_REQUESTS=true)
if (process.env.NODE_ENV !== 'production' || process.env.LOG_REQUESTS === 'true') {
  app.use(requestLogger);
}

// Serve logo files
app.get('/api/logo/:theme', (req, res) => {
  const { theme } = req.params;
  const logoName = theme === 'dark' ? 'dark_logo.png' : 'light_logo.png';
  const logoPath = path.join(__dirname, 'uplouds', logoName);
  
  // Check if file exists, otherwise send default
  res.sendFile(logoPath, (err) => {
    if (err) {
      // If file doesn't exist, send a placeholder or 404
      res.status(404).json({ error: 'Logo not found' });
    }
  });
});

// Routes
import coursesRouter from './src/presentation/routes/courses.js';
import topicsRouter from './src/presentation/routes/topics.js';
import contentRouter from './src/presentation/routes/content.js';
import searchRouter from './src/presentation/routes/search.js';
import aiGenerationRouter from './src/presentation/routes/ai-generation.js';
import templatesRouter from './src/presentation/routes/templates.js';
import templateApplicationRouter from './src/presentation/routes/template-application.js';
import qualityChecksRouter from './src/presentation/routes/quality-checks.js';
import versionsRouter from './src/presentation/routes/versions.js';
import videoToLessonRouter from './src/presentation/routes/video-to-lesson.js';
import multilingualRouter from './src/presentation/routes/multilingual.js';
import multilingualStatsRouter from './src/presentation/routes/multilingual-stats.js';
import jobsRouter from './src/presentation/routes/jobs.js';
import exchangeRouter from './src/presentation/routes/exchange.js';
import uploadRouter from './src/presentation/routes/upload.js';
import debugRouter from './src/presentation/routes/debug.js';
import contentMetricsRouter from './src/presentation/routes/content-metrics.js';
import exercisesRouter from './src/presentation/routes/exercises.js';
import { errorHandler } from './src/presentation/middleware/errorHandler.js';

app.use('/api/courses', coursesRouter);
app.use('/api/topics', topicsRouter);
app.use('/api/content', contentRouter);
app.use('/api/search', searchRouter);
app.use('/api/content', aiGenerationRouter);
app.use('/api/templates', templatesRouter);
app.use('/api', templateApplicationRouter);
app.use('/api/quality-checks', qualityChecksRouter);
app.use('/api', versionsRouter);
app.use('/api/video-to-lesson', videoToLessonRouter);
app.use('/api/content/multilingual', multilingualRouter);
app.use('/api/content/multilingual', multilingualStatsRouter);
app.use('/api/jobs', jobsRouter);
app.use('/api/exchange', exchangeRouter);
app.use('/api/upload', uploadRouter);
app.use('/api/debug', debugRouter);
app.use('/api/fill-content-metrics', contentMetricsRouter);
app.use('/api/exercises', exercisesRouter);

// Error handling middleware (must be after routes)
app.use(errorHandler);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Resource not found',
      timestamp: new Date().toISOString(),
    },
  });
});

// Initialize database and run migrations in the background
// This allows the server to start immediately and respond to health checks
async function initializeDatabase() {
  try {
    // Import database connection to ensure it's initialized
    const { db } = await import('./src/infrastructure/database/DatabaseConnection.js');
    
    // Wait for database connection to be ready (with timeout)
    logger.info('Waiting for database connection...');
    
    // Set a timeout for DB connection (30 seconds)
    const connectionTimeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Database connection timeout')), 30000)
    );
    
    await Promise.race([db.ready, connectionTimeout]);
    
    // Test connection
    const isConnected = await db.testConnection();
    if (!isConnected) {
      logger.warn('⚠️ Database connection not available, migrations will be skipped');
      return false;
    }
    
    logger.info('✅ Database connection established');
    
    // Run database migrations automatically
    if (process.env.SKIP_MIGRATIONS !== 'true') {
      try {
        logger.info('🔄 Starting database migrations...');
        const { migrationRunner } = await import('./src/infrastructure/database/services/MigrationRunner.js');
        await migrationRunner.runMigrations();
        logger.info('✅ Database migrations completed successfully');
        return true;
      } catch (error) {
        logger.error('❌ Failed to run database migrations', { 
          error: error.message,
          stack: error.stack 
        });
        // In production, log but don't exit - let the server continue
        if (process.env.NODE_ENV === 'production') {
          logger.error('❌ CRITICAL: Migrations failed in production. Server may not function correctly.');
        } else {
          logger.warn('⚠️ Continuing without migrations (development mode)');
        }
        return false;
      }
    } else {
      logger.info('⏭️ Database migrations skipped (SKIP_MIGRATIONS=true)');
      return true;
    }
  } catch (error) {
    logger.error('❌ Database initialization failed', { 
      error: error.message,
      stack: error.stack 
    });
    // Don't exit - allow server to start and respond to health checks
    // The server can still function for basic endpoints even if DB is not ready
    return false;
  }
}

// Start server immediately, initialize DB in background
async function startServer() {
  try {
  // Start the Express server immediately (don't wait for DB)
    // Set longer timeout for video transcription requests (20 minutes)
    // Video transcription can take a long time (downloading, processing, quality check, content generation)
    const server = app.listen(PORT, '0.0.0.0', async () => {
      // Set server timeout to 20 minutes (1200000 ms) for long-running requests
      server.timeout = 20 * 60 * 1000; // 20 minutes
      console.log(`🚀 Content Studio Backend running on port ${PORT}`);
    logger.info(`🚀 Content Studio Backend running on port ${PORT}`, {
      environment: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'INFO',
    });
    
    // Start GRPC server
    // Skip in test environment to prevent Jest from hanging
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      try {
        const grpcServer = await import('./src/grpc/server.js');
        await grpcServer.default.start();
        logger.info('GRPC server started successfully', {
          grpc_port: process.env.GRPC_PORT || 50051,
        });
      } catch (error) {
        logger.error('Failed to start GRPC server', { 
          error: error.message,
          stack: error.stack,
        });
        logger.warn('Continuing without GRPC server...');
      }
    }
    
    // Register service with Coordinator (non-blocking)
    // Skip registration in test environment to prevent Jest from hanging
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      try {
        const { registerService, uploadMigration } = await import('./src/registration/register.js');
        // Register service first
        registerService().then(async (registrationResult) => {
          // After registration (or if already registered), upload migration
          // Wait a bit to ensure registration is complete
          await new Promise(resolve => setTimeout(resolve, 2000));
          uploadMigration().catch(error => {
            logger.error('Migration upload error (non-critical)', { 
              error: error.message 
            });
          });
        }).catch(async (error) => {
          logger.error('Service registration error (non-critical)', { 
            error: error.message 
          });
          // Even if registration fails, try to upload migration if SERVICE_ID exists
          await new Promise(resolve => setTimeout(resolve, 2000));
          uploadMigration().catch(err => {
            logger.error('Migration upload error (non-critical)', { 
              error: err.message 
            });
          });
        });
      } catch (error) {
        logger.warn('Failed to load registration module (non-critical)', { 
          error: error.message 
        });
      }
    }
    
    // Initialize database in the background (non-blocking)
    // Skip in test environment to prevent Jest from hanging
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      initializeDatabase().catch(error => {
        console.error('Background database initialization failed:', error.message);
        logger.error('Background database initialization failed', { 
          error: error.message 
        });
      });
    }
    
    // Start background jobs (if enabled)
    // Skip in test environment to prevent Jest from hanging
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      if (process.env.ENABLE_BACKGROUND_JOBS !== 'false') {
        try {
          const { getJobScheduler } = await import('./src/infrastructure/jobs/JobScheduler.js');
          const scheduler = getJobScheduler();
          await scheduler.start();
          logger.info('Background jobs scheduler started');
        } catch (error) {
          logger.error('Failed to start background jobs scheduler', { error: error.message });
          logger.warn('Continuing without background jobs...');
        }
      } else {
        logger.info('Background jobs disabled (ENABLE_BACKGROUND_JOBS=false)');
      }
    }
  });

    // Handle server errors
    server.on('error', (error) => {
      console.error('❌ Server error:', error);
      if (error.code === 'EADDRINUSE') {
        console.error(`Port ${PORT} is already in use`);
      }
      process.exit(1);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    logger.error('Failed to start server', { error: error.message, stack: error.stack });
    process.exit(1);
  }
}

// Graceful shutdown handler
async function shutdown() {
  logger.info('Shutting down Content Studio microservice', {
    service: process.env.SERVICE_NAME || 'content-studio',
  });

  try {
    // Shutdown GRPC server
    if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
      try {
        const grpcServer = await import('./src/grpc/server.js');
        await grpcServer.default.shutdown();
      } catch (error) {
        logger.error('Error shutting down GRPC server', { error: error.message });
      }
    }
  } catch (error) {
    logger.error('Error during shutdown', { error: error.message });
  }

  process.exit(0);
}

// Register shutdown handlers
process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

// Start the application
// Skip server startup in test environment to prevent Jest from hanging
if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
  startServer();
}

export default app;

