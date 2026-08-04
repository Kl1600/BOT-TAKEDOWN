import { refreshPanelsForMember } from '../../services/panelRefreshService.js';
import * as logger from '../../utils/logger.js';

export default {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember, client) {
    const targetMember = newMember || oldMember;
    if (!client || !targetMember?.guild?.id) return;

    try {
      await refreshPanelsForMember(client, targetMember);
    } catch (err) {
      logger.error(`Erreur rafraîchissement panels membre ${targetMember.id}:`, err);
    }
  }
};
