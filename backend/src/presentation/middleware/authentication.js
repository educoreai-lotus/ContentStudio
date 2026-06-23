import { authMockData } from '../../infrastructure/mock/authMockData.js';
import { logger } from '../../infrastructure/logging/Logger.js';
import {
  buildReqUserFromValidation,
  postAuthValidationToCoordinator,
  resolveCoordinatorApiUrl,
} from '../../infrastructure/auth/coordinatorRequestAuth.js';

function isMockAuthEnabled() {
  return process.env.NODE_ENV !== 'production' && process.env.ENABLE_MOCK_AUTH === 'true';
}

function buildMockUser() {
  const trainerId = authMockData.trainer?.trainer_id || 'trainer-maya-levi';
  return {
    directoryUserId: trainerId,
    userId: trainerId,
    organizationId: authMockData.trainer?.company_id || 'default',
    primaryRole: 'TRAINER',
    isSystemAdmin: false,
    isTrainer: true,
    source: 'mock',
  };
}

function extractBearerToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.slice(7).trim();
  return token || null;
}

export const authenticate = async (req, res, next) => {
  const token = extractBearerToken(req);

  if (!token) {
    if (isMockAuthEnabled()) {
      req.user = buildMockUser();
      return next();
    }

    return res.status(401).json({ error: 'Missing bearer token' });
  }

  const coordinatorUrl = resolveCoordinatorApiUrl();
  if (!coordinatorUrl) {
    if (isMockAuthEnabled()) {
      logger.warn(
        '[Auth] COORDINATOR_API_URL/COORDINATOR_URL not set; using mock auth in development'
      );
      req.user = buildMockUser();
      return next();
    }

    if (process.env.NODE_ENV === 'production') {
      logger.error('[Auth] COORDINATOR_API_URL or COORDINATOR_URL is required in production');
      return res.status(503).json({ error: 'Authentication service not configured' });
    }

    return res.status(401).json({ error: 'Authentication service not configured' });
  }

  try {
    const { validation } = await postAuthValidationToCoordinator({
      accessToken: token,
      route: req.originalUrl || req.path || '',
      method: req.method || 'GET',
    });

    if (!validation || validation.valid !== true) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    req.user = buildReqUserFromValidation(validation);
    req.user.source = 'coordinator-nauth';

    const newAccessToken = validation.new_access_token || validation.newAccessToken;
    if (typeof newAccessToken === 'string' && newAccessToken.trim() !== '') {
      res.setHeader('X-New-Access-Token', newAccessToken.trim());
    }

    return next();
  } catch (error) {
    logger.warn('[Auth] Coordinator token validation failed', {
      error: error.message,
      route: req.originalUrl,
    });

    if (isMockAuthEnabled()) {
      req.user = buildMockUser();
      return next();
    }

    return res.status(401).json({ error: 'Authentication failed' });
  }
};

/** @deprecated Use `authenticate` — kept for imports that still reference the old name */
export const authenticationMiddleware = authenticate;
