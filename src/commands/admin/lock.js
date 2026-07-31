import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { executeLock, isStaffOrAdmin, replyOk, replyErr, prefixReply } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('lock')
  .setDescription('Verrouiller un salon (empêche les messages)')
  .addChannelOption(o => o.setName('salon').setDescription('Salon à verrouiller (défaut : actuel)').setRequired(false))
  .addStringOption(o => o.setName('raison').setDescription('Raison du lock').setRequired(false).setMaxLength(500));

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member))
    return replyErr(interaction, 'Permissions insuffisantes.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = interaction.options.getChannel('salon') || interaction.channel;
  const raison  = interaction.options.getString('raison') || 'Aucune raison fournie';

  try {
    await executeLock({ channel, mod: interaction.user, raison, client: interaction.client });
    return replyOk(interaction, `✅ <#${channel.id}> a été **verrouillé**.\n-# Raison : ${raison}`, 0xED4245);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) return prefixReply(message, '❌ Permissions insuffisantes.');

  const channel = message.mentions.channels?.first() || message.channel;
  const raison  = args.filter(a => !a.startsWith('<#')).join(' ') || 'Aucune raison fournie';

  try {
    await executeLock({ channel, mod: message.author, raison, client: message.client });
    await message.reply(`✅ <#${channel.id}> est verrouillé. Raison : ${raison}`);
  } catch (e) {
    await prefixReply(message, `❌ ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
