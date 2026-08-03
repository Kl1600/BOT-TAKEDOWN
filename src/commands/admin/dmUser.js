import { ActionRowBuilder, ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { isStaffOrAdmin, replyErr, replyOk } from '../../services/moderationService.js';

const MODAL_PREFIX = 'userctx_dm_message_';

function getTargetId(interaction) {
  return interaction.targetUser?.id || interaction.targetMember?.id || null;
}

async function resolveTargetUser(interaction, targetId) {
  if (!targetId) return null;
  return interaction.client.users.fetch(targetId).catch(() => null);
}

async function sendDirectMessage(client, userId, content) {
  const user = await client.users.fetch(userId).catch(() => null);
  if (!user) {
    throw new Error('Utilisateur introuvable.');
  }

  await user.send({ content });
  return user;
}

export const data = new ContextMenuCommandBuilder()
  .setName('dm_user')
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeUserContextMenu(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const targetId = getTargetId(interaction);
  const targetUser = await resolveTargetUser(interaction, targetId);
  if (!targetId || !targetUser) {
    return replyErr(interaction, 'Utilisateur introuvable.');
  }

  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${targetId}`)
    .setTitle(`DM ${targetUser.username}`);

  const messageInput = new TextInputBuilder()
    .setCustomId('message')
    .setLabel('Message à envoyer')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(2000);

  modal.addComponents(new ActionRowBuilder().addComponents(messageInput));
  await interaction.showModal(modal);
}

export async function handleDmUserModalSubmit(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const match = interaction.customId.match(/^userctx_dm_message_(\d{17,20})$/);
  const targetId = match?.[1] || null;
  if (!targetId) {
    return replyErr(interaction, 'Utilisateur introuvable.');
  }

  const content = interaction.fields.getTextInputValue('message')?.trim();
  if (!content) {
    return replyErr(interaction, 'Message vide.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const user = await sendDirectMessage(interaction.client, targetId, content);
    return replyOk(interaction, `✅ Message envoyé à <@${user.id}>.`, 0x57F287);
  } catch (error) {
    return replyErr(interaction, error?.message || 'Impossible d’envoyer le DM.');
  }
}

export default {
  data,
  executeUserContextMenu,
  handleDmUserModalSubmit
};
