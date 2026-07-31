import { SlashCommandBuilder } from 'discord.js';
import { prefixReply, replyErr } from '../../services/moderationService.js';
import { sendStaffRolePanel } from '../../services/rolePanelService.js';
import config from '../../config/config.js';

function canUsePanelStaff(member) {
  return Boolean(
    member?.roles?.cache?.has(config.roles.admin) ||
    member?.roles?.cache?.has(config.roles.staff)
  );
}

export const data = new SlashCommandBuilder()
  .setName('rolestaff')
  .setDescription('Envoyer le panel des rôles staff dans ce salon');

export async function executeSlash(interaction) {
  if (!canUsePanelStaff(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await sendStaffRolePanel(interaction);
}

export async function executePrefix(message) {
  if (!canUsePanelStaff(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  await message.delete().catch(() => null);
  await sendStaffRolePanel({
    channel: message.channel,
    member: message.member,
    deferReply: async () => {},
    deleteReply: async () => {}
  }).catch(() => null);
}

export default { data, executeSlash, executePrefix };
