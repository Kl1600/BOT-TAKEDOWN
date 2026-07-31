import { SlashCommandBuilder } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyErr, replyOk, replyUsage } from '../../services/moderationService.js';
import config from '../../config/config.js';

function extractUserId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

async function sendDirectMessage(client, userId, content) {
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) {
    throw new Error('Utilisateur introuvable.');
  }

  await user.send({ content });
  return user;
}

export const data = new SlashCommandBuilder()
  .setName('dm')
  .setDescription('Envoyer un message priv? ? un utilisateur')
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('ID Discord du destinataire')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Message ? envoyer')
      .setRequired(true)
      .setMaxLength(2000)
  );

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const userId = extractUserId(interaction.options.getString('id', true));
  const message = interaction.options.getString('message', true).trim();

  if (!userId || !message) {
    return replyUsage(interaction, '`/dm <id> <message>`');
  }

  await interaction.deferReply({ ephemeral: true });

  try {
    const user = await sendDirectMessage(interaction.client, userId, message);
    return replyOk(interaction, `? Message envoy? ? <@${user.id}>.`);
  } catch (error) {
    return replyErr(interaction, error.message || 'Impossible d?envoyer le DM.');
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '? Permissions insuffisantes.');
  }

  const userId = extractUserId(args[0]);
  const content = args.slice(1).join(' ').trim();

  if (!userId || !content) {
    return replyUsage(message, `\`${config.prefix}dm <id> <message>\``);
  }

  try {
    const user = await sendDirectMessage(message.client, userId, content);
    return prefixReply(message, `? Message envoy? ? ${user.tag}.`);
  } catch (error) {
    return prefixReply(message, `? ${error.message || 'Impossible d?envoyer le DM.'}`);
  }
}

export default { data, executeSlash, executePrefix };
