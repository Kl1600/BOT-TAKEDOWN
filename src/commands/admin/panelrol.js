import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isStaffOrAdmin, replyErr, prefixReply } from '../../services/moderationService.js';
import { sendRolePanel } from '../../services/rolePanelService.js';

export const data = new SlashCommandBuilder()
  .setName('panelrol')
  .setDescription('Envoyer le panel des rôles dans ce salon (staff uniquement)');

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await sendRolePanel(interaction);
}

export async function executePrefix(message) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  await message.delete().catch(() => null);
  await sendRolePanel({
    channel: message.channel,
    member: message.member,
    deferReply: async () => {},
    deleteReply: async () => {}
  }).catch(() => null);
}

export default { data, executeSlash, executePrefix };
