import express from 'express';
import { ContentController } from '../controllers/ContentController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { ContentVersionRepository } from '../../infrastructure/database/repositories/ContentVersionRepository.js';
import { CreateContentVersionUseCase } from '../../application/use-cases/CreateContentVersionUseCase.js';

const router = express.Router();

// Initialize repositories (PostgreSQL if connected, otherwise in-memory)
const contentRepository = RepositoryFactory.getContentRepository();
const contentVersionRepository = new ContentVersionRepository();

// Initialize use cases
const createContentVersionUseCase = new CreateContentVersionUseCase({
  contentVersionRepository,
});

// TODO: Initialize quality check service
const qualityCheckService = null; // Will be implemented later

const contentController = new ContentController({
  contentRepository,
  qualityCheckService,
  contentVersionRepository,
  createContentVersionUseCase,
});

// Routes
router.post('/', (req, res, next) => contentController.create(req, res, next));
router.post('/approve', (req, res, next) => contentController.approve(req, res, next));
router.get('/', (req, res, next) => contentController.list(req, res, next));
router.get('/:id', (req, res, next) => contentController.getById(req, res, next));
router.put('/:id', (req, res, next) => contentController.update(req, res, next));
router.delete('/:id', (req, res, next) => contentController.remove(req, res, next));

export default router;

