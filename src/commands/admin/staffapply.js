import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ActionRowBuilder } from 'discord.js';
import { t, isEnglishOnly } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';
import config from '../../config/config.js';

const translateHint = '-# ???? Click below to translate to English.';

registerPanelRefreshBuilder('staffapply', async ({ member }) => {
  const translateDisabled = !(await isEnglishOnly(member));
  const panelLang = 'fr';

  const title = t(panelLang, 'commands.staffapply.panel.title');
  const desc = t(panelLang, 'commands.staffapply.panel.description');

  const text = new TextDisplayBuilder().setContent(
    `### ${title}\n\n${desc}\n\n-# Répondez aux sélecteurs, puis lancez l'évaluation en plusieurs étapes.\n\n${translateHint}`
  );

  const applyBtn = new ButtonBuilder()
    .setCustomId('staffapply_open')
    .setLabel(t(panelLang, 'commands.staffapply.panel.button'))
    .setStyle(ButtonStyle.Secondary);

  const translateBtn = new ButtonBuilder()
    .setCustomId('msg_translate_staffapply')
    .setLabel('???? Translate')
    .setStyle(ButtonStyle.Secondary);

  return [
    new ContainerBuilder()
      .setAccentColor(config.colors.primary)
      .addTextDisplayComponents(text)
      .addActionRowComponents(new ActionRowBuilder().addComponents(applyBtn, translateBtn))
  ];
});

export default {
  data: new SlashCommandBuilder()
    .setName('staffapply')
    .setDescription('Recrutement du staff')
    .addSubcommand(subcommand =>
      subcommand
        .setName('menu')
        .setDescription('Afficher le menu de recrutement staff')
    ),

  async executeSlash(interaction, lang) {
    if (!await checkPermissions(interaction, interaction.member)) return;
    const translateDisabled = !(await isEnglishOnly(interaction.member));
    const panelLang = 'fr';

    const title = t(panelLang, 'commands.staffapply.panel.title');
    const desc = t(panelLang, 'commands.staffapply.panel.description');

    const text = new TextDisplayBuilder().setContent(
      `### ${title}\n\n${desc}\n\n-# Répondez aux sélecteurs, puis lancez l'évaluation en plusieurs étapes.\n\n${translateHint}`
    );

    const applyBtn = new ButtonBuilder()
      .setCustomId('staffapply_open')
      .setLabel(t(panelLang, 'commands.staffapply.panel.button'))
      .setStyle(ButtonStyle.Secondary);

    const translateBtn = new ButtonBuilder()
      .setCustomId('msg_translate_staffapply')
      .setLabel('???? Translate')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(applyBtn, translateBtn);

    const container = new ContainerBuilder()
      .setAccentColor(config.colors.primary)
      .addTextDisplayComponents(text)
      .addActionRowComponents(row);

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const sentMessage = await sendV2Container(interaction.channel, container);
    if (!sentMessage?.id) {
      await interaction.editReply({ content: '-# Impossible d’envoyer le panneau de candidature staff dans ce salon.' }).catch(() => null);
      return;
    }

    registerPanelRefresh({
      key: `staffapply:${sentMessage.id}:${interaction.user.id}`,
      guildId: interaction.guildId,
      channelId: interaction.channelId,
      messageIds: sentMessage.id,
      memberId: interaction.user.id,
      refreshOnMemberUpdate: true,
      panelType: 'staffapply',
      buildComponents: async member => {
        const refreshedTranslateDisabled = !(await isEnglishOnly(member));
        const refreshedTranslateBtn = new ButtonBuilder()
          .setCustomId('msg_translate_staffapply')
          .setLabel('???? Translate')
          .setStyle(ButtonStyle.Secondary);

        return [
          new ContainerBuilder()
            .setAccentColor(config.colors.primary)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `### ${t('fr', 'commands.staffapply.panel.title')}\n\n${t('fr', 'commands.staffapply.panel.description')}\n\n-# Répondez aux sélecteurs, puis lancez l'évaluation en plusieurs étapes.\n\n${translateHint}`
              )
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('staffapply_open')
                  .setLabel(t('fr', 'commands.staffapply.panel.button'))
                  .setStyle(ButtonStyle.Secondary),
                refreshedTranslateBtn
              )
            )
        ];
      }
    });
    await interaction.deleteReply().catch(() => null);
  },

  async executePrefix(message, args, lang) {
    if (!await checkPermissions(message, message.member)) return;
    const translateDisabled = !(await isEnglishOnly(message.member));
    const panelLang = 'fr';

    await message.delete().catch(() => null);

    const title = t(panelLang, 'commands.staffapply.panel.title');
    const desc = t(panelLang, 'commands.staffapply.panel.description');

    const text = new TextDisplayBuilder().setContent(
      `### ${title}\n\n${desc}\n\n-# Répondez aux sélecteurs, puis lancez l'évaluation en plusieurs étapes.\n\n${translateHint}`
    );

    const applyBtn = new ButtonBuilder()
      .setCustomId('staffapply_open')
      .setLabel(t(panelLang, 'commands.staffapply.panel.button'))
      .setStyle(ButtonStyle.Secondary);

    const translateBtn = new ButtonBuilder()
      .setCustomId('msg_translate_staffapply')
      .setLabel('???? Translate')
      .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder().addComponents(applyBtn, translateBtn);

    const container = new ContainerBuilder()
      .setAccentColor(config.colors.primary)
      .addTextDisplayComponents(text)
      .addActionRowComponents(row);

    const sentMessage = await sendV2Container(message.channel, container);
    if (!sentMessage?.id) {
      await message.channel.send({ content: '-# Impossible d’envoyer le panneau de candidature staff dans ce salon.' }).catch(() => null);
      return;
    }

    registerPanelRefresh({
      key: `staffapply:${sentMessage.id}:${message.author.id}`,
      guildId: message.guildId,
      channelId: message.channelId,
      messageIds: sentMessage.id,
      memberId: message.author.id,
      refreshOnMemberUpdate: true,
      panelType: 'staffapply',
      buildComponents: async member => {
        const refreshedTranslateDisabled = !(await isEnglishOnly(member));
        const refreshedTranslateBtn = new ButtonBuilder()
          .setCustomId('msg_translate_staffapply')
          .setLabel('???? Translate')
          .setStyle(ButtonStyle.Secondary);

        return [
          new ContainerBuilder()
            .setAccentColor(config.colors.primary)
            .addTextDisplayComponents(
              new TextDisplayBuilder().setContent(
                `### ${t('fr', 'commands.staffapply.panel.title')}\n\n${t('fr', 'commands.staffapply.panel.description')}\n\n-# Répondez aux sélecteurs, puis lancez l'évaluation en plusieurs étapes.\n\n${translateHint}`
              )
            )
            .addActionRowComponents(
              new ActionRowBuilder().addComponents(
                new ButtonBuilder()
                  .setCustomId('staffapply_open')
                  .setLabel(t('fr', 'commands.staffapply.panel.button'))
                  .setStyle(ButtonStyle.Secondary),
                refreshedTranslateBtn
              )
            )
        ];
      }
    });
  }
};




