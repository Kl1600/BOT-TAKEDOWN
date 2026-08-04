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
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';
import config from '../../config/config.js';

const translateHint = '-# ???? Click below to translate to English.';

registerPanelRefreshBuilder('patchnote', async ({ member, payload }) => {
  const translateDisabled = !(await isEnglishOnly(member));
  return [buildPatchnoteContainer(payload.content, translateDisabled)];
});

function buildPatchnoteContainer(content, translateDisabled = false) {
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
        .setLabel('Translate')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

export async function handlePatchNoteModalSubmit(interaction, lang) {
  const content = interaction.fields.getTextInputValue('patchnote_content_input');
  const translateDisabled = !(await isEnglishOnly(interaction.member));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const shouldPing = interaction.customId === 'patchnote_modal_ping';
  if (shouldPing) {
    await interaction.channel.send({ content: `<@&${config.notifications.patchNotes}>` }).catch(() => null);
  }

  const sentMessage = await sendV2Container(interaction.channel, buildPatchnoteContainer(content, translateDisabled));
  registerPanelRefresh({
    key: `patchnote:${sentMessage?.id || interaction.channelId}:${interaction.user.id}`,
    guildId: interaction.guildId,
    channelId: interaction.channelId,
    messageIds: sentMessage?.id,
    memberId: interaction.user.id,
    panelType: 'patchnote',
    payload: { content },
    buildComponents: async member => [buildPatchnoteContainer(content, !(await isEnglishOnly(member)))]
  });
  await interaction.editReply({ content: t(lang, 'commands.patchnote.success') });

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
        .setDescription('Pinger le rôle de notif patch notes ?? ')
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
    const translateDisabled = !(await isEnglishOnly(message.member));

    const prefix = config.prefix;
    const commandUsed = message.content.slice(prefix.length).trim().split(/ +/)[0];
    const content = message.content.slice(prefix.length + commandUsed.length).trim();

    if (!content) {
      await message.reply({
        content: `Utilisation : \`${prefix}patchnote <contenu du patch note>\``
      }).catch(() => null);
      return;
    }

    await message.delete().catch(() => null);
    const sentMessage = await sendV2Container(message.channel, buildPatchnoteContainer(content, translateDisabled));
    registerPanelRefresh({
      key: `patchnote:${sentMessage?.id || message.channelId}:${message.author.id}`,
      guildId: message.guildId,
      channelId: message.channelId,
      messageIds: sentMessage?.id,
      memberId: message.author.id,
      panelType: 'patchnote',
      payload: { content },
      buildComponents: async member => [buildPatchnoteContainer(content, !(await isEnglishOnly(member)))]
    });

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

