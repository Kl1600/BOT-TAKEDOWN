import { AuditLogEvent } from 'discord.js';
import { logVoice } from '../../services/logService.js';
import { handleJoinGenerator, handleLeaveDynamic, handleStaffWaitVoiceState } from '../../services/voiceService.js';
import { handleXpVoiceState } from '../../services/xpService.js';

async function getRecentVoiceAction(guild, actionType, targetId) {
  const auditLogs = await guild.fetchAuditLogs({ type: actionType, limit: 5 }).catch(() => null);
  if (!auditLogs) return null;

  const entry = [...auditLogs.entries.values()].find(candidate => {
    if (candidate.target?.id !== targetId) return false;
    return Date.now() - candidate.createdTimestamp < 8000;
  });

  if (!entry) return null;

  return {
    executor: entry.executor,
    extra: entry.extra
  };
}

function formatUser(member) {
  return `<@${member.id}> (\`${member.user.username}\`)`;
}

function formatChannel(channel) {
  return `\`${channel?.name || 'Salon inconnu'}\``;
}

export default {
  name: 'voiceStateUpdate',
  once: false,
  async execute(oldState, newState) {
    const member = newState.member ?? oldState.member;
    if (!member || member.user.bot) return;

    const client = member.client;
    const guild = member.guild;
    const oldChannel = oldState.channel;
    const newChannel = newState.channel;

    if (newChannel && (!oldChannel || oldChannel.id !== newChannel.id)) {
      await handleJoinGenerator(newState);
    }
    if (oldChannel && (!newChannel || oldChannel.id !== newChannel.id)) {
      await handleLeaveDynamic(oldState);
    }

    handleStaffWaitVoiceState(oldState, newState);

    await handleXpVoiceState(oldState, newState).catch(() => null);

    if (!oldChannel && newChannel) {
      return logVoice(client, {
        title: 'Rejoint un vocal',
        color: 0x57F287,
        fields: [
          { name: 'Membre', value: formatUser(member), inline: true },
          { name: 'Salon', value: formatChannel(newChannel), inline: true }
        ]
      });
    }

    if (oldChannel && !newChannel) {
      const disconnectAction = await getRecentVoiceAction(guild, AuditLogEvent.MemberDisconnect, member.id);
      const disconnectedBy = disconnectAction?.executor
        ? `<@${disconnectAction.executor.id}> (\`${disconnectAction.executor.username}\`)`
        : null;

      return logVoice(client, {
        title: disconnectedBy ? 'Déconnecté d’un vocal' : 'Quitté un vocal',
        color: 0xED4245,
        fields: [
          { name: 'Membre', value: formatUser(member), inline: true },
          { name: 'Salon quitté', value: formatChannel(oldChannel), inline: true },
          ...(disconnectedBy ? [{ name: 'Par', value: disconnectedBy, inline: true }] : [])
        ]
      });
    }

    if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
      const moveAction = await getRecentVoiceAction(guild, AuditLogEvent.MemberMove, member.id);
      const movedBy = moveAction?.executor
        ? `<@${moveAction.executor.id}> (\`${moveAction.executor.username}\`)`
        : null;

      return logVoice(client, {
        title: movedBy ? 'Déplacé en vocal' : 'Changement de vocal',
        color: 0xF0A500,
        fields: [
          { name: 'Membre', value: formatUser(member), inline: true },
          { name: 'Avant', value: formatChannel(oldChannel), inline: true },
          { name: 'Après', value: formatChannel(newChannel), inline: true },
          ...(movedBy ? [{ name: 'Par', value: movedBy, inline: true }] : [])
        ]
      });
    }
  }
};
