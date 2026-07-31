import { ContainerBuilder, TextDisplayBuilder, MessageFlags, Routes } from 'discord.js';
import { getLanguage, t, translateText } from '../utils/language.js';
import { createErrorContainer, editV2InteractionReply } from '../utils/v2Helper.js';
import { getModesTranslationGroup } from './modesService.js';
import config from '../config/config.js';

function extractText(component) {
  let text = '';
  if (component.content) {
    text += component.content + ' ';
  }
  if (component.components && Array.isArray(component.components)) {
    for (const sub of component.components) {
      text += extractText(sub);
    }
  }
  if (component.accessory) {
    text += extractText(component.accessory);
  }
  return text;
}

function extractRenderableText(message) {
  let text = '';

  if (message?.content) {
    text += `${message.content} `;
  }

  if (message?.components && Array.isArray(message.components)) {
    for (const component of message.components) {
      text += extractText(component);
    }
  }

  return text.trim();
}

function extractComponentText(component) {
  let text = '';

  if (component?.content) {
    text += `${component.content} `;
  }

  if (Array.isArray(component?.components)) {
    for (const child of component.components) {
      text += extractComponentText(child);
    }
  }

  return text.trim();
}

function normalizeEmbedData(embed) {
  if (!embed) return null;
  if (typeof embed.toJSON === 'function') {
    return embed.toJSON();
  }
  return embed;
}

async function translateEmbedData(embed, fromLang = 'fr', toLang = 'en') {
  const data = normalizeEmbedData(embed);
  if (!data) return data;

  const translated = { ...data };

  if (data.title) {
    translated.title = await translateText(data.title, fromLang, toLang);
  }

  if (data.description) {
    translated.description = await translateText(data.description, fromLang, toLang);
  }

  if (data.author?.name) {
    translated.author = {
      ...data.author,
      name: await translateText(data.author.name, fromLang, toLang)
    };
  }

  if (data.footer?.text) {
    translated.footer = {
      ...data.footer,
      text: await translateText(data.footer.text, fromLang, toLang)
    };
  }

  if (Array.isArray(data.fields)) {
    translated.fields = await Promise.all(
      data.fields.map(async field => ({
        ...field,
        name: await translateText(field.name, fromLang, toLang),
        value: await translateText(field.value, fromLang, toLang)
      }))
    );
  }

  return translated;
}

async function translateReglementStack(interaction) {
  const originalComponents = Array.isArray(interaction.message?.components)
    ? interaction.message.components
    : [];

  const translatedContainers = [];

  for (let index = 0; index < originalComponents.length; index += 1) {
    const component = originalComponents[index];
    const rawText = extractComponentText(component);
    const translatedText = await translateText(rawText, 'fr', 'en');

    const text = new TextDisplayBuilder().setContent(translatedText);
    const container = new ContainerBuilder()
      .setAccentColor(config.colors.primary)
      .addTextDisplayComponents(text);

    translatedContainers.push(container);
  }

  return translatedContainers;
}

async function translateModesStack(interaction) {
  const messageIds = getModesTranslationGroup(interaction.message?.id) || [interaction.message?.id].filter(Boolean);
  const translatedContainersByMessage = [];

  for (const messageId of messageIds) {
    const message = messageId === interaction.message?.id
      ? interaction.message
      : await interaction.channel.messages.fetch(messageId).catch(() => null);

    if (!message) continue;

    const originalComponents = Array.isArray(message.components) ? message.components : [];
    const translatedContainers = [];

    for (const component of originalComponents) {
      const rawText = extractComponentText(component);
      const translatedText = await translateText(rawText, 'fr', 'en');

      const text = new TextDisplayBuilder().setContent(translatedText);
      const container = new ContainerBuilder()
        .setAccentColor(config.colors.primary)
        .addTextDisplayComponents(text);

      translatedContainers.push(container);
    }

    translatedContainersByMessage.push({ messageId, translatedContainers });
  }

  return translatedContainersByMessage;
}

export async function handleMessageTranslate(interaction) {
  const member = interaction.member;
  const lang = await getLanguage(member);
  const allowedPanelTypes = new Set(['annonce', 'patchnote', 'ticket', 'reglement', 'guide', 'staffapply', 'beta', 'modes', 'connect']);
  const hasEnglishRole = Boolean(member?.roles?.cache?.has(config.roles.en));
  const hasFrenchRole = Boolean(member?.roles?.cache?.has(config.roles.fr));
  const canTranslateToEnglish = hasEnglishRole && !hasFrenchRole;

  if (!canTranslateToEnglish) {
    const errorMsg = t(lang, 'errors.translation_not_allowed');
    return interaction.reply({
      content: errorMsg,
      flags: MessageFlags.Ephemeral
    });
  }

  const sourceTranslateId = interaction.customId || '';
  const explicitType = sourceTranslateId.startsWith('msg_translate_')
    ? sourceTranslateId.slice('msg_translate_'.length)
    : null;

  if (!allowedPanelTypes.has(explicitType)) {
    const errorMsg = t(lang, 'errors.translation_not_allowed');
    return interaction.reply({
      content: errorMsg,
      flags: MessageFlags.Ephemeral
    });
  }

  const hasEmbeds = Array.isArray(interaction.message?.embeds) && interaction.message.embeds.length > 0;

  if (explicitType === 'reglement') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const translatedContainers = await translateReglementStack(interaction);
    return await interaction.client.rest.patch(
      Routes.webhookMessage(interaction.applicationId, interaction.token, '@original'),
      {
        body: {
          components: translatedContainers.map(container => container.toJSON()),
          flags: MessageFlags.IsComponentsV2
        }
      }
    );
  }

  if (explicitType === 'modes') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const translatedMessages = await translateModesStack(interaction);

    if (translatedMessages.length === 0) {
      return interaction.editReply({
        content: t(lang, 'errors.translation_not_allowed')
      });
    }

    const [firstEntry, ...remainingEntries] = translatedMessages;
    await interaction.editReply({
      components: firstEntry.translatedContainers,
      flags: MessageFlags.IsComponentsV2
    });

    for (const entry of remainingEntries) {
      await interaction.followUp({
        components: entry.translatedContainers,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    return;
  }

  if (hasEmbeds) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const translatedEmbeds = [];
    for (const embed of interaction.message.embeds) {
      translatedEmbeds.push(await translateEmbedData(embed, 'fr', 'en'));
    }
    return await interaction.editReply({
      embeds: translatedEmbeds
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2 });
  const rawText = extractRenderableText(interaction.message);
  const translatedText = await translateText(rawText.trim(), 'fr', 'en');

  const text = new TextDisplayBuilder().setContent(translatedText);
  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text);

  return await editV2InteractionReply(interaction, container);
}

export default {
  handleMessageTranslate
};
