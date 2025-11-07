import { CreateTopicUseCase } from '../../application/use-cases/CreateTopicUseCase.js';
import { GetTopicsUseCase } from '../../application/use-cases/GetTopicsUseCase.js';
import { GetTopicUseCase } from '../../application/use-cases/GetTopicUseCase.js';
import { UpdateTopicUseCase } from '../../application/use-cases/UpdateTopicUseCase.js';
import { DeleteTopicUseCase } from '../../application/use-cases/DeleteTopicUseCase.js';
import { ValidateFormatRequirementsUseCase } from '../../application/use-cases/ValidateFormatRequirementsUseCase.js';
import { CreateTopicDTO, UpdateTopicDTO, TopicResponseDTO } from '../../application/dtos/TopicDTO.js';

export class TopicController {
  constructor(topicRepository, skillsEngineClient = null) {
    this.createTopicUseCase = new CreateTopicUseCase({
      topicRepository,
      skillsEngineClient,
    });
    this.getTopicsUseCase = new GetTopicsUseCase(topicRepository);
    this.getTopicUseCase = new GetTopicUseCase(topicRepository);
    this.updateTopicUseCase = new UpdateTopicUseCase(topicRepository);
    this.deleteTopicUseCase = new DeleteTopicUseCase(topicRepository);
    this.validateFormatRequirementsUseCase = new ValidateFormatRequirementsUseCase(topicRepository);
  }

  async create(req, res, next) {
    try {
      const createDTO = new CreateTopicDTO(req.body);
      const topic = await this.createTopicUseCase.execute(createDTO);
      const responseDTO = new TopicResponseDTO(topic);

      res.status(201).json(responseDTO);
    } catch (error) {
      next(error);
    }
  }

  async list(req, res, next) {
    try {
      const trainerId = req.query.trainer_id || req.user?.trainer_id;
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

      res.status(200).json({
        topics: result.topics.map(topic => new TopicResponseDTO(topic)),
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

      const responseDTO = new TopicResponseDTO(topic);
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

      const responseDTO = new TopicResponseDTO(topic);
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
}

