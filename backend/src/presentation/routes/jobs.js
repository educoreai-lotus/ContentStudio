import express from 'express';
import { getJobScheduler } from '../../infrastructure/jobs/JobScheduler.js';

const router = express.Router();

/**
 * Get job scheduler status
 * GET /api/jobs/status
 */
router.get('/status', (req, res, next) => {
  try {
    const scheduler = getJobScheduler();
    const status = scheduler.getStatus();
    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * Manually trigger language evaluation job
 * POST /api/jobs/trigger/evaluation
 * 
 * Note: This should be protected with admin authentication in production
 */
router.post('/trigger/evaluation', async (req, res, next) => {
  try {
    const scheduler = getJobScheduler();
    const result = await scheduler.triggerJob('Language Evaluation');
    res.json({
      success: true,
      data: result,
      message: 'Language evaluation job triggered successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;

