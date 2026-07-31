import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { executeTicketRename, hasTicketManagementAccess, replyOk, replyErr, prefixReply, replyUsage } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('rename')
  .setDescription('Renommer le salon de ticket actuel')
  .addStringOption(o => o.setName('nom').setDescription('Nouveau nom du salon').setRequired(true).setMaxLength(50));

export async function executeSlash(interaction) {
  if (!hasTicketManagementAccess(interaction.member))
    return replyErr(interaction, 'Permissions insuffisantes.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const nom = interaction.options.getString('nom');

  try {
    const result = await executeTicketRename({ channel: interaction.channel, mod: interaction.user, newName: nom, client: interaction.client });
    return replyOk(interaction, `? Renomm? : \`${result.oldName}\` ? \`${result.newName}\``, 0xF0A500);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

export async function executePrefix(message, args) {
  if (!hasTicketManagementAccess(message.member)) return prefixReply(message, '? Permissions insuffisantes.');

  const nom = args.join(' ').trim();
  if (!nom) return replyUsage(message, '`+rename <nouveau-nom>`');

  try {
    await executeTicketRename({ channel: message.channel, mod: message.author, newName: nom, client: message.client });
    await message.delete().catch(() => null);
  } catch (e) {
    await prefixReply(message, `? ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
