import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { executeUnlock, isStaffOrAdmin, replyOk, replyErr, prefixReply } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('unlock')
  .setDescription('Déverrouiller un salon')
  .addChannelOption(o => o.setName('salon').setDescription('Salon à déverrouiller (défaut : actuel)').setRequired(false))
  .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false).setMaxLength(500));

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member))
    return replyErr(interaction, 'Permissions insuffisantes.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const channel = interaction.options.getChannel('salon') || interaction.channel;
  const raison  = interaction.options.getString('raison') || 'Aucune raison fournie';

  try {
    await executeUnlock({ channel, mod: interaction.user, raison, client: interaction.client });
    return replyOk(interaction, `✅ <#${channel.id}> a été **déverrouillé**.\n-# Raison : ${raison}`, 0x57F287);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) return prefixReply(message, '❌ Permissions insuffisantes.');

  const channel = message.mentions.channels?.first() || message.channel;
  const raison  = args.filter(a => !a.startsWith('<#')).join(' ') || 'Aucune raison fournie';

  try {
    await executeUnlock({ channel, mod: message.author, raison, client: message.client });
    await message.reply(`✅ <#${channel.id}> est déverrouillé.`);
  } catch (e) {
    await prefixReply(message, `❌ ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
