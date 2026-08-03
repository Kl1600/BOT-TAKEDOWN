import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { t } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import { buildTicketPanelContainer } from '../../services/ticketService.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';
import { getLanguage } from '../../utils/language.js';

registerPanelRefreshBuilder('ticket', async ({ member }) => {
  const lang = await getLanguage(member);
  return [buildTicketPanelContainer(lang, member)];
});

export default {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Envoyer le panneau d\'ouverture de ticket'),

  async executeSlash(interaction, lang) {
    if (!await checkPermissions(interaction, interaction.member)) return;
    const message = await sendV2Container(interaction.channel, buildTicketPanelContainer(lang, interaction.member));
    registerPanelRefresh({
      key: `ticket:${message?.id || interaction.channelId}`,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageIds: message?.id,
      memberId: interaction.user.id,
      refreshOnMemberUpdate: true,
      panelType: 'ticket',
      buildComponents: async member => {
        const refreshedLang = await getLanguage(member);
        return [buildTicketPanelContainer(refreshedLang, member)];
      }
    });
    await interaction.reply({ content: 'Panneau de ticket envoyé avec succès.', flags: MessageFlags.Ephemeral });
  },

  async executePrefix(message, args, lang) {
    if (!await checkPermissions(message, message.member)) return;
    await message.delete().catch(() => null);
    const sentMessage = await sendV2Container(message.channel, buildTicketPanelContainer(lang, message.member));
    registerPanelRefresh({
      key: `ticket:${sentMessage?.id || message.channelId}`,
      guildId: message.guildId,
      channelId: message.channelId,
      messageIds: sentMessage?.id,
      memberId: message.author.id,
      refreshOnMemberUpdate: true,
      panelType: 'ticket',
      buildComponents: async member => {
        const refreshedLang = await getLanguage(member);
        return [buildTicketPanelContainer(refreshedLang, member)];
      }
    });
  }
};
