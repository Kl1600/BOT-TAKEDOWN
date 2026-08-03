import { ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags } from 'discord.js';
import { executeUnmute, hasTicketManagementAccess, replyErr, replyOk } from '../../services/moderationService.js';

function getTargetId(interaction) {
  return interaction.targetUser?.id || interaction.targetMember?.id || null;
}

async function resolveTargetMember(interaction, targetId) {
  if (interaction.targetMember) return interaction.targetMember;
  if (!targetId) return null;
  return interaction.guild.members.fetch(targetId).catch(() => null);
}

export const data = new ContextMenuCommandBuilder()
  .setName('unmute_user')
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeUserContextMenu(interaction) {
  if (!hasTicketManagementAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const targetId = getTargetId(interaction);
  const target = await resolveTargetMember(interaction, targetId);
  if (!target) {
    return replyErr(interaction, 'Membre introuvable.');
  }

  if (target.id === interaction.user.id) {
    return replyErr(interaction, 'Vous ne pouvez pas vous retirer votre propre mute.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await executeUnmute({ mod: interaction.user, target, raison: 'Unmute via menu contextuel', client: interaction.client });
    return replyOk(interaction, `✅ Le mute de \`${target.user.username}\` a été retiré.`, 0x57F287);
  } catch (error) {
    return replyErr(interaction, error?.message || 'Impossible de retirer le mute.');
  }
}

export default {
  data,
  executeUserContextMenu
};
