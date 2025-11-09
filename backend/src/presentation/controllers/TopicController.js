import { CreateTopicUseCase } from '../../application/use-cases/CreateTopicUseCase.js';
import { GetTopicsUseCase } from '../../application/use-cases/GetTopicsUseCase.js';
import { GetTopicUseCase } from '../../application/use-cases/GetTopicUseCase.js';
import { UpdateTopicUseCase } from '../../application/use-cases/UpdateTopicUseCase.js';
import { DeleteTopicUseCase } from '../../application/use-cases/DeleteTopicUseCase.js';
import { ValidateFormatRequirementsUseCase } from '../../application/use-cases/ValidateFormatRequirementsUseCase.js';
import { ApplyTemplateToLessonUseCase } from '../../application/use-cases/ApplyTemplateToLessonUseCase.js';
import { CreateTopicDTO, UpdateTopicDTO, TopicResponseDTO } from '../../application/dtos/TopicDTO.js';
import { logger } from '../../infrastructure/logging/Logger.js';

export class TopicController {
  constructor(topicRepository, skillsEngineClient = null, templateRepository = null, contentRepository = null) {
    this.createTopicUseCase = new CreateTopicUseCase({
      topicRepository,
      skillsEngineClient,
    });
    this.getTopicsUseCase = new GetTopicsUseCase(topicRepository);
    this.getTopicUseCase = new GetTopicUseCase(topicRepository);
    this.updateTopicUseCase = new UpdateTopicUseCase(topicRepository);
    this.deleteTopicUseCase = new DeleteTopicUseCase(topicRepository);
    this.validateFormatRequirementsUseCase = new ValidateFormatRequirementsUseCase(topicRepository);
    this.templateRepository = templateRepository;
    this.applyTemplateToLessonUseCase =
      templateRepository && contentRepository
        ? new ApplyTemplateToLessonUseCase({
            templateRepository,
            topicRepository,
            contentRepository,
          })
        : null;
    this.skillsEngineClient = skillsEngineClient;
  }

  async buildTopicResponse(topic) {
    const responseDTO = new TopicResponseDTO(topic);
    if (this.templateRepository && topic.template_id) {
      try {
        const template = await this.templateRepository.findById(topic.template_id);
        if (template) {
          responseDTO.template_name = template.template_name;
          responseDTO.template_format_order = template.format_order;
          responseDTO.template_type = template.template_type;
        }
      } catch (error) {
        logger.warn('Failed to load template for topic response', {
          topicId: topic.topic_id,
          templateId: topic.template_id,
          error: error.message,
        });
      }
    }
    return responseDTO;
  }

  async create(req, res, next) {
    try {
      const trainerId =
        req.body.trainer_id || req.auth?.trainer?.trainer_id || req.auth?.trainer?.id;
      const createDTO = new CreateTopicDTO({
        ...req.body,
        trainer_id: trainerId,
      });
      const topic = await this.createTopicUseCase.execute(createDTO);
      const responseDTO = await this.buildTopicResponse(topic);

      res.status(201).json(responseDTO);
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const trainerId =
        req.query.trainer_id || req.auth?.trainer?.trainer_id || req.auth?.trainer?.id;
      const filters = {
        status: req.query.status,
        course_id:
          req.query.course_id === 'null' || req.query.course_id === null
            ? null
            : req.query.course_id
            ? parseInt(req.query.course_id)
            : undefined,
        search: req.query.search,
      };
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 10, 50),
      };

      const result = await this.getTopicsUseCase.execute(trainerId, filters, pagination);

      const topicsWithTemplates = await Promise.all(
        result.topics.map(topic => this.buildTopicResponse(topic))
      );

      res.status(200).json({
        topics: topicsWithTemplates,
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const topicId = parseInt(req.params.id);
      const topic = await this.getTopicUseCase.execute(topicId);

      if (!topic) {
        return res.status(404).json({
          error: {
            code: 'TOPIC_NOT_FOUND',
            message: 'Topic not found',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const responseDTO = await this.buildTopicResponse(topic);
      res.status(200).json(responseDTO);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const topicId = parseInt(req.params.id);
      const updateDTO = new UpdateTopicDTO(req.body);
      const topic = await this.updateTopicUseCase.execute(topicId, updateDTO);

      if (!topic) {
        return res.status(404).json({
          error: {
            code: 'TOPIC_NOT_FOUND',
            message: 'Topic not found',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const responseDTO = await this.buildTopicResponse(topic);
      res.status(200).json(responseDTO);
    } catch (error) {
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const topicId = parseInt(req.params.id);
      await this.deleteTopicUseCase.execute(topicId);

      res.status(200).json({
        success: true,
        message: 'Topic deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  async validateFormatRequirements(req, res, next) {
    try {
      const topicId = parseInt(req.params.id);
      const contentItems = req.body.content_items || [];

      const result = await this.validateFormatRequirementsUseCase.execute(topicId, contentItems);

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async applyTemplate(req, res, next) {
    try {
      if (!this.applyTemplateToLessonUseCase) {
        return res.status(503).json({
          success: false,
          error: 'Template application service is not available',
        });
      }

      const topicId = parseInt(req.params.id);
      const templateId = parseInt(req.body.template_id);

      if (!templateId) {
        return res.status(400).json({
          success: false,
          error: 'template_id is required',
        });
      }

      const result = await this.applyTemplateToLessonUseCase.execute({
        topicId,
        templateId,
      });

      res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  }

  async suggestSkills(req, res, next) {
    try {
      const topicName = req.body.topic_name || req.query.topic_name;
      if (!topicName || topicName.trim().length < 3) {
        return res.status(400).json({
          error: {
            code: 'INVALID_TOPIC_NAME',
            message: 'topic_name must be at least 3 characters',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const trainerId =
        req.body.trainer_id || req.query.trainer_id || req.auth?.trainer?.trainer_id || req.auth?.trainer?.id;

      let skills = [];
      let source = 'mock';

      if (this.skillsEngineClient) {
        try {
          const mapping = await this.skillsEngineClient.getSkillsMapping(trainerId, topicName);
          if (mapping) {
            const microSkills = mapping.micro_skills || [];
            const nanoSkills = mapping.nano_skills || [];
            skills = [...new Set([...microSkills, ...nanoSkills])];
            source = mapping.fallback ? 'mock' : 'skills-engine';
          }
        } catch (error) {
          logger.warn('Skills Engine suggestion failed, using fallback skills', {
            error: error.message,
            topicName,
          });
        }
      }

      if (skills.length === 0) {
        skills = ['creative thinking', 'problem solving', 'collaboration'];
        source = 'mock';
      }

      res.status(200).json({
        skills,
        source,
        topic_name: topicName,
        trainer_id: trainerId,
      });
    } catch (error) {
      next(error);
    }
  }
}

