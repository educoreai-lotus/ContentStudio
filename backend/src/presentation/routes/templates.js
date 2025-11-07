import express from 'express';
import { TemplateController } from '../controllers/TemplateController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';

const router = express.Router();

// Initialize repository (PostgreSQL if connected, otherwise in-memory)
const templateRepository = RepositoryFactory.getTemplateRepository();

// Initialize controller
const templateController = new TemplateController({ templateRepository });

// Routes
router.post('/', (req, res, next) => templateController.create(req, res, next));
router.get('/', (req, res, next) => templateController.list(req, res, next));
router.get('/:id', (req, res, next) => templateController.getById(req, res, next));
router.put('/:id', (req, res, next) => templateController.update(req, res, next));
router.delete('/:id', (req, res, next) => templateController.remove(req, res, next));

export default router;

