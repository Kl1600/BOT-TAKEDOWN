import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyUsage, replyErr, replyOk } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';
import config from '../../config/config.js';

function extractUserId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

async function clearCooldown(userId) {
  const cooldown = await dbService.getStaffApplyCooldown(userId).catch(() => null);
  if (!cooldown) {
    return false;
  }

  await dbService.clearStaffApplyCooldown(userId).catch(() => null);
  return true;
}

export const data = new SlashCommandBuilder()
  .setName('saferc')
  .setDescription('Retirer le cooldown de candidature staff')
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('ID Discord du candidat')
      .setRequired(true)
  );

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const userId = extractUserId(interaction.options.getString('id', true));
  if (!userId) {
    return replyErr(interaction, 'ID Discord invalide.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const removed = await clearCooldown(userId);
  if (!removed) {
    return replyErr(interaction, 'Aucun cooldown staff apply à retirer pour cet utilisateur.');
  }

  await dbService.addLog('STAFFAPPLY_SAFERC', interaction.user.id, `Removed staff apply cooldown for ${userId}`, interaction.channelId).catch(() => null);
  return replyOk(interaction, `✅ Le cooldown staff apply de <@${userId}> a été retiré.`);
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const userId = extractUserId(args[0]);
  if (!userId) {
    return replyUsage(message, `\`${config.prefix}saferc <id>\``);
  }

  const removed = await clearCooldown(userId);
  if (!removed) {
    return prefixReply(message, '❌ Aucun cooldown staff apply à retirer pour cet utilisateur.');
  }

  await dbService.addLog('STAFFAPPLY_SAFERC', message.author.id, `Removed staff apply cooldown for ${userId}`, message.channelId).catch(() => null);
  return prefixReply(message, `✅ Le cooldown staff apply de <@${userId}> a été retiré.`);
}

export default { data, executeSlash, executePrefix };
