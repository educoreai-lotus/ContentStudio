import express from 'express';
import { ExerciseController } from '../controllers/ExerciseController.js';

const router = express.Router();
const exerciseController = new ExerciseController();

/**
 * GET /api/exercises/topic/:topicId
 * Get all exercises for a topic
 */
router.get('/topic/:topicId', (req, res, next) => {
  exerciseController.getExercisesByTopic(req, res, next);
});

/**
 * POST /api/exercises/generate-ai
 * Generate AI exercises for a topic
 * 
 * Body:
 * {
 *   topic_id: number,
 *   question_type: "code" | "theoretical",
 *   programming_language: string,
 *   language: string (optional),
 *   amount: number (optional, default 4)
 * }
 */
router.post('/generate-ai', (req, res, next) => {
  exerciseController.generateAIExercises(req, res, next);
});

/**
 * POST /api/exercises/manual
 * Create a single manual exercise (validates with Dabla first)
 * 
 * Body:
 * {
 *   topic_id: number,
 *   question_text: string,
 *   question_type: "code" | "theoretical",
 *   programming_language: string,
 *   language: string (optional),
 *   hint: string (optional),
 *   solution: string (optional)
 * }
 */
router.post('/manual', (req, res, next) => {
  exerciseController.createManualExercise(req, res, next);
});

/**
 * POST /api/exercises/manual/batch
 * Create multiple manual exercises in batch (all must be validated)
 * 
 * Body:
 * {
 *   topic_id: number,
 *   exercises: Array<{
 *     question_text: string,
 *     question_type: "code" | "theoretical",
 *     programming_language: string,
 *     language: string (optional),
 *     hint: string (optional),
 *     solution: string (optional)
 *   }>
 * }
 */
router.post('/manual/batch', (req, res, next) => {
  exerciseController.createManualExercisesBatch(req, res, next);
});

export default router;

