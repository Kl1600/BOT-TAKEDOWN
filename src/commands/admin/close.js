import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { executeTicketClose, hasTicketManagementAccess, replyErr, prefixReply } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('close')
  .setDescription('Fermer le ticket du salon actuel')
  .addStringOption(o => o.setName('raison').setDescription('Raison de la fermeture').setRequired(false).setMaxLength(500));

export async function executeSlash(interaction) {
  if (!hasTicketManagementAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const raison = interaction.options.getString('raison') || 'Fermé via commande';

  try {
    await executeTicketClose({ channel: interaction.channel, mod: interaction.user, raison, client: interaction.client });
    await interaction.deleteReply().catch(() => null);
  } catch (error) {
    return replyErr(interaction, error.message);
  }
}

export async function executePrefix(message, args) {
  if (!hasTicketManagementAccess(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const raison = args.join(' ') || 'Fermé via commande';

  try {
    await executeTicketClose({ channel: message.channel, mod: message.author, raison, client: message.client });
    await message.delete().catch(() => null);
  } catch (error) {
    await prefixReply(message, `❌ ${error.message}`);
  }
}

export default { data, executeSlash, executePrefix };
