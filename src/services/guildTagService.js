import { ContainerBuilder, MessageFlags, TextDisplayBuilder } from 'discord.js';
import config from '../config/config.js';
import dbService from '../database/dbProxy.js';
import * as logger from '../utils/logger.js';

const memberSyncQueues = new Map();
let trackedGuildId = null;

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
    detected: 'TAG SERVEUR DÉTECTÉ',
    added: 'TAG SERVEUR AJOUTÉ',
    removed: 'TAG SERVEUR RETIRÉ'
  };
  const descriptions = {
    detected: 'Le membre possède déjà le tag du serveur.',
    added: 'Le membre vient d’ajouter le tag du serveur.',
    removed: 'Le membre vient de retirer le tag du serveur.'
  };

  const tagValue = state.tag || 'Aucun';
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
        `**Tag** : \`${tagValue}\``
      ].join('\n'))
    );

  await channel.send({
    components: [container],
    flags: MessageFlags.IsComponentsV2,
    allowedMentions: { parse: [] }
  });
}

async function syncMemberTagState(member, user, { logInitialPresence = true } = {}) {
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
    if (state.hasTag && logInitialPresence) {
      await sendGuildTagLog(context.channel, member, state, 'detected');
    }
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

export function syncGuildTagMember(member, user = member?.user, options = {}) {
  if (!member?.id) return Promise.resolve(false);

  const queueKey = `${member.guild?.id || 'unknown'}:${member.id}`;
  const previousQueue = memberSyncQueues.get(queueKey) || Promise.resolve();
  const nextQueue = previousQueue
    .catch(() => null)
    .then(() => syncMemberTagState(member, user, options));

  memberSyncQueues.set(queueKey, nextQueue);
  return nextQueue.finally(() => {
    if (memberSyncQueues.get(queueKey) === nextQueue) {
      memberSyncQueues.delete(queueKey);
    }
  });
}

export async function removeGuildTagMember(member) {
  if (!member?.id || !member.guild?.id) return;
  if (trackedGuildId && member.guild.id !== trackedGuildId) return;

  await dbService.deleteGuildTagState(member.guild.id, member.id);
}

export async function initializeGuildTagTracking(client) {
  const context = await resolveTrackingContext(client);
  if (!context) {
    logger.warn(`Salon de logs des tags ${config.channels.guildTagLogs || 'non configuré'} introuvable.`);
    return;
  }

  const members = await context.guild.members.fetch();
  for (const member of members.values()) {
    await syncGuildTagMember(member, member.user, { logInitialPresence: true });
  }

  logger.info(`Suivi des tags serveur initialisé pour ${members.size} membres.`);
}

export async function hasGuildTagAccess(guildId, userId) {
  const state = await dbService.getGuildTagState(guildId, userId);
  return Boolean(state?.has_tag);
}

export default {
  initializeGuildTagTracking,
  syncGuildTagMember,
  removeGuildTagMember,
  hasGuildTagAccess
};
