export function decodeJwtPayload(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;

  try {
    let b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const pad = b64.length % 4;
    if (pad) b64 += '='.repeat(4 - pad);
    return JSON.parse(atob(b64));
  } catch {
    return null;
  }
}

export function isTrainerFromClaims(claims) {
  if (!claims || typeof claims !== 'object') return false;
  return claims.isTrainer === true || claims.is_trainer === true;
}

export function getDirectoryUserIdFromClaims(claims) {
  if (!claims || typeof claims !== 'object') return '';
  return (
    claims.directoryUserId ||
    claims.directory_user_id ||
    claims.sub ||
    ''
  );
}

export function getOrganizationIdFromClaims(claims) {
  if (!claims || typeof claims !== 'object') return '';
  return (
    claims.organizationId ||
    claims.organization_id ||
    claims.companyId ||
    claims.company_id ||
    ''
  );
}
