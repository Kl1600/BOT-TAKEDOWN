import { ActionRowBuilder, ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { executeKick, isStaffOrAdmin, replyErr, replyOk } from '../../services/moderationService.js';

const MODAL_PREFIX = 'userctx_kick_reason_';

function getTargetId(interaction) {
  return interaction.targetUser?.id || interaction.targetMember?.id || null;
}

async function resolveTargetMember(interaction, targetId) {
  if (interaction.targetMember) return interaction.targetMember;
  if (!targetId) return null;
  return interaction.guild.members.fetch(targetId).catch(() => null);
}

export const data = new ContextMenuCommandBuilder()
  .setName('kick_user')
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeUserContextMenu(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const targetId = getTargetId(interaction);
  const targetUser = interaction.targetUser;

  if (!targetId || !targetUser) {
    return replyErr(interaction, 'Membre introuvable.');
  }

  if (targetId === interaction.user.id) {
    return replyErr(interaction, 'Vous ne pouvez pas vous expulser vous-même.');
  }

  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${targetId}`)
    .setTitle(`Kick ${targetUser.username}`);

  const reasonInput = new TextInputBuilder()
    .setCustomId('raison')
    .setLabel('Raison du kick')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

export async function handleKickUserModalSubmit(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const match = interaction.customId.match(/^userctx_kick_reason_(\d{17,20})$/);
  const targetId = match?.[1] || null;
  if (!targetId) {
    return replyErr(interaction, 'Membre introuvable.');
  }

  const target = await resolveTargetMember(interaction, targetId);
  if (!target) {
    return replyErr(interaction, 'Membre introuvable.');
  }

  if (target.id === interaction.user.id) {
    return replyErr(interaction, 'Vous ne pouvez pas vous expulser vous-même.');
  }

  const raison = interaction.fields.getTextInputValue('raison')?.trim() || 'Aucune raison fournie';

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    await executeKick({ guild: interaction.guild, mod: interaction.user, target, raison, client: interaction.client });
    return replyOk(interaction, `✅ \`${target.user.username}\` a été expulsé.\n-# Raison : ${raison}`, 0xF0A500);
  } catch (error) {
    return replyErr(interaction, error?.message || 'Impossible d’expulser ce membre.');
  }
}

export default {
  data,
  executeUserContextMenu,
  handleKickUserModalSubmit
};
