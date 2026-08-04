import { handleGuildMemberInviteLeave } from '../../services/inviteService.js';
import { executeTicketClose } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';

export default {
  name: 'guildMemberRemove',
  once: false,
  async execute(member) {
    await handleGuildMemberInviteLeave(member).catch(() => null);

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
