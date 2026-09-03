import { handleGuildMemberInviteLeave } from '../../services/inviteService.js';
import { executeTicketClose } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';
import { removeGuildTagMember } from '../../services/guildTagService.js';
import { updateMemberCountChannel } from '../../services/memberCountService.js';
import * as logger from '../../utils/logger.js';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    void updateMemberCountChannel(member.client).catch(err => {
      logger.error('Impossible d’actualiser le compteur après le départ d’un membre:', err);
    });

    await handleGuildMemberInviteLeave(member).catch(() => null);
    await removeGuildTagMember(member).catch(err => {
      logger.error(`Impossible de supprimer l’état du tag serveur de ${member.id}:`, err);
    });

    const activeTicket = await dbService.getUserActiveTicket(member.id).catch(() => null);
    if (!activeTicket) return;

    const channel = member.guild.channels.cache.get(activeTicket.channel_id)
      || await member.guild.channels.fetch(activeTicket.channel_id).catch(() => null);

    if (!channel || !channel.isTextBased()) {
      await dbService.deleteTicket(activeTicket.channel_id).catch(() => null);
      return;
    }

    await executeTicketClose({
      channel,
      mod: member.user,
      raison: 'Membre quitté le serveur',
      client: member.client
    }).catch(() => null);
  }
};
