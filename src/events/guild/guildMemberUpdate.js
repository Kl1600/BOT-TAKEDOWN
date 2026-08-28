import { syncGuildTagMember } from '../../services/guildTagService.js';

export default {
  name: 'guildMemberUpdate',
  once: false,
  async execute(_oldMember, newMember) {
    await syncGuildTagMember(newMember, newMember.user);
  }
};
