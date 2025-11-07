import { logger } from '../logging/Logger.js';

/**
 * Authentication Service Client
 * Communicates with the Authentication microservice using the unified exchange endpoint.
 */
export class AuthenticationClient {
  constructor({ serviceUrl, fetchImpl } = {}) {
    this.serviceUrl = serviceUrl ? serviceUrl.replace(/\/$/, '') : null;
    this.fetchImpl = fetchImpl || globalThis.fetch?.bind(globalThis);
  }

  /**
   * Request JWT token for the current trainer/user.
   * @param {Object} options
   * @param {string} [options.trainerId] - Optional trainer identifier for context.
   * @returns {Promise<Object>} Token payload (must include a `token` field on success).
   */
  async requestToken({ trainerId } = {}) {
    if (!this.serviceUrl) {
      throw new Error('Authentication service URL not configured');
    }

    if (!this.fetchImpl) {
      throw new Error('Fetch implementation not available');
    }

    const exchangePayload = {
      serviceName: 'ContentStudio',
      payload: JSON.stringify({
        requestType: 'requestToken',
        trainerId: trainerId || null,
        token: '',
      }),
    };

    const response = await this.fetchImpl(`${this.serviceUrl}/api/exchange`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(exchangePayload),
    });

    if (!response.ok) {
      const errorBody = await this.safeParseJson(response);
      throw new Error(
        `Authentication service error: ${response.status} ${response.statusText}${
          errorBody ? ` - ${JSON.stringify(errorBody)}` : ''
        }`
      );
    }

    const rawData = await this.safeParseJson(response);
    const payload = this.extractPayload(rawData);

    if (!payload?.token) {
      logger.warn('Authentication service response missing token', { rawData });
    }

    return payload || {};
  }

  extractPayload(rawData) {
    if (!rawData) {
      return null;
    }

    if (rawData.token) {
      return rawData;
    }

    const candidate =
      rawData.payload !== undefined
        ? rawData.payload
        : rawData.data !== undefined
        ? rawData.data
        : rawData.result;

    if (typeof candidate === 'string') {
      try {
        return JSON.parse(candidate);
      } catch (error) {
        logger.warn('Unable to parse authentication payload string', { error: error.message });
        return null;
      }
    }

    return candidate || null;
  }

  async safeParseJson(response) {
    try {
      return await response.json();
    } catch (error) {
      return null;
    }
  }
}


