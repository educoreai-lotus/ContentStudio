import { CreateCourseUseCase } from '../../application/use-cases/CreateCourseUseCase.js';
import { GetCoursesUseCase } from '../../application/use-cases/GetCoursesUseCase.js';
import { GetCourseUseCase } from '../../application/use-cases/GetCourseUseCase.js';
import { UpdateCourseUseCase } from '../../application/use-cases/UpdateCourseUseCase.js';
import { DeleteCourseUseCase } from '../../application/use-cases/DeleteCourseUseCase.js';
import { PublishCourseUseCase } from '../../application/use-cases/PublishCourseUseCase.js';
import { CreateCourseDTO, UpdateCourseDTO, CourseResponseDTO } from '../../application/dtos/CourseDTO.js';

export class CourseController {
  constructor(courseRepository, topicRepository, contentRepository, templateRepository, exerciseRepository) {
    this.createCourseUseCase = new CreateCourseUseCase(courseRepository);
    this.getCoursesUseCase = new GetCoursesUseCase(courseRepository);
    this.getCourseUseCase = new GetCourseUseCase(courseRepository);
    this.updateCourseUseCase = new UpdateCourseUseCase(courseRepository, topicRepository, contentRepository);
    this.deleteCourseUseCase = new DeleteCourseUseCase(courseRepository);
    this.publishCourseUseCase = new PublishCourseUseCase({
      courseRepository,
      topicRepository,
      contentRepository,
      templateRepository,
      exerciseRepository,
    });
  }

  async create(req, res, next) {
    try {
      const trainerId =
        req.body.trainer_id || req.auth?.trainer?.trainer_id || req.auth?.trainer?.id;
      const createDTO = new CreateCourseDTO({
        ...req.body,
        trainer_id: trainerId,
      });
      const course = await this.createCourseUseCase.execute(createDTO);
      const responseDTO = new CourseResponseDTO(course);

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
        search: req.query.search,
      };
      const pagination = {
        page: parseInt(req.query.page) || 1,
        limit: Math.min(parseInt(req.query.limit) || 10, 50),
      };

      const result = await this.getCoursesUseCase.execute(trainerId, filters, pagination);

      res.status(200).json({
        courses: result.courses.map(course => new CourseResponseDTO(course)),
        pagination: result.pagination,
      });
    } catch (error) {
      next(error);
    }
  }

  async getById(req, res, next) {
    try {
      const courseId = parseInt(req.params.id);
      const course = await this.getCourseUseCase.execute(courseId);

      if (!course) {
        return res.status(404).json({
          error: {
            code: 'COURSE_NOT_FOUND',
            message: 'Course not found',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const responseDTO = new CourseResponseDTO(course);
      res.status(200).json(responseDTO);
    } catch (error) {
      next(error);
    }
  }

  async update(req, res, next) {
    try {
      const courseId = parseInt(req.params.id);
      const updateDTO = new UpdateCourseDTO(req.body);
      const course = await this.updateCourseUseCase.execute(courseId, updateDTO);

      if (!course) {
        return res.status(404).json({
          error: {
            code: 'COURSE_NOT_FOUND',
            message: 'Course not found',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const responseDTO = new CourseResponseDTO(course);
      res.status(200).json(responseDTO);
    } catch (error) {
      // Handle language update blocked error
      if (error.code === 'LANGUAGE_UPDATE_BLOCKED') {
        return res.status(400).json({
          error: {
            code: 'LANGUAGE_UPDATE_BLOCKED',
            message: error.message,
            details: error.details,
            timestamp: new Date().toISOString(),
          },
        });
      }
      next(error);
    }
  }

  async delete(req, res, next) {
    try {
      const courseId = parseInt(req.params.id);
      await this.deleteCourseUseCase.execute(courseId);

      res.status(200).json({
        success: true,
        message: 'Course deleted successfully',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Publish course (transfer to Course Builder)
   * ⚠️ IMPORTANT: We do NOT publish the course here.
   * We ONLY transfer it to Course Builder, which handles final publishing and visibility.
   * 
   * @param {Object} req - Express request
   * @param {Object} res - Express response
   * @param {Function} next - Express next middleware
   */
  async publish(req, res, next) {
    try {
      const courseId = parseInt(req.params.id);
      
      if (!courseId || isNaN(courseId)) {
        return res.status(400).json({
          error: {
            code: 'INVALID_COURSE_ID',
            message: 'Invalid course ID',
            timestamp: new Date().toISOString(),
          },
        });
      }

      const result = await this.publishCourseUseCase.execute(courseId);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    } catch (error) {
      // Return validation errors with 400 status
      if (error.message.includes('Cannot transfer the course')) {
        return res.status(400).json({
          success: false,
          error: {
            code: 'VALIDATION_FAILED',
            message: error.message,
            timestamp: new Date().toISOString(),
          },
        });
      }

      // Network/server errors
      if (error.message.includes('Course Builder') || error.message.includes('transfer')) {
        return res.status(500).json({
          success: false,
          error: {
            code: 'TRANSFER_FAILED',
            message: 'Transfer failed — Course Builder could not receive the data. Please try again later.',
            timestamp: new Date().toISOString(),
          },
        });
      }

      next(error);
    }
  }
}

