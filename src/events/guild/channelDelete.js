import { logGeneral, readableChannelType } from '../../services/logService.js';

export default {
  name: 'channelDelete',
  once: false,
  async execute(channel) {
    if (!channel.guild) return;
    await logGeneral(channel.client, {
      title: '🗑️ Salon supprimé',
      color: 0xED4245,
      fields: [
        { name: 'Nom',  value: `\`${channel.name}\``, inline: true },
        { name: 'Type', value: readableChannelType(channel.type), inline: true },
        { name: 'ID',   value: `\`${channel.id}\``, inline: true }
      ]
    });
  }
};
