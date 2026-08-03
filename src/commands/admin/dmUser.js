import { ActionRowBuilder, ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { isStaffOrAdmin } from '../../services/moderationService.js';

const MODAL_PREFIX = 'userctx_dm_message_';

function getTargetId(interaction) {
  return interaction.targetUser?.id || interaction.targetMember?.id || null;
}

async function resolveTargetUser(interaction, targetId) {
  if (!targetId) return null;
  return interaction.client.users.fetch(targetId).catch(() => null);
}

async function replyPlain(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content }).catch(() => null);
  }
  return interaction.reply({ content, ephemeral: true }).catch(() => null);
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
    return replyPlain(interaction, 'Permissions insuffisantes.');
  }

  const targetId = getTargetId(interaction);
  const targetUser = await resolveTargetUser(interaction, targetId);
  if (!targetId || !targetUser) {
    return replyPlain(interaction, 'Utilisateur introuvable.');
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
    return replyPlain(interaction, 'Permissions insuffisantes.');
  }

  const match = interaction.customId.match(/^userctx_dm_message_(\d{17,20})$/);
  const targetId = match?.[1] || null;
  if (!targetId) {
    return replyPlain(interaction, 'Utilisateur introuvable.');
  }

  const content = interaction.fields.getTextInputValue('message')?.trim();
  if (!content) {
    return replyPlain(interaction, 'Message vide.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const user = await sendDirectMessage(interaction.client, targetId, content);
    return interaction.editReply({ content: `-# Message envoyé à <@${user.id}>.` }).catch(() => null);
  } catch (error) {
    return replyPlain(interaction, error?.message || 'Impossible d’envoyer le DM.');
  }
}

export default {
  data,
  executeUserContextMenu,
  handleDmUserModalSubmit
};
