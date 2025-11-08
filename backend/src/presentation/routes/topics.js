import express from 'express';
import { TopicController } from '../controllers/TopicController.js';
import { RepositoryFactory } from '../../infrastructure/database/repositories/RepositoryFactory.js';
import { IntegrationServiceManager } from '../../infrastructure/integrations/IntegrationServiceManager.js';

const router = express.Router();

// Initialize repository (PostgreSQL if connected, otherwise in-memory)
const topicRepository = await RepositoryFactory.getTopicRepository();

// Initialize integration services
const integrationManager = new IntegrationServiceManager();
const skillsEngineClient = integrationManager.getSkillsEngine();

// Initialize controller
const topicController = new TopicController(topicRepository, skillsEngineClient);

router.post('/', topicController.create.bind(topicController));
router.get('/', topicController.list.bind(topicController));
router.get('/suggest-skills', topicController.suggestSkills.bind(topicController));
router.post('/suggest-skills', topicController.suggestSkills.bind(topicController));
router.get('/:id', topicController.getById.bind(topicController));
router.put('/:id', topicController.update.bind(topicController));
router.delete('/:id', topicController.delete.bind(topicController));
router.post('/:id/validate-formats', topicController.validateFormatRequirements.bind(topicController));

export default router;

