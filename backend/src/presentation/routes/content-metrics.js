import express from 'express';
import { ContentMetricsController } from '../controllers/ContentMetricsController.js';

const router = express.Router();
const contentMetricsController = new ContentMetricsController();

/**
 * POST /api/fill-content-metrics
 * 
 * Receives requests from other microservices to fill content metrics
 * 
 * Request format:
 * {
 *   "serviceName": "<MicroserviceName>",
 *   "payload": "<stringified JSON>"
 * }
 * 
 * Response format:
 * {
 *   "serviceName": "<same serviceName>",
 *   "payload": "<stringified filled JSON>"
 * }
 */
router.post('/fill-content-metrics', (req, res, next) => {
  contentMetricsController.fillContentMetrics(req, res, next);
});

export default router;

