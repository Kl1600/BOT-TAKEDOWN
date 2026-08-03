import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyErr } from '../../services/moderationService.js';
import { sendBetaAccessPanel, buildBetaAccessPanelContainer } from '../../services/betaService.js';
import { getLanguage, isEnglishOnly } from '../../utils/language.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';

registerPanelRefreshBuilder('beta', async ({ member }) => [
  buildBetaAccessPanelContainer(
    await getLanguage(member),
    !(await isEnglishOnly(member))
  )
]);

export const data = new SlashCommandBuilder()
  .setName('accesbeta')
  .setDescription('Envoyer le panneau d’accès à la bêta');

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const lang = await getLanguage(interaction.member);
  const translateDisabled = !(await isEnglishOnly(interaction.member));
  const sentMessage = await sendBetaAccessPanel(interaction.channel, lang, translateDisabled);
  registerPanelRefresh({
    key: `beta:${sentMessage?.id || interaction.channelId}:${interaction.user.id}`,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageIds: sentMessage?.id,
    memberId: interaction.user.id,
    refreshOnMemberUpdate: true,
    panelType: 'beta',
    buildComponents: async member => [
      buildBetaAccessPanelContainer(
        await getLanguage(member),
        !(await isEnglishOnly(member))
      )
    ]
  });
  await interaction.deleteReply().catch(() => null);
}

export async function executePrefix(message) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const lang = await getLanguage(message.member);
  await message.delete().catch(() => null);
  const translateDisabled = !(await isEnglishOnly(message.member));
  const sentMessage = await sendBetaAccessPanel(message.channel, lang, translateDisabled);
  registerPanelRefresh({
    key: `beta:${sentMessage?.id || message.channelId}:${message.author.id}`,
    guildId: message.guildId,
    channelId: message.channelId,
    messageIds: sentMessage?.id,
    memberId: message.author.id,
    refreshOnMemberUpdate: true,
    panelType: 'beta',
    buildComponents: async member => [
      buildBetaAccessPanelContainer(
        await getLanguage(member),
        !(await isEnglishOnly(member))
      )
    ]
  });
}

export default { data, executeSlash, executePrefix };
