import { syncGuildTagMember } from '../../services/guildTagService.js';

export default {
  name: 'presenceUpdate',
  once: false,
  async execute(oldPresence, newPresence) {
    const member = newPresence?.member || oldPresence?.member;
    const user = newPresence?.user || oldPresence?.user || member?.user;
    if (!member || !user) return;

    await syncGuildTagMember(member, user);
  }
};
