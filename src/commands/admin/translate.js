import { EmbedBuilder, MessageContextMenuCommandBuilder } from 'discord.js';
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

async function replyPlainError(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content }).catch(() => null);
  }

  return interaction.reply({
    content,
    ephemeral: true
  }).catch(() => null);
}

export const data = new MessageContextMenuCommandBuilder()
  .setName('Traduire')
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
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(trimText(translatedText))
      .setAuthor({
        name: `Traduction de ${sourceMessage.author.username}`,
        iconURL: sourceMessage.author.displayAvatarURL()
      })
      .setFooter({
        text: `Demandé par ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      });

    await interaction.editReply({
      embeds: [embed]
    }).catch(() => null);
  } catch (error) {
    await replyPlainError(interaction, error?.message || t(lang, 'errors.command_error'));
  }
}

export default {
  data,
  executeContextMenu
};
