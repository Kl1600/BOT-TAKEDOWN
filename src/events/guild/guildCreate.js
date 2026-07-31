import { initializeInviteTracking } from '../../services/inviteService.js';

export default {
  name: 'guildCreate',
  once: false,
  async execute(guild, client) {
    await initializeInviteTracking(client).catch(() => null);
  }
};
