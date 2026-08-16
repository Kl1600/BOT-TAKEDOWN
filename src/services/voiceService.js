import {
  ChannelType,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags,
  UserSelectMenuBuilder
} from 'discord.js';
import * as logger from '../utils/logger.js';

// Salons vocaux déclencheurs (Join-to-Create)
const GENERATOR_CHANNEL_IDS = new Set([
  '1517850992115450028',
  '1523726944435306559'
]);
const GENERATOR_CHANNEL_LANG = new Map([
  ['1517850992115450028', 'FR'],
  ['1523726944435306559', 'ENG']
]);

const STAFF_WAIT_CHANNEL_IDS = new Set([
  '1527724385828470814',
  '1519738752094830834'
]);
const STAFF_WAIT_ROLE_ID = '1532824877516718141';
const STAFF_WAIT_ALERT_CHANNEL_ID = '1532829411894755368';
const STAFF_WAIT_DELAY_MS = 5_000;

// Stockage en mémoire des salons vocaux dynamiques créés
const dynamicChannels = new Set();
const dynamicChannelOwners = new Map();
const dynamicChannelRecords = new Map();
const staffWaitTimers = new Map();

const VOICE_COPY = {
  FR: {
    title: '## 🎧 Gestion du salon vocal', description: 'Seul le créateur du salon peut utiliser ces commandes.',
    public: 'Public', private: 'Privé', makePublic: 'Rendre public', makePrivate: 'Rendre privé',
    whitelist: 'Liste blanche', blacklist: 'Liste noire', limit: 'Places', kick: 'Expulser',
    ownerOnly: 'Seul le créateur de ce salon peut utiliser cette commande.', missing: 'Ce salon vocal temporaire n\'est plus disponible.',
    privateOnly: 'Passe d\'abord le salon en privé pour gérer la liste blanche.', publicOnly: 'Passe d\'abord le salon en public pour gérer la liste noire.',
    whitelistHelp: 'Choisis un membre à autoriser ou à retirer de la liste blanche.', blacklistHelp: 'Choisis un membre à bloquer ou à retirer de la liste noire.',
    kickHelp: 'Choisis un membre actuellement présent dans ton salon.', add: 'Ajouter', remove: 'Retirer',
    limitTitle: 'Nombre de places', limitLabel: 'Entre 0 et 99 (0 = illimité)', limitPlaceholder: 'Exemple : 5',
    invalidLimit: 'Le nombre de places doit être compris entre 0 et 99.', updated: 'Modification enregistrée.',
    invalidTarget: 'Ce membre n\'est pas dans ton salon vocal.', ownerTarget: 'Tu ne peux pas te cibler toi-même.'
  },
  ENG: {
    title: '## 🎧 Voice channel controls', description: 'Only the channel creator can use these controls.',
    public: 'Public', private: 'Private', makePublic: 'Make public', makePrivate: 'Make private',
    whitelist: 'Whitelist', blacklist: 'Blacklist', limit: 'User limit', kick: 'Kick',
    ownerOnly: 'Only the creator of this channel can use this control.', missing: 'This temporary voice channel is no longer available.',
    privateOnly: 'Make the channel private before managing its whitelist.', publicOnly: 'Make the channel public before managing its blacklist.',
    whitelistHelp: 'Choose a member to add to or remove from the whitelist.', blacklistHelp: 'Choose a member to add to or remove from the blacklist.',
    kickHelp: 'Choose a member currently connected to your channel.', add: 'Add', remove: 'Remove',
    limitTitle: 'User limit', limitLabel: 'Between 0 and 99 (0 = unlimited)', limitPlaceholder: 'Example: 5',
    invalidLimit: 'The user limit must be between 0 and 99.', updated: 'Change saved.',
    invalidTarget: 'This member is not connected to your voice channel.', ownerTarget: 'You cannot target yourself.'
  }
};

function getVoiceCopy(record) {
  return VOICE_COPY[record?.languageTag] || VOICE_COPY.FR;
}

function getConnectOverwriteState(channel, everyoneRoleId) {
  const overwrite = channel.permissionOverwrites.cache.get(everyoneRoleId);
  if (overwrite?.allow.has(PermissionFlagsBits.Connect)) return true;
  if (overwrite?.deny.has(PermissionFlagsBits.Connect)) return false;
  return null;
}

function buildVoiceControlPanel(record) {
  const copy = getVoiceCopy(record);
  const status = record.isPrivate ? copy.private : copy.public;
  return new ContainerBuilder()
    .setAccentColor(record.isPrivate ? 0xED4245 : 0x57F287)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(
      `${copy.title}\n${copy.description}\n\n**Statut :** ${status} • **Propriétaire :** <@${record.ownerId}>`
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`voice_privacy_${record.channelId}`).setLabel(record.isPrivate ? copy.makePublic : copy.makePrivate).setStyle(record.isPrivate ? ButtonStyle.Success : ButtonStyle.Danger),
      new ButtonBuilder().setCustomId(`voice_limit_${record.channelId}`).setLabel(copy.limit).setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setCustomId(`voice_kick_${record.channelId}`).setLabel(copy.kick).setStyle(ButtonStyle.Danger)
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`voice_whitelist_${record.channelId}`).setLabel(copy.whitelist).setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setCustomId(`voice_blacklist_${record.channelId}`).setLabel(copy.blacklist).setStyle(ButtonStyle.Secondary)
    ));
}

async function replyEphemeral(interaction, content, components = []) {
  const payload = components.length
    ? { components, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral }
    : { content, flags: MessageFlags.Ephemeral };
  if (interaction.replied || interaction.deferred) return interaction.followUp(payload).catch(() => null);
  return interaction.reply(payload).catch(() => null);
}

function getOwnedVoiceRecord(interaction, channelId) {
  const record = dynamicChannelRecords.get(channelId);
  if (!record) return { record: null, error: VOICE_COPY.FR.missing };
  const copy = getVoiceCopy(record);
  if (record.ownerId !== interaction.user.id) return { record: null, error: copy.ownerOnly };
  return { record, error: null };
}

async function updateVoiceControlPanel(interaction, record) {
  const channel = interaction.guild?.channels.cache.get(record.channelId)
    || await interaction.guild?.channels.fetch(record.channelId).catch(() => null);
  if (!channel?.isTextBased() || !record.panelMessageId) return;
  const message = await channel.messages.fetch(record.panelMessageId).catch(() => null);
  if (!message) return;
  await message.edit({ components: [buildVoiceControlPanel(record)], flags: MessageFlags.IsComponentsV2 }).catch(() => null);
}

function buildUserManagementPanel(record, type) {
  const copy = getVoiceCopy(record);
  const isWhitelist = type === 'whitelist';
  const help = isWhitelist ? copy.whitelistHelp : copy.blacklistHelp;
  const label = isWhitelist ? copy.whitelist : copy.blacklist;
  return new ContainerBuilder()
    .setAccentColor(0x5865F2)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${label}\n${help}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(`voice_${type}_add_${record.channelId}`).setPlaceholder(`${copy.add} • ${label}`).setMinValues(1).setMaxValues(1)
    ))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(`voice_${type}_remove_${record.channelId}`).setPlaceholder(`${copy.remove} • ${label}`).setMinValues(1).setMaxValues(1)
    ));
}

function buildKickPanel(record) {
  const copy = getVoiceCopy(record);
  return new ContainerBuilder()
    .setAccentColor(0xED4245)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(`## ${copy.kick}\n${copy.kickHelp}`))
    .addActionRowComponents(new ActionRowBuilder().addComponents(
      new UserSelectMenuBuilder().setCustomId(`voice_kick_select_${record.channelId}`).setPlaceholder(copy.kick).setMinValues(1).setMaxValues(1)
    ));
}

function sanitizeVoiceName(name) {
  return String(name ?? '')
    .replace(/[\\/\[\]#:*?? "<>|]/g, '')
    .trim()
    .slice(0, 90) || 'salon-vocal';
}

function getStaffWaitKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getStatusLabel(status) {
  switch (status) {
    case 'claimed':
      return 'Pris en charge';
    case 'left':
      return 'A quitté la vocal';
    case 'waiting':
    default:
      return 'Attente prise en charge';
  }
}

function buildStaffWaitPanel(userId, joinedAt, status) {
  const descriptionLines = [`**<@${userId}>** est en attente staff.`];

  if (status === 'waiting') {
    descriptionLines.push(`Attend depuis <t:${Math.floor(joinedAt / 1000)}:R>.`);
  }

  descriptionLines.push(`-# Merci d'essayer de prendre en charge le membre rapidement.`);

  const container = new ContainerBuilder()
    .setAccentColor(0xED4245)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(descriptionLines.join('\n'))
    )
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`staff_wait_status_${status}`)
          .setLabel(getStatusLabel(status))
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      )
    );

  return container;
}

function getOrCreateStaffWaitRecord(guildId, userId) {
  const key = getStaffWaitKey(guildId, userId);
  let record = staffWaitTimers.get(key);
  if (!record) {
    record = {
      guildId,
      userId,
      status: 'waiting',
      alerted: false,
      joinedAt: Date.now(),
      channelId: null,
      timeoutId: null,
      messageId: null,
      messageChannelId: null
    };
    staffWaitTimers.set(key, record);
  }
  return record;
}

function clearStaffWaitTimer(record) {
  if (!record?.timeoutId) return;
  clearTimeout(record.timeoutId);
  record.timeoutId = null;
}

async function updateStaffWaitAlert(client, record, nextStatus) {
  try {
    if (!record?.alerted || !record.messageId || !record.messageChannelId) return;

    const alertChannel = client.channels.cache.get(record.messageChannelId)
      || await client.channels.fetch(record.messageChannelId).catch(() => null);
    if (!alertChannel?.isTextBased()) return;

    const message = await alertChannel.messages.fetch(record.messageId).catch(() => null);
    if (!message) return;

    record.status = nextStatus;
    await message.edit({
      content: `<@&${STAFF_WAIT_ROLE_ID}>`,
      components: [buildStaffWaitPanel(record.userId, record.joinedAt, nextStatus)],
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    clearStaffWaitTimer(record);
    staffWaitTimers.delete(getStaffWaitKey(record.guildId, record.userId));
  } catch (err) {
    logger.error('Erreur lors de la mise à jour du ping staff vocal:', err);
  }
}

async function sendStaffWaitAlert(client, record) {
  try {
    const guild = client.guilds.cache.get(record.guildId) || await client.guilds.fetch(record.guildId).catch(() => null);
    if (!guild) return;

    const member = await guild.members.fetch(record.userId).catch(() => null);
    if (!member?.voice?.channelId || member.voice.channelId !== record.channelId) return;
    if (!STAFF_WAIT_CHANNEL_IDS.has(member.voice.channelId)) return;

    const alertChannel = client.channels.cache.get(STAFF_WAIT_ALERT_CHANNEL_ID)
      || await client.channels.fetch(STAFF_WAIT_ALERT_CHANNEL_ID).catch(() => null);
    if (!alertChannel?.isTextBased()) return;

    const message = await alertChannel.send({
      content: `<@&${STAFF_WAIT_ROLE_ID}>`,
      components: [buildStaffWaitPanel(record.userId, record.joinedAt, 'waiting')],
      flags: MessageFlags.IsComponentsV2
    }).catch(() => null);

    if (!message) return;

    record.alerted = true;
    record.messageId = message.id;
    record.messageChannelId = alertChannel.id;
    record.status = 'waiting';
    clearStaffWaitTimer(record);
  } catch (err) {
    logger.error('Erreur lors de l\'envoi du ping staff vocal:', err);
  }
}

function scheduleStaffWaitAlert(newState) {
  const member = newState.member;
  const channel = newState.channel;
  if (!member || !channel) return;
  if (!STAFF_WAIT_CHANNEL_IDS.has(channel.id)) return;

  const record = getOrCreateStaffWaitRecord(member.guild.id, member.id);
  record.channelId = channel.id;
  record.joinedAt = Date.now();
  record.status = 'waiting';
  clearStaffWaitTimer(record);

  record.timeoutId = setTimeout(() => {
    void sendStaffWaitAlert(member.client, record);
  }, STAFF_WAIT_DELAY_MS);
}

/**
 * Gère la création d'un salon vocal dynamique si le membre rejoint le salon déclencheur
 */
export async function handleJoinGenerator(newState) {
  const member = newState.member;
  const channel = newState.channel;
  if (!channel || !member) return;

  if (!GENERATOR_CHANNEL_IDS.has(channel.id)) return;

  try {
    const languageTag = GENERATOR_CHANNEL_LANG.get(channel.id) || 'FR';
    const channelName = `》${sanitizeVoiceName(member.displayName)} [${languageTag}]`;

    const newVoice = await channel.guild.channels.create({
      name: channelName,
      type: ChannelType.GuildVoice,
      parent: channel.parentId,
      permissionOverwrites: [
        ...channel.permissionOverwrites.cache.values(),
        {
          id: member.id,
          allow: [
            PermissionFlagsBits.ViewChannel,
            PermissionFlagsBits.Connect,
            PermissionFlagsBits.Speak,
            PermissionFlagsBits.MoveMembers,
            PermissionFlagsBits.MuteMembers,
            PermissionFlagsBits.DeafenMembers
          ]
        }
      ]
    });

    dynamicChannels.add(newVoice.id);
    dynamicChannelOwners.set(newVoice.id, member.id);

    const record = {
      channelId: newVoice.id,
      ownerId: member.id,
      languageTag,
      isPrivate: false,
      whitelist: new Set(),
      blacklist: new Set(),
      baseEveryoneConnect: getConnectOverwriteState(newVoice, newVoice.guild.roles.everyone.id),
      panelMessageId: null
    };
    dynamicChannelRecords.set(newVoice.id, record);

    await member.voice.setChannel(newVoice).catch(async () => {
      dynamicChannels.delete(newVoice.id);
      dynamicChannelOwners.delete(newVoice.id);
      dynamicChannelRecords.delete(newVoice.id);
      await newVoice.delete().catch(() => null);
    });

    if (member.voice.channelId === newVoice.id && newVoice.isTextBased()) {
      const panelMessage = await newVoice.send({
        components: [buildVoiceControlPanel(record)],
        flags: MessageFlags.IsComponentsV2
      }).catch(err => {
        logger.error(`Impossible d'envoyer le panneau du salon vocal ${newVoice.id}:`, err);
        return null;
      });
      record.panelMessageId = panelMessage?.id || null;
    }
  } catch (err) {
    logger.error('Erreur lors de la création du salon vocal dynamique:', err);
  }
}

/**
 * Supprime le salon vocal dynamique uniquement quand il est vide
 */
export async function handleLeaveDynamic(oldState) {
  const oldChannel = oldState.channel;
  if (!oldChannel) return;

  if (!dynamicChannels.has(oldChannel.id)) return;

  try {
    const remainingMembers = oldChannel.members?.size ?? 0;
    if (remainingMembers > 0) return;

    dynamicChannels.delete(oldChannel.id);
    dynamicChannelOwners.delete(oldChannel.id);
    dynamicChannelRecords.delete(oldChannel.id);
    await oldChannel.delete().catch(() => null);
  } catch (err) {
    logger.error(`Erreur lors de la suppression du salon dynamique ${oldChannel.id}:`, err);
  }
}

export async function handleVoiceButton(interaction) {
  const match = interaction.customId.match(/^voice_(privacy|limit|kick|whitelist|blacklist)_(\d+)$/);
  if (!match) return false;

  const [, action, channelId] = match;
  const { record, error } = getOwnedVoiceRecord(interaction, channelId);
  if (!record) {
    await replyEphemeral(interaction, error);
    return true;
  }

  const copy = getVoiceCopy(record);
  const channel = interaction.guild?.channels.cache.get(channelId)
    || await interaction.guild?.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    await replyEphemeral(interaction, copy.missing);
    return true;
  }

  if (action === 'privacy') {
    record.isPrivate = !record.isPrivate;
    await channel.permissionOverwrites.edit(channel.guild.roles.everyone.id, {
      Connect: record.isPrivate ? false : record.baseEveryoneConnect
    });

    for (const userId of record.whitelist) {
      await channel.permissionOverwrites.edit(userId, {
        ViewChannel: record.isPrivate ? true : null,
        Connect: record.isPrivate ? true : null
      });
    }
    await updateVoiceControlPanel(interaction, record);
    await replyEphemeral(interaction, copy.updated);
    return true;
  }

  if (action === 'limit') {
    const modal = new ModalBuilder()
      .setCustomId(`voice_limit_modal_${channelId}`)
      .setTitle(copy.limitTitle)
      .addComponents(new ActionRowBuilder().addComponents(
        new TextInputBuilder()
          .setCustomId('voice_limit_value')
          .setLabel(copy.limitLabel)
          .setPlaceholder(copy.limitPlaceholder)
          .setStyle(TextInputStyle.Short)
          .setRequired(true)
          .setMaxLength(2)
          .setValue(String(channel.userLimit || 0))
      ));
    await interaction.showModal(modal);
    return true;
  }

  if (action === 'kick') {
    await replyEphemeral(interaction, '', [buildKickPanel(record)]);
    return true;
  }

  if (action === 'whitelist') {
    if (!record.isPrivate) {
      await replyEphemeral(interaction, copy.privateOnly);
      return true;
    }
    await replyEphemeral(interaction, '', [buildUserManagementPanel(record, 'whitelist')]);
    return true;
  }

  if (record.isPrivate) {
    await replyEphemeral(interaction, copy.publicOnly);
    return true;
  }
  await replyEphemeral(interaction, '', [buildUserManagementPanel(record, 'blacklist')]);
  return true;
}

export async function handleVoiceUserSelect(interaction) {
  const listMatch = interaction.customId.match(/^voice_(whitelist|blacklist)_(add|remove)_(\d+)$/);
  const kickMatch = interaction.customId.match(/^voice_kick_select_(\d+)$/);
  if (!listMatch && !kickMatch) return false;

  const channelId = kickMatch ? kickMatch[1] : listMatch[3];
  const { record, error } = getOwnedVoiceRecord(interaction, channelId);
  if (!record) {
    await replyEphemeral(interaction, error);
    return true;
  }

  const copy = getVoiceCopy(record);
  const channel = interaction.guild?.channels.cache.get(channelId)
    || await interaction.guild?.channels.fetch(channelId).catch(() => null);
  const userId = interaction.values[0];
  if (!channel || !userId) {
    await replyEphemeral(interaction, copy.missing);
    return true;
  }

  if (kickMatch) {
    if (userId === record.ownerId) {
      await replyEphemeral(interaction, copy.ownerTarget);
      return true;
    }
    const target = channel.members.get(userId);
    if (!target) {
      await replyEphemeral(interaction, copy.invalidTarget);
      return true;
    }
    await target.voice.setChannel(null);
    await replyEphemeral(interaction, copy.updated);
    return true;
  }

  const [, type, operation] = listMatch;
  if (type === 'whitelist' && !record.isPrivate) {
    await replyEphemeral(interaction, copy.privateOnly);
    return true;
  }
  if (type === 'blacklist' && record.isPrivate) {
    await replyEphemeral(interaction, copy.publicOnly);
    return true;
  }
  if (userId === record.ownerId) {
    await replyEphemeral(interaction, copy.ownerTarget);
    return true;
  }

  const list = type === 'whitelist' ? record.whitelist : record.blacklist;
  const oppositeList = type === 'whitelist' ? record.blacklist : record.whitelist;
  if (operation === 'add') {
    list.add(userId);
    oppositeList.delete(userId);
    await channel.permissionOverwrites.edit(userId, {
      ViewChannel: type === 'whitelist' ? true : null,
      Connect: type === 'whitelist' ? true : false
    });
  } else {
    list.delete(userId);
    await channel.permissionOverwrites.edit(userId, { ViewChannel: null, Connect: null });
  }

  await replyEphemeral(interaction, copy.updated);
  return true;
}

export async function handleVoiceModalSubmit(interaction) {
  const match = interaction.customId.match(/^voice_limit_modal_(\d+)$/);
  if (!match) return false;

  const channelId = match[1];
  const { record, error } = getOwnedVoiceRecord(interaction, channelId);
  if (!record) {
    await replyEphemeral(interaction, error);
    return true;
  }

  const copy = getVoiceCopy(record);
  const rawValue = interaction.fields.getTextInputValue('voice_limit_value').trim();
  const limit = Number(rawValue);
  if (!/^\d{1,2}$/.test(rawValue) || !Number.isInteger(limit) || limit < 0 || limit > 99) {
    await replyEphemeral(interaction, copy.invalidLimit);
    return true;
  }

  const channel = interaction.guild?.channels.cache.get(channelId)
    || await interaction.guild?.channels.fetch(channelId).catch(() => null);
  if (!channel) {
    await replyEphemeral(interaction, copy.missing);
    return true;
  }

  await channel.setUserLimit(limit);
  await replyEphemeral(interaction, copy.updated);
  return true;
}

export function handleStaffWaitVoiceState(oldState, newState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user?.bot) return;

  const oldChannelId = oldState.channelId;
  const newChannelId = newState.channelId;
  const oldIsTarget = Boolean(oldChannelId && STAFF_WAIT_CHANNEL_IDS.has(oldChannelId));
  const newIsTarget = Boolean(newChannelId && STAFF_WAIT_CHANNEL_IDS.has(newChannelId));
  const recordKey = getStaffWaitKey(member.guild.id, member.id);
  const record = staffWaitTimers.get(recordKey);

  if (!oldIsTarget && newIsTarget) {
    scheduleStaffWaitAlert(newState);
    return;
  }

  if (oldIsTarget && newIsTarget && oldChannelId !== newChannelId) {
    scheduleStaffWaitAlert(newState);
    return;
  }

  if (oldIsTarget && !newIsTarget) {
    if (record) {
      clearStaffWaitTimer(record);
      if (record.alerted) {
        const nextStatus = newChannelId ? 'claimed' : 'left';
        void updateStaffWaitAlert(member.client, record, nextStatus);
      } else {
        staffWaitTimers.delete(recordKey);
      }
    }
    return;
  }

  if (!newChannelId && record && record.alerted) {
    void updateStaffWaitAlert(member.client, record, 'left');
  }
}

export default {
  handleJoinGenerator,
  handleLeaveDynamic,
  handleStaffWaitVoiceState,
  handleVoiceButton,
  handleVoiceUserSelect,
  handleVoiceModalSubmit
};
