import { MessageFlags } from 'discord.js';
import config from '../config/config.js';
import { getLanguage, t } from '../utils/language.js';
import { createErrorContainer } from '../utils/v2Helper.js';
import { replyPermissionDenied } from '../services/moderationService.js';

/**
 * Check if the member has the required permission role to execute commands.
 * If permission is denied, sends a localized response.
 * 
 * @param {any} context Discord interaction or message
 * @param {any} member The guild member executing the command
 * @returns {Promise<boolean>} Resolves to true if allowed, false otherwise
 */
export async function checkPermissions(context, member) {
  if (!context.guild || !member) {
    const lang = await getLanguage(member);
    const msg = t(lang, 'errors.only_guild');
    if (typeof context.reply === 'function') {
      const container = createErrorContainer(msg);
      await context.reply({ components: [container], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }).catch(() => null);
    }
    return false;
  }

  // Accepte uniquement le rôle admin
  const hasRole = member.roles.cache.has(config.roles.admin);
  if (!hasRole) {
    await replyPermissionDenied(context);
    return false;
  }

  return true;
}

export default {
  checkPermissions
};
