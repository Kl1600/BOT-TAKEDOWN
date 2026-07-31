import { ChannelType, PermissionFlagsBits } from 'discord.js';
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

// Stockage en mémoire des salons vocaux dynamiques créés
const dynamicChannels = new Set();
const dynamicChannelOwners = new Map();

function sanitizeVoiceName(name) {
  return String(name ?? '')
    .replace(/[\\/\[\]#:*?"<>|]/g, '')
    .trim()
    .slice(0, 90) || 'salon-vocal';
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

export default {
  handleJoinGenerator,
  handleLeaveDynamic
};
