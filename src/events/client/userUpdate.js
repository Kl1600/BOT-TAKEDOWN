import { syncGuildTagUser } from '../../services/guildTagService.js';

export default {
  name: 'userUpdate',
  once: false,
  async execute(_oldUser, newUser, client) {
    await syncGuildTagUser(client, newUser);
  }
};
