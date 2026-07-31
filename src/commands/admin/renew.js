import { ChannelType, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyErr, replyOk } from '../../services/moderationService.js';
import * as logger from '../../utils/logger.js';

function resolveTargetChannel(source) {
  const optionChannel = source.options?.getChannel?.('salon') || null;
  const mentionedChannel = source.mentions?.channels?.first?.() || null;
  const target = optionChannel || mentionedChannel || source.channel || null;

  if (!target || typeof target.isTextBased !== 'function' || !target.isTextBased()) {
    return null;
  }

  if (target.type === ChannelType.GuildAnnouncement || target.type === ChannelType.GuildText) {
    return target;
  }

  return null;
}

async function renewChannel(channel, reason) {
  const clonedChannel = await channel.clone({
    name: channel.name,
    reason
  }).catch(err => {
    throw new Error(err?.message || 'Impossible de dupliquer le salon.');
  });

  if (!clonedChannel) {
    throw new Error('Impossible de dupliquer le salon.');
  }

  if (clonedChannel.id !== channel.id) {
    await channel.delete(reason).catch(err => {
      throw new Error(err?.message || "Impossible de supprimer l'ancien salon.");
    });
  }

  return clonedChannel;
}

export const data = new SlashCommandBuilder()
  .setName('renew')
  .setDescription("Dupliquer un salon et supprimer l'ancien")
  .addChannelOption(option =>
    option
      .setName('salon')
      .setDescription('Salon à renouveler (défaut : salon actuel)')
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('raison')
      .setDescription('Raison du renouvellement')
      .setRequired(false)
      .setMaxLength(500)
  );

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const channel = resolveTargetChannel(interaction);
  if (!channel) {
    return replyErr(interaction, 'Le salon cible doit être un salon texte.');
  }

  const reason = interaction.options.getString('raison') || 'Renouvellement du salon';

  try {
    const newChannel = await renewChannel(channel, reason);
    return replyOk(interaction, `✅ Salon renouvelé : <#${channel.id}> → <#${newChannel.id}>`, 0x57F287);
  } catch (err) {
    return replyErr(interaction, err.message || 'Impossible de renouveler le salon.');
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const channel = resolveTargetChannel(message);
  if (!channel) {
    return prefixReply(message, '❌ Le salon cible doit être un salon texte.');
  }

  const reason = args.filter(arg => !arg.startsWith('<#')).join(' ') || 'Renouvellement du salon';

  try {
    const newChannel = await renewChannel(channel, reason);
    await newChannel.send(`✅ Salon renouvelé par ${message.author.toString()}.`).catch(() => null);
    await message.delete().catch(() => null);
  } catch (err) {
    logger.error('Erreur renew prefix:', err);
    await prefixReply(message, `❌ ${err.message || 'Impossible de renouveler le salon.'}`);
  }
}

export default {
  data,
  executeSlash,
  executePrefix
};
