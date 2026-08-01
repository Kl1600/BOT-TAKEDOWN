import config from '../../config/config.js';
import { getLanguage, t } from '../../utils/language.js';
import * as logger from '../../utils/logger.js';
import { handleStaffApplyChatMessage } from '../../services/recruitmentService.js';
import { handleAntiLinkMessage } from '../../services/antiLinkService.js';
import { handleAntiImageMessage } from '../../services/antiImageService.js';
import { logCommand } from '../../services/logService.js';
import { handleXpMessage } from '../../services/xpService.js';

export default {
  name: 'messageCreate',
  once: false,
  async execute(message, client) {
    if (await handleStaffApplyChatMessage(message)) {
      return;
    }

    if (await handleAntiLinkMessage(message)) {
      return;
    }

    if (await handleAntiImageMessage(message)) {
      return;
    }

    // Ignore bots and direct messages for normal commands
    if (message.author.bot || !message.guild) return;

    await handleXpMessage(message).catch(() => null);

    // Check if the message starts with the configured prefix
    const prefix = config.prefix;
    if (!message.content.startsWith(prefix)) return;

    // Parse commands and arguments
    const args = message.content.slice(prefix.length).trim().split(/ +/);
    const commandName = args.shift().toLowerCase();

    const command = client.commands.get(commandName);
    if (!command) return;

    const lang = 'fr'; // Force le français par défaut pour les commandes préfixées

    await message.delete().catch(() => null);

    logger.debug(`Prefix Command: ${prefix}${commandName} par ${message.author.tag} (${message.author.id})`);
    const argsText = args.join(' ').trim() || 'aucune option';

    try {
      if (typeof command.executePrefix === 'function') {
        await command.executePrefix(message, args, lang);
      }
    } catch (err) {
      logger.error(`Erreur commande préfixée "${commandName}":`, err);
      const errMsg = t(lang, 'errors.command_error');
      await message.reply({ content: errMsg }).catch(() => null);
    } finally {
      await logCommand(client, {
        title: 'Commande préfixe',
        description: `\`${prefix}${commandName}\` utilisée dans <#${message.channelId}>`,
        fields: [
          { name: 'Utilisateur', value: `<@${message.author.id}> (\`${message.author.tag}\`)`, inline: true },
          { name: 'Salon', value: `<#${message.channelId}>`, inline: true },
          { name: 'Arguments', value: argsText.slice(0, 1024), inline: false }
        ]
      }).catch(() => null);
    }
  }
};
