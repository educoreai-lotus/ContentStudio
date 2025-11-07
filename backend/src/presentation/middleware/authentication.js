import { AuthenticationClient } from '../../infrastructure/integrations/AuthenticationClient.js';
import { authMockData } from '../../infrastructure/mock/authMockData.js';
import { logger } from '../../infrastructure/logging/Logger.js';

const authenticationClient = new AuthenticationClient({
  serviceUrl: process.env.AUTH_SERVICE_URL,
});

const buildAuthFromMock = (trainerId) => {
  const trainerInfo =
    trainerId && authMockData.trainer
      ? { ...authMockData.trainer, trainer_id: trainerId }
      : authMockData.trainer;

  return {
    ...authMockData,
    trainer: trainerInfo,
    source: 'mock',
  };
};

export const authenticationMiddleware = async (req, res, next) => {
  if (req.method === 'OPTIONS') {
    return next();
  }

  const trainerId =
    req.headers['x-trainer-id'] ||
    req.headers['trainer-id'] ||
    req.query.trainer_id ||
    req.body?.trainer_id ||
    null;

  try {
    const tokenPayload = await authenticationClient.requestToken({ trainerId });

    if (tokenPayload && tokenPayload.token) {
      req.auth = {
        ...tokenPayload,
        source: 'authentication-service',
      };

      if (!req.auth.trainer && trainerId) {
        req.auth.trainer = { trainer_id: trainerId };
      }

      return next();
    }

    logger.warn('Authentication token missing in response, using mock data', {
      trainerId,
    });
    req.auth = buildAuthFromMock(trainerId);
  } catch (error) {
    logger.warn('Authentication service unavailable, using mock data fallback', {
      error: error.message,
      trainerId,
    });
    req.auth = buildAuthFromMock(trainerId);
  }

  return next();
};


