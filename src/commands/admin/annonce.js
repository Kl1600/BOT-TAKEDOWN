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
import { t, isEnglishOnly } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { logAnnouncement } from '../../services/logService.js';
import { appendSeparatorComponent, splitContentBySeparator, sendV2Container } from '../../utils/v2Helper.js';
import { preparePanelTranslation, storePanelTranslation } from '../../services/translationService.js';
import config from '../../config/config.js';

const translateHint = '-# 🇬🇧 Click below to translate to English.';

function buildAnnouncementContainer(content, translateDisabled = false) {
  const button = new ButtonBuilder()
    .setCustomId('msg_translate_annonce')
    .setLabel('🇬🇧 Translate')
    .setStyle(ButtonStyle.Secondary);

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
  container.addActionRowComponents(new ActionRowBuilder().addComponents(button));
  return container;
}

export async function handleAnnonceModalSubmit(interaction, lang) {
  const content = interaction.fields.getTextInputValue('annonce_content_input');
  const translateDisabled = !(await isEnglishOnly(interaction.member));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const container = buildAnnouncementContainer(content, translateDisabled);
  const translatedComponents = await preparePanelTranslation([container]);

  const shouldPing = interaction.customId === 'annonce_modal_ping';
  if (shouldPing) {
    await interaction.channel.send({ content: '@everyone' }).catch(() => null);
  }

  const announcementMessage = await sendV2Container(interaction.channel, container);
  await storePanelTranslation(announcementMessage?.id, 'annonce', translatedComponents);
  await interaction.editReply({ content: t(lang, 'commands.annonce.success') });

  await logAnnouncement(interaction.client, {
    title: 'Annonce publiee',
    color: 0x57F287,
    fields: [
      { name: 'Publie par', value: `<@${interaction.user.id}> (\`${interaction.user.username}\`)`, inline: true },
      { name: 'Salon', value: `<#${interaction.channelId}>`, inline: true }
    ]
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('annonce')
    .setDescription('Publier une annonce sur le serveur')
    .addBooleanOption(option =>
      option.setName('ping_everyone')
        .setDescription('Faire un ping @everyone ? (Par défaut : non)')
        .setRequired(false)
    ),

  async executeSlash(interaction, lang) {
    if (!await checkPermissions(interaction, interaction.member)) return;

    const pingEveryone = interaction.options.getBoolean('ping_everyone') ?? false;

    const modal = new ModalBuilder()
      .setCustomId(pingEveryone ? 'annonce_modal_ping' : 'annonce_modal_noping')
      .setTitle('Publier une annonce');

    const input = new TextInputBuilder()
      .setCustomId('annonce_content_input')
      .setLabel('Contenu de l\'annonce')
      .setPlaceholder('Entrez votre annonce ici. Utilisez separator sur une ligne pour insérer une séparation.')
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(4000);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
  },

  async executePrefix(message, args, lang) {
    if (!await checkPermissions(message, message.member)) return;

    const content = args.join(' ').trim();
    if (!content) return;
    const translateDisabled = !(await isEnglishOnly(message.member));

    await message.delete().catch(() => null);

    const container = buildAnnouncementContainer(content, translateDisabled);
    const translatedComponents = await preparePanelTranslation([container]);
    const announcementMessage = await sendV2Container(message.channel, container);
    await storePanelTranslation(announcementMessage?.id, 'annonce', translatedComponents);

    await logAnnouncement(message.client, {
      title: 'Annonce publiee',
      color: 0x57F287,
      fields: [
        { name: 'Publie par', value: `<@${message.author.id}> (\`${message.author.username}\`)`, inline: true },
        { name: 'Salon', value: `<#${message.channelId}>`, inline: true }
      ]
    });
  }
};
