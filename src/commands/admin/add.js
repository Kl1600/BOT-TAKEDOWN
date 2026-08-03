import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { hasTicketManagementAccess, prefixReply, replyUsage, replyErr, resolveMemberFromInput } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';
import config from '../../config/config.js';

async function addMemberToTicket(channel, userId) {
  await channel.permissionOverwrites.edit(userId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('add')
    .setDescription('Ajouter un membre au ticket')
    .addStringOption(option =>
    option
        .setName('id')
        .setDescription('ID Discord du membre à ajouter')
        .setRequired(true)
    ),

  async executeSlash(interaction) {
    if (!hasTicketManagementAccess(interaction.member)) {
      return replyErr(interaction, 'Permissions insuffisantes.');
    }

    const ticket = await dbService.getTicket(interaction.channel.id);
    if (!ticket) {
      return replyErr(interaction, 'Cette commande doit être utilisée dans un ticket.');
    }

    const targetMember = await resolveMemberFromInput(interaction.guild, interaction.options.getString('id', true));
    if (!targetMember) {
      return replyUsage(interaction, '`/add <id|@membre>`');
    }

    await addMemberToTicket(interaction.channel, targetMember.id);
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    await interaction.deleteReply().catch(() => null);
    return null;
  },

  async executePrefix(message, args) {
    if (!hasTicketManagementAccess(message.member)) return prefixReply(message, '❌ Permissions insuffisantes.');

    const ticket = await dbService.getTicket(message.channel.id);
    if (!ticket) {
      return prefixReply(message, '❌ Cette commande doit être utilisée dans un ticket.');
    }

    const targetMember = await resolveMemberFromInput(message.guild, args[0], message.mentions.members?.first());
    if (!targetMember) {
      return replyUsage(message, `\`${config.prefix}add <id|@membre>\``);
    }

    await addMemberToTicket(message.channel, targetMember.id);
    return null;
  }
};
