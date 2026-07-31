import { SlashCommandBuilder } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyUsage, replyErr, replyOk } from '../../services/moderationService.js';
import config from '../../config/config.js';
import {
  addGuildAntiLinkWhitelist,
  removeGuildAntiLinkWhitelist,
  getGuildAntiLinkSnapshot
} from '../../services/antiLinkService.js';
import dbService from '../../database/dbProxy.js';

function extractUserId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

function parseArgs(args) {
  const action = String(args[0] ?? 'add').trim().toLowerCase();
  const userId = action === 'add' || action === 'remove'
    ? extractUserId(args[1])
    : extractUserId(args[0]);
  return { action, userId };
}

function formatUsers(rows) {
  if (!rows.length) return 'Aucun utilisateur.';
  return rows.map(row => `<@${row.user_id}> (\`${row.user_id}\`)`).join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('wllink')
  .setDescription('Gérer la whitelist des liens Discord')
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('Action à effectuer')
      .addChoices(
        { name: 'add', value: 'add' },
        { name: 'remove', value: 'remove' },
        { name: 'list', value: 'list' }
      )
  )
  .addStringOption(option =>
    option
      .setName('id')
      .setDescription('ID Discord du membre')
  );

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const action = String(interaction.options.getString('action') || 'add').toLowerCase();
  const userId = extractUserId(interaction.options.getString('id'));

  if (action === 'list') {
    const rows = await dbService.getGuildAntiLinkWhitelist(interaction.guildId).catch(() => []);
    return replyOk(interaction, `✅ Whitelist liens Discord:\n${formatUsers(rows)}`);
  }

  if (!userId) {
    return replyErr(interaction, 'ID Discord invalide.');
  }

  if (action === 'remove') {
    await removeGuildAntiLinkWhitelist(interaction.guildId, userId);
    return replyOk(interaction, `✅ <@${userId}> retiré de la whitelist liens Discord.`);
  }

  await addGuildAntiLinkWhitelist(interaction.guildId, userId, interaction.user.id);
  return replyOk(interaction, `✅ <@${userId}> ajouté à la whitelist liens Discord.`);
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const { action, userId } = parseArgs(args);

  if (action === 'list') {
    const rows = await dbService.getGuildAntiLinkWhitelist(message.guild.id).catch(() => []);
    return prefixReply(message, `✅ Whitelist liens Discord:\n${formatUsers(rows)}`);
  }

  if (!userId) {
    return replyUsage(message, `\`${config.prefix}wllink [add/remove] <id>\` ou \`${config.prefix}wllink list\``);
  }

  if (action === 'remove') {
    await removeGuildAntiLinkWhitelist(message.guild.id, userId);
    return prefixReply(message, `✅ <@${userId}> retiré de la whitelist liens Discord.`);
  }

  await addGuildAntiLinkWhitelist(message.guild.id, userId, message.author.id);
  return prefixReply(message, `✅ <@${userId}> ajouté à la whitelist liens Discord.`);
}

export default { data, executeSlash, executePrefix };
