import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

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
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
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
import { errorHandler } from './src/presentation/middleware/errorHandler.js';
import { requestLogger } from './src/presentation/middleware/requestLogger.js';
import { logger } from './src/infrastructure/logging/Logger.js';

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

// Start server
app.listen(PORT, async () => {
  logger.info(`Content Studio Backend running on port ${PORT}`, {
    environment: process.env.NODE_ENV || 'development',
    logLevel: process.env.LOG_LEVEL || 'INFO',
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

export default app;

