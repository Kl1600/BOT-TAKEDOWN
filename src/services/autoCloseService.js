import * as logger from '../utils/logger.js';

/**
 * Auto-delete des tickets fermés désactivé.
 */
export function startAutoDeleteCheck(client) {
  logger.info('Auto-delete of closed tickets is disabled.');
  return;
}

export default {
  startAutoDeleteCheck
};
