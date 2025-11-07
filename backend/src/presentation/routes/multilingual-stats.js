import express from 'express';
import { LanguageStatsRepository } from '../../infrastructure/database/repositories/LanguageStatsRepository.js';

const router = express.Router();

const languageStatsRepository = new LanguageStatsRepository();

/**
 * Get language statistics
 * GET /api/content/multilingual/stats
 */
router.get('/stats', async (req, res, next) => {
  try {
    const frequentLanguages = await languageStatsRepository.getFrequentLanguages();
    const popularLanguages = await languageStatsRepository.getPopularLanguages(20);
    const nonFrequentLanguages = await languageStatsRepository.getNonFrequentLanguages();

    res.json({
      success: true,
      data: {
        frequent_languages: frequentLanguages,
        popular_languages: popularLanguages,
        non_frequent_languages: nonFrequentLanguages,
        total_languages: popularLanguages.length,
        frequent_count: frequentLanguages.length,
        non_frequent_count: nonFrequentLanguages.length,
      },
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Get specific language statistics
 * GET /api/content/multilingual/stats/:languageCode
 */
router.get('/stats/:languageCode', async (req, res, next) => {
  try {
    const { languageCode } = req.params;
    const stats = await languageStatsRepository.getLanguageStats(languageCode);

    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Language not found',
      });
    }

    res.json({
      success: true,
      data: stats,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Manually trigger language evaluation (admin only)
 * POST /api/content/multilingual/evaluate
 */
router.post('/evaluate', async (req, res, next) => {
  try {
    // TODO: Add admin authentication
    const { LanguageEvaluationOrchestrator } = await import(
      '../../infrastructure/jobs/LanguageEvaluationOrchestrator.js'
    );
    const { LanguageStatsRepository } = await import(
      '../../infrastructure/database/repositories/LanguageStatsRepository.js'
    );
    const { SupabaseStorageClient } = await import(
      '../../infrastructure/storage/SupabaseStorageClient.js'
    );
    const { RepositoryFactory } = await import(
      '../../infrastructure/database/repositories/RepositoryFactory.js'
    );

    const languageStatsRepository = new LanguageStatsRepository();
    const supabaseStorageClient = new SupabaseStorageClient({
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    });
    const contentRepository = RepositoryFactory.getContentRepository();
    const topicRepository = RepositoryFactory.getTopicRepository();

    const orchestrator = new LanguageEvaluationOrchestrator({
      languageStatsRepository,
      supabaseStorageClient,
      contentRepository,
      topicRepository,
    });

    const result = await orchestrator.execute();

    res.json({
      success: true,
      data: result,
      message: 'Language evaluation completed',
    });
  } catch (error) {
    next(error);
  }
});

export default router;



