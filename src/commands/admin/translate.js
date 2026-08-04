import { ApplicationCommandType, ContextMenuCommandBuilder } from 'discord.js';
import { detectTextLanguage, getLanguage, translateText, t } from '../../utils/language.js';

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
  .setName('Translate')
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeContextMenu(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyPlainError(interaction, 'Permissions insuffisantes.');
  }

  const lang = await getLanguage(interaction.member);
  const sourceMessage = interaction.targetMessage || null;

  if (!sourceMessage) {
    return replyPlainError(interaction, t(lang, 'errors.translate_reply_only'));
  }

  const sourceText = sourceMessage.content?.trim();
  if (!sourceText) {
    return replyPlainError(interaction, t(lang, 'errors.translate_reply_only'));
  }

  await interaction.deferReply({ ephemeral: true }).catch(() => null);

  try {
    const detectedLang = await detectTextLanguage(sourceText);
    if (!detectedLang || !detectedLang.startsWith('en')) {
      await replyPlainError(interaction, t(lang, 'errors.translate_not_english'));
      return;
    }

    const translatedText = await translateText(sourceText, 'en', 'fr');

    await interaction.editReply({
      content: `**A文 Translation**\n${formatQuoteBlock(trimText(translatedText, 1800))}`
    }).catch(() => null);
  } catch (error) {
    await replyPlainError(interaction, error?.message || t(lang, 'errors.command_error'));
  }
}

export default {
  data,
  executeContextMenu
};
