import { SlashCommandBuilder } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyErr, replyOk } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';

function formatUsers(rows) {
  if (!rows.length) return 'Aucun utilisateur.';
  return rows.map(row => `<@${row.user_id}> (\`${row.user_id}\`)`).join('\n');
}

async function getWhitelist(guildId) {
  return dbService.getGuildAntiLinkWhitelist(guildId).catch(() => []);
}

export const data = new SlashCommandBuilder()
  .setName('wllinklist')
  .setDescription('Afficher la whitelist des liens Discord');

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const rows = await getWhitelist(interaction.guildId);
  return replyOk(interaction, `✅ Whitelist liens Discord:\n${formatUsers(rows)}`);
}

export async function executePrefix(message) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const rows = await getWhitelist(message.guild.id);
  return prefixReply(message, `✅ Whitelist liens Discord:\n${formatUsers(rows)}`);
}

export default { data, executeSlash, executePrefix };
