import {
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  ChannelType
} from 'discord.js';
import { logSanction, logGeneral, logTicket } from './logService.js';
import dbService from '../database/dbProxy.js';
import config from '../config/config.js';
import { generateTranscript } from '../utils/transcriptor.js';
import { getLanguage, t } from '../utils/language.js';
import * as logger from '../utils/logger.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function isStaffOrAdmin(member) {
  return (
    member.roles.cache.has(config.roles.admin)
  );
}

export function hasTicketManagementAccess(member) {
  return (
    isStaffOrAdmin(member) ||
    member?.roles?.cache?.has('1509613216463065243')
  );
}

export function extractDiscordId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

export async function resolveMemberFromInput(guild, input, fallbackMember = null) {
  if (fallbackMember) return fallbackMember;

  const userId = extractDiscordId(input);
  if (!userId) return null;

  return guild.members.fetch(userId).catch(() => null);
}

async function autoDeleteUsageResponse(context, response) {
  setTimeout(async () => {
    try {
      if (typeof context.deleteReply === 'function') {
        await context.deleteReply().catch(() => null);
      } else if (response?.delete) {
        await response.delete().catch(() => null);
      }
    } catch (err) {
      logger.warn(`Impossible de supprimer le message d'utilisation: ${err?.message || err}`);
    }
  }, 8000);
}

function isPermissionDeniedMessage(msg) {
  return /permission|insuffis|autoris/i.test(String(msg ?? ''));
}

async function autoDeletePermissionResponse(context, response) {
  setTimeout(async () => {
    try {
      if (typeof context.deleteReply === 'function') {
        await context.deleteReply().catch(() => null);
      } else if (response?.delete) {
        await response.delete().catch(() => null);
      }
    } catch (err) {
      logger.warn(`Impossible de supprimer le message de permission: ${err?.message || err}`);
    }
  }, 1000);
}

export async function replyPermissionDenied(context, msg) {
  const lang = await getLanguage(context?.member || context?.author || null);
  const localizedMessage = lang === 'en'
    ? 'Permissions insufficient.'
    : 'Permissions insuffisantes.';
  const isInteraction = typeof context.editReply === 'function' || typeof context.deferReply === 'function';
  const payload = {
    content: `❌ ${localizedMessage}`,
    flags: isInteraction ? MessageFlags.Ephemeral : undefined
  };

  if (typeof context.editReply === 'function' && (context.deferred || context.replied)) {
    await context.editReply(payload).catch(() => null);
    await autoDeletePermissionResponse(context);
    return null;
  }

  if (typeof context.channel?.send === 'function' && typeof context.delete === 'function') {
    const response = await context.channel.send({ content: `❌ ${localizedMessage}` }).catch(() => null);
    await context.delete().catch(() => null);
    await autoDeletePermissionResponse(context, response);
    return response;
  }

  if (typeof context.reply === 'function') {
    const response = await context.reply(payload).catch(() => null);
    await autoDeletePermissionResponse(context, response);
    return response;
  }

  return null;
}

export async function replyUsage(context, usageMessage) {
  if (typeof context.editReply === 'function' && (context.deferred || context.replied)) {
    await context.editReply({ content: usageMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
    await autoDeleteUsageResponse(context);
    return null;
  }

  if (typeof context.reply === 'function') {
    const response = await context.reply({ content: usageMessage }).catch(() => null);
    await autoDeleteUsageResponse(context, response);
    return response;
  }

  return null;
}

export function parseDurationInput(rawValue) {
  const value = String(rawValue ?? '').trim().toLowerCase();
  const match = value.match(/^(\d+)\s*([smhdw]?)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2] || 'd';
  if (!Number.isInteger(amount) || amount <= 0) return null;

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

/**
 * Réponse V2 succès (slash uniquement — après deferReply ou directement)
 */
export function replyOk(interaction, msg, color = 0x57F287) {
  const flags = typeof interaction?.editReply === 'function' || typeof interaction?.deferReply === 'function'
    ? MessageFlags.Ephemeral
    : undefined;
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content: msg, flags }).catch(() => null);
  }
  return interaction.reply({ content: msg, flags }).catch(() => null);
}

export function replyErr(interaction, msg) {
  if (isPermissionDeniedMessage(msg)) {
    return replyPermissionDenied(interaction, msg);
  }
  const flags = typeof interaction?.editReply === 'function' || typeof interaction?.deferReply === 'function'
    ? MessageFlags.Ephemeral
    : undefined;
  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({ content: `❌ ${msg}`, flags }).catch(() => null);
  }
  return interaction.reply({ content: `❌ ${msg}`, flags }).catch(() => null);
}
/**
 * Réponse simple pour les commandes préfixées
 */
export async function prefixReply(message, msg) {
  if (isPermissionDeniedMessage(msg)) {
    return replyPermissionDenied(message, msg);
  }
  return message.reply({ content: msg }).catch(() => null);
}

/**
 * Durées de mute pour les slash commands
 */
export const MUTE_DURATIONS = {
  '60s': 60, '5min': 300, '10min': 600, '30min': 1800,
  '1h': 3600, '6h': 21600, '12h': 43200, '24h': 86400,
  '7j': 604800, '28j': 2419200
};

const tempBanTimers = new Map();
let tempBanSweepTimer = null;

function clearTempBanTimer(key) {
  const timer = tempBanTimers.get(key);
  if (timer) {
    clearTimeout(timer);
    tempBanTimers.delete(key);
  }
}

async function processTempBanRecord(client, record) {
  if (!record?.guild_id || !record?.user_id) return false;

  const key = `${record.guild_id}:${record.user_id}`;
  clearTempBanTimer(key);

  const guild = client.guilds.cache.get(record.guild_id) || await client.guilds.fetch(record.guild_id).catch(() => null);
  if (!guild) {
    await dbService.deleteTempBan(record.guild_id, record.user_id).catch(() => null);
    return false;
  }

  await guild.members.unban(record.user_id, `[tempban] ${record.reason || 'Tempban expir?? '}`).catch(err => {
    logger.warn(`Impossible de lever le tempban ${record.user_id} sur ${record.guild_id}: ${err?.message || err}`);
  });

  await dbService.deleteTempBan(record.guild_id, record.user_id).catch(() => null);
  return true;
}

async function scheduleTempBanRecord(client, record) {
  if (!record?.guild_id || !record?.user_id || !record?.unban_at) return false;

  const key = `${record.guild_id}:${record.user_id}`;
  clearTempBanTimer(key);

  const delay = Math.max(0, (Number(record.unban_at) * 1000) - Date.now());
  tempBanTimers.set(key, setTimeout(() => {
    processTempBanRecord(client, record).catch(err => {
      logger.warn(`Erreur tempban ${key}: ${err?.message || err}`);
    });
  }, delay));

  return true;
}

export async function registerTempBan(client, record) {
  if (!client) return false;
  await dbService.upsertTempBan(record).catch(err => {
    logger.warn(`Impossible d'enregistrer le tempban ${record?.userId || 'unknown'}: ${err?.message || err}`);
  });
  return scheduleTempBanRecord(client, {
    guild_id: record.guildId,
    user_id: record.userId,
    moderator_id: record.moderatorId,
    reason: record.reason,
    unban_at: record.unbanAt
  });
}

export async function startTempBanScheduler(client) {
  if (!client || tempBanSweepTimer) return;

  const bootstrap = async () => {
    const records = await dbService.getTempBans().catch(() => []);
    for (const record of records) {
      await scheduleTempBanRecord(client, record).catch(() => null);
    }
  };

  const sweep = async () => {
    const due = await dbService.getDueTempBans().catch(() => []);
    for (const record of due) {
      await processTempBanRecord(client, record).catch(() => null);
    }
  };

  await bootstrap().catch(() => null);
  await sweep().catch(() => null);
  tempBanSweepTimer = setInterval(() => {
    sweep().catch(err => {
      logger.warn(`Erreur v?rification tempban: ${err?.message || err}`);
    });
  }, 60 * 1000);
}

// ── BAN ───────────────────────────────────────────────────────────────────────

export async function executeBan({ guild, mod, target, raison, days = 0, client }) {
  if (!target.bannable)
    throw new Error('Impossible de bannir ce membre (son rôle est supérieur ou égal au mien).');

  // DM avant le ban (impossible après)
  await target.user.send(
    `🔨 Vous avez été **banni** de **${guild.name}**.\n> **Raison :** ${raison}`
  ).catch(() => null);

  await target.ban({
    reason: `[${mod.username}] ${raison}`,
    deleteMessageSeconds: Math.min(days, 7) * 86400
  });

  await logSanction(client, {
    title: '🔨 Membre banni', color: 0xED4245,
    fields: [
      { name: 'Modérateur', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Membre',     value: `\`${target.user.username}\` (\`${target.user.id}\`)`, inline: true },
      { name: 'Raison',     value: raison, inline: false },
      { name: 'Messages supprimés', value: `${days} jour(s)`, inline: true }
    ]
  });
}

// ── UNBAN ─────────────────────────────────────────────────────────────────────

export async function executeUnban({ guild, mod, userId, raison, client }) {
  // Nettoyage de l'ID (parfois les gens copient avec des espaces ou <>)
  const cleanId = userId.replace(/[^0-9]/g, '');
  if (!cleanId || cleanId.length < 17)
    throw new Error(`ID invalide : \`${userId}\`. Un ID Discord contient 17–19 chiffres.`);

  // Vérifie que l'utilisateur est bien banni
  let ban;
  try {
    ban = await guild.bans.fetch(cleanId);
  } catch {
    throw new Error(`Aucun ban trouvé pour l'ID \`${cleanId}\`. Vérifiez l'ID.`);
  }

  await guild.members.unban(cleanId, `[${mod.username}] ${raison}`);

  await logSanction(client, {
    title: '✅ Membre débanni', color: 0x57F287,
    fields: [
      { name: 'Modérateur',  value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Utilisateur', value: `\`${ban.user.username}\` (\`${cleanId}\`)`, inline: true },
      { name: 'Raison',      value: raison, inline: false }
    ]
  });

  return ban.user;
}

// ── KICK ──────────────────────────────────────────────────────────────────────

export async function executeKick({ guild, mod, target, raison, client }) {
  if (!target.kickable)
    throw new Error('Impossible d\'expulser ce membre (son rôle est supérieur ou égal au mien).');

  // DM avant le kick
  await target.user.send(
    `👟 Vous avez été **expulsé** de **${guild.name}**.\n> **Raison :** ${raison}`
  ).catch(() => null);

  await target.kick(`[${mod.username}] ${raison}`);

  await logSanction(client, {
    title: '👟 Membre expulsé', color: 0xF0A500,
    fields: [
      { name: 'Modérateur', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Membre',     value: `\`${target.user.username}\` (\`${target.user.id}\`)`, inline: true },
      { name: 'Raison',     value: raison, inline: false }
    ]
  });
}

// ── MUTE ──────────────────────────────────────────────────────────────────────

export async function executeMute({ guild, mod, target, seconds, dureeLabel, raison, client }) {
  if (!target.moderatable)
    throw new Error('Impossible de mute ce membre (son rôle est supérieur ou égal au mien).');

  // Discord limite le timeout à 28 jours
  const clampedMs = Math.min(seconds * 1000, 28 * 24 * 3600 * 1000);
  await target.timeout(clampedMs, `[${mod.username}] ${raison}`);

  const until = new Date(Date.now() + clampedMs);

  await target.user.send(
    `🔇 Vous avez été **mis en sourdine** sur **${guild.name}** pendant **${dureeLabel}**.\n> **Raison :** ${raison}`
  ).catch(() => null);

  await logSanction(client, {
    title: '🔇 Membre mute', color: 0xF0A500,
    fields: [
      { name: 'Modérateur', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Membre',     value: `\`${target.user.username}\``, inline: true },
      { name: 'Durée',      value: dureeLabel, inline: true },
      { name: 'Expire',     value: `<t:${Math.floor(until.getTime() / 1000)}:R>`, inline: true },
      { name: 'Raison',     value: raison, inline: false }
    ]
  });

  return until;
}

// ── UNMUTE ────────────────────────────────────────────────────────────────────

export async function executeUnmute({ mod, target, raison, client }) {
  if (!target.isCommunicationDisabled())
    throw new Error('Ce membre n\'est pas actuellement en sourdine.');

  await target.timeout(null, `[${mod.username}] ${raison}`);

  await logSanction(client, {
    title: '🔊 Membre unmute', color: 0x57F287,
    fields: [
      { name: 'Modérateur', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Membre',     value: `\`${target.user.username}\``, inline: true },
      { name: 'Raison',     value: raison, inline: false }
    ]
  });
}

// ── LOCK ──────────────────────────────────────────────────────────────────────

export async function executeLock({ channel, mod, raison, client }) {
  // Vérifie que le salon supporte les permissions (pas une catégorie)
  if (!channel.permissionOverwrites)
    throw new Error('Ce type de salon ne peut pas être verrouillé.');

  const everyone = channel.guild.roles.everyone;

  // Récupère les permissions actuelles de @everyone pour restaurer plus tard si besoin
  await channel.permissionOverwrites.edit(everyone, {
    SendMessages: false,
    AddReactions: false,
    SendMessagesInThreads: false
  });

  await channel.send(
    `🔒 Ce salon a été **verrouillé** par <@${mod.id}>.\n> **Raison :** ${raison}`
  ).catch(() => null);

  await logGeneral(client, {
    title: '🔒 Salon verrouillé', color: 0xED4245,
    fields: [
      { name: 'Modérateur', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Salon',      value: `<#${channel.id}>`, inline: true },
      { name: 'Raison',     value: raison, inline: false }
    ]
  });
}

// ── UNLOCK ────────────────────────────────────────────────────────────────────

export async function executeUnlock({ channel, mod, raison, client }) {
  if (!channel.permissionOverwrites)
    throw new Error('Ce type de salon ne peut pas être déverrouillé.');

  const everyone = channel.guild.roles.everyone;

  // null = hérite de la catégorie parente (reset)
  await channel.permissionOverwrites.edit(everyone, {
    SendMessages: null,
    AddReactions: null,
    SendMessagesInThreads: null
  });

  await channel.send(
    `🔓 Ce salon a été **déverrouillé** par <@${mod.id}>.`
  ).catch(() => null);

  await logGeneral(client, {
    title: '🔓 Salon déverrouillé', color: 0x57F287,
    fields: [
      { name: 'Modérateur', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Salon',      value: `<#${channel.id}>`, inline: true },
      { name: 'Raison',     value: raison, inline: false }
    ]
  });
}

// ── TICKET CLOSE ─────────────────────────────────────────────────────────────

export async function executeTicketClose({ channel, mod, raison, client }) {
  const ticket = await dbService.getTicket(channel.id);
  if (!ticket) throw new Error('Ce salon n\'est pas un ticket.');
  if (ticket.status === 'closed') throw new Error('Ce ticket est déjà fermé.');

  await dbService.closeTicket(channel.id, mod.id);

  // Retire l'accès au créateur
  await channel.permissionOverwrites.edit(ticket.creator_id, {
    ViewChannel: false
  }).catch(() => null);

  await channel.send({
    content: 'Fermeture du ticket dans 3 secondes.'
  }).catch(() => null);

  await logTicket(client, {
    title: '🔒 Ticket fermé', color: 0xED4245,
    fields: [
      { name: 'Ticket',    value: `<#${channel.id}>`, inline: true },
      { name: 'Fermé par', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Créateur',  value: `<@${ticket.creator_id}>`, inline: true },
      { name: 'Raison',    value: raison, inline: false }
    ]
  });

  setTimeout(async () => {
    try {
      const htmlTranscript = await generateTranscript(channel, 'html');
      const txtTranscript = await generateTranscript(channel, 'txt');
      const creatorUser = await client.users.fetch(ticket.creator_id).catch(() => null);
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

// ── TICKET RENAME ─────────────────────────────────────────────────────────────

export async function executeTicketRename({ channel, mod, newName, client }) {
  const ticket = await dbService.getTicket(channel.id);
  if (!ticket) throw new Error('Ce salon n\'est pas un ticket.');

  // Nettoyage strict du nom (Discord : lettres minuscules, chiffres, tirets)
  const clean = newName
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // retire les accents
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9\-]/g, '')
    .replace(/-{2,}/g, '-')       // double tirets → simple
    .replace(/^-|-$/g, '')         // tirets en début/fin
    .slice(0, 50);

  if (!clean)
    throw new Error('Nom invalide après nettoyage. Utilisez des lettres, chiffres ou tirets.');

  const oldName = channel.name;
  await channel.setName(clean, `Renommé par ${mod.username}`);

  await logTicket(client, {
    title: '✏️ Ticket renommé', color: 0xF0A500,
    fields: [
      { name: 'Renommé par', value: `<@${mod.id}> (\`${mod.username}\`)`, inline: true },
      { name: 'Ancien nom',  value: `\`${oldName}\``, inline: true },
      { name: 'Nouveau nom', value: `\`${clean}\``, inline: true }
    ]
  });

  return { oldName, newName: clean };
}

export default {
  isStaffOrAdmin, replyOk, replyErr, prefixReply, replyUsage, parseDurationInput, MUTE_DURATIONS,
  registerTempBan, startTempBanScheduler,
  executeBan, executeUnban, executeKick, executeMute, executeUnmute,
  executeLock, executeUnlock, executeTicketClose, executeTicketRename
};
