import { SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import { sendStreamerPanel } from '../../services/streamerService.js';
import { isStaffOrAdmin, replyErr, prefixReply } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('panelstreamer')
  .setDescription('Envoyer le panel de lancement de live dans ce salon (staff uniquement)');

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await sendStreamerPanel(interaction);
}

export async function executePrefix(message) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  await message.delete().catch(() => null);
  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('streamer_go_live')
      .setLabel('Je lance mon live !')
      .setStyle(ButtonStyle.Danger)
  );

  await message.channel.send({
    content: 'Appuie pour lancer un live',
    components: [row]
  }).catch(() => null);
}

export default { data, executeSlash, executePrefix };
