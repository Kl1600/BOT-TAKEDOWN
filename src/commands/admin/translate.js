import { ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags } from 'discord.js';
import { getLanguage, translateText, t } from '../../utils/language.js';

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
  .setName('en')
  .setType(ApplicationCommandType.Message)
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeContextMenu(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyPlainError(interaction, 'Permissions insuffisantes.');
  }

  const lang = await getLanguage(interaction.member);
  const sourceMessage = interaction.targetMessage || null;
  const sourceText = sourceMessage?.content?.trim();

  if (!sourceMessage || !sourceText) {
    return replyPlainError(interaction, t(lang, 'errors.translate_reply_only'));
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);

  try {
    const translatedText = await translateText(sourceText, 'fr', 'en');
    const payload = {
      content: [
        '**A文 Translation**',
        `Sent by <@${interaction.user.id}>`,
        formatQuoteBlock(trimText(translatedText, 1800))
      ].join('\n'),
      allowedMentions: {
        parse: [],
        users: [interaction.user.id]
      }
    };

    await sourceMessage.reply(payload).catch(async () => {
      await sourceMessage.channel.send({
        ...payload,
        reply: {
          messageReference: sourceMessage.id,
          failIfNotExists: false
        }
      }).catch(() => null);
    });

    await interaction.deleteReply().catch(() => null);
  } catch (error) {
    const errorMessage = error?.message || (lang === 'en'
      ? 'Unable to translate the text.'
      : 'Impossible de traduire le texte.');
    await replyPlainError(interaction, errorMessage);
  }
}

export default {
  data,
  executeContextMenu
};
