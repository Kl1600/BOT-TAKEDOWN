import { ActionRowBuilder, ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getLanguage, translateText, t } from '../../utils/language.js';
import { replyErr } from '../../services/moderationService.js';

const TRANSLATION_ROLE_ID = '1509613216463065243';
const MODAL_PREFIX = 'translate_en_user_modal:';

function hasTranslationAccess(member) {
  return Boolean(member?.roles?.cache?.has(TRANSLATION_ROLE_ID));
}

function trimText(text, maxLength = 3900) {
  const value = String(text ?? '');
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function formatQuoteBlock(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(line => (line.trim() ? `> ${line}` : '>'))
    .join('\n');
}

async function replyPlainError(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content }).catch(() => null);
  }

  return interaction.reply({
    content,
    ephemeral: true
  }).catch(() => null);
}

export const data = new ContextMenuCommandBuilder()
  .setName('en_user')
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeUserContextMenu(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const targetUser = interaction.targetUser || null;
  if (!targetUser) {
    return replyPlainError(interaction, 'Utilisateur introuvable.');
  }

  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${targetUser.id}`)
    .setTitle('A文 Translation');

  const textInput = new TextInputBuilder()
    .setCustomId('texte')
    .setLabel('Texte français à traduire')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setPlaceholder('Colle ici ton texte avec les sauts de ligne conservés.');

  modal.addComponents(new ActionRowBuilder().addComponents(textInput));
  await interaction.showModal(modal);
}

export async function handleEnUserModalSubmit(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyPlainError(interaction, 'Permissions insuffisantes.');
  }

  const lang = await getLanguage(interaction.member);
  const match = String(interaction.customId || '').match(/^translate_en_user_modal:(\d{17,20})$/);
  const targetUserId = match?.[1] || null;
  const sourceText = interaction.fields.getTextInputValue('texte')?.trim();

  if (!targetUserId) {
    return replyPlainError(interaction, 'Utilisateur introuvable.');
  }

  if (!sourceText) {
    return replyPlainError(interaction, t(lang, 'errors.translate_reply_only'));
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const translatedText = await translateText(sourceText, 'fr', 'en');
    const payload = {
      content: [
        '**A文 Translation**',
        `Sent by <@${interaction.user.id}>`,
        `-# **Recipient : <@${targetUserId}>**`,
        formatQuoteBlock(trimText(translatedText, 1800))
      ].join('\n'),
      allowedMentions: {
        parse: [],
        users: [interaction.user.id, targetUserId]
      }
    };

    await interaction.channel.send(payload).catch(async error => {
      throw new Error(error?.message || 'Impossible d’envoyer la traduction dans ce salon.');
    });
    await interaction.deleteReply().catch(() => null);
  } catch (error) {
    const errorMessage = error?.message || (lang === 'en'
      ? 'Unable to translate the text.'
      : 'Impossible de traduire le texte.');
    await interaction.editReply({ content: errorMessage }).catch(() => null);
  }
}

export default {
  data,
  executeUserContextMenu,
  handleEnUserModalSubmit
};
