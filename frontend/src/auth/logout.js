import { clearAuthToken } from './accessToken.js';

const FALLBACK_TOKEN_KEYS = ['authToken', 'accessToken', 'token'];

let logoutInProgress = false;

export function isLogoutInProgress() {
  return logoutInProgress;
}

export async function callNAuthLogout() {
  const baseUrl = import.meta.env.VITE_NAUTH_BASE_URL;
  if (!baseUrl || String(baseUrl).trim() === '') {
    console.warn('[logout] VITE_NAUTH_BASE_URL is not set; skipping nAuth logout call.');
    return;
  }

  const url = `${String(baseUrl).replace(/\/$/, '')}/auth/logout`;
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
  });

  if (!response.ok) {
    throw new Error(`nAuth logout failed with status ${response.status}`);
  }
}

export function clearClientAuthState() {
  clearAuthToken();

  try {
    for (const key of FALLBACK_TOKEN_KEYS) {
      localStorage.removeItem(key);
    }
  } catch {
    // ignore storage errors
  }
}

export function redirectToNAuthLogin() {
  const frontendUrl = import.meta.env.VITE_NAUTH_FRONTEND_URL;
  if (!frontendUrl || String(frontendUrl).trim() === '') {
    console.warn('[logout] VITE_NAUTH_FRONTEND_URL is not set; redirecting to /');
    window.location.href = '/';
    return;
  }

  const target = `${String(frontendUrl).replace(/\/$/, '')}/login`;
  window.location.href = target;
}

export async function logout(options = {}) {
  if (logoutInProgress) {
    return;
  }

  logoutInProgress = true;

  try {
    try {
      await callNAuthLogout();
    } catch (error) {
      console.warn('[logout] nAuth logout request failed:', error);
    }
  } finally {
    clearClientAuthState();
    if (options.redirect !== false) {
      redirectToNAuthLogin();
    } else {
      logoutInProgress = false;
    }
  }
}
