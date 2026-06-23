import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AUTH_TOKEN_STORAGE_KEY } from '../src/auth/accessToken.js';

const NAUTH_API = 'https://nauth-api.test';
const NAUTH_FRONTEND = 'https://nauth.test';

describe('logout', () => {
  let locationHref;
  let fetchMock;

  beforeEach(async () => {
    vi.resetModules();
    vi.stubEnv('VITE_NAUTH_BASE_URL', NAUTH_API);
    vi.stubEnv('VITE_NAUTH_FRONTEND_URL', NAUTH_FRONTEND);

    localStorage.clear();
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, 'primary-token');
    localStorage.setItem('authToken', 'fallback-1');
    localStorage.setItem('accessToken', 'fallback-2');
    localStorage.setItem('token', 'fallback-3');

    locationHref = '';
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        get href() {
          return locationHref;
        },
        set href(value) {
          locationHref = value;
        },
      },
    });

    fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 });
    vi.stubGlobal('fetch', fetchMock);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  async function loadLogoutModule() {
    return import('../src/auth/logout.js');
  }

  it('calls nAuth logout with POST and credentials include', async () => {
    const { callNAuthLogout } = await loadLogoutModule();

    await callNAuthLogout();

    expect(fetchMock).toHaveBeenCalledWith(`${NAUTH_API}/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
    });
  });

  it('clears the Content Studio token key and fallback keys', async () => {
    const { clearClientAuthState } = await loadLogoutModule();

    clearClientAuthState();

    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('authToken')).toBeNull();
    expect(localStorage.getItem('accessToken')).toBeNull();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('redirects to nAuth frontend login page', async () => {
    const { redirectToNAuthLogin } = await loadLogoutModule();

    redirectToNAuthLogin();

    expect(locationHref).toBe(`${NAUTH_FRONTEND}/login`);
  });

  it('logout clears local token and redirects even when nAuth logout fails', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { logout } = await loadLogoutModule();
    await logout();

    expect(fetchMock).toHaveBeenCalled();
    expect(localStorage.getItem(AUTH_TOKEN_STORAGE_KEY)).toBeNull();
    expect(locationHref).toBe(`${NAUTH_FRONTEND}/login`);
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('skips nAuth logout when VITE_NAUTH_BASE_URL is missing', async () => {
    vi.stubEnv('VITE_NAUTH_BASE_URL', '');
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { callNAuthLogout } = await loadLogoutModule();
    await callNAuthLogout();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalled();

    warnSpy.mockRestore();
  });

  it('prevents duplicate logout while in progress', async () => {
    let resolveFetch;
    fetchMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveFetch = () => resolve({ ok: true, status: 200 });
        })
    );

    const { logout, isLogoutInProgress } = await loadLogoutModule();
    const first = logout();

    expect(isLogoutInProgress()).toBe(true);
    await logout();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    resolveFetch();
    await first;
  });
});
