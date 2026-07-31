const modesTranslationGroups = new Map();

export function registerModesTranslationGroup(triggerMessageId, messageIds) {
  if (!triggerMessageId || !Array.isArray(messageIds) || messageIds.length === 0) {
    return;
  }

  modesTranslationGroups.set(String(triggerMessageId), messageIds.map(String));
}

export function getModesTranslationGroup(triggerMessageId) {
  if (!triggerMessageId) return null;
  return modesTranslationGroups.get(String(triggerMessageId)) || null;
}

export function clearModesTranslationGroup(triggerMessageId) {
  if (!triggerMessageId) return;
  modesTranslationGroups.delete(String(triggerMessageId));
}

export default {
  registerModesTranslationGroup,
  getModesTranslationGroup,
  clearModesTranslationGroup
};
