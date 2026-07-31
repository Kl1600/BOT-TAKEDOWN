import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { executeUnban, isStaffOrAdmin, replyOk, replyErr, prefixReply, replyUsage } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('unban')
  .setDescription('Debannir un utilisateur')
  .addStringOption(o => o.setName('userid').setDescription("ID Discord de l'utilisateur banni").setRequired(true))
  .addStringOption(o => o.setName('raison').setDescription('Raison du unban').setRequired(false).setMaxLength(500));

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member))
    return replyErr(interaction, 'Permissions insuffisantes.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const userId = interaction.options.getString('userid').trim();
  const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

  if (!userId) return replyUsage(interaction, '`/unban <userid> [raison]`');

  try {
    const user = await executeUnban({ guild: interaction.guild, mod: interaction.user, userId, raison, client: interaction.client });
    return replyOk(interaction, `? \`${user.username}\` a ete debanni.
-# Raison : ${raison}`, 0x57F287);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) return prefixReply(message, '? Permissions insuffisantes.');

  const userId = args[0];
  if (!userId) return replyUsage(message, `\`${message.client.prefix || '+'}unban <userId> [raison]\``);

  const raison = args.slice(1).join(' ') || 'Aucune raison fournie';

  try {
    const user = await executeUnban({ guild: message.guild, mod: message.author, userId, raison, client: message.client });
    await message.reply(`? \`${user.username}\` a ete debanni. Raison : ${raison}`);
  } catch (e) {
    await prefixReply(message, `? ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
