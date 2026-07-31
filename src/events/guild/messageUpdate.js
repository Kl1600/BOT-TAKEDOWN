import { logMessage } from '../../services/logService.js';

const trim = (s) => s.length > 1024 ? s.slice(0, 1021) + '…' : s;

export default {
  name: 'messageUpdate',
  once: false,
  async execute(oldMessage, newMessage) {
    // Ignore DMs, bots, webhooks, et les embeds auto-ajoutés (contenu identique)
    if (!newMessage.guild) return;
    if (newMessage.author?.bot) return;
    if (newMessage.webhookId) return;
    if (oldMessage.content === newMessage.content) return;

    const oldContent = oldMessage.content
      ? trim(oldMessage.content)
      : '*Contenu indisponible (hors cache)*';
    const newContent = newMessage.content
      ? trim(newMessage.content)
      : '*Contenu indisponible*';

    await logMessage(newMessage.client, {
      title: '✏️ Message modifié',
      color: 0xF0A500,
      fields: [
        {
          name: 'Auteur',
          value: `<@${newMessage.author.id}> (\`${newMessage.author.username}\`)`,
          inline: true
        },
        { name: 'Salon', value: `<#${newMessage.channel.id}>`, inline: true },
        { name: 'Lien',  value: `[Voir le message](${newMessage.url})`, inline: true },
        { name: 'Avant', value: oldContent, inline: false },
        { name: 'Après', value: newContent, inline: false }
      ]
    });
  }
};
