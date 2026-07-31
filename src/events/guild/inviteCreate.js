import { handleInviteCreate } from '../../services/inviteService.js';

export default {
  name: 'inviteCreate',
  once: false,
  async execute(invite) {
    await handleInviteCreate(invite).catch(() => null);
  }
};
