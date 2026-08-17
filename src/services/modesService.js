const modesTranslationGroups = new Map();

const MODE_MESSAGE_MARKERS = [
  'TAKEDOWN — Modes de jeu',
  'Course-Poursuite — Casual',
  'Course-Poursuite — Ranked',
  'Course de Rue — Casual',
  'Course de Rue — Ranked',
  'Modes d’entraînement',
  'Open World',
  'Practice',
  'Entraînement Course de Rue',
  'Partie Personnalisée'
];

function extractComponentText(component) {
  let text = typeof component?.content === 'string' ? component.content : '';
  if (Array.isArray(component?.components)) {
    for (const child of component.components) {
      text += `\n${extractComponentText(child)}`;
    }
  }
  if (component?.accessory) {
    text += `\n${extractComponentText(component.accessory)}`;
  }
  return text;
}

function isModesMessage(message) {
  if (!Array.isArray(message?.components) || message.components.length === 0) return false;
  const text = message.components.map(extractComponentText).join('\n');
  return MODE_MESSAGE_MARKERS.some(marker => text.includes(marker));
}

function isModesGroupStart(message) {
  const text = Array.isArray(message?.components)
    ? message.components.map(extractComponentText).join('\n')
    : '';
  return text.includes(MODE_MESSAGE_MARKERS[0]);
}

export function registerModesTranslationGroup(triggerMessageId, messageIds) {
  if (!triggerMessageId || !Array.isArray(messageIds) || messageIds.length === 0) {
    return;
  }

  const normalizedIds = messageIds.map(String);
  for (const messageId of normalizedIds) {
    modesTranslationGroups.set(messageId, normalizedIds);
  }
}

export function getModesTranslationGroup(triggerMessageId) {
  if (!triggerMessageId) return null;
  return modesTranslationGroups.get(String(triggerMessageId)) || null;
}

export async function resolveModesTranslationGroup(triggerMessage) {
  const triggerMessageId = triggerMessage?.id;
  if (!triggerMessageId) return [];

  const cachedGroup = getModesTranslationGroup(triggerMessageId);
  if (cachedGroup) return cachedGroup;
  if (!isModesMessage(triggerMessage)) return [String(triggerMessageId)];

  const messageManager = triggerMessage.channel?.messages;
  if (!messageManager) return [String(triggerMessageId)];

  const previousMessages = await messageManager.fetch({
    before: triggerMessageId,
    limit: 10
  }).catch(() => null);

  if (!previousMessages) return [String(triggerMessageId)];

  const groupMessages = [triggerMessage];
  const orderedPreviousMessages = [...previousMessages.values()]
    .sort((first, second) => second.createdTimestamp - first.createdTimestamp);

  for (const message of orderedPreviousMessages) {
    if (message.author?.id !== triggerMessage.author?.id || !isModesMessage(message)) {
      break;
    }

    groupMessages.push(message);
    if (isModesGroupStart(message)) break;
  }

  const messageIds = groupMessages
    .sort((first, second) => first.createdTimestamp - second.createdTimestamp)
    .map(message => String(message.id));

  registerModesTranslationGroup(triggerMessageId, messageIds);
  return messageIds;
}

export function clearModesTranslationGroup(triggerMessageId) {
  if (!triggerMessageId) return;
  const group = getModesTranslationGroup(triggerMessageId) || [String(triggerMessageId)];
  for (const messageId of group) {
    modesTranslationGroups.delete(String(messageId));
  }
}

export default {
  registerModesTranslationGroup,
  getModesTranslationGroup,
  resolveModesTranslationGroup,
  clearModesTranslationGroup
};
