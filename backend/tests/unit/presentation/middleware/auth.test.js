import { jest } from '@jest/globals';
import { requireTrainer } from '../../../../src/presentation/middleware/authorizeTrainer.js';
import { buildReqUserFromValidation } from '../../../../src/infrastructure/auth/coordinatorRequestAuth.js';

describe('authorizeTrainer middleware', () => {
  const next = jest.fn();
  const res = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when req.user is missing', () => {
    const req = {};
    requireTrainer(req, res, next);
    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('returns 403 when isTrainer is false', () => {
    const req = {
      user: {
        directoryUserId: 'user-1',
        isTrainer: false,
        primaryRole: 'HR',
      },
    };
    requireTrainer(req, res, next);
    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({
      error: 'Access denied',
      message: 'Trainer role required',
    });
  });

  it('allows HR primary role when isTrainer is true', () => {
    const req = {
      user: {
        directoryUserId: 'user-1',
        isTrainer: true,
        primaryRole: 'HR',
      },
    };
    requireTrainer(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('buildReqUserFromValidation', () => {
  it('maps is_trainer snake_case to isTrainer', () => {
    const user = buildReqUserFromValidation({
      valid: true,
      directory_user_id: 'dir-1',
      organization_id: 'org-1',
      primary_role: 'HR',
      is_system_admin: false,
      is_trainer: true,
    });

    expect(user).toEqual({
      directoryUserId: 'dir-1',
      userId: 'dir-1',
      organizationId: 'org-1',
      primaryRole: 'HR',
      isSystemAdmin: false,
      isTrainer: true,
    });
  });

  it('does not treat primaryRole TRAINER as authorization signal without is_trainer', () => {
    const user = buildReqUserFromValidation({
      valid: true,
      directory_user_id: 'dir-2',
      organization_id: 'org-2',
      primary_role: 'TRAINER',
      is_trainer: false,
    });

    expect(user.isTrainer).toBe(false);
    expect(user.primaryRole).toBe('TRAINER');
  });
});
