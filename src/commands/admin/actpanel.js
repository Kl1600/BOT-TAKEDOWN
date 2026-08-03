import { MessageFlags, SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { isStaffOrAdmin, replyErr, prefixReply } from '../../services/moderationService.js';
import { refreshAllPanels } from '../../services/panelRefreshService.js';
import * as logger from '../../utils/logger.js';

function canRefreshPanels(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    isStaffOrAdmin(member)
  );
}

export const data = new SlashCommandBuilder()
  .setName('actpanel')
  .setDescription('Forcer le rafra?chissement de tous les panels');

export async function executeSlash(interaction) {
  if (!canRefreshPanels(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const refreshedCount = await refreshAllPanels(interaction.client);
    return interaction.editReply({
      content: refreshedCount > 0
        ? `? ${refreshedCount} panel(s) rafra?chi(s).`
        : '?? Aucun panel ? rafra?chir.'
    });
  } catch (err) {
    logger.error('Erreur actpanel:', err);
    return interaction.editReply({
      content: `? ${err.message || 'Impossible de rafra?chir les panels.'}`
    }).catch(() => null);
  }
}

export async function executePrefix(message) {
  if (!canRefreshPanels(message.member)) {
    return prefixReply(message, '? Permissions insuffisantes.');
  }

  await message.delete().catch(() => null);

  try {
    const refreshedCount = await refreshAllPanels(message.client);
    const confirmation = await message.channel.send(
      refreshedCount > 0
        ? `? ${refreshedCount} panel(s) rafra?chi(s).`
        : '?? Aucun panel ? rafra?chir.'
    ).catch(() => null);

    if (confirmation) {
      setTimeout(() => {
        confirmation.delete().catch(() => null);
      }, 4000);
    }
  } catch (err) {
    logger.error('Erreur actpanel prefix:', err);
    await prefixReply(message, `? ${err.message || 'Impossible de rafra?chir les panels.'}`);
  }
}

export default { data, executeSlash, executePrefix };
