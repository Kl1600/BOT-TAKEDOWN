import { ChannelType, PermissionFlagsBits, ActionRowBuilder, ButtonBuilder, ButtonStyle, ContainerBuilder, StringSelectMenuBuilder, TextDisplayBuilder, MessageFlags, ModalBuilder, TextInputBuilder, TextInputStyle } from 'discord.js';
import { sendV2Container } from '../utils/v2Helper.js';
import config from '../config/config.js';
import { getLanguage, t } from '../utils/language.js';
import dbService from '../database/dbProxy.js';
import { logTicket } from './logService.js';
import { generateTranscript } from '../utils/transcriptor.js';

function slugifyChannelName(input) {
  const cleaned = input
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');

  return cleaned || 'ticket';
}


const TICKET_CATEGORY_OPTIONS = {
  fr: [
    { label: 'Support/Autres', value: '1527610387703271484' },
    { label: 'Partenariats', value: '1527610362164281414' },
    { label: 'Tournois/Events', value: '1527610448315154522' },
    { label: 'Crew', value: '1533877304520871976' },
    { label: 'Sanction', value: '1527611704077455440' },
    { label: 'Streamer', value: '1527612393205661716' }
  ],
  en: [
    { label: 'Support/Other', value: '1527610402509164716' },
    { label: 'Partner', value: '1527610421891305502' },
    { label: 'Tournament/Event', value: '1527610434964820109' },
    { label: 'Crew', value: '1533877082277281792' },
    { label: 'Sanction', value: '1527611683760242789' },
    { label: 'Streamer', value: '1527612438441230337' }
  ]
};

export function buildTicketPanelContainer(lang, member = null) {
  const hasFrenchRole = Boolean(member?.roles?.cache?.has(config.roles.fr));
  const hasEnglishRole = Boolean(member?.roles?.cache?.has(config.roles.en));
  const disableFrenchSelect = hasEnglishRole && !hasFrenchRole;
  const disableEnglishSelect = hasFrenchRole;
  const panelLang = 'fr';
  const text = new TextDisplayBuilder().setContent(
    `### ${t(panelLang, 'commands.ticket.panel.title').toUpperCase()}\n\n` +
    `${t(panelLang, 'commands.ticket.panel.description')}`
  );

  const frenchSelect = new StringSelectMenuBuilder()
    .setCustomId('ticket_category_fr')
    .setPlaceholder('🇫🇷 Choisir :')
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(disableFrenchSelect);
  for (const option of TICKET_CATEGORY_OPTIONS.fr) {
    frenchSelect.addOptions(option);
  }

  const englishSelect = new StringSelectMenuBuilder()
    .setCustomId('ticket_category_en')
    .setPlaceholder('🇬🇧 Choose :')
    .setMinValues(1)
    .setMaxValues(1)
    .setDisabled(disableEnglishSelect);
  for (const option of TICKET_CATEGORY_OPTIONS.en) {
    englishSelect.addOptions(option);
  }

  return new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(new ActionRowBuilder().addComponents(frenchSelect))
    .addActionRowComponents(new ActionRowBuilder().addComponents(englishSelect));
}
/**
 * Clic sur "Ouvrir un ticket" â†’ ouvre directement le modal de raison (FR uniquement)
 */
export async function handleTicketOpenClick(interaction) {
  const user = interaction.user;
  const lang = await getLanguage(interaction.member);

  // Vérifie si le membre a déjà un ticket ouvert
  const existingTicket = await dbService.getUserActiveTicket(user.id);
  if (existingTicket) {
    const channel = interaction.guild.channels.cache.get(existingTicket.channel_id);
    if (channel) {
      return interaction.reply({
        content: `${t(lang, 'errors.ticket_already_exists')} (<#${channel.id}>)`,
        flags: MessageFlags.Ephemeral
      });
    } else {
      await dbService.deleteTicket(existingTicket.channel_id);
    }
  }

  // Ouvre directement le modal de raison
  const modal = new ModalBuilder()
    .setCustomId('ticket_modal_fr')
    .setTitle(t(lang, 'tickets.modal.title'));

  const reasonInput = new TextInputBuilder()
    .setCustomId('ticket_reason_input')
    .setLabel(t(lang, 'tickets.modal.label'))
    .setPlaceholder(t(lang, 'tickets.modal.placeholder'))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

export async function handleTicketCategorySelect(interaction) {
  if (!interaction.customId.startsWith('ticket_category_')) return false;

  const selectedLang = interaction.customId.endsWith('_en') ? 'en' : 'fr';
  const selectedCategoryId = interaction.values?.[0];
  if (!selectedCategoryId) {
    await interaction.reply({
      content: 'Catégorie invalide.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return true;
  }

  const existingTicket = await dbService.getUserActiveTicket(interaction.user.id);
  if (existingTicket) {
    const channel = interaction.guild.channels.cache.get(existingTicket.channel_id);
    if (channel) {
      await interaction.reply({
        content: `${t(selectedLang, 'errors.ticket_already_exists')} (<#${channel.id}>)`,
        flags: MessageFlags.Ephemeral
      }).catch(() => null);
      return true;
    }
    await dbService.deleteTicket(existingTicket.channel_id);
  }

  const matchedCategory = (TICKET_CATEGORY_OPTIONS[selectedLang] || []).find(option => option.value === selectedCategoryId);
  const reason = matchedCategory ? matchedCategory.label : t(selectedLang, 'commands.ticket.panel.title');

  await createTicketForUser(interaction, selectedLang, selectedCategoryId, reason);
  return true;
}

/**
 * @deprecated Plus utilisé — la langue est maintenant fixée à FR dès l'ouverture.
 * Conservé pour compatibilité avec d'éventuels anciens boutons en cache Discord.
 */
export async function handleTicketLangClick(interaction) {
  const lang = await getLanguage(interaction.member);

  // Redirige vers le modal FR directement
  const modal = new ModalBuilder()
    .setCustomId('ticket_modal_fr')
    .setTitle(t(lang, 'tickets.modal.title'));

  const reasonInput = new TextInputBuilder()
    .setCustomId('ticket_reason_input')
    .setLabel(t(lang, 'tickets.modal.label'))
    .setPlaceholder(t(lang, 'tickets.modal.placeholder'))
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(500);

  modal.addComponents(new ActionRowBuilder().addComponents(reasonInput));
  await interaction.showModal(modal);
}

async function createTicketForUser(interaction, selectedLang, selectedCategoryId, reason) {
  const guild = interaction.guild;
  const user = interaction.user;
  const ticketMenuLang = selectedLang;
  const logLang = 'fr';
  const ticketParentCategoryId = selectedCategoryId || (selectedLang === 'en'
    ? (config.tickets.categoryEnId || config.tickets.categoryId)
    : (config.tickets.categoryFrId || config.tickets.categoryId));

  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);
  await dbService.setUserLanguage(user.id, selectedLang);

  const permissionOverwrites = [
    {
      id: guild.roles.everyone.id,
      deny: [PermissionFlagsBits.ViewChannel]
    },
    {
      id: user.id,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    },
    {
      id: config.roles.admin,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    }
  ];

  if (config.tickets.supportRoleId && config.tickets.supportRoleId !== config.roles.admin) {
    permissionOverwrites.push({
      id: config.tickets.supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  const ticketNumber = await dbService.reserveNextTicketNumber(user.id);
  const channelName = `ticket-${ticketNumber}-${slugifyChannelName(user.username)}`.slice(0, 100);
  const channel = await guild.channels.create({
    name: channelName,
    type: ChannelType.GuildText,
    parent: ticketParentCategoryId,
    permissionOverwrites
  }).catch(err => {
    console.error('Failed to create ticket channel:', err);
    return null;
  });

  if (!channel) {
    return interaction.editReply({
      content: t(selectedLang, 'errors.ticket_creation_failed')
    }).catch(() => null);
  }

  await dbService.createTicket(channel.id, user.id, ticketNumber, reason);

  const creatorLabel = t(ticketMenuLang, 'tickets.status.creator_label');
  const reasonLabel = t(ticketMenuLang, 'tickets.reason');

  const welcomeText = new TextDisplayBuilder().setContent(
    `TICKET DE ${user.username.toUpperCase()}\n\n` +
    `**${creatorLabel}** : <@${user.id}>\n` +
    `**${reasonLabel}** : ${reason}`
  );

  const closeButton = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel(t(ticketMenuLang, 'tickets.buttons.close'))
    .setStyle(ButtonStyle.Secondary);

  const row = new ActionRowBuilder().addComponents(closeButton);

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(welcomeText)
    .addActionRowComponents(row);

  const staffPingRoleId = config.notifications?.ticket || config.tickets.supportRoleId;
  const staffPing = staffPingRoleId ? ` <@&${staffPingRoleId}>` : '';
  await channel.send({ content: `<@${user.id}>${staffPing}` }).catch(() => null);
  await sendV2Container(channel, container);

  await interaction.editReply({ content: `Ticket créé : <#${channel.id}>` }).catch(() => null);

  await dbService.addLog('TICKET_OPEN', user.id, `Created ticket ${channel.name} | Reason: ${reason}`, channel.id);
  await logTicket(interaction.client, {
    title: t(logLang, 'tickets.logs.open_title'),
    color: config.colors.primary,
    fields: [
      { name: t(logLang, 'tickets.logs.fields.ticket'), value: `<#${channel.id}>`, inline: true },
      { name: t(logLang, 'tickets.logs.fields.creator'), value: `<@${user.id}>`, inline: true }
    ]
  });
}

/**
 * Handle modal submit - Creates ticket channel and sends V2 welcome message
 */
export async function handleTicketModalSubmit(interaction) {
  const userLang = await getLanguage(interaction.member);
  const modalMatch = interaction.customId.match(/^ticket_modal_(fr|en)_(\d{18,20})$/);
  const selectedLang = modalMatch?.[1] || userLang;
  const selectedCategoryId = modalMatch?.[2] || null;
  const reason = interaction.fields.getTextInputValue('ticket_reason_input');

  await createTicketForUser(interaction, selectedLang, selectedCategoryId, reason);
}

/**
 * Handle closure of ticket channel (lock sender permissions, present control actions)
 */
export async function handleTicketClose(interaction) {
  const channel = interaction.channel;
  const user = interaction.user;
  const lang = await getLanguage(interaction.member);

  const ticket = await dbService.getTicket(channel.id);
  if (!ticket) {
    return interaction.reply({
      content: t(lang, 'errors.ticket_not_found'),
      flags: MessageFlags.Ephemeral
    });
  }

  if (ticket.status === 'closed') {
    return interaction.reply({
      content: t(lang, 'errors.ticket_already_closed'),
      flags: MessageFlags.Ephemeral
    });
  }

  await dbService.closeTicket(channel.id, user.id);
  const creatorId = ticket.creator_id;

  await interaction.reply({
    content: 'Fermeture du ticket dans 3 secondes.',
  });

  // Logs
  await dbService.addLog('TICKET_CLOSE', user.id, `Closed ticket ${channel.name}`, channel.id);
  await logTicket(interaction.client, {
    title: t(lang, 'tickets.logs.close_title'),
    color: config.colors.secondary,
    fields: [
      { name: t(lang, 'tickets.logs.fields.ticket'), value: channel.name, inline: true },
      { name: t(lang, 'tickets.logs.fields.creator'), value: `<@${creatorId}>`, inline: true },
      { name: t(lang, 'tickets.logs.fields.closed_by'), value: `<@${user.id}>`, inline: true }
    ]
  });

  setTimeout(async () => {
    try {
      const htmlTranscript = await generateTranscript(channel, 'html');
      const txtTranscript = await generateTranscript(channel, 'txt');
      const creatorUser = await interaction.client.users.fetch(creatorId).catch(() => null);

      if (creatorUser) {
        await creatorUser.send({
          content: `Voici le transcript du ticket \`${channel.name}\`.`,
          files: [htmlTranscript, txtTranscript]
        }).catch(() => null);
      }
    } catch (error) {
      console.error('Failed to generate or send ticket transcript:', error);
    }

    await channel.delete().catch(err => {
      console.error('Failed to delete ticket channel:', err);
    });
  }, 3000);
}

/**
 * Handle reopening of a closed ticket
 */
export async function handleTicketReopen(interaction) {
  const channel = interaction.channel;
  const user = interaction.user;
  const lang = await getLanguage(interaction.member);

  const ticket = await dbService.getTicket(channel.id);
  if (!ticket) {
    return interaction.reply({
      content: t(lang, 'errors.ticket_not_found'),
      flags: MessageFlags.Ephemeral
    });
  }

  // Update DB
  await dbService.reopenTicket(channel.id);

  // Restore creator write and read access
  const creatorId = ticket.creator_id;
  await channel.permissionOverwrites.edit(creatorId, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  }).catch(() => null);

  // Delete control message
  await interaction.message.delete().catch(() => null);

  // Send reopening notification with a Close button at the bottom
  const reopenedText = new TextDisplayBuilder().setContent(t(lang, 'tickets.status.reopened'));
  const closeBtn = new ButtonBuilder()
    .setCustomId('ticket_close')
    .setLabel(t(lang, 'tickets.buttons.close'))
    .setStyle(ButtonStyle.Secondary);
  const row = new ActionRowBuilder().addComponents(closeBtn);

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(reopenedText)
    .addActionRowComponents(row);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });

  // Audit Logs
  await dbService.addLog('TICKET_REOPEN', user.id, `Reopened ticket ${channel.name}`, channel.id);
}

/**
 * Generate transcripts (HTML + TXT) and send to both ticket channel and logs channel
 */
export async function handleTicketTranscript(interaction) {
  const channel = interaction.channel;
  const user = interaction.user;
  const lang = await getLanguage(interaction.member);

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const ticket = await dbService.getTicket(channel.id);
  const creatorId = ticket ? ticket.creator_id : user.id;

  // Generate attachments
  const htmlTranscript = await generateTranscript(channel, 'html');
  const txtTranscript = await generateTranscript(channel, 'txt');

  await interaction.editReply({
    content: `✅ Transcription générée pour le ticket #${channel.name}`,
    files: [htmlTranscript, txtTranscript]
  });

  // Copy transcripts to logs channel
  const logChannelId = config.channels.logs;
  if (logChannelId) {
    const logChannel = await interaction.guild.channels.fetch(logChannelId).catch(() => null);
    if (logChannel && logChannel.isTextBased()) {
      await logChannel.send({
        content: `Transcript généré par <@${user.id}> pour le ticket \`${channel.name}\`\nCréateur : <@${creatorId}>`,
        files: [htmlTranscript, txtTranscript]
      });
    }
  }

  // Audit Logs
  await dbService.addLog('TICKET_TRANSCRIPT', user.id, `Generated transcripts for ${channel.name}`, channel.id);
}

/**
 * Handle deletion of ticket channel (5 seconds warning, then delete)
 */
export async function handleTicketDelete(interaction) {
  const channel = interaction.channel;
  const user = interaction.user;
  const lang = await getLanguage(interaction.member);

  const ticket = await dbService.getTicket(channel.id);
  const creatorId = ticket ? ticket.creator_id : 'unknown';

  const deletingText = new TextDisplayBuilder().setContent(t(lang, 'tickets.status.deleting'));
  const container = new ContainerBuilder()
    .setAccentColor(config.colors.error)
    .addTextDisplayComponents(deletingText);

  await interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });

  // Logs (must execute before deleting the channel so name/data is referenced)
  await dbService.addLog('TICKET_DELETE', user.id, `Deleted ticket ${channel.name}`, channel.id);
  await logTicket(interaction.client, {
    title: t(lang, 'tickets.logs.delete_title'),
    color: config.colors.error,
    fields: [
      { name: t(lang, 'tickets.logs.fields.ticket'), value: channel.name, inline: true },
      { name: t(lang, 'tickets.logs.fields.creator'), value: `<@${creatorId}>`, inline: true },
      { name: t(lang, 'tickets.logs.fields.deleted_by'), value: `<@${user.id}>`, inline: true }
    ]
  });

  // Clean DB ticket entry
  await dbService.deleteTicket(channel.id);

  // Deletion timeout (5 seconds warning)
  setTimeout(() => {
    channel.delete().catch(err => {
      console.error('Failed to delete ticket channel:', err);
    });
  }, 5000);
}











