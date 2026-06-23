import { CreateTemplateUseCase } from '../../application/use-cases/CreateTemplateUseCase.js';
import { GetTemplatesUseCase } from '../../application/use-cases/GetTemplatesUseCase.js';
import { GetTemplateUseCase } from '../../application/use-cases/GetTemplateUseCase.js';
import { UpdateTemplateUseCase } from '../../application/use-cases/UpdateTemplateUseCase.js';
import { DeleteTemplateUseCase } from '../../application/use-cases/DeleteTemplateUseCase.js';
import { GenerateTemplateWithAIUseCase } from '../../application/use-cases/GenerateTemplateWithAIUseCase.js';
import { TemplateDTO } from '../../application/dtos/TemplateDTO.js';
import {
  assertTrainerCanReadTemplate,
  assertTrainerOwnsTemplate,
  assertTrainerOwnsTopic,
  requireAuthenticatedTrainerId,
  respondToOwnershipError,
} from '../middleware/ownershipHelpers.js';

/**
 * Template Controller
 */
export class TemplateController {
  constructor({ templateRepository, topicRepository, aiGenerationService }) {
    this.createTemplateUseCase = new CreateTemplateUseCase({ templateRepository });
    this.getTemplatesUseCase = new GetTemplatesUseCase({ templateRepository });
    this.getTemplateUseCase = new GetTemplateUseCase({ templateRepository });
    this.updateTemplateUseCase = new UpdateTemplateUseCase({ templateRepository });
    this.deleteTemplateUseCase = new DeleteTemplateUseCase({ templateRepository });
    this.generateTemplateWithAIUseCase = new GenerateTemplateWithAIUseCase({
      templateRepository,
      topicRepository,
      aiGenerationService,
    });
  }

  async create(req, res, next) {
    try {
      const createdBy = requireAuthenticatedTrainerId(req);
      const templateData = {
        template_name: req.body.template_name,
        format_order: req.body.format_order,
        created_by: createdBy,
      };

      const template = await this.createTemplateUseCase.execute(templateData);

      res.status(201).json({
        success: true,
        data: TemplateDTO.toTemplateResponse(template),
      });
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const trainerId = requireAuthenticatedTrainerId(req);
      const filters = {
        readableByTrainer: trainerId,
        template_name: req.query.search,
      };

      // Remove undefined filters
      Object.keys(filters).forEach(key => {
        if (filters[key] === undefined) {
          delete filters[key];
        }
      });

      const templates = await this.getTemplatesUseCase.execute(filters);

      console.log('[TemplateController] GET /api/templates:', {
        filters,
        templatesCount: templates.length,
        templateIds: templates.map(t => t.template_id),
        templateNames: templates.map(t => t.template_name),
        createdByValues: templates.map(t => t.created_by),
      });

      res.json({
        success: true,
        data: TemplateDTO.toTemplateListResponse(templates),
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const trainerId = requireAuthenticatedTrainerId(req);
      const templateId = parseInt(req.params.id);
      const template = await assertTrainerCanReadTemplate(templateId, trainerId);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      res.json({
        success: true,
        data: TemplateDTO.toTemplateResponse(template),
      });
    } catch (error) {
      if (respondToOwnershipError(error, res)) return;
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const trainerId = requireAuthenticatedTrainerId(req);
      const templateId = parseInt(req.params.id);
      await assertTrainerOwnsTemplate(templateId, trainerId);

      const updates = {
        template_name: req.body.template_name,
        format_order: req.body.format_order,
      };

      // Remove undefined fields
      Object.keys(updates).forEach(key => {
        if (updates[key] === undefined) {
          delete updates[key];
        }
      });

      const template = await this.updateTemplateUseCase.execute(templateId, updates);

      if (!template) {
        return res.status(404).json({
          success: false,
          error: 'Template not found',
        });
      }

      res.json({
        success: true,
        data: TemplateDTO.toTemplateResponse(template),
      });
    } catch (error) {
      if (respondToOwnershipError(error, res)) return;
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const trainerId = requireAuthenticatedTrainerId(req);
      const templateId = parseInt(req.params.id);
      await assertTrainerOwnsTemplate(templateId, trainerId);
      await this.deleteTemplateUseCase.execute(templateId);

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      if (respondToOwnershipError(error, res)) return;
      next(error);
    }
  }

  async generateWithAI(req, res, next) {
    try {
      const topicId = parseInt(req.body.topic_id);
      const trainerId = requireAuthenticatedTrainerId(req);
      await assertTrainerOwnsTopic(topicId, trainerId);
      const templateName = req.body.template_name;

      const result = await this.generateTemplateWithAIUseCase.execute({
        topicId,
        trainerId,
        templateName,
      });

      // Extract AI feedback if present
      const { aiFeedback, ...template } = result;

      res.status(201).json({
        success: true,
        data: TemplateDTO.toTemplateResponse(template),
        aiFeedback: aiFeedback || null,
      });
    } catch (error) {
      if (respondToOwnershipError(error, res)) return;
      next(error);
    }
  }
}

