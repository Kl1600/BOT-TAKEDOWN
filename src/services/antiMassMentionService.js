import config from '../config/config.js';
import * as logger from '../utils/logger.js';

const MASS_MENTION_REGEX = /(^|[^a-z0-9_])@(everyone|here)\b/i;

export async function handleAntiMassMentionMessage(message) {
  if (!message.guild || message.author.bot) return false;

  const containsMassMention = message.mentions?.everyone
    || MASS_MENTION_REGEX.test(String(message.content || ''));
  if (!containsMassMention) return false;

  if (message.member?.roles?.cache?.has(config.roles.permBot)) {
    return false;
  }

  const deleted = await message.delete()
    .then(() => true)
    .catch(error => {
      logger.error('Impossible de supprimer un message contenant @everyone ou @here:', error);
      return false;
    });

  if (!deleted) return true;

  await message.channel.send({
    content: '-# Seul le rôle Perm Bot peut utiliser @everyone ou @here.',
    allowedMentions: { parse: [] }
  }).then(warning => {
    setTimeout(() => warning.delete().catch(() => null), 5000);
  }).catch(() => null);

  return true;
}

export default {
  handleAntiMassMentionMessage
};
