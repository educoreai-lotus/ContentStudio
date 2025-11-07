import { CreateCourseUseCase } from '../../application/use-cases/CreateCourseUseCase.js';
import { GetCoursesUseCase } from '../../application/use-cases/GetCoursesUseCase.js';
import { GetCourseUseCase } from '../../application/use-cases/GetCourseUseCase.js';
import { UpdateCourseUseCase } from '../../application/use-cases/UpdateCourseUseCase.js';
import { DeleteCourseUseCase } from '../../application/use-cases/DeleteCourseUseCase.js';
import { CreateCourseDTO, UpdateCourseDTO, CourseResponseDTO } from '../../application/dtos/CourseDTO.js';

export class CourseController {
  constructor(courseRepository) {
    this.createCourseUseCase = new CreateCourseUseCase(courseRepository);
    this.getCoursesUseCase = new GetCoursesUseCase(courseRepository);
    this.getCourseUseCase = new GetCourseUseCase(courseRepository);
    this.updateCourseUseCase = new UpdateCourseUseCase(courseRepository);
    this.deleteCourseUseCase = new DeleteCourseUseCase(courseRepository);
  }

  async create(req, res, next) {
    try {
      const createDTO = new CreateCourseDTO(req.body);
      const course = await this.createCourseUseCase.execute(createDTO);
      const responseDTO = new CourseResponseDTO(course);

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
}

