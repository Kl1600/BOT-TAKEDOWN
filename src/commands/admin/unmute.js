import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { executeUnmute, hasTicketManagementAccess, replyOk, replyErr, prefixReply, replyUsage, resolveMemberFromInput } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('unmute')
  .setDescription("Retirer le mute d'un membre")
  .addUserOption(o => o.setName('membre').setDescription('Membre à unmute').setRequired(true))
  .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false).setMaxLength(500));

export async function executeSlash(interaction) {
  if (!hasTicketManagementAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const target = interaction.options.getMember('membre');
  const raison = interaction.options.getString('raison') || 'Aucune raison fournie';

  if (!target) return replyUsage(interaction, '`/unmute <membre> [raison]`');

  try {
    await executeUnmute({ mod: interaction.user, target, raison, client: interaction.client });
    return replyOk(interaction, `✅ Le mute de \`${target.user.username}\` a été retiré.\n-# Raison : ${raison}`, 0x57F287);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

export async function executePrefix(message, args) {
  if (!hasTicketManagementAccess(message.member)) return prefixReply(message, '❌ Permissions insuffisantes.');

  const mention = await resolveMemberFromInput(message.guild, args[0], message.mentions.members?.first());
  if (!mention) return replyUsage(message, `\`${message.client.prefix || '+'}unmute <id|@membre> [raison]\``);

  const raison = args.slice(1).join(' ') || 'Aucune raison fournie';

  try {
    await executeUnmute({ mod: message.author, target: mention, raison, client: message.client });
    await message.reply(`✅ Le mute de \`${mention.user.username}\` a été retiré.`);
  } catch (e) {
    await prefixReply(message, `❌ ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
