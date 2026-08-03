import { EmbedBuilder, MessageFlags, SlashCommandBuilder } from 'discord.js';
import { detectTextLanguage, getLanguage, translateText, t } from '../../utils/language.js';
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

async function resolveReplyTarget(interaction) {
  const referenceMessageId =
    interaction.message?.reference?.messageId ||
    interaction.reference?.messageId ||
    interaction.targetMessage?.id ||
    null;

  if (!referenceMessageId) return null;

  return interaction.channel?.messages.fetch(referenceMessageId).catch(() => null);
}

export const data = new SlashCommandBuilder()
  .setName('translate')
  .setDescription('Traduire une réponse en anglais vers le français')
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeSlash(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const lang = await getLanguage(interaction.member);
  const repliedMessage = await resolveReplyTarget(interaction);

  if (!repliedMessage) {
    return replyErr(interaction, t(lang, 'errors.translate_reply_only'));
  }

  const sourceText = repliedMessage.content?.trim();
  if (!sourceText) {
    return replyErr(interaction, t(lang, 'errors.translate_reply_only'));
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const detectedLang = await detectTextLanguage(sourceText);
    if (detectedLang !== 'en') {
      await interaction.editReply({
        content: t(lang, 'errors.translate_not_english')
      }).catch(() => null);
      return;
    }

    const translatedText = await translateText(sourceText, 'en', 'fr');
    const embed = new EmbedBuilder()
      .setColor(0x57F287)
      .setDescription(trimText(translatedText))
      .setAuthor({
        name: `Traduction de ${repliedMessage.author.username}`,
        iconURL: repliedMessage.author.displayAvatarURL()
      })
      .setFooter({
        text: `Demandé par ${interaction.user.username}`,
        iconURL: interaction.user.displayAvatarURL()
      });

    await interaction.editReply({
      embeds: [embed]
    });
  } catch (error) {
    await interaction.editReply({
      content: error?.message || t(lang, 'errors.command_error')
    }).catch(() => null);
  }
}

export default {
  data,
  executeSlash
};
