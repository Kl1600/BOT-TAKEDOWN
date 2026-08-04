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
  .setName('refreshpanel')
  .setDescription('Forcer le rafraÃ®chissement de tous les panels');

export async function executeSlash(interaction) {
  if (!canRefreshPanels(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await new Promise(resolve => setTimeout(resolve, 750));
    const refreshedCount = await refreshAllPanels(interaction.client);
    return interaction.editReply({
      content: refreshedCount > 0
        ? `âœ… ${refreshedCount} panel(s) rafraÃ®chi(s).`
        : 'â„¹ï¸ Aucun panel Ã  rafraÃ®chir.'
    });
  } catch (err) {
    logger.error('Erreur refreshpanel:', err);
    return interaction.editReply({
      content: `âŒ ${err.message || 'Impossible de rafraÃ®chir les panels.'}`
    }).catch(() => null);
  }
}

export async function executePrefix(message) {
  if (!canRefreshPanels(message.member)) {
    return prefixReply(message, 'âŒ Permissions insuffisantes.');
  }

  await message.delete().catch(() => null);

  try {
    await new Promise(resolve => setTimeout(resolve, 750));
    const refreshedCount = await refreshAllPanels(message.client);
    const confirmation = await message.channel.send(
      refreshedCount > 0
        ? `âœ… ${refreshedCount} panel(s) rafraÃ®chi(s).`
        : 'â„¹ï¸ Aucun panel Ã  rafraÃ®chir.'
    ).catch(() => null);

    if (confirmation) {
      setTimeout(() => {
        confirmation.delete().catch(() => null);
      }, 4000);
    }
  } catch (err) {
    logger.error('Erreur refreshpanel prefix:', err);
    await prefixReply(message, `âŒ ${err.message || 'Impossible de rafraÃ®chir les panels.'}`);
  }
}

export default { data, executeSlash, executePrefix };

