import express from 'express';
import { ContentMetricsController } from '../controllers/ContentMetricsController.js';

const router = express.Router();
const contentMetricsController = new ContentMetricsController();

/**
 * POST /api/fill-content-metrics
 * 
 * Receives requests from other microservices to fill content metrics
 * 
 * Request format (body is ALWAYS a stringified JSON with Content-Type: application/json):
 * Content-Type: application/json
 * Body: "{\"requester_service\":\"course-builder\",\"payload\":{},\"response\":{}}"
 * 
 * Response format (returns stringified JSON):
 * Content-Type: application/json
 * Body: "{\"requester_service\":\"course-builder\",\"payload\":{},\"response\":{...}}"
 * 
 * Standard structure enforced:
 * {
 *   "requester_service": "<service-name>",
 *   "payload": { ... },
 *   "response": { ... }
 * }
 */
router.post('/', express.text({ type: 'application/json' }), (req, res, next) => {
  contentMetricsController.fillContentMetrics(req, res, next);
});

export default router;

