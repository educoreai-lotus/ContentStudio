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

// Health check endpoint
// Must respond quickly to pass Docker/Railway health checks
// Server is considered healthy if it can respond, even if DB is not ready yet
let dbCache = null;
app.get('/health', async (req, res) => {
  try {
    // Quick health check - server is up
    const healthStatus = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      server: 'running',
    };
    
    // Optionally check DB (but don't fail if it's not ready)
    // Use cached import to avoid repeated dynamic imports
    try {
      if (!dbCache) {
        const dbModule = await import('./src/infrastructure/database/DatabaseConnection.js');
        dbCache = dbModule.db;
      }
      
      const isConnected = await Promise.race([
        dbCache.testConnection(),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 1000))
      ]).catch(() => false);
      
      healthStatus.database = isConnected ? 'connected' : 'connecting';
    } catch (error) {
      healthStatus.database = 'not_ready';
    }
    
    res.status(200).json(healthStatus);
  } catch (error) {
    // Even if there's an error, return 200 to pass health check
    // The server is running, which is what matters for Docker/Railway
    res.status(200).json({ 
      status: 'ok', 
      timestamp: new Date().toISOString(),
      server: 'running'
    });
  }
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
function startServer() {
  // Start the Express server immediately (don't wait for DB)
  app.listen(PORT, async () => {
    logger.info(`🚀 Content Studio Backend running on port ${PORT}`, {
      environment: process.env.NODE_ENV || 'development',
      logLevel: process.env.LOG_LEVEL || 'INFO',
    });
    
    // Initialize database in the background (non-blocking)
    initializeDatabase().catch(error => {
      logger.error('Background database initialization failed', { 
        error: error.message 
      });
    });
    
    // Start background jobs (if enabled)
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
  });
}

// Start the application
startServer();

export default app;

