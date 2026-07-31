import { logVoice } from '../../services/logService.js';
import { handleJoinGenerator, handleLeaveDynamic } from '../../services/voiceService.js';
import { handleXpVoiceState } from '../../services/xpService.js';

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    // Utilise toujours le client depuis le membre (plus fiable)
    const client = member.client;

    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    // Gestion des vocaux dynamiques
    if (newChannel && (!oldChannel || oldChannel.id !== newChannel.id)) {
      await handleJoinGenerator(newState);
    }
    if (oldChannel && (!newChannel || oldChannel.id !== newChannel.id)) {
      await handleLeaveDynamic(oldState);
    }

    await handleXpVoiceState(oldState, newState).catch(() => null);

    // Rejoindre un salon vocal
    if (!oldChannel && newChannel) {
      return logVoice(client, {
        title: '🔊 Rejoint un vocal',
        color: 0x57F287,
        fields: [
          { name: 'Membre', value: `<@${member.id}> (\`${member.user.username}\`)`, inline: true },
          { name: 'Salon',  value: `\`${newChannel.name}\``, inline: true }
        ]
      });
    }

    // Quitter un salon vocal
    if (oldChannel && !newChannel) {
      return logVoice(client, {
        title: '🔇 Quitté un vocal',
        color: 0xED4245,
        fields: [
          { name: 'Membre',       value: `<@${member.id}> (\`${member.user.username}\`)`, inline: true },
          { name: 'Salon quitté', value: `\`${oldChannel.name}\``, inline: true }
        ]
      });
    }

    // Déplacé d'un salon vocal à un autre
    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      return logVoice(client, {
        title: '🔀 Déplacé en vocal',
        color: 0xF0A500,
        fields: [
          { name: 'Membre', value: `<@${member.id}> (\`${member.user.username}\`)`, inline: true },
          { name: 'Avant',  value: `\`${oldChannel.name}\``, inline: true },
          { name: 'Après',  value: `\`${newChannel.name}\``, inline: true }
        ]
      });
    }
  }
};
