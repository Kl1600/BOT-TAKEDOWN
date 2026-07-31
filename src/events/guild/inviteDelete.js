import { handleInviteDelete } from '../../services/inviteService.js';

export default {
  name: 'inviteDelete',
  once: false,
  async execute(invite) {
    await handleInviteDelete(invite).catch(() => null);
  }
};
