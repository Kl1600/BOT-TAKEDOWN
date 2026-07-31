import { MessageFlags } from 'discord.js';
import dbService from '../database/dbProxy.js';
import * as logger from '../utils/logger.js';
import { hasActiveStaffApplySession } from './recruitmentService.js';

const PANEL_REFRESH_INTERVAL_MS = 5 * 60 * 1000;
const refreshEntries = new Map();
const refreshBuilders = new Map();
let refreshTimer = null;

function normalizeMessageIds(messageIds) {
  if (Array.isArray(messageIds)) {
    return messageIds.map(id => String(id)).filter(Boolean);
  }
  if (messageIds) {
    return [String(messageIds)];
  }
  return [];
}

async function fetchFreshGuildMember(guild, memberId) {
  if (!guild || !memberId) return null;
  return guild.members.fetch(memberId, { force: true }).catch(async () => {
    try {
      return await guild.members.fetch(memberId).catch(() => null);
    } catch {
      return null;
    }
  });
}

export function registerPanelRefreshBuilder(panelType, builder) {
  if (!panelType || typeof builder !== 'function') return;
  refreshBuilders.set(String(panelType), builder);
}

export function registerPanelRefresh({
  key,
  guildId,
  channelId,
  messageIds,
  memberId = null,
  refreshOnMemberUpdate = false,
  panelType = null,
  payload = null,
  buildComponents
}) {
  const normalizedKey = String(key || messageIds?.[0] || channelId || Date.now());
  const normalizedMessageIds = normalizeMessageIds(messageIds);
  if (!normalizedMessageIds.length || typeof buildComponents !== 'function') {
    return normalizedKey;
  }

  const entry = {
    guildId: guildId ? String(guildId) : null,
    channelId: channelId ? String(channelId) : null,
    messageIds: normalizedMessageIds,
    memberId: memberId ? String(memberId) : null,
    refreshOnMemberUpdate: Boolean(refreshOnMemberUpdate),
    panelType: panelType ? String(panelType) : null,
    payload: payload || null,
    buildComponents
  };

  refreshEntries.set(normalizedKey, entry);

  if (entry.panelType) {
    dbService.upsertPanelRefreshRecord({
      key: normalizedKey,
      guildId: entry.guildId,
      channelId: entry.channelId,
      messageIds: entry.messageIds,
      memberId: entry.memberId,
      refreshOnMemberUpdate: entry.refreshOnMemberUpdate,
      panelType: entry.panelType,
      payload: entry.payload
    }).catch(err => logger.warn(`Impossible d'enregistrer le panel ${normalizedKey}: ${err?.message || err}`));
  }

  return normalizedKey;
}

export function unregisterPanelRefresh(key) {
  if (!key) return;
  refreshEntries.delete(String(key));
  dbService.deletePanelRefreshRecord(String(key)).catch(() => null);
}

async function refreshEntry(client, entry) {
  if (entry.panelType === 'staffapply' && entry.memberId && hasActiveStaffApplySession(entry.memberId)) {
    return false;
  }

  const guild = entry.guildId
    ? client.guilds.cache.get(entry.guildId) || await client.guilds.fetch(entry.guildId).catch(() => null)
    : null;
  if (!guild) return false;

  const member = entry.memberId
    ? await fetchFreshGuildMember(guild, entry.memberId)
    : null;
  if (member) {
    member.forceLanguage = 'fr';
  }

  let components = null;
  try {
    components = await entry.buildComponents(member, client);
  } catch (err) {
    logger.warn(`Impossible de reconstruire un panel: ${err?.message || err}`);
  } finally {
    if (member) {
      delete member.forceLanguage;
    }
  }

  if (!Array.isArray(components) || components.length === 0) {
    return false;
  }

  const normalizedComponents = Array.isArray(components) ? components : [components];
  const isNestedComponentSet = normalizedComponents.every(component => Array.isArray(component));

  for (let index = 0; index < entry.messageIds.length; index += 1) {
    const messageId = entry.messageIds[index];
    const rawComponentSet = entry.messageIds.length > 1
      ? normalizedComponents[index]
      : isNestedComponentSet
        ? normalizedComponents[0]
        : normalizedComponents;
    if (!rawComponentSet) continue;
    const componentSet = Array.isArray(rawComponentSet) ? rawComponentSet : [rawComponentSet];
    const channel = entry.channelId
      ? guild.channels.cache.get(entry.channelId) || await guild.channels.fetch(entry.channelId).catch(() => null)
      : null;
    if (!channel || !channel.isTextBased()) continue;

    const message = await channel.messages.fetch(messageId).catch(() => null);
    if (!message) continue;

    await message.edit({
      components: componentSet,
      flags: MessageFlags.IsComponentsV2
    }).catch(err => {
      logger.warn(`Impossible de rafraîchir le panel ${messageId}: ${err?.message || err}`);
    });
  }

  return true;
}

export async function refreshAllPanels(client) {
  for (const entry of refreshEntries.values()) {
    await refreshEntry(client, entry);
  }
}

export async function refreshPanelsForMember(client, guildId, memberId) {
  const normalizedGuildId = String(guildId);
  const normalizedMemberId = String(memberId);

  for (const entry of refreshEntries.values()) {
    if (entry.guildId !== normalizedGuildId) continue;
    if (entry.memberId !== normalizedMemberId) continue;
    if (!entry.refreshOnMemberUpdate) continue;
    await refreshEntry(client, entry);
  }
}

export async function rehydratePanelRefreshes(client) {
  const records = await dbService.getPanelRefreshRecords().catch(() => []);

  for (const record of records) {
    const inferredPanelType = record?.panel_type
      || (String(record?.key || '').startsWith('modes:') ? 'modes' : null);
    if (!inferredPanelType) continue;

    const builder = refreshBuilders.get(String(inferredPanelType));
    if (typeof builder !== 'function') continue;

    let payload = null;
    try {
      payload = record.payload ? JSON.parse(record.payload) : null;
    } catch {
      payload = null;
    }

    let messageIds = [];
    try {
      messageIds = record.message_ids ? JSON.parse(record.message_ids) : [];
    } catch {
      messageIds = [];
    }

    refreshEntries.set(String(record.key), {
      guildId: String(record.guild_id),
      channelId: String(record.channel_id),
      messageIds: normalizeMessageIds(messageIds),
      memberId: record.member_id ? String(record.member_id) : null,
      refreshOnMemberUpdate: Boolean(record.refresh_on_member_update),
      panelType: String(inferredPanelType),
      payload,
      buildComponents: async member => builder({ member, client, payload, lang: 'fr' })
    });
  }

  await refreshAllPanels(client).catch(() => null);
}

export function startPanelRefreshScheduler(client) {
  if (refreshTimer) return;

  refreshTimer = setInterval(() => {
    refreshAllPanels(client).catch(err => {
      logger.warn(`Erreur rafraîchissement panels: ${err?.message || err}`);
    });
  }, PANEL_REFRESH_INTERVAL_MS);
}

export default {
  registerPanelRefresh,
  registerPanelRefreshBuilder,
  unregisterPanelRefresh,
  refreshAllPanels,
  refreshPanelsForMember,
  rehydratePanelRefreshes,
  startPanelRefreshScheduler
};
