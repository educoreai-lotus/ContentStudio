import { HandleExchangeRequestUseCase } from '../../application/use-cases/HandleExchangeRequestUseCase.js';

export class InterServiceExchangeController {
  constructor({ topicRepository, contentRepository, courseRepository }) {
    this.handleExchangeRequestUseCase = new HandleExchangeRequestUseCase({
      topicRepository,
      contentRepository,
      courseRepository,
    });
  }

  async exchange(req, res, next) {
    try {
      const { serviceName, payload } = req.body;

      const filledPayload = await this.handleExchangeRequestUseCase.execute({
        serviceName,
        payload,
      });

      res.status(200).json(filledPayload);
    } catch (error) {
      next(error);
    }
  }
}


