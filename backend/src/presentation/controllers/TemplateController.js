import { CreateTemplateUseCase } from '../../application/use-cases/CreateTemplateUseCase.js';
import { GetTemplatesUseCase } from '../../application/use-cases/GetTemplatesUseCase.js';
import { GetTemplateUseCase } from '../../application/use-cases/GetTemplateUseCase.js';
import { UpdateTemplateUseCase } from '../../application/use-cases/UpdateTemplateUseCase.js';
import { DeleteTemplateUseCase } from '../../application/use-cases/DeleteTemplateUseCase.js';
import { GenerateTemplateWithAIUseCase } from '../../application/use-cases/GenerateTemplateWithAIUseCase.js';
import { TemplateDTO } from '../../application/dtos/TemplateDTO.js';

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
      const templateData = {
        template_name: req.body.template_name,
        format_order: req.body.format_order,
        created_by: req.body.created_by || 'trainer123', // TODO: Get from auth
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
      const filters = {
        created_by: req.query.created_by,
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
      const templateId = parseInt(req.params.id);
      const template = await this.getTemplateUseCase.execute(templateId);

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
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const templateId = parseInt(req.params.id);
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
      next(error);
    }
  }

  async remove(req, res, next) {
    try {
      const templateId = parseInt(req.params.id);
      await this.deleteTemplateUseCase.execute(templateId);

      res.json({
        success: true,
        message: 'Template deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async generateWithAI(req, res, next) {
    try {
      const topicId = parseInt(req.body.topic_id);
      const trainerId = req.body.trainer_id || req.auth?.trainer?.trainer_id || 'system';
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
      next(error);
    }
  }
}

