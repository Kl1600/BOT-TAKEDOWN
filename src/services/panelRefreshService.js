import { MessageFlags } from 'discord.js';
import dbService from '../database/dbProxy.js';
import { logGeneral } from './logService.js';
import * as logger from '../utils/logger.js';

const PANEL_REFRESH_INTERVAL_MS = 5 * 60 * 1000;

const panelBuilders = new Map();
let refreshInterval = null;
let refreshPromise = null;
let refreshClient = null;

function normalizeMessageIds(messageIds) {
  if (!messageIds) return [];
  return (Array.isArray(messageIds) ? messageIds : [messageIds])
    .map(value => String(value))
    .filter(Boolean);
}

function normalizePayload(payload) {
  if (payload == null) return null;
  if (typeof payload === 'object') return payload;
  try {
    return JSON.parse(String(payload));
  } catch {
    return { value: payload };
  }
}

function normalizeComponentGroups(result) {
  if (!result) return [];

  if (Array.isArray(result)) {
    if (result.length > 0 && Array.isArray(result[0])) {
      return result.map(group => normalizeMessageGroup(group));
    }
    return [normalizeMessageGroup(result)];
  }

  return [normalizeMessageGroup([result])];
}

function normalizeMessageGroup(group) {
  return (Array.isArray(group) ? group : [group]).filter(Boolean);
}

async function resolveGuild(client, guildId) {
  if (!guildId) return null;
  return client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
}

async function resolveChannel(client, channelId) {
  if (!channelId) return null;
  return client.channels.cache.get(channelId) || await client.channels.fetch(channelId).catch(() => null);
}

async function resolveMember(guild, memberId) {
  if (!guild || !memberId) return null;
  return guild.members.cache.get(memberId) || await guild.members.fetch(memberId).catch(() => null);
}

async function refreshRecord(client, record) {
  const panelType = String(record.panel_type || '');
  const builder = panelBuilders.get(panelType);
  if (typeof builder !== 'function') {
    logger.warn(`[PanelRefresh] Aucun builder enregistré pour le panneau "${panelType}".`);
    return 0;
  }

  const guild = await resolveGuild(client, record.guild_id);
  if (!guild) {
    logger.warn(`[PanelRefresh] Guild introuvable pour le panneau "${record.key}".`);
    await dbService.deletePanelRefreshRecord(record.key).catch(() => null);
    return 0;
  }

  const channel = await resolveChannel(client, record.channel_id);
  if (!channel?.isTextBased?.()) {
    logger.warn(`[PanelRefresh] Salon introuvable ou non textuel pour le panneau "${record.key}".`);
    await dbService.deletePanelRefreshRecord(record.key).catch(() => null);
    return 0;
  }

  const member = await resolveMember(guild, record.member_id);
  const payload = normalizePayload(record.payload);
  const messageIds = normalizeMessageIds(record.message_ids);

  if (messageIds.length === 0) {
    logger.warn(`[PanelRefresh] Aucun message à rafraîchir pour le panneau "${record.key}".`);
    await dbService.deletePanelRefreshRecord(record.key).catch(() => null);
    return 0;
  }

  let built;
  try {
    built = await builder({ client, guild, channel, member, payload, record });
  } catch (err) {
    logger.error(`[PanelRefresh] Erreur lors de la reconstruction du panneau "${panelType}" (${record.key}):`, err);
    return 0;
  }

  const groups = normalizeComponentGroups(built);
  const refreshCount = Math.min(messageIds.length, groups.length);
  if (refreshCount === 0) {
    return 0;
  }

  let successCount = 0;
  for (let index = 0; index < refreshCount; index += 1) {
    const messageId = messageIds[index];
    const components = groups[index];
    if (!components || components.length === 0) continue;

    const message = channel.messages.cache.get(messageId) || await channel.messages.fetch(messageId).catch(() => null);
    if (!message) {
      logger.warn(`[PanelRefresh] Message introuvable (${messageId}) pour le panneau "${record.key}".`);
      continue;
    }

    try {
      await message.edit({
        components,
        flags: MessageFlags.IsComponentsV2
      });
      successCount += 1;
    } catch (err) {
      logger.error(`[PanelRefresh] Impossible de rafraîchir le message ${messageId} (${record.key}):`, err);
    }
  }

  return successCount;
}

export function registerPanelRefreshBuilder(panelType, builder) {
  if (!panelType || typeof builder !== 'function') return;
  panelBuilders.set(String(panelType), builder);
}

export async function registerPanelRefresh(record) {
  if (!record?.key || !record?.guildId || !record?.channelId) {
    return null;
  }

  const normalizedRecord = {
    ...record,
    messageIds: normalizeMessageIds(record.messageIds)
  };

  await dbService.upsertPanelRefreshRecord(normalizedRecord).catch(err => {
    logger.warn(`[PanelRefresh] Impossible d'enregistrer le panneau "${normalizedRecord.key}": ${err?.message || err}`);
  });

  return normalizedRecord.key;
}

export async function unregisterPanelRefresh(key) {
  if (!key) return;
  await dbService.deletePanelRefreshRecord(key).catch(err => {
    logger.warn(`[PanelRefresh] Impossible de supprimer le panneau "${key}": ${err?.message || err}`);
  });
}

export async function refreshAllPanels(client = refreshClient, { source = 'auto' } = {}) {
  if (!client || refreshPromise) {
    return refreshPromise || 0;
  }

  refreshClient = client;
  refreshPromise = (async () => {
    const records = await dbService.getPanelRefreshRecords().catch(err => {
      logger.warn(`[PanelRefresh] Impossible de lire les panneaux enregistrés: ${err?.message || err}`);
      return [];
    });

    let totalRefreshed = 0;
    for (const record of records || []) {
      totalRefreshed += await refreshRecord(client, record);
    }

    return totalRefreshed;
  })();

  try {
    const refreshedCount = await refreshPromise;

    await logGeneral(client, {
      title: 'Rafraîchissement des panels',
      description: `Source : **${source}**`,
      fields: [
        { name: 'Panels mis à jour', value: String(refreshedCount), inline: true }
      ]
    }).catch(() => null);

    return refreshedCount;
  } finally {
    refreshPromise = null;
  }
}

export async function refreshPanelsForMember(client = refreshClient, memberOrId = null) {
  if (!client || !memberOrId) return 0;

  const memberId = typeof memberOrId === 'string'
    ? memberOrId
    : memberOrId?.id || null;

  if (!memberId) return 0;

  const records = await dbService.getPanelRefreshRecords().catch(err => {
    logger.warn(`[PanelRefresh] Impossible de lire les panneaux enregistrés: ${err?.message || err}`);
    return [];
  });

  let totalRefreshed = 0;
  for (const record of records || []) {
    if (String(record.member_id || '') !== String(memberId)) continue;
    totalRefreshed += await refreshRecord(client, record);
  }

  return totalRefreshed;
}

export async function rehydratePanelRefreshes(client = refreshClient) {
  if (!client) return 0;
  return refreshAllPanels(client, { source: 'startup' });
}

export function startPanelRefreshScheduler(client = refreshClient) {
  if (!client) return;

  refreshClient = client;
  if (refreshInterval) return;

  refreshInterval = setInterval(() => {
    void refreshAllPanels(client, { source: 'auto' }).catch(err => {
      logger.error('[PanelRefresh] Erreur lors du rafraîchissement automatique:', err);
    });
  }, PANEL_REFRESH_INTERVAL_MS);

  if (typeof refreshInterval.unref === 'function') {
    refreshInterval.unref();
  }
}

export function stopPanelRefreshScheduler() {
  if (!refreshInterval) return;
  clearInterval(refreshInterval);
  refreshInterval = null;
}

export default {
  registerPanelRefresh,
  registerPanelRefreshBuilder,
  unregisterPanelRefresh,
  refreshAllPanels,
  refreshPanelsForMember,
  rehydratePanelRefreshes,
  startPanelRefreshScheduler,
  stopPanelRefreshScheduler
};
