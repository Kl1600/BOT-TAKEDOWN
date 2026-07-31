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

function getStaffWaitKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getStatusLabel(status) {
  switch (status) {
    case 'claimed':
      return 'Pris en charge';
    case 'left':
      return 'A quitté la vocal';
    case 'waiting':
    default:
      return 'Attente prise en charge';
  }
}

function buildStaffWaitEmbed(userId, joinedAt, status) {
  const descriptionLines = [
    `**<@${userId}>** est en attente staff.`
  ];

  if (status === 'waiting') {
    descriptionLines.push(`Attend depuis <t:${Math.floor(joinedAt / 1000)}:R>.`);
  }

  descriptionLines.push(`-# Merci d'essayer de prendre en charge le membre rapidement.`);

  return new EmbedBuilder()
    .setColor(0xED4245)
    .setDescription(descriptionLines.join('\n'))
    .addFields({
      name: 'Statut',
      value: `\`${getStatusLabel(status)}\``,
      inline: false
    })
    .setTimestamp();
}

function getOrCreateStaffWaitRecord(guildId, userId) {
  const key = getStaffWaitKey(guildId, userId);
  let record = staffWaitTimers.get(key);
  if (!record) {
    record = {
      guildId,
      userId,
      status: 'waiting',
      alerted: false,
      joinedAt: Date.now(),
      channelId: null,
      timeoutId: null,
      messageId: null,
      messageChannelId: null
    };
    staffWaitTimers.set(key, record);
  }
  return record;
}

function clearStaffWaitTimer(record) {
  if (!record?.timeoutId) return;
  clearTimeout(record.timeoutId);
  record.timeoutId = null;
}

async function updateStaffWaitAlert(client, record, nextStatus) {
  try {
    if (!record?.alerted || !record.messageId || !record.messageChannelId) return;

    const alertChannel = client.channels.cache.get(record.messageChannelId)
      || await client.channels.fetch(record.messageChannelId).catch(() => null);
    if (!alertChannel?.isTextBased()) return;

    const message = await alertChannel.messages.fetch(record.messageId).catch(() => null);
    if (!message) return;

    record.status = nextStatus;
    await message.edit({
      content: `<@&${STAFF_WAIT_ROLE_ID}>`,
      embeds: [buildStaffWaitEmbed(record.userId, record.joinedAt, nextStatus)]
    }).catch(() => null);

    clearStaffWaitTimer(record);
    staffWaitTimers.delete(getStaffWaitKey(record.guildId, record.userId));
  } catch (err) {
    logger.error('Erreur lors de la mise à jour du ping staff vocal:', err);
  }
}

async function sendStaffWaitAlert(client, record) {
  try {
    const guild = client.guilds.cache.get(record.guildId) || await client.guilds.fetch(record.guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(record.userId).catch(() => null);
    if (!member?.voice?.channelId || member.voice.channelId !== record.channelId) return;
    if (!STAFF_WAIT_CHANNEL_IDS.has(member.voice.channelId)) return;

    const alertChannel = client.channels.cache.get(STAFF_WAIT_ALERT_CHANNEL_ID)
      || await client.channels.fetch(STAFF_WAIT_ALERT_CHANNEL_ID).catch(() => null);
    if (!alertChannel?.isTextBased()) return;

    const message = await alertChannel.send({
      content: `<@&${STAFF_WAIT_ROLE_ID}>`,
      embeds: [buildStaffWaitEmbed(record.userId, record.joinedAt, 'waiting')]
    }).catch(() => null);

    if (!message) return;

    record.alerted = true;
    record.messageId = message.id;
    record.messageChannelId = alertChannel.id;
    record.status = 'waiting';
    clearStaffWaitTimer(record);
  } catch (err) {
    logger.error('Erreur lors de l\'envoi du ping staff vocal:', err);
  }
}

function scheduleStaffWaitAlert(newState) {
  const member = newState.member;
  const channel = newState.channel;
  if (!member || !channel) return;
  if (!STAFF_WAIT_CHANNEL_IDS.has(channel.id)) return;

  const record = getOrCreateStaffWaitRecord(member.guild.id, member.id);
  record.channelId = channel.id;
  record.joinedAt = Date.now();
  record.status = 'waiting';
  clearStaffWaitTimer(record);

  record.timeoutId = setTimeout(() => {
    void sendStaffWaitAlert(member.client, record);
  }, STAFF_WAIT_DELAY_MS);
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
  const oldIsTarget = Boolean(oldChannelId && STAFF_WAIT_CHANNEL_IDS.has(oldChannelId));
  const newIsTarget = Boolean(newChannelId && STAFF_WAIT_CHANNEL_IDS.has(newChannelId));
  const recordKey = getStaffWaitKey(member.guild.id, member.id);
  const record = staffWaitTimers.get(recordKey);

  if (!oldIsTarget && newIsTarget) {
    scheduleStaffWaitAlert(newState);
    return;
  }

  if (oldIsTarget && newIsTarget && oldChannelId !== newChannelId) {
    scheduleStaffWaitAlert(newState);
    return;
  }

  if (oldIsTarget && !newIsTarget) {
    if (record) {
      clearStaffWaitTimer(record);
      if (record.alerted) {
        const nextStatus = newChannelId ? 'claimed' : 'left';
        void updateStaffWaitAlert(member.client, record, nextStatus);
      } else {
        staffWaitTimers.delete(recordKey);
      }
    }
    return;
  }

  if (!newChannelId && record && record.alerted) {
    void updateStaffWaitAlert(member.client, record, 'left');
  }
}

export default {
  handleJoinGenerator,
  handleLeaveDynamic,
  handleStaffWaitVoiceState
};
