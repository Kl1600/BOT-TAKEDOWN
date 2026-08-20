import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { t } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import { buildTicketPanelContainer } from '../../services/ticketService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Envoyer le panneau d\'ouverture de ticket'),

  async executeSlash(interaction, lang) {
    if (!await checkPermissions(interaction, interaction.member)) return;
    await sendV2Container(interaction.channel, await buildTicketPanelContainer('fr', interaction.member));
    await interaction.reply({ content: 'Panneau de ticket envoyé avec succès.', flags: MessageFlags.Ephemeral });
  },

  async executePrefix(message, args, lang) {
    if (!await checkPermissions(message, message.member)) return;
    await message.delete().catch(() => null);
    await sendV2Container(message.channel, await buildTicketPanelContainer('fr', message.member));
  }
};
