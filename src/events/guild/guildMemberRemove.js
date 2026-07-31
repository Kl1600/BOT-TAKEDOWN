import { handleGuildMemberInviteLeave } from '../../services/inviteService.js';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    await handleGuildMemberInviteLeave(member).catch(() => null);
  }
};
