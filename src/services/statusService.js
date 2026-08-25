import { ActivityType } from 'discord.js';
import config from '../config/config.js';
import * as logger from '../utils/logger.js';

const STATUS_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const maintainedClients = new WeakSet();
let statusRefreshTimer = null;

export function applyConfiguredStatus(client) {
  if (!client?.user) return false;

  const text = String(config.status.text || 'Course-Poursuite').trim().slice(0, 128) || 'Course-Poursuite';
  const activityType = ActivityType[config.status.type] ?? ActivityType.Watching;
  const presence = config.status.presence || 'dnd';

  client.user.setPresence({
    activities: [{ name: text, type: activityType }],
    status: presence
  });

  return true;
}

function safelyApplyConfiguredStatus(client, reason) {
  try {
    applyConfiguredStatus(client);
  } catch (err) {
    logger.error(`Impossible d’appliquer le statut du bot (${reason}):`, err);
  }
}

export function startStatusMaintenance(client) {
  safelyApplyConfiguredStatus(client, 'démarrage');

  if (!maintainedClients.has(client)) {
    maintainedClients.add(client);
    client.on('shardReady', () => safelyApplyConfiguredStatus(client, 'connexion au gateway'));
    client.on('shardResume', () => safelyApplyConfiguredStatus(client, 'reconnexion au gateway'));
  }

  if (statusRefreshTimer) clearInterval(statusRefreshTimer);
  statusRefreshTimer = setInterval(() => {
    if (client.isReady()) safelyApplyConfiguredStatus(client, 'vérification périodique');
  }, STATUS_REFRESH_INTERVAL_MS);
  statusRefreshTimer.unref?.();
}

export default {
  applyConfiguredStatus,
  startStatusMaintenance
};
