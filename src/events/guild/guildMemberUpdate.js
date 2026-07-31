import { refreshPanelsForMember } from '../../services/panelRefreshService.js';
import * as logger from '../../utils/logger.js';

export default {
  name: 'guildMemberUpdate',
  once: false,
  async execute(oldMember, newMember) {
    try {
      await refreshPanelsForMember(newMember.client, newMember.guild.id, newMember.id).catch(() => null);
    } catch (err) {
      logger.error('Erreur guildMemberUpdate:', err);
    }
  }
};
