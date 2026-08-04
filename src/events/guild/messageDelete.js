import { logMessage } from '../../services/logService.js';

const trim = (s) => (s.length > 1024 ? s.slice(0, 1021) + '???' : s);

export default {
  name: 'messageDelete',
  once: false,
  async execute(message) {
    // Ignore DMs, bots, et webhooks
    if (!message.guild) return;
    if (message.author?.bot) return;
    if (message.webhookId) return;

    const content = message.content ? trim(message.content) : '*Contenu indisponible (message hors cache)*';

    await logMessage(message.client, {
      title: '🗑️ Message supprimé',
      color: 0xED4245,
      fields: [
        {
          name: 'Auteur',
          value: message.author ? `<@${message.author.id}> (\`${message.author.username}\`)` : '*Auteur inconnu*',
          inline: true
        },
        { name: 'Salon',   value: `<#${message.channel.id}>`, inline: true },
        { name: 'Contenu', value: content, inline: false }
      ]
    });
  }
};
