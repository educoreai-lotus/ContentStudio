import { setAuthToken } from './accessToken.js';

/**
 * Read #access_token from URL hash, persist to localStorage, strip hash from URL.
 */
export function ingestAccessTokenFromHash() {
  if (typeof window === 'undefined') return;

  const hash = window.location.hash || '';
  if (!hash.startsWith('#')) return;

  const hashParams = new URLSearchParams(hash.slice(1));
  const accessToken = hashParams.get('access_token');
  if (typeof accessToken !== 'string' || accessToken.trim() === '') {
    return;
  }

  setAuthToken(accessToken.trim());

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState(null, '', cleanUrl);
}
