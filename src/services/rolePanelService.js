import { ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder, MessageFlags } from 'discord.js';
import config from '../config/config.js';
import { isStaffOrAdmin } from './moderationService.js';
import { sendV2Container } from '../utils/v2Helper.js';

const ROLE_BUTTONS = [
  { customId: 'rolepanel_stream', label: 'Notif stream', roleId: '1520500366926413895' },
  { customId: 'rolepanel_events', label: 'Notif événements', roleId: '1520115559663013988' },
  { customId: 'rolepanel_patch', label: 'Notif patch-notes', roleId: '1520116888879890593' },
  { customId: 'rolepanel_tournois', label: 'Notif Tournois', roleId: '1520115501206868068' }
];

const STAFF_ROLE_BUTTONS = [
  { customId: 'rolepanel_staff_bda', label: 'Notif BDA', roleId: '1532824877516718141' },
  { customId: 'rolepanel_staff_ticket', label: 'Notif Ticket', roleId: '1533059907958608023' }
];

const ROLE_BUTTON_MAP = new Map([...ROLE_BUTTONS, ...STAFF_ROLE_BUTTONS].map(button => [button.customId, button]));

export async function sendRolePanel(interaction) {
  if (typeof interaction.deferReply === 'function') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  const text = new TextDisplayBuilder().setContent(
    `### PANEL ROLES\n\n` +
    `Clique sur un bouton pour recevoir ou retirer le rôle correspondant.`
  );

  const rows = [];
  for (let i = 0; i < ROLE_BUTTONS.length; i += 5) {
    const chunk = ROLE_BUTTONS.slice(i, i + 5);
    const row = new ActionRowBuilder();
    for (const button of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(button.customId)
          .setLabel(button.label)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(...rows);

  await sendV2Container(interaction.channel, container);
  if (typeof interaction.deleteReply === 'function') {
    await interaction.deleteReply().catch(() => null);
  }
}

export async function sendStaffRolePanel(interaction) {
  if (typeof interaction.deferReply === 'function') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  const text = new TextDisplayBuilder().setContent(
    `### Role Staff\n\nVoici les différents rôles disponibles, cliquez pour vous ajoutez ou retirez le role.`
  );

  const rows = [];
  for (let i = 0; i < STAFF_ROLE_BUTTONS.length; i += 5) {
    const chunk = STAFF_ROLE_BUTTONS.slice(i, i + 5);
    const row = new ActionRowBuilder();
    for (const button of chunk) {
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(button.customId)
          .setLabel(button.label)
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(...rows);

  await sendV2Container(interaction.channel, container);
  if (typeof interaction.deleteReply === 'function') {
    await interaction.deleteReply().catch(() => null);
  }
}

export async function handleRolePanelButton(interaction) {
  const button = ROLE_BUTTON_MAP.get(interaction.customId);
  if (!button) return false;

  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '-# Cette action doit être utilisée dans un serveur.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const member = interaction.member;
  const roleId = button.roleId;
  const role = interaction.guild.roles.cache.get(roleId) || await interaction.guild.roles.fetch(roleId).catch(() => null);

  if (!role) {
    await interaction.reply({ content: '-# Rôle introuvable dans la configuration.', flags: MessageFlags.Ephemeral });
    return true;
  }

  const hasRole = member.roles.cache.has(roleId);

  try {
    if (hasRole) {
      await member.roles.remove(roleId);
      await interaction.reply({
        content: `-# Le rôle **${button.label}** a été retiré.`,
        flags: MessageFlags.Ephemeral
      });
      return true;
    }

    await member.roles.add(roleId);

    await interaction.reply({
      content: `-# Le rôle **${button.label}** a été ajouté.`,
      flags: MessageFlags.Ephemeral
    });
  } catch (err) {
    await interaction.reply({
      content: `-# Impossible de modifier le rôle **${button.label}**.`,
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
  }
  return true;
}

export default {
  sendRolePanel,
  sendStaffRolePanel,
  handleRolePanelButton
};


