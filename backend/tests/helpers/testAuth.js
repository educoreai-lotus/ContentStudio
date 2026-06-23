import express from 'express';
import cors from 'cors';
import { errorHandler } from '../../src/presentation/middleware/errorHandler.js';

/**
 * Shared authenticated trainer identity for integration tests.
 * Mirrors the shape set by Coordinator/JWT validation in production.
 */
export const TEST_TRAINER = {
  directoryUserId: 'trainer-x',
  userId: 'trainer-x',
  organizationId: 'org-1',
  isTrainer: true,
  primaryRole: 'TRAINER',
};

export const TEST_TRAINER_B = {
  directoryUserId: 'trainer-y',
  userId: 'trainer-y',
  organizationId: 'org-1',
  isTrainer: true,
  primaryRole: 'TRAINER',
};

export const TEST_TRAINER_ID = TEST_TRAINER.directoryUserId;

/** Valid template format_order for entity validation in tests */
export const VALID_TEMPLATE_FORMAT_ORDER = [
  'text_audio',
  'code',
  'presentation',
  'mind_map',
  'avatar_video',
];

/**
 * Express middleware that injects req.user for protected route tests.
 */
export function injectTestUser(user = TEST_TRAINER) {
  return (req, _res, next) => {
    req.user = user;
    next();
  };
}

/**
 * Build an Express app with optional authenticated trainer context.
 */
export function createIntegrationTestApp(routers, { user = TEST_TRAINER, authenticated = true } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  if (authenticated) {
    app.use(injectTestUser(user));
  }

  const routeList = Array.isArray(routers) ? routers : [routers];
  for (const { path, router } of routeList) {
    app.use(path, router);
  }

  app.use(errorHandler);
  return app;
}
