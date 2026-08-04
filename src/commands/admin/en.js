import { ActionRowBuilder, MessageFlags, ModalBuilder, SlashCommandBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { getLanguage, translateText } from '../../utils/language.js';
import { replyErr } from '../../services/moderationService.js';

const TRANSLATION_ROLE_ID = '1509613216463065243';
const pendingTranslationTargets = new Map();
const pendingTranslationTimers = new Map();

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

function extractDiscordId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

function parseMessageLink(input) {
  if (!input) return null;
  const match = String(input).match(/(?:ptb\.|canary\.)?discord\.com\/channels\/(\d+)\/(\d+)\/(\d+)(?:\?.*)?/i);
  if (!match) return null;
  return {
    guildId: match[1],
    channelId: match[2],
    messageId: match[3]
  };
}

function storePendingTranslationTarget(interactionId, target) {
  pendingTranslationTargets.set(interactionId, target);

  const timer = pendingTranslationTimers.get(interactionId);
  if (timer) clearTimeout(timer);

  pendingTranslationTimers.set(interactionId, setTimeout(() => {
    pendingTranslationTargets.delete(interactionId);
    pendingTranslationTimers.delete(interactionId);
  }, 15 * 60 * 1000));
}

async function resolveTranslationTarget(interaction, rawValue) {
  const value = String(rawValue ?? '').trim();
  if (!value) return null;

  const messageLink = parseMessageLink(value);
  if (messageLink) {
    const channel = await interaction.guild.channels.fetch(messageLink.channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      return null;
    }

    const message = await channel.messages.fetch(messageLink.messageId).catch(() => null);
    if (!message) return null;

    return {
      type: 'message',
      message,
      guildId: messageLink.guildId,
      channelId: messageLink.channelId,
      messageId: messageLink.messageId,
      userId: message.author?.id || null,
      username: message.author?.username || null
    };
  }

  const userId = extractDiscordId(value);
  if (!userId) return null;

  const user = await interaction.client.users.fetch(userId).catch(() => null);
  if (!user) return null;

  return {
    type: 'user',
    userId: user.id,
    username: user.username
  };
}

export const data = new SlashCommandBuilder()
  .setName('en')
  .setDescription('Traduire un texte français en anglais, avec une cible optionnelle')
  .setDefaultMemberPermissions(null)
  .setDMPermission(false)
  .addStringOption(option =>
    option
      .setName('cible')
      .setDescription('Mentionne un membre ou colle le lien du message auquel répondre')
      .setRequired(false)
      .setMaxLength(200)
  );

export async function executeSlash(interaction) {
  if (!hasTranslationAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const rawTarget = interaction.options.getString('cible')?.trim();
  const target = await resolveTranslationTarget(interaction, rawTarget);

  if (rawTarget && !target) {
    return replyErr(interaction, 'Cible invalide. Utilisez une mention, un ID ou un lien de message Discord.');
  }

  storePendingTranslationTarget(interaction.id, target);

  const modal = new ModalBuilder()
    .setCustomId(`translate_en_modal:${interaction.id}`)
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
  const [, parentInteractionId] = String(interaction.customId || '').split(':');
  const target = pendingTranslationTargets.get(parentInteractionId) || null;
  pendingTranslationTargets.delete(parentInteractionId);
  const pendingTimer = pendingTranslationTimers.get(parentInteractionId);
  if (pendingTimer) {
    clearTimeout(pendingTimer);
    pendingTranslationTimers.delete(parentInteractionId);
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const translatedText = await translateText(sourceText, 'fr', 'en');
    const contentLines = [
      '**A文 Translation**',
      `Sent by <@${interaction.user.id}>`
    ];

    const payload = {
      content: contentLines.join('\n')
    };

    if (target?.type === 'user' && target.userId) {
      payload.content += `\n-# **Recipient : <@${target.userId}>**`;
      payload.allowedMentions = { parse: [], users: [target.userId, interaction.user.id] };
    } else {
      payload.allowedMentions = { parse: [], users: [interaction.user.id] };
    }

    payload.content += `\n${formatQuoteBlock(trimText(translatedText, 1800))}`;

    if (target?.type === 'message' && target.message) {
      const replyPayload = {
        content: payload.content,
        allowedMentions: {
          ...(payload.allowedMentions || {}),
          repliedUser: false
        },
        reply: {
          messageReference: target.message.id,
          failIfNotExists: false
        }
      };

      await target.message.channel.send(replyPayload).catch(async () => {
        await target.message.reply({
          content: payload.content,
          allowedMentions: {
            ...(payload.allowedMentions || {}),
            repliedUser: false
          }
        });
      });
    } else {
      await interaction.channel.send(payload);
    }

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
