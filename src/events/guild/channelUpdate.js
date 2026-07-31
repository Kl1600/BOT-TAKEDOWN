import { logGeneral } from '../../services/logService.js';

export default {
  name: 'channelUpdate',
  once: false,
  async execute(oldChannel, newChannel) {
    if (!newChannel.guild) return;

    const changes = [];

    if (oldChannel.name !== newChannel.name) {
      changes.push({
        name: 'Renommé',
        value: `\`${oldChannel.name}\` → \`${newChannel.name}\``,
        inline: false
      });
    }

    if (oldChannel.parentId !== newChannel.parentId) {
      const oldCat = oldChannel.parent?.name ?? 'Aucune';
      const newCat = newChannel.parent?.name ?? 'Aucune';
      changes.push({
        name: 'Catégorie déplacée',
        value: `\`${oldCat}\` → \`${newCat}\``,
        inline: false
      });
    }

    if (oldChannel.topic !== newChannel.topic) {
      changes.push({
        name: 'Sujet modifié',
        value: `\`${oldChannel.topic ?? 'Aucun'}\` → \`${newChannel.topic ?? 'Aucun'}\``,
        inline: false
      });
    }

    // Rien d'intéressant à logguer
    if (changes.length === 0) return;

    await logGeneral(newChannel.client, {
      title: '✏️ Salon modifié',
      color: 0xF0A500,
      fields: [
        { name: 'Salon', value: `<#${newChannel.id}> (\`${newChannel.name}\`)`, inline: true },
        ...changes
      ]
    });
  }
};
