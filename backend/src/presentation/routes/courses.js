import express from 'express';
import { CourseController } from '../controllers/CourseController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';

const router = express.Router();

// Initialize repository (PostgreSQL if connected, otherwise in-memory)
const courseRepository = await RepositoryFactory.getCourseRepository();
const courseController = new CourseController(courseRepository);

router.post('/', courseController.create.bind(courseController));
router.get('/', courseController.list.bind(courseController));
router.get('/:id', courseController.getById.bind(courseController));
router.put('/:id', courseController.update.bind(courseController));
router.delete('/:id', courseController.delete.bind(courseController));

export default router;

