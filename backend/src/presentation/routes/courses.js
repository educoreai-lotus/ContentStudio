import express from 'express';
import { CourseController } from '../controllers/CourseController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';

const router = express.Router();

// Initialize repositories (PostgreSQL if connected, otherwise in-memory)
const courseRepository = await RepositoryFactory.getCourseRepository();
const topicRepository = await RepositoryFactory.getTopicRepository();
const contentRepository = await RepositoryFactory.getContentRepository();
const templateRepository = await RepositoryFactory.getTemplateRepository();
const exerciseRepository = await RepositoryFactory.getExerciseRepository();

const courseController = new CourseController(
  courseRepository,
  topicRepository,
  contentRepository,
  templateRepository,
  exerciseRepository
);

router.post('/', courseController.create.bind(courseController));
router.get('/', courseController.list.bind(courseController));
router.get('/:id', courseController.getById.bind(courseController));
router.put('/:id', courseController.update.bind(courseController));
router.delete('/:id', courseController.delete.bind(courseController));
router.post('/:id/publish', courseController.publish.bind(courseController));

export default router;

