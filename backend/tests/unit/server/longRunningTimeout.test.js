import http from 'http';
import {
  LONG_RUNNING_REQUEST_TIMEOUT_MS,
  applyLongRunningServerTimeouts,
} from '../../../src/infrastructure/config/longRunningServerTimeout.js';

describe('long-running inbound server timeout', () => {
  it('is 30 minutes', () => {
    expect(LONG_RUNNING_REQUEST_TIMEOUT_MS).toBe(30 * 60 * 1000);
  });

  it('sets server.timeout without changing requestTimeout or headersTimeout', () => {
    const server = http.createServer();
    const requestTimeoutBefore = server.requestTimeout;
    const headersTimeoutBefore = server.headersTimeout;

    applyLongRunningServerTimeouts(server);

    expect(server.timeout).toBe(LONG_RUNNING_REQUEST_TIMEOUT_MS);
    expect(server.requestTimeout).toBe(requestTimeoutBefore);
    expect(server.headersTimeout).toBe(headersTimeoutBefore);

    server.close();
  });
});
