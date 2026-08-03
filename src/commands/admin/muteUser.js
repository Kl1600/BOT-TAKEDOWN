import { ActionRowBuilder, ApplicationCommandType, ContextMenuCommandBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { executeMute, hasTicketManagementAccess, MUTE_DURATIONS } from '../../services/moderationService.js';

const MODAL_PREFIX = 'userctx_mute_reason_';

function getTargetId(interaction) {
  return interaction.targetUser?.id || interaction.targetMember?.id || null;
}

async function resolveTargetMember(interaction, targetId) {
  if (interaction.targetMember) return interaction.targetMember;
  if (!targetId) return null;
  return interaction.guild.members.fetch(targetId).catch(() => null);
}

async function replyPlain(interaction, content) {
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content }).catch(() => null);
  }
  return interaction.reply({ content, ephemeral: true }).catch(() => null);
}

function parseFlexibleDuration(rawValue) {
  const value = String(rawValue ?? '').trim().toLowerCase();
  const match = value.match(/^(\d+)\s*(s|sec|secs|second|secondes?|m|min|mins|minute|minutes?|h|heure|heures?|d|j|jour|jours?)$/i);
  if (!match) return null;

  const amount = Number(match[1]);
  if (!Number.isInteger(amount) || amount <= 0) return null;

  const unit = match[2].toLowerCase();
  const multipliers = {
    s: 1,
    sec: 1,
    secs: 1,
    second: 1,
    secondes: 1,
    seconde: 1,
    m: 60,
    min: 60,
    mins: 60,
    minute: 60,
    minutes: 60,
    h: 3600,
    heure: 3600,
    heures: 3600,
    d: 86400,
    j: 86400,
    jour: 86400,
    jours: 86400
  };

  return amount * (multipliers[unit] || 0);
}

export const data = new ContextMenuCommandBuilder()
  .setName('mute_user')
  .setType(ApplicationCommandType.User)
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeUserContextMenu(interaction) {
  if (!hasTicketManagementAccess(interaction.member)) {
    return replyPlain(interaction, 'Permissions insuffisantes.');
  }

  const targetId = getTargetId(interaction);
  const targetUser = interaction.targetUser;

  if (!targetId || !targetUser) {
    return replyPlain(interaction, 'Membre introuvable.');
  }

  if (targetId === interaction.user.id) {
    return replyPlain(interaction, 'Vous ne pouvez pas vous mettre en sourdine vous-même.');
  }

  const modal = new ModalBuilder()
    .setCustomId(`${MODAL_PREFIX}${targetId}`)
    .setTitle(`Mute ${targetUser.username}`);

  const durationInput = new TextInputBuilder()
    .setCustomId('duree')
    .setLabel('Durée du mute (60s, 5min, 1h, 7j...)')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  const reasonInput = new TextInputBuilder()
    .setCustomId('raison')
    .setLabel('Raison du mute')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(500);

  modal.addComponents(
    new ActionRowBuilder().addComponents(durationInput),
    new ActionRowBuilder().addComponents(reasonInput)
  );
  await interaction.showModal(modal);
}

export async function handleMuteUserModalSubmit(interaction) {
  if (!hasTicketManagementAccess(interaction.member)) {
    return replyPlain(interaction, 'Permissions insuffisantes.');
  }

  const match = interaction.customId.match(/^userctx_mute_reason_(\d{17,20})$/);
  const targetId = match?.[1] || null;
  if (!targetId) {
    return replyPlain(interaction, 'Membre introuvable.');
  }

  const target = await resolveTargetMember(interaction, targetId);
  if (!target) {
    return replyPlain(interaction, 'Membre introuvable.');
  }

  if (target.id === interaction.user.id) {
    return replyPlain(interaction, 'Vous ne pouvez pas vous mettre en sourdine vous-même.');
  }

  const dureeRaw = interaction.fields.getTextInputValue('duree')?.trim()?.toLowerCase();
  const seconds = MUTE_DURATIONS[dureeRaw] || parseFlexibleDuration(dureeRaw);
  const raison = interaction.fields.getTextInputValue('raison')?.trim() || 'Aucune raison fournie';

  if (!seconds) {
    return replyPlain(interaction, 'Durée invalide. Exemples : 60s, 5min, 1h, 7j.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const until = await executeMute({
      guild: interaction.guild,
      mod: interaction.user,
      target,
      seconds,
      dureeLabel: dureeRaw,
      raison,
      client: interaction.client
    });

    return interaction.editReply({
      content: `✅ \`${target.user.username}\` est en sourdine pendant **${dureeRaw}**.\n-# Expire : <t:${Math.floor(until.getTime() / 1000)}:R>\n-# Raison : ${raison}`
    }).catch(() => null);
  } catch (error) {
    return replyPlain(interaction, error?.message || 'Impossible de mettre ce membre en sourdine.');
  }
}

export default {
  data,
  executeUserContextMenu,
  handleMuteUserModalSubmit
};
