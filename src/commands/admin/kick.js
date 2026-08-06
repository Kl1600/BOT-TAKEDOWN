import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { executeKick, isStaffOrAdmin, replyOk, replyErr, prefixReply, replyUsage, resolveMemberFromInput } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('kick')
  .setDescription('Expulser un membre du serveur')
  .addStringOption(o => o.setName('membre').setDescription('ID ou mention du membre à expulser').setRequired(true))
  .addStringOption(o => o.setName('raison').setDescription('Raison du kick').setRequired(false).setMaxLength(500));

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const target = await resolveMemberFromInput(interaction.guild, interaction.options.getString('membre', true));
  const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

  if (!target) return replyUsage(interaction, '`/kick <membre> [raison]`');
  if (target.id === interaction.user.id) return replyUsage(interaction, '`/kick <membre> [raison]`');

  try {
    await executeKick({ guild: interaction.guild, mod: interaction.user, target, raison, client: interaction.client });
    return replyOk(interaction, `✅ <@${target.id}> kick du serveur.`, 0xF0A500);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) return prefixReply(message, '❌ Permissions insuffisantes.');

  const mention = await resolveMemberFromInput(message.guild, args[0], message.mentions.members?.first());
  if (!mention) return replyUsage(message, `\`${message.client.prefix || '+'}kick <id|@membre> [raison]\``);

  const raison = args.slice(1).join(' ') || 'Aucune raison fournie';

  try {
    await executeKick({ guild: message.guild, mod: message.author, target: mention, raison, client: message.client });
    return message.channel.send(`✅ <@${mention.id}> kick du serveur.`);
  } catch (e) {
    await prefixReply(message, `❌ ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
