import { ChannelType, EmbedBuilder, PermissionFlagsBits } from 'discord.js';
import * as logger from '../utils/logger.js';

// Salons vocaux déclencheurs (Join-to-Create)
const GENERATOR_CHANNEL_IDS = new Set([
  '1517850992115450028',
  '1523726944435306559'
]);
const GENERATOR_CHANNEL_LANG = new Map([
  ['1517850992115450028', 'FR'],
  ['1523726944435306559', 'ENG']
]);

const STAFF_WAIT_CHANNEL_IDS = new Set([
  '1527724385828470814',
  '1519738752094830834'
]);
const STAFF_WAIT_ROLE_ID = '1532824877516718141';
const STAFF_WAIT_ALERT_CHANNEL_ID = '1532829411894755368';
const STAFF_WAIT_DELAY_MS = 5_000;

// Stockage en mémoire des salons vocaux dynamiques créés
const dynamicChannels = new Set();
const dynamicChannelOwners = new Map();
const staffWaitTimers = new Map();

function sanitizeVoiceName(name) {
  return String(name ?? '')
    .replace(/[\\/\[\]#:*?"<>|]/g, '')
    .trim()
    .slice(0, 90) || 'salon-vocal';
}

function formatDuration(totalMilliseconds) {
  const totalSeconds = Math.max(0, Math.floor((totalMilliseconds || 0) / 1000));
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }

  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) {
    return seconds > 0 ? `${minutes}m${String(seconds).padStart(2, '0')}` : `${minutes}m`;
  }

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h${String(remainingMinutes).padStart(2, '0')}`;
}

function getStaffWaitKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function clearStaffWaitTimer(guildId, userId) {
  const key = getStaffWaitKey(guildId, userId);
  const entry = staffWaitTimers.get(key);
  if (!entry) return;

  clearTimeout(entry.timeoutId);
  staffWaitTimers.delete(key);
}

async function sendStaffWaitAlert(client, guildId, userId, channelId, joinedAt) {
  try {
    const guild = client.guilds.cache.get(guildId) || await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(userId).catch(() => null);
    if (!member?.voice?.channelId || member.voice.channelId !== channelId) return;
    if (!STAFF_WAIT_CHANNEL_IDS.has(member.voice.channelId)) return;

    const alertChannel = client.channels.cache.get(STAFF_WAIT_ALERT_CHANNEL_ID)
      || await client.channels.fetch(STAFF_WAIT_ALERT_CHANNEL_ID).catch(() => null);
    if (!alertChannel?.isTextBased()) return;

    const embed = new EmbedBuilder()
      .setColor(0xED4245)
      .setDescription([
        `**<@${userId}>** est en attente staff.`,
        `Attend depuis <t:${Math.floor(joinedAt / 1000)}:R>.`,
        '-# Merci d\'essayer de prendre en charge le membre rapidement.'
      ].join('\n'))
      .setTimestamp();

    await alertChannel.send({
      content: `<@&${STAFF_WAIT_ROLE_ID}>`,
      embeds: [embed]
    }).catch(() => null);
  } catch (err) {
    logger.error('Erreur lors de l\'envoi du ping staff vocal:', err);
  } finally {
    clearStaffWaitTimer(guildId, userId);
  }
}

function scheduleStaffWaitAlert(newState) {
  const member = newState.member;
  const channel = newState.channel;
  if (!member || !channel) return;
  if (!STAFF_WAIT_CHANNEL_IDS.has(channel.id)) return;

  const guildId = member.guild.id;
  const userId = member.id;
  clearStaffWaitTimer(guildId, userId);

  const joinedAt = Date.now();
  const timeoutId = setTimeout(() => {
    void sendStaffWaitAlert(member.client, guildId, userId, channel.id, joinedAt);
  }, STAFF_WAIT_DELAY_MS);

  staffWaitTimers.set(getStaffWaitKey(guildId, userId), {
    timeoutId,
    channelId: channel.id,
    joinedAt
  });
}

/**
 * Gère la création d'un salon vocal dynamique si le membre rejoint le salon déclencheur
 */
export async function handleJoinGenerator(newState) {
  const member = newState.member;
  const channel = newState.channel;
  if (!channel || !member) return;

  if (!GENERATOR_CHANNEL_IDS.has(channel.id)) return;

  try {
    const languageTag = GENERATOR_CHANNEL_LANG.get(channel.id) || 'FR';
    const channelName = `》${sanitizeVoiceName(member.displayName)} [${languageTag}]`;

    const newVoice = await channel.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: channel.parentId,
      permissionOverwrites: [
        ...channel.permissionOverwrites.cache.values(),
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers
          ]
        }
      ]
    });

    dynamicChannels.add(newVoice.id);
    dynamicChannelOwners.set(newVoice.id, member.id);

    await member.voice.setChannel(newVoice).catch(async () => {
      dynamicChannels.delete(newVoice.id);
      dynamicChannelOwners.delete(newVoice.id);
      await newVoice.delete().catch(() => null);
    });
  } catch (err) {
    logger.error('Erreur lors de la création du salon vocal dynamique:', err);
  }
}

/**
 * Supprime le salon vocal dynamique uniquement quand il est vide
 */
export async function handleLeaveDynamic(oldState) {
  const oldChannel = oldState.channel;
  if (!oldChannel) return;

  if (!dynamicChannels.has(oldChannel.id)) return;

  try {
    const remainingMembers = oldChannel.members?.size ?? 0;
    if (remainingMembers > 0) return;

    dynamicChannels.delete(oldChannel.id);
    dynamicChannelOwners.delete(oldChannel.id);
    await oldChannel.delete().catch(() => null);
  } catch (err) {
    logger.error(`Erreur lors de la suppression du salon dynamique ${oldChannel.id}:`, err);
  }
}

export function handleStaffWaitVoiceState(oldState, newState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user?.bot) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;

  if (oldChannelId && STAFF_WAIT_CHANNEL_IDS.has(oldChannelId) && oldChannelId !== newChannelId) {
    clearStaffWaitTimer(member.guild.id, member.id);
  }

  if (newChannelId && STAFF_WAIT_CHANNEL_IDS.has(newChannelId) && oldChannelId !== newChannelId) {
    scheduleStaffWaitAlert(newState);
  }

  if (!newChannelId) {
    clearStaffWaitTimer(member.guild.id, member.id);
  }
}

export default {
  handleJoinGenerator,
  handleLeaveDynamic,
  handleStaffWaitVoiceState
};
