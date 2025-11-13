/**
 * Status Messages Helper
 * Utility functions for managing status messages during content creation
 */

/**
 * Push a status message to the status messages array
 * @param {Array} statusList - Array of status messages
 * @param {string} message - Status message text
 * @returns {void}
 */
export function pushStatus(statusList, message) {
  if (!Array.isArray(statusList)) {
    throw new Error('statusList must be an array');
  }
  statusList.push({
    message,
    timestamp: new Date().toISOString(),
  });
}

/**
 * Create a new status messages array
 * @returns {Array} Empty status messages array
 */
export function createStatusMessages() {
  return [];
}

