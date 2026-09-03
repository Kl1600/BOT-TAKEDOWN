import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from 'discord.js';
import config from '../config/config.js';
import dbService from '../database/dbProxy.js';
import * as logger from '../utils/logger.js';

const memberSyncQueues = new Map();
const TAG_SCAN_INTERVAL_MS = 35 * 1000;
const TAG_FULL_FETCH_RETRY_DELAY_MS = 5 * 60 * 1000;
let trackedGuildId = null;
let tagScanTimer = null;
let tagScanInProgress = false;
let maintenanceFailureLogged = false;
let nextFullMemberFetchAt = 0;
let memberFetchTimeoutLogged = false;

function isGuildMembersTimeout(error) {
  return error?.code === 'GuildMembersTimeout'
    || error?.message === "Members didn't arrive in time.";
}

async function fetchGuildTagMembers(guild) {
  if (Date.now() < nextFullMemberFetchAt) {
    return guild.members.cache;
  }

  try {
    const members = await guild.members.fetch();
    nextFullMemberFetchAt = 0;
    memberFetchTimeoutLogged = false;
    return members;
  } catch (error) {
    if (!isGuildMembersTimeout(error)) throw error;

    nextFullMemberFetchAt = Date.now() + TAG_FULL_FETCH_RETRY_DELAY_MS;
    if (!memberFetchTimeoutLogged) {
      memberFetchTimeoutLogged = true;
      logger.warn('Chargement complet des membres trop long, suivi des tags poursuivi avec le cache Discord.');
    }
    return guild.members.cache;
  }
}

function getPrimaryGuildData(user) {
  const primaryGuild = user?.primaryGuild ?? user?.primary_guild ?? null;
  if (!primaryGuild) {
    return {
      identityGuildId: null,
      identityEnabled: false,
      tag: null
    };
  }

  return {
    identityGuildId: primaryGuild.identityGuildId ?? primaryGuild.identity_guild_id ?? null,
    identityEnabled: (primaryGuild.identityEnabled ?? primaryGuild.identity_enabled) === true,
    tag: primaryGuild.tag || null
  };
}

function resolveTagState(user, guildId) {
  const primaryGuild = getPrimaryGuildData(user);
  const hasTag = primaryGuild.identityEnabled && primaryGuild.identityGuildId === guildId;

  return {
    hasTag,
    tag: hasTag ? primaryGuild.tag : null,
    identityGuildId: primaryGuild.identityGuildId
  };
}

async function resolveTrackingContext(client) {
  const channelId = config.channels.guildTagLogs;
  if (!client || !channelId) return null;

  const channel = client.channels.cache.get(channelId)
    || await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased() || !channel.guild) return null;

  trackedGuildId = channel.guild.id;
  return { channel, guild: channel.guild };
}

async function sendGuildTagLog(channel, member, state, action) {
  const titles = {
    added: 'TAG SERVEUR AJOUTÉ',
    removed: 'TAG SERVEUR RETIRÉ'
  };
  const descriptions = {
    added: 'Le membre vient d’ajouter le tag du serveur.',
    removed: 'Le membre vient de retirer le tag du serveur.'
  };

  const tagValue = state.tag || 'Aucun';
  const totalTaggedMembers = await dbService.countGuildTagMembers(channel.guild.id);
  const container = new ContainerBuilder()
    .setAccentColor(action === 'removed' ? config.colors.error : config.colors.success)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        `### ${titles[action]}`,
        '',
        descriptions[action],
        '',
        `**Membre** : <@${member.id}> (\`${member.user.username}\`)`,
        `**Identifiant** : \`${member.id}\``,
        `**Tag** : \`${tagValue}\``,
        `**Total de membres avec le tag** : \`${totalTaggedMembers}\``
      ].join('\n'))
    );

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  });
}

async function syncMemberTagState(member, user) {
  if (!member || member.user?.bot) return false;

  const context = await resolveTrackingContext(member.client);
  if (!context || member.guild.id !== context.guild.id) return false;

  const state = resolveTagState(user || member.user, context.guild.id);
  const previous = await dbService.getGuildTagState(context.guild.id, member.id);
  const previousHasTag = previous ? Boolean(previous.has_tag) : null;

  await dbService.upsertGuildTagState(
    context.guild.id,
    member.id,
    state.hasTag,
    state.tag,
    state.identityGuildId
  );

  if (previousHasTag === state.hasTag) return state.hasTag;

  if (previousHasTag === null) {
    return state.hasTag;
  }

  await sendGuildTagLog(
    context.channel,
    member,
    state.hasTag ? state : { ...state, tag: previous.tag || null },
    state.hasTag ? 'added' : 'removed'
  );
  return state.hasTag;
}

export function syncGuildTagMember(member, user = member?.user) {
  if (!member?.id) return Promise.resolve(false);

  const queueKey = `${member.guild?.id || 'unknown'}:${member.id}`;
  const previousQueue = memberSyncQueues.get(queueKey) || Promise.resolve();
  const nextQueue = previousQueue
    .catch(() => null)
    .then(() => syncMemberTagState(member, user));

  memberSyncQueues.set(queueKey, nextQueue);
  return nextQueue.finally(() => {
    if (memberSyncQueues.get(queueKey) === nextQueue) {
      memberSyncQueues.delete(queueKey);
    }
  });
}

export async function syncGuildTagUser(client, user) {
  if (!client || !user?.id || user.bot) return false;

  const context = await resolveTrackingContext(client);
  if (!context) return false;

  const member = context.guild.members.cache.get(user.id);
  if (!member) return false;

  return syncGuildTagMember(member, user);
}

export async function removeGuildTagMember(member) {
  if (!member?.id || !member.guild?.id) return;
  if (trackedGuildId && member.guild.id !== trackedGuildId) return;

  await dbService.deleteGuildTagState(member.guild.id, member.id);
}

async function scanGuildTagMembers(client) {
  if (tagScanInProgress) return null;
  tagScanInProgress = true;

  try {
    const context = await resolveTrackingContext(client);
    if (!context) return null;

    const members = await fetchGuildTagMembers(context.guild);
    for (const member of members.values()) {
      await syncGuildTagMember(member, member.user);
    }

    return members.size;
  } finally {
    tagScanInProgress = false;
  }
}

function startGuildTagMaintenance(client) {
  if (tagScanTimer) clearInterval(tagScanTimer);

  tagScanTimer = setInterval(() => {
    void scanGuildTagMembers(client)
      .then(result => {
        if (result !== null) maintenanceFailureLogged = false;
      })
      .catch(err => {
        if (!maintenanceFailureLogged) {
          maintenanceFailureLogged = true;
          logger.error('Impossible d’actualiser le suivi des tags serveur:', err);
        }
      });
  }, TAG_SCAN_INTERVAL_MS);
  tagScanTimer.unref?.();
}

export async function initializeGuildTagTracking(client) {
  const context = await resolveTrackingContext(client);
  if (!context) {
    logger.warn(`Salon de logs des tags ${config.channels.guildTagLogs || 'non configuré'} introuvable.`);
    return;
  }

  const memberCount = await scanGuildTagMembers(client);
  startGuildTagMaintenance(client);

  logger.info(`Suivi des tags serveur initialisé pour ${memberCount || 0} membres.`);
}

export async function hasGuildTagAccess(guildId, userId) {
  const state = await dbService.getGuildTagState(guildId, userId);
  return Boolean(state?.has_tag);
}

export default {
  initializeGuildTagTracking,
  syncGuildTagMember,
  syncGuildTagUser,
  removeGuildTagMember,
  hasGuildTagAccess
};
