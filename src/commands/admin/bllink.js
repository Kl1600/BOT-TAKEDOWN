import { SlashCommandBuilder } from 'discord.js';
import { prefixReply, replyUsage, replyErr, replyOk } from '../../services/moderationService.js';
import config from '../../config/config.js';
import {
  addGuildAntiLinkBlacklist,
  removeGuildAntiLinkBlacklist
} from '../../services/antiLinkService.js';
import dbService from '../../database/dbProxy.js';

function hasBlacklistManagementAccess(member) {
  return Boolean(member?.roles?.cache?.has(config.roles.admin));
}

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
  .setName('bllink')
  .setDescription('Gérer la blacklist des liens Discord')
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
  if (!hasBlacklistManagementAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const action = String(interaction.options.getString('action') || 'add').toLowerCase();
  const userId = extractUserId(interaction.options.getString('id'));

  if (action === 'list') {
    const rows = await dbService.getGuildAntiLinkBlacklist(interaction.guildId).catch(() => []);
    return replyOk(interaction, `✅ Blacklist liens Discord:\n${formatUsers(rows)}`);
  }

  if (!userId) {
    return replyErr(interaction, 'ID Discord invalide.');
  }

  if (action === 'remove') {
    await removeGuildAntiLinkBlacklist(interaction.guildId, userId);
    return replyOk(interaction, `✅ <@${userId}> retiré de la blacklist liens Discord.`);
  }

  await addGuildAntiLinkBlacklist(interaction.guildId, userId, interaction.user.id);
  return replyOk(interaction, `✅ <@${userId}> ajouté à la blacklist liens Discord.`);
}

export async function executePrefix(message, args) {
  if (!hasBlacklistManagementAccess(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const { action, userId } = parseArgs(args);

  if (action === 'list') {
    const rows = await dbService.getGuildAntiLinkBlacklist(message.guild.id).catch(() => []);
    return prefixReply(message, `✅ Blacklist liens Discord:\n${formatUsers(rows)}`);
  }

  if (!userId) {
    return replyUsage(message, `\`${config.prefix}bllink [add/remove] <id>\` ou \`${config.prefix}bllink list\``);
  }

  if (action === 'remove') {
    await removeGuildAntiLinkBlacklist(message.guild.id, userId);
    return prefixReply(message, `✅ <@${userId}> retiré de la blacklist liens Discord.`);
  }

  await addGuildAntiLinkBlacklist(message.guild.id, userId, message.author.id);
  return prefixReply(message, `✅ <@${userId}> ajouté à la blacklist liens Discord.`);
}

export default { data, executeSlash, executePrefix };
