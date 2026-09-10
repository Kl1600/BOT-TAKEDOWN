import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { getLanguage, isTranslationUnavailableError, t } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { logAnnouncement } from '../../services/logService.js';
import { appendSeparatorComponent, splitContentBySeparator, sendV2Container } from '../../utils/v2Helper.js';
import { preparePanelTranslation, storePanelTranslation } from '../../services/translationService.js';
import config from '../../config/config.js';
import * as logger from '../../utils/logger.js';

const translateHint = '-# 🇬🇧 Click below to translate to English.';

function buildPatchnoteContainer(content) {
  const container = new ContainerBuilder().setAccentColor(config.colors.primary);
  const blocks = splitContentBySeparator(content);

  blocks.forEach((block, index) => {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(block.trim()));
    if (index < blocks.length - 1) {
      appendSeparatorComponent(container);
    }
  });

  if (blocks.length > 0) {
    appendSeparatorComponent(container);
  }

  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(translateHint));
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('msg_translate_patchnote')
        .setLabel('🇬🇧 Translate')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

async function prepareAndStorePatchnoteTranslation(messageId, container) {
  if (!messageId) return;

  try {
    const translatedComponents = await preparePanelTranslation([container]);
    await storePanelTranslation(messageId, 'patchnote', translatedComponents);
  } catch (error) {
    if (isTranslationUnavailableError(error)) {
      logger.warn('Traduction du patch note non préparée ; elle sera retentée lors d’un clic sur Translate.');
      return;
    }
    logger.error('Impossible de préparer la traduction du patch note:', error);
  }
}

export async function handlePatchNoteModalSubmit(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const content = interaction.fields.getTextInputValue('patchnote_content_input');
  const lang = await getLanguage(interaction.member).catch(() => 'fr');

  const container = buildPatchnoteContainer(content);

  const shouldPing = interaction.customId === 'patchnote_modal_ping';
  if (shouldPing) {
    await interaction.channel.send({ content: `<@&${config.notifications.patchNotes}>` }).catch(() => null);
  }

  const patchnoteMessage = await sendV2Container(interaction.channel, container);
  await interaction.editReply({ content: t(lang, 'commands.patchnote.success') });
  void prepareAndStorePatchnoteTranslation(patchnoteMessage?.id, container);

  await logAnnouncement(interaction.client, {
    title: 'Patch note publiee',
    color: 0x57F287,
    fields: [
      { name: 'Publie par', value: `<@${interaction.user.id}> (\`${interaction.user.username}\`)`, inline: true },
      { name: 'Salon', value: `<#${interaction.channelId}>`, inline: true }
    ]
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('patchnote')
    .setDescription('Publier un patch note sur le serveur')
    .addBooleanOption(option =>
      option.setName('ping_patchnotes')
        .setDescription('Pinger le rôle de notif patch notes ? ')
        .setRequired(false)
    ),

  async executeSlash(interaction, lang) {
    if (!await checkPermissions(interaction, interaction.member)) return;

    const pingPatchNotes = interaction.options.getBoolean('ping_patchnotes') ?? false;

    const modal = new ModalBuilder()
      .setCustomId(pingPatchNotes ? 'patchnote_modal_ping' : 'patchnote_modal_noping')
      .setTitle('Publier un patch note');

    const input = new TextInputBuilder()
      .setCustomId('patchnote_content_input')
      .setLabel('Contenu du patch note')
      .setPlaceholder('Entrez votre patch note ici. Utilisez separator sur une ligne pour insérer une séparation.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  },

  async executePrefix(message, args, lang) {
    if (!await checkPermissions(message, message.member)) return;

    const prefix = config.prefix;
    const commandUsed = message.content.slice(prefix.length).trim().split(/ +/)[0];
    const content = message.content.slice(prefix.length + commandUsed.length).trim();

    if (!content) {
      await message.channel.send({
        content: `Utilisation : \`${prefix}patchnote <contenu du patch note>\``
      }).catch(() => null);
      return;
    }

    const container = buildPatchnoteContainer(content);

    await message.delete().catch(() => null);
    const patchnoteMessage = await sendV2Container(message.channel, container);
    void prepareAndStorePatchnoteTranslation(patchnoteMessage?.id, container);

    await logAnnouncement(message.client, {
      title: 'Patch note publiee',
      color: 0x57F287,
      fields: [
        { name: 'Publie par', value: `<@${message.author.id}> (\`${message.author.username}\`)`, inline: true },
        { name: 'Salon', value: `<#${message.channelId}>`, inline: true }
      ]
    });
  }
};
