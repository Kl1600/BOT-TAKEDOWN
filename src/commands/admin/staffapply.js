import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ButtonStyle, MessageFlags, ActionRowBuilder } from 'discord.js';
import { t, isEnglishOnly } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import config from '../../config/config.js';

const translateHint = '-# 🇬🇧 Click below to translate to English.';

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
      .setLabel('🇬🇧 Translate')
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
      .setLabel('🇬🇧 Translate')
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

  }
};


