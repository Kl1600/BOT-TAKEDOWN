import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isStaffOrAdmin, replyErr, replyOk, prefixReply } from '../../services/moderationService.js';
import * as logger from '../../utils/logger.js';

async function clearChannel(channel) {
  let totalDeleted = 0;

  while (true) {
    const messages = await channel.messages.fetch({ limit: 100 }).catch(() => null);
    if (!messages || messages.size === 0) break;

    const deletable = messages.filter(message => !message.pinned);
    if (deletable.size === 0) break;

    const bulk = deletable.filter(message => Date.now() - message.createdTimestamp < 14 * 24 * 60 * 60 * 1000);
    const oldMessages = deletable.filter(message => Date.now() - message.createdTimestamp >= 14 * 24 * 60 * 60 * 1000);

    if (bulk.size > 0) {
      const deleted = await channel.bulkDelete(bulk, true).catch(() => null);
      totalDeleted += deleted?.size ?? 0;
    }

    for (const message of oldMessages.values()) {
      await message.delete().catch(() => null);
      totalDeleted += 1;
    }

    if (messages.size < 100) break;
  }

  return totalDeleted;
}

export const data = new SlashCommandBuilder()
  .setName('clear')
  .setDescription('Supprimer tous les messages du salon');

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const deleted = await clearChannel(interaction.channel);
    return replyOk(interaction, `✅ ${deleted} message(s) supprimé(s) dans ce salon.`, 0x57F287);
  } catch (err) {
    logger.error('Erreur clear slash:', err);
    return replyErr(interaction, err.message || 'Impossible de vider le salon.');
  }
}

export async function executePrefix(message) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  try {
    const deleted = await clearChannel(message.channel);
    const confirmation = await message.channel.send(`✅ ${deleted} message(s) supprimé(s) dans ce salon.`).catch(() => null);
    if (confirmation) {
      setTimeout(() => {
        confirmation.delete().catch(() => null);
      }, 4000);
    }
  } catch (err) {
    logger.error('Erreur clear prefix:', err);
    await prefixReply(message, `❌ ${err.message || 'Impossible de vider le salon.'}`);
  }
}
 

export default { data, executeSlash, executePrefix };
