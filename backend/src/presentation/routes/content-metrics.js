import express from 'express';
import { ContentMetricsController } from '../controllers/ContentMetricsController.js';

const router = express.Router();
const contentMetricsController = new ContentMetricsController();

/**
 * POST /api/fill-content-metrics
 * 
 * Receives requests from other microservices to fill content metrics
 * 
 * Request format (body is ALWAYS a stringified JSON):
 * "{\"microservice_name\":\"CourseBuilder\",\"payload\":{},\"response\":{\"course\":[]}}"
 * 
 * Response format (returns stringified JSON):
 * "{\"microservice_name\":\"CourseBuilder\",\"payload\":{},\"response\":{\"course\":[...]}}"
 */
router.post('/', express.text({ type: 'application/json' }), (req, res, next) => {
  contentMetricsController.fillContentMetrics(req, res, next);
});

export default router;

