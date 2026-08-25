import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  CheckboxGroupBuilder,
  ComponentType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  TextDisplayBuilder
} from 'discord.js';
import config from '../config/config.js';
import { isStaffOrAdmin } from './moderationService.js';
import { sendV2Container } from '../utils/v2Helper.js';
import { getLanguage } from '../utils/language.js';
import * as logger from '../utils/logger.js';

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

const ROLE_PANEL_COPY = {
  fr: {
    modalTitle: 'Choisissez vos rôles',
    modalLabel: 'Notifications à recevoir',
    modalDescription: 'Cochez les notifications que vous souhaitez recevoir.',
    wrongButton: 'Utilisez le bouton Choisir.',
    success: 'Vos rôles de notification ont été mis à jour.',
    error: 'Impossible de modifier vos rôles de notification.',
    options: {
      rolepanel_stream: ['Notif stream', 'Lives, TikToks et activités sur les réseaux'],
      rolepanel_events: ['Notif événements', 'Événements et soirées à venir'],
      rolepanel_patch: ['Notif patch-notes', 'Nouveautés et notes de mise à jour'],
      rolepanel_tournois: ['Notif tournois', 'Tournois et événements compétitifs']
    }
  },
  en: {
    modalTitle: 'Choose your roles',
    modalLabel: 'Notifications to receive',
    modalDescription: 'Select the notifications you would like to receive.',
    wrongButton: 'Use the Choose button.',
    success: 'Your notification roles have been updated.',
    error: 'Unable to update your notification roles.',
    options: {
      rolepanel_stream: ['Stream notifications', 'Live streams, TikToks and social media activity'],
      rolepanel_events: ['Event notifications', 'Upcoming events and community nights'],
      rolepanel_patch: ['Patch notes notifications', 'Updates, changes and patch notes'],
      rolepanel_tournois: ['Tournament notifications', 'Tournaments and competitive events']
    }
  }
};

const STAFF_ROLE_PANEL_COPY = {
  modalTitle: 'Choisissez vos rôles staff',
  modalLabel: 'Notifications staff à recevoir',
  modalDescription: 'Cochez les notifications staff que vous souhaitez recevoir.',
  success: 'Vos rôles de notification staff ont été mis à jour.',
  error: 'Impossible de modifier vos rôles de notification staff.',
  options: {
    rolepanel_staff_bda: ['Notif BDA', 'Alertes lorsqu’un membre attend une prise en charge staff'],
    rolepanel_staff_ticket: ['Notif Ticket', 'Notifications lors de l’ouverture d’un ticket']
  }
};

async function fetchCurrentMember(interaction) {
  return interaction.guild.members.fetch(interaction.user.id, { force: true })
    .catch(() => interaction.member);
}

function buildRoleSelectionModal(member, lang) {
  const copy = ROLE_PANEL_COPY[lang] || ROLE_PANEL_COPY.fr;
  const checkboxGroup = new CheckboxGroupBuilder()
    .setCustomId('rolepanel_notifications')
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(ROLE_BUTTONS.length)
    .setOptions(ROLE_BUTTONS.map(button => {
      const [label, description] = copy.options[button.customId];
      return {
        label,
        description,
        value: button.customId,
        default: member.roles.cache.has(button.roleId)
      };
    }));

  return new ModalBuilder({
    custom_id: `rolepanel_modal_${lang}`,
    title: copy.modalTitle,
    components: [
      {
        type: ComponentType.Label,
        label: copy.modalLabel,
        description: copy.modalDescription,
        component: checkboxGroup.toJSON()
      }
    ]
  });
}

function buildStaffRoleSelectionModal(member) {
  const checkboxGroup = new CheckboxGroupBuilder()
    .setCustomId('rolepanel_staff_notifications')
    .setRequired(false)
    .setMinValues(0)
    .setMaxValues(STAFF_ROLE_BUTTONS.length)
    .setOptions(STAFF_ROLE_BUTTONS.map(button => {
      const [label, description] = STAFF_ROLE_PANEL_COPY.options[button.customId];
      return {
        label,
        description,
        value: button.customId,
        default: member.roles.cache.has(button.roleId)
      };
    }));

  return new ModalBuilder({
    custom_id: 'rolepanel_modal_staff',
    title: STAFF_ROLE_PANEL_COPY.modalTitle,
    components: [
      {
        type: ComponentType.Label,
        label: STAFF_ROLE_PANEL_COPY.modalLabel,
        description: STAFF_ROLE_PANEL_COPY.modalDescription,
        component: checkboxGroup.toJSON()
      }
    ]
  });
}

export async function sendRolePanel(interaction) {
  if (typeof interaction.deferReply === 'function') {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  const text = new TextDisplayBuilder().setContent(
    `### NOTIFICATION\n\n` +
    `**FR** - Clique sur un bouton pour recevoir ou retirer le rôle correspondant.\n` +
    `**GB** - Click a button to receive or remove the corresponding role.`
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rolepanel_choose_fr')
      .setLabel('Choisir')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId('rolepanel_choose_en')
      .setLabel('Choose')
      .setStyle(ButtonStyle.Secondary)
  );

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(row);

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
    `### NOTIFICATION STAFF\n\n` +
    `**FR** - Clique sur le bouton pour recevoir ou retirer les rôles correspondants.`
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId('rolepanel_choose_staff')
      .setLabel('Choisir')
      .setStyle(ButtonStyle.Secondary)
  );

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(row);

  await sendV2Container(interaction.channel, container);
  if (typeof interaction.deleteReply === 'function') {
    await interaction.deleteReply().catch(() => null);
  }
}

export async function handleRolePanelButton(interaction) {
  if (interaction.customId === 'rolepanel_choose_staff') {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '-# Cette action doit être utilisée dans un serveur.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const member = await fetchCurrentMember(interaction);
    await interaction.showModal(buildStaffRoleSelectionModal(member));
    return true;
  }

  const languageMatch = interaction.customId.match(/^rolepanel_choose_(fr|en)$/);
  if (languageMatch) {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '-# Cette action doit être utilisée dans un serveur.', flags: MessageFlags.Ephemeral });
      return true;
    }

    const requestedLang = languageMatch[1];
    const member = await fetchCurrentMember(interaction);
    const memberLang = await getLanguage(member);
    if (requestedLang !== memberLang) {
      const copy = ROLE_PANEL_COPY[memberLang] || ROLE_PANEL_COPY.fr;
      await interaction.reply({ content: `-# ${copy.wrongButton}`, flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.showModal(buildRoleSelectionModal(member, memberLang));
    return true;
  }

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

export async function handleRolePanelModalSubmit(interaction) {
  if (interaction.customId === 'rolepanel_modal_staff') {
    if (!interaction.guild || !interaction.member) {
      await interaction.reply({ content: '-# Cette action doit être utilisée dans un serveur.', flags: MessageFlags.Ephemeral });
      return true;
    }

    await interaction.deferReply({ flags: MessageFlags.Ephemeral });
    const member = await fetchCurrentMember(interaction);
    const selectedValues = new Set(interaction.fields.getCheckboxGroup('rolepanel_staff_notifications'));
    const selectedRoles = STAFF_ROLE_BUTTONS.filter(button => selectedValues.has(button.customId));
    const rolesToAdd = selectedRoles
      .filter(button => !member.roles.cache.has(button.roleId))
      .map(button => button.roleId);
    const rolesToRemove = STAFF_ROLE_BUTTONS
      .filter(button => !selectedValues.has(button.customId) && member.roles.cache.has(button.roleId))
      .map(button => button.roleId);

    try {
      if (rolesToAdd.length > 0) await member.roles.add(rolesToAdd);
      if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);
      await interaction.editReply({ content: `-# ${STAFF_ROLE_PANEL_COPY.success}` });
    } catch (err) {
      logger.error(`Impossible de mettre à jour les rôles de notification staff de ${interaction.user.id}:`, err);
      await interaction.editReply({ content: `-# ${STAFF_ROLE_PANEL_COPY.error}` }).catch(() => null);
    }

    return true;
  }

  const modalMatch = interaction.customId.match(/^rolepanel_modal_(fr|en)$/);
  if (!modalMatch) return false;

  const lang = modalMatch[1];
  const copy = ROLE_PANEL_COPY[lang] || ROLE_PANEL_COPY.fr;
  if (!interaction.guild || !interaction.member) {
    await interaction.reply({ content: '-# Cette action doit être utilisée dans un serveur.', flags: MessageFlags.Ephemeral });
    return true;
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const member = await fetchCurrentMember(interaction);
  const selectedValues = new Set(interaction.fields.getCheckboxGroup('rolepanel_notifications'));
  const selectedRoles = ROLE_BUTTONS.filter(button => selectedValues.has(button.customId));
  const rolesToAdd = selectedRoles
    .filter(button => !member.roles.cache.has(button.roleId))
    .map(button => button.roleId);
  const rolesToRemove = ROLE_BUTTONS
    .filter(button => !selectedValues.has(button.customId) && member.roles.cache.has(button.roleId))
    .map(button => button.roleId);

  try {
    if (rolesToAdd.length > 0) await member.roles.add(rolesToAdd);
    if (rolesToRemove.length > 0) await member.roles.remove(rolesToRemove);
    await interaction.editReply({ content: `-# ${copy.success}` });
  } catch (err) {
    logger.error(`Impossible de mettre à jour les rôles de notification de ${interaction.user.id}:`, err);
    await interaction.editReply({ content: `-# ${copy.error}` }).catch(() => null);
  }

  return true;
}

export default {
  sendRolePanel,
  sendStaffRolePanel,
  handleRolePanelButton,
  handleRolePanelModalSubmit
};
