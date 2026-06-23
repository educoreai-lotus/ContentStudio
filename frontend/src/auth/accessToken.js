export const AUTH_TOKEN_STORAGE_KEY = 'auth_token';

export function getAuthToken() {
  try {
    const token = localStorage.getItem(AUTH_TOKEN_STORAGE_KEY);
    return token != null ? String(token).trim() : '';
  } catch {
    return '';
  }
}

export function setAuthToken(token) {
  const value = token != null ? String(token).trim() : '';
  if (!value) return;
  try {
    localStorage.setItem(AUTH_TOKEN_STORAGE_KEY, value);
  } catch {
    // ignore storage errors
  }
}

export function clearAuthToken() {
  try {
    localStorage.removeItem(AUTH_TOKEN_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

export function applyRotatedTokenFromHeaders(headers) {
  if (!headers) return;
  const next =
    headers['x-new-access-token'] ??
    headers['X-New-Access-Token'];
  if (next != null && String(next).trim() !== '') {
    setAuthToken(String(next).trim());
  }
}
