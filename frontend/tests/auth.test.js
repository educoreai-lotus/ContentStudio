import { describe, it, expect, beforeEach } from 'vitest';
import {
  decodeJwtPayload,
  isTrainerFromClaims,
} from '../src/auth/jwtUtils.js';
import { ingestAccessTokenFromHash } from '../src/auth/hashTokenBootstrap.js';
import { AUTH_TOKEN_STORAGE_KEY, getAuthToken } from '../src/auth/accessToken.js';

function buildFakeJwt(payload) {
  const header = btoa(JSON.stringify({ alg: 'none', typ: 'JWT' }));
  const body = btoa(JSON.stringify(payload));
  return `${header}.${body}.signature`;
}

describe('jwtUtils', () => {
  it('reads isTrainer from camelCase and snake_case claims', () => {
    expect(isTrainerFromClaims({ isTrainer: true })).toBe(true);
    expect(isTrainerFromClaims({ is_trainer: true })).toBe(true);
    expect(isTrainerFromClaims({ primaryRole: 'TRAINER', is_trainer: false })).toBe(false);
  });

  it('decodes JWT payload for UX checks', () => {
    const token = buildFakeJwt({ directoryUserId: 'dir-1', isTrainer: true });
    const claims = decodeJwtPayload(token);
    expect(claims.directoryUserId).toBe('dir-1');
    expect(isTrainerFromClaims(claims)).toBe(true);
  });
});

describe('hashTokenBootstrap', () => {
  beforeEach(() => {
    localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  it('stores access_token from hash', () => {
    const token = buildFakeJwt({ isTrainer: true, directoryUserId: 'dir-9' });
    window.location.hash = `#access_token=${encodeURIComponent(token)}`;

    ingestAccessTokenFromHash();

    expect(getAuthToken()).toBe(token);
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBe(token);
  });
});
