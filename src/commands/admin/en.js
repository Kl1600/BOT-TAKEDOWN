import { ActionRowBuilder, MessageFlags, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getLanguage, translateText } from '../../utils/language.js';
import { replyErr } from '../../services/moderationService.js';

const TRANSLATION_ROLE_ID = '1509613216463065243';

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
    .map(line => (line.trim() ? `> ${line}` : ''))
    .join('\n');
}

function extractUserId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

async function resolveMentionTarget(interaction, rawValue) {
  const userId = extractUserId(rawValue);
  if (!userId) return null;
  return interaction.client.users.fetch(userId).catch(() => null);
}

export const data = new SlashCommandBuilder()
  .setName('en')
  .setDescription('Traduire un texte français en anglais')
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeSlash(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const modal = new ModalBuilder()
    .setCustomId('translate_en_modal')
    .setTitle('A文 Translation');

  const targetInput = new TextInputBuilder()
    .setCustomId('destinataire')
    .setLabel('Membre destinataire (optionnel)')
    .setStyle(TextInputStyle.Short)
    .setRequired(false)
    .setMaxLength(100)
    .setPlaceholder('@membre ou ID Discord');

  const textInput = new TextInputBuilder()
    .setCustomId('texte')
    .setLabel('Texte français à traduire')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(4000)
    .setPlaceholder('Colle ici ton texte avec les sauts de ligne conservés.');

  modal.addComponents(
    new ActionRowBuilder().addComponents(targetInput),
    new ActionRowBuilder().addComponents(textInput)
  );
  await interaction.showModal(modal);
}

export async function handleEnModalSubmit(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const lang = await getLanguage(interaction.member);
  const rawTarget = interaction.fields.getTextInputValue('destinataire')?.trim();
  const sourceText = interaction.fields.getTextInputValue('texte')?.trim();
  const targetUser = await resolveMentionTarget(interaction, rawTarget);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const translatedText = await translateText(sourceText, 'fr', 'en');
    const mentionLine = targetUser ? `To <@${targetUser.id}>\n` : '';
    const allowedMentions = targetUser
      ? { parse: [], users: [targetUser.id] }
      : { parse: [] };

    await interaction.channel.send({
      content: `**A文 Translation**\nSent by <@${interaction.user.id}>\n${mentionLine}${formatQuoteBlock(trimText(translatedText, 1800))}`,
      allowedMentions
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
  executeSlash,
  handleEnModalSubmit
};
