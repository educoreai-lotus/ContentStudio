import axios from 'axios';

export const N_AUTH_VALIDATION_ACTION =
  'Route this request to nAuth service only for access token validation and session continuity decision.';

export const AUTH_REQUESTER_SERVICE = 'content-studio';

export function resolveCoordinatorApiUrl() {
  return process.env.COORDINATOR_API_URL || process.env.COORDINATOR_URL || null;
}

export function resolveAuthValidationTimeoutMs() {
  const authMs = Number(process.env.AUTH_VALIDATION_TIMEOUT_MS);
  if (Number.isFinite(authMs) && authMs > 0) {
    return authMs;
  }
  return 30000;
}

export function buildAuthValidationEnvelope({ accessToken, route, method }) {
  return {
    requester_service: AUTH_REQUESTER_SERVICE,
    payload: {
      action: N_AUTH_VALIDATION_ACTION,
      access_token: accessToken,
      route: route || '',
      method: method || 'GET',
    },
    response: {
      valid: false,
      reason: '',
      auth_state: '',
      directory_user_id: '',
      organization_id: '',
      primary_role: '',
      is_system_admin: false,
      is_trainer: false,
      new_access_token: '',
    },
  };
}

export function extractValidationPayload(rawData) {
  if (!rawData || typeof rawData !== 'object') {
    return null;
  }

  if (rawData.response && typeof rawData.response === 'object') {
    return rawData.response;
  }

  if (rawData.data && typeof rawData.data === 'object') {
    if (rawData.data.response && typeof rawData.data.response === 'object') {
      return rawData.data.response;
    }
    return rawData.data;
  }

  if (Object.prototype.hasOwnProperty.call(rawData, 'valid')) {
    return rawData;
  }

  return null;
}

export function buildReqUserFromValidation(validation) {
  const directoryUserId = validation?.directory_user_id || validation?.directoryUserId || '';
  const organizationId = validation?.organization_id || validation?.organizationId || '';
  const primaryRole = validation?.primary_role || validation?.primaryRole || '';
  const isSystemAdmin =
    validation?.is_system_admin === true || validation?.isSystemAdmin === true;
  const isTrainer =
    validation?.is_trainer === true || validation?.isTrainer === true;

  return {
    directoryUserId,
    userId: directoryUserId,
    organizationId,
    primaryRole,
    isSystemAdmin,
    isTrainer,
  };
}

export async function postAuthValidationToCoordinator({ accessToken, route, method }) {
  const coordinatorUrl = resolveCoordinatorApiUrl();
  if (!coordinatorUrl) {
    throw new Error(
      'COORDINATOR_API_URL or COORDINATOR_URL environment variable is required'
    );
  }

  const cleanCoordinatorUrl = coordinatorUrl.replace(/\/$/, '');
  const url = `${cleanCoordinatorUrl}/request`;
  const envelope = buildAuthValidationEnvelope({ accessToken, route, method });

  const response = await axios.post(url, envelope, {
    headers: {
      'Content-Type': 'application/json',
    },
    timeout: resolveAuthValidationTimeoutMs(),
  });

  return {
    validation: extractValidationPayload(response?.data),
    raw: response?.data,
  };
}
