import { ContainerBuilder, TextDisplayBuilder, MessageFlags, Routes } from 'discord.js';
import { getLanguage, t, translateText } from '../utils/language.js';
import { editV2InteractionReply } from '../utils/v2Helper.js';
import { resolveModesTranslationGroup } from './modesService.js';
import dbService from '../database/dbProxy.js';
import config from '../config/config.js';
import { REGLEMENT_CP_ENGLISH_SECTIONS } from '../commands/admin/reglementcp.js';

const storedPanelTranslations = new Map();

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

function stripReglementTranslateHint(text) {
  return String(text ?? '')
    .replace(/^\s*-\#\s*🇬🇧\s*Click below to translate to English\.\s*$/gmi, '')
    .replace(/^\s*-\#\s*Click below to translate to English\.\s*$/gmi, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeComponentData(component) {
  const data = typeof component?.toJSON === 'function' ? component.toJSON() : component;
  return JSON.parse(JSON.stringify(data));
}

function isFooterText(text) {
  return /^\s*-#\s*©\s*Takedown\s*-\s*Fivem\s*•/i.test(String(text ?? ''));
}

function hasTranslateHint(text) {
  return /Click below to translate to English\./i.test(String(text ?? ''));
}

async function translateTextDisplayContent(content) {
  if (isFooterText(content)) return content;

  const sourceText = stripReglementTranslateHint(content);
  if (!sourceText) return '';

  return translateText(sourceText, 'fr', 'en');
}

function isTranslateButton(component) {
  const customId = component?.custom_id ?? component?.customId;
  return typeof customId === 'string' && customId.startsWith('msg_translate');
}

function isEmptyTextComponent(component) {
  return typeof component?.content === 'string'
    && component.content.trim().length === 0
    && !Array.isArray(component.components)
    && !component.accessory;
}

async function translateComponentTree(component, translateContent = translateTextDisplayContent) {
  const translated = normalizeComponentData(component);

  async function visit(node) {
    if (!node || typeof node !== 'object') return;

    if (typeof node.content === 'string') {
      node.content = await translateContent(node.content);
    }

    for (const property of ['label', 'placeholder', 'description']) {
      if (typeof node[property] === 'string') {
        node[property] = await translateTextDisplayContent(node[property]);
      }
    }

    if (node.emoji == null) {
      delete node.emoji;
    }

    if (Array.isArray(node.components)) {
      node.components = node.components.filter(child => !isTranslateButton(child));
      for (const child of node.components) {
        await visit(child);
      }
      node.components = node.components.filter(child => {
        if (isEmptyTextComponent(child)) return false;
        if (Array.isArray(child?.components) && child.components.length === 0) return false;
        return true;
      });
    }

    if (Array.isArray(node.options)) {
      for (const option of node.options) {
        await visit(option);
      }
    }

    if (node.accessory) {
      await visit(node.accessory);
    }
  }

  await visit(translated);
  return translated;
}

export async function preparePanelTranslation(components) {
  const translatedComponents = [];
  for (const component of Array.isArray(components) ? components : []) {
    translatedComponents.push(await translateComponentTree(component));
  }
  return translatedComponents;
}

export async function storePanelTranslation(messageId, panelType, components) {
  if (!messageId || !['annonce', 'patchnote'].includes(panelType) || !Array.isArray(components)) return;

  const normalizedComponents = normalizeComponentData(components);
  storedPanelTranslations.set(messageId, {
    panelType,
    components: normalizedComponents
  });

  await dbService.savePanelTranslation(
    messageId,
    panelType,
    JSON.stringify(normalizedComponents)
  );
}

async function getStoredPanelTranslation(messageId, panelType) {
  if (!messageId) return null;

  const cached = storedPanelTranslations.get(messageId);
  if (cached?.panelType === panelType) {
    return normalizeComponentData(cached.components);
  }

  const record = await dbService.getPanelTranslation(messageId);
  if (!record || record.panel_type !== panelType) return null;

  try {
    const components = JSON.parse(record.components_json);
    if (!Array.isArray(components) || components.length === 0) return null;

    storedPanelTranslations.set(messageId, { panelType, components });
    return normalizeComponentData(components);
  } catch {
    return null;
  }
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

async function translateStructuredStack(interaction, translateContent = translateTextDisplayContent) {
  const originalComponents = Array.isArray(interaction.message?.components)
    ? interaction.message.components
    : [];
  const translatedComponents = [];
  for (const component of originalComponents) {
    translatedComponents.push(await translateComponentTree(component, translateContent));
  }
  return translatedComponents;
}

async function replyWithTranslatedComponents(interaction, translatedComponents) {
  return interaction.client.rest.patch(
    Routes.webhookMessage(interaction.applicationId, interaction.token, '@original'),
    {
      body: {
        components: translatedComponents,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      }
    }
  );
}

function getGuideEnglishSections() {
  const content = t('en', 'commands.guide.content', {
    presentation: config.guide.channels.presentation,
    announcements: config.guide.channels.announcements,
    rules: config.guide.channels.rules,
    support: config.guide.channels.support,
    status: config.guide.channels.status,
    patchnotes: config.guide.channels.patchnotes
  });

  return String(content)
    .split(/^\s*separator\s*$/gmi)
    .map(section => section.trim())
    .filter(Boolean);
}

async function translateGuideStack(interaction) {
  const englishSections = getGuideEnglishSections();
  let sectionIndex = 0;

  return translateStructuredStack(interaction, async content => {
    if (isFooterText(content)) return content;
    if (hasTranslateHint(content)) return '';
    const translatedSection = englishSections[sectionIndex];
    sectionIndex += 1;
    return translatedSection ?? await translateTextDisplayContent(content);
  });
}

function getCrewEnglishSections() {
  return String(t('en', 'commands.crew.content'))
    .split(/^\s*separator\s*$/gmi)
    .map(section => section.trim())
    .filter(Boolean);
}

async function translateCrewStack(interaction) {
  const englishSections = getCrewEnglishSections();
  let sectionIndex = 0;

  return translateStructuredStack(interaction, async content => {
    if (isFooterText(content)) return content;
    if (hasTranslateHint(content)) return '';
    const translatedSection = englishSections[sectionIndex];
    sectionIndex += 1;
    return translatedSection ?? await translateTextDisplayContent(content);
  });
}

async function translateReglementCpStack(interaction) {
  let sectionIndex = 0;

  return translateStructuredStack(interaction, async content => {
    if (isFooterText(content)) return content;
    const translatedSection = REGLEMENT_CP_ENGLISH_SECTIONS[sectionIndex];
    sectionIndex += 1;
    return translatedSection ?? await translateTextDisplayContent(content);
  });
}

async function translateModesStack(interaction) {
  const messageIds = await resolveModesTranslationGroup(interaction.message);
  const translatedContainersByMessage = [];

  for (const messageId of messageIds) {
    const message = messageId === interaction.message?.id
      ? interaction.message
      : await interaction.channel.messages.fetch(messageId).catch(() => null);

    if (!message) continue;

    const originalComponents = Array.isArray(message.components) ? message.components : [];
    const translatedComponents = [];

    for (const component of originalComponents) {
      translatedComponents.push(await translateComponentTree(component));
    }

    translatedContainersByMessage.push({ messageId, translatedComponents });
  }

  return translatedContainersByMessage;
}

export async function handleMessageTranslate(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const member = interaction.member;
  const lang = await getLanguage(member);
  const allowedPanelTypes = new Set(['annonce', 'patchnote', 'ticket', 'reglement', 'reglementcp', 'guide', 'crew', 'staffapply', 'beta', 'modes', 'connect']);
  const hasEnglishRole = Boolean(member?.roles?.cache?.has(config.roles.en));
  const hasFrenchRole = Boolean(member?.roles?.cache?.has(config.roles.fr));
  const canTranslateToEnglish = hasEnglishRole && !hasFrenchRole;

  if (!canTranslateToEnglish) {
    const errorMsg = t(lang, 'errors.translation_not_allowed');
    return interaction.editReply({ content: errorMsg });
  }

  const sourceTranslateId = interaction.customId || '';
  const explicitType = sourceTranslateId.startsWith('msg_translate_') ? sourceTranslateId.slice('msg_translate_'.length) : null;

  if (!allowedPanelTypes.has(explicitType)) {
    const errorMsg = t(lang, 'errors.translation_not_allowed');
    return interaction.editReply({ content: errorMsg });
  }

  const hasEmbeds = Array.isArray(interaction.message?.embeds) && interaction.message.embeds.length > 0;

  if (explicitType === 'annonce' || explicitType === 'patchnote') {
    let translatedComponents = await getStoredPanelTranslation(interaction.message?.id, explicitType);
    if (!translatedComponents) {
      translatedComponents = await translateStructuredStack(interaction);
      await storePanelTranslation(interaction.message?.id, explicitType, translatedComponents);
    }

    return replyWithTranslatedComponents(interaction, translatedComponents);
  }

  if (explicitType === 'reglement' || explicitType === 'reglementcp' || explicitType === 'guide' || explicitType === 'crew') {
    const translatedComponents = explicitType === 'guide'
      ? await translateGuideStack(interaction)
      : explicitType === 'crew'
        ? await translateCrewStack(interaction)
        : explicitType === 'reglementcp'
          ? await translateReglementCpStack(interaction)
        : await translateStructuredStack(interaction);
    return replyWithTranslatedComponents(interaction, translatedComponents);
  }

  if (explicitType === 'modes') {
    const translatedMessages = await translateModesStack(interaction);

    if (translatedMessages.length === 0) {
      return interaction.editReply({
        content: t(lang, 'errors.translation_not_allowed')
      });
    }

    const [firstEntry, ...remainingEntries] = translatedMessages;
    await interaction.editReply({
      components: firstEntry.translatedComponents,
      flags: MessageFlags.IsComponentsV2
    });

    for (const entry of remainingEntries) {
      await interaction.followUp({
        components: entry.translatedComponents,
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
      });
    }

    return;
  }

  if (hasEmbeds) {
    const translatedEmbeds = [];
    for (const embed of interaction.message.embeds) {
      translatedEmbeds.push(await translateEmbedData(embed, 'fr', 'en'));
    }
    return await interaction.editReply({
      embeds: translatedEmbeds
    });
  }

  const originalComponents = Array.isArray(interaction.message?.components) ? interaction.message.components : [];
  if (originalComponents.length > 0) {
    const translatedComponents = await translateStructuredStack(interaction);
    return replyWithTranslatedComponents(interaction, translatedComponents);
  }

  const rawText = extractRenderableText(interaction.message);
  const translatedText = await translateText(rawText.trim(), 'fr', 'en');
  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(translatedText));
  return editV2InteractionReply(interaction, container);
}

export default {
  handleMessageTranslate
};
