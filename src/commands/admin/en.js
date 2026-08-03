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
  return `${value.slice(0, maxLength - 1)}â€¦`;
}

function formatQuoteBlock(text) {
  return String(text ?? '')
    .split(/\r?\n/)
    .map(line => (line.trim() ? `> ${line}` : ''))
    .join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('en')
  .setDescription('Traduire un texte franÃ§ais en anglais')
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeSlash(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const modal = new ModalBuilder()
    .setCustomId('translate_en_modal')
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

export async function handleEnModalSubmit(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const lang = await getLanguage(interaction.member);
  const sourceText = interaction.fields.getTextInputValue('texte')?.trim();

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const translatedText = await translateText(sourceText, 'fr', 'en');

    await interaction.channel.send({
      content: `**A文 Translation**\nSent by <@${interaction.user.id}>\n${formatQuoteBlock(trimText(translatedText, 1800))}`,
      allowedMentions: { parse: [] }
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
