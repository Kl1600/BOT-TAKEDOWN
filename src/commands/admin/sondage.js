import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { sendPollSetupPanel } from '../../services/pollService.js';

export default {
  data: new SlashCommandBuilder()
    .setName('sondage')
    .setDescription('Créer un sondage interactif'),

  async executeSlash(interaction) {
    if (!await checkPermissions(interaction, interaction.member)) return;
    await sendPollSetupPanel(interaction.channel, interaction.user.id);
    await interaction.reply({ content: 'Panneau de sondage envoyé.', flags: MessageFlags.Ephemeral });
  },

  async executePrefix(message) {
    if (!await checkPermissions(message, message.member)) return;
    await message.delete().catch(() => null);
    await sendPollSetupPanel(message.channel, message.author.id);
  }
};
