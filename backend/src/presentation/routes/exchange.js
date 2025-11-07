import express from 'express';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { InterServiceExchangeController } from '../controllers/InterServiceExchangeController.js';

const router = express.Router();

const topicRepository = RepositoryFactory.getTopicRepository();
const contentRepository = RepositoryFactory.getContentRepository();
const courseRepository = RepositoryFactory.getCourseRepository();

const interServiceExchangeController = new InterServiceExchangeController({
  topicRepository,
  contentRepository,
  courseRepository,
});

router.post('/', (req, res, next) =>
  interServiceExchangeController.exchange(req, res, next)
);

export default router;


