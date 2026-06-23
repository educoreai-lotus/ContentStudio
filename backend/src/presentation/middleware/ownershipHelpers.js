import { getDirectoryUserId } from './authHelpers.js';
import { ownershipService } from '../../application/services/OwnershipService.js';
import {
  OwnershipNotFoundError,
  OwnershipUnauthorizedError,
} from '../../application/services/ownershipErrors.js';

export { ownershipService };

/**
 * Require authenticated directory user id from verified JWT (never from client body/query).
 */
export function requireAuthenticatedTrainerId(req) {
  const trainerId = getDirectoryUserId(req);
  if (!trainerId) {
    throw new OwnershipUnauthorizedError();
  }
  return trainerId;
}

export function isOwnershipError(error) {
  return (
    error instanceof OwnershipUnauthorizedError ||
    error instanceof OwnershipNotFoundError ||
    error?.statusCode === 401 ||
    error?.statusCode === 404
  );
}

/**
 * Send 401/404 for ownership errors. Returns true if handled.
 */
export function respondToOwnershipError(error, res) {
  if (error instanceof OwnershipUnauthorizedError || error?.statusCode === 401) {
    res.status(401).json({ error: error.message || 'Authentication required' });
    return true;
  }

  if (error instanceof OwnershipNotFoundError || error?.statusCode === 404) {
    res.status(404).json({
      error: {
        code: 'NOT_FOUND',
        message: 'Resource not found',
        timestamp: new Date().toISOString(),
      },
    });
    return true;
  }

  return false;
}

export async function assertTrainerOwnsCourse(courseId, trainerId, options) {
  return ownershipService.assertTrainerOwnsCourse(courseId, trainerId, options);
}

export async function assertTrainerOwnsTopic(topicId, trainerId, options) {
  return ownershipService.assertTrainerOwnsTopic(topicId, trainerId, options);
}

export async function assertTrainerOwnsContent(contentId, trainerId) {
  return ownershipService.assertTrainerOwnsContent(contentId, trainerId);
}

export async function assertTrainerCanReadTemplate(templateId, trainerId) {
  return ownershipService.assertTrainerCanReadTemplate(templateId, trainerId);
}

export async function assertTrainerOwnsTemplate(templateId, trainerId) {
  return ownershipService.assertTrainerOwnsTemplate(templateId, trainerId);
}

export async function assertTrainerOwnsHistory(historyId, trainerId) {
  return ownershipService.assertTrainerOwnsHistory(historyId, trainerId);
}
