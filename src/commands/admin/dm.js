import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyErr, replyOk, replyUsage } from '../../services/moderationService.js';
import config from '../../config/config.js';
import { logDm } from '../../services/logService.js';

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
  .setDescription('Envoyer un message privé à un utilisateur')
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('ID Discord du destinataire')
      .setRequired(true)
  )
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Message à envoyer')
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

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const user = await sendDirectMessage(interaction.client, userId, message);
    await logDm(interaction.client, {
      direction: 'envoyé',
      fields: [
        { name: 'Auteur', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
        { name: 'Destinataire', value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
        { name: 'Contenu', value: message.slice(0, 1024), inline: false }
      ]
    }).catch(() => null);
    return replyOk(interaction, `Message envoyé à <@${user.id}>.`);
  } catch (error) {
    return replyErr(interaction, error.message || 'Impossible d’envoyer le DM.');
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const userId = extractUserId(args[0]);
  const content = args.slice(1).join(' ').trim();

  if (!userId || !content) {
    return replyUsage(message, `\`${config.prefix}dm <id> <message>\``);
  }

  try {
    const user = await sendDirectMessage(message.client, userId, content);
    await logDm(message.client, {
      direction: 'envoyé',
      fields: [
        { name: 'Auteur', value: `<@${message.author.id}> (\`${message.author.tag}\`)`, inline: true },
        { name: 'Destinataire', value: `<@${user.id}> (\`${user.tag}\`)`, inline: true },
        { name: 'Contenu', value: content.slice(0, 1024), inline: false }
      ]
    }).catch(() => null);
    return prefixReply(message, `Message envoyé à ${user.tag}.`);
  } catch (error) {
    return prefixReply(message, error.message || 'Impossible d’envoyer le DM.');
  }
}

export default { data, executeSlash, executePrefix };
