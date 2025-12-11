import cron from 'node-cron';
import { LanguageEvaluationOrchestrator } from './LanguageEvaluationOrchestrator.js';
import { PreloadFrequentLanguagesUseCase } from '../../application/use-cases/PreloadFrequentLanguagesUseCase.js';
import { AITranslationService } from '../ai/AITranslationService.js';
import { LanguageStatsRepository } from '../database/repositories/LanguageStatsRepository.js';
import { SupabaseStorageClient } from '../storage/SupabaseStorageClient.js';
import { RepositoryFactory } from '../database/repositories/RepositoryFactory.js';
import { logger } from '../logging/Logger.js';

/**
 * Job Scheduler
 * Manages all background jobs using Node-CRON
 * 
 * Jobs:
 * 1. Language Evaluation (bi-weekly/monthly)
 * 2. Language Cleanup (after evaluation)
 * 3. Preload Frequent Languages (on startup)
 */
export class JobScheduler {
  constructor() {
    this.jobs = [];
    this.isRunning = false;
  }

  /**
   * Initialize and start all scheduled jobs
   */
  async start() {
    if (this.isRunning) {
      // Only log warning in non-test environments
      if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
        logger.warn('Job scheduler is already running');
      }
      return;
    }

    logger.info('Starting job scheduler...');
    this.isRunning = true;

    // Initialize services
    const languageStatsRepository = new LanguageStatsRepository();
    // SupabaseStorageClient will handle test environment automatically
    const supabaseStorageClient = new SupabaseStorageClient({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const contentRepository = await RepositoryFactory.getContentRepository();
    const topicRepository = await RepositoryFactory.getTopicRepository();
    const databaseReady = await RepositoryFactory.testConnection();

    if (!databaseReady) {
      // Only log warning in non-test environments
      if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
        logger.warn('Database not reachable. Skipping background job startup.');
      }
      this.isRunning = false;
      return;
    }

    // Initialize orchestrator
    const orchestrator = new LanguageEvaluationOrchestrator({
      languageStatsRepository,
      supabaseStorageClient,
      contentRepository,
      topicRepository,
    });

    // Initialize translation service for preload
    const translationService = new AITranslationService({
      openaiApiKey: process.env.OPENAI_API_KEY,
      geminiApiKey: process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY,
      preferredProvider: process.env.GEMINI_API_KEY ? 'gemini' : 'openai',
    });

    // Initialize preload use case
    const preloadUseCase = new PreloadFrequentLanguagesUseCase({
      languageStatsRepository,
      supabaseStorageClient,
      topicRepository,
      contentRepository,
      translationService,
    });

    // Job 1: Language Evaluation (Every 2 weeks: 1st and 15th of month at 2 AM)
    const evaluationJob = cron.schedule('0 2 1,15 * *', async () => {
      console.log('========================================');
      console.log('Running scheduled language evaluation...');
      console.log('========================================');
      
      try {
        const result = await orchestrator.execute();
        console.log('Language evaluation completed:', result);
      } catch (error) {
        console.error('Language evaluation job failed:', error);
        // TODO: Send alert/notification
      }
    }, {
      scheduled: false, // Don't start immediately
      timezone: 'UTC',
    });

    this.jobs.push({
      name: 'Language Evaluation',
      schedule: '0 2 1,15 * *',
      job: evaluationJob,
    });

    // Job 2: Preload Frequent Languages (On startup, then daily at 3 AM)
    const preloadJob = cron.schedule('0 3 * * *', async () => {
      console.log('Running preload frequent languages job...');
      
      try {
        const result = await preloadUseCase.execute();
        console.log('Preload completed:', result);
      } catch (error) {
        console.error('Preload job failed:', error);
      }
    }, {
      scheduled: false,
      timezone: 'UTC',
    });

    this.jobs.push({
      name: 'Preload Frequent Languages',
      schedule: '0 3 * * *',
      job: preloadJob,
    });

    // Start all jobs
    this.jobs.forEach(({ name, job }) => {
      job.start();
      console.log(`Started job: ${name}`);
    });

    // Run preload on startup (once)
    console.log('Running initial preload of frequent languages...');
    try {
      await preloadUseCase.execute();
      console.log('Initial preload completed');
    } catch (error) {
      console.error('Initial preload failed:', error);
    }

    console.log(`Job scheduler started with ${this.jobs.length} jobs`);
  }

  /**
   * Stop all scheduled jobs
   */
  stop() {
    if (!this.isRunning) {
      // Only log warning in non-test environments
      if (process.env.NODE_ENV !== 'test' && !process.env.JEST_WORKER_ID) {
        logger.warn('Job scheduler is not running');
      }
      return;
    }

    console.log('Stopping job scheduler...');
    
    this.jobs.forEach(({ name, job }) => {
      job.stop();
      console.log(`Stopped job: ${name}`);
    });

    this.jobs = [];
    this.isRunning = false;
    console.log('Job scheduler stopped');
  }

  /**
   * Get status of all jobs
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      jobs: this.jobs.map(({ name, schedule }) => ({
        name,
        schedule,
        isActive: this.isRunning,
      })),
    };
  }

  /**
   * Manually trigger a job (for testing)
   */
  async triggerJob(jobName) {
    const job = this.jobs.find(j => j.name === jobName);
    if (!job) {
      throw new Error(`Job ${jobName} not found`);
    }

    console.log(`Manually triggering job: ${jobName}`);
    
    // Get the orchestrator or use case and execute
    // This is a simplified version - in production, you'd want to store references
    if (jobName === 'Language Evaluation') {
      const languageStatsRepository = new LanguageStatsRepository();
      // SupabaseStorageClient will handle test environment automatically
      const supabaseStorageClient = new SupabaseStorageClient({
        supabaseUrl: process.env.SUPABASE_URL,
        supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      });
      const contentRepository = await RepositoryFactory.getContentRepository();
      const topicRepository = await RepositoryFactory.getTopicRepository();

      const orchestrator = new LanguageEvaluationOrchestrator({
        languageStatsRepository,
        supabaseStorageClient,
        contentRepository,
        topicRepository,
      });

      return await orchestrator.execute();
    }

    throw new Error(`Manual trigger not implemented for ${jobName}`);
  }
}

// Singleton instance
let schedulerInstance = null;

/**
 * Get job scheduler instance
 */
export function getJobScheduler() {
  if (!schedulerInstance) {
    schedulerInstance = new JobScheduler();
  }
  return schedulerInstance;
}

