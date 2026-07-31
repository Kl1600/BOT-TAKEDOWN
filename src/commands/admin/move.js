import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { hasTicketManagementAccess, prefixReply, replyUsage, replyErr, resolveMemberFromInput } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';
import config from '../../config/config.js';

async function removeMemberFromTicket(channel, userId) {
  const overwrite = channel.permissionOverwrites.cache.get(userId);
  if (!overwrite) return false;

  await channel.permissionOverwrites.delete(userId);
  return true;
}

export default {
  data: new SlashCommandBuilder()
    .setName('remove')
    .setDescription('Retirer un membre du ticket')
    .addStringOption(option =>
      option
        .setName('id')
        .setDescription('ID Discord du membre ? retirer')
        .setRequired(true)
    ),
  async executeSlash(interaction) {
    if (!hasTicketManagementAccess(interaction.member)) {
      return replyErr(interaction, 'Permissions insuffisantes.');
    }

    const ticket = await dbService.getTicket(interaction.channel.id);
    if (!ticket) {
      return replyErr(interaction, 'Cette commande doit ?tre utilis?e dans un ticket.');
    }

    const targetMember = await resolveMemberFromInput(interaction.guild, interaction.options.getString('id', true));
    if (!targetMember) {
      return replyUsage(interaction, '`/remove <id|@membre>`');
    }

    const removed = await removeMemberFromTicket(interaction.channel, targetMember.id);
    if (!removed) {
      return replyErr(interaction, 'Ce membre n?a pas acc?s ? ce ticket.');
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
    await interaction.deleteReply().catch(() => null);
    return null;
  },

  async executePrefix(message, args) {
    if (!hasTicketManagementAccess(message.member)) return prefixReply(message, '? Permissions insuffisantes.');

    const ticket = await dbService.getTicket(message.channel.id);
    if (!ticket) {
      return prefixReply(message, '? Cette commande doit ?tre utilis?e dans un ticket.');
    }

    const targetMember = await resolveMemberFromInput(message.guild, args[0], message.mentions.members?.first());
    if (!targetMember) {
      return replyUsage(message, `\`${config.prefix}remove <id|@membre>\``);
    }

    const removed = await removeMemberFromTicket(message.channel, targetMember.id);
    if (!removed) {
      return prefixReply(message, '? Ce membre n?a pas acc?s ? ce ticket.');
    }

    return null;
  }
};
