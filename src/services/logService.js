import { EmbedBuilder } from 'discord.js';
import config from '../config/config.js';
import * as logger from '../utils/logger.js';

// ── Types de canaux lisibles ──────────────────────────────────────────────────
const CHANNEL_TYPES = {
  0: 'Texte', 2: 'Vocal', 4: 'Catégorie', 5: 'Annonces',
  10: 'Thread annonces', 11: 'Thread public', 12: 'Thread privé',
  13: 'Stage', 15: 'Forum', 16: 'Média'
};

// ── Fonction centrale d'envoi ─────────────────────────────────────────────────

async function sendLog(client, channelKey, embed) {
  try {
    const channelId = config.logs?.[channelKey];
    // Valide que c'est un snowflake Discord (17–20 chiffres) avant d'essayer
    if (!channelId || !/^\d{17,20}$/.test(channelId)) return;
    const channel =
      client.channels.cache.get(channelId) ||
      await client.channels.fetch(channelId).catch(() => null);
    if (!channel?.isTextBased()) return;
    await channel.send({ embeds: [embed] });
  } catch (err) {
    logger.error(`[LogService] Erreur envoi log [${channelKey}]:`, err.message);
  }
}

// ── Builder mutualisé ─────────────────────────────────────────────────────────

function buildEmbed({ title, description, color, fields = [] }) {
  const embed = new EmbedBuilder()
    .setTitle(title)
    .setColor(color || config.colors.primary)
    .setTimestamp();

  if (description) embed.setDescription(description);
  if (fields.length > 0) {
    // Discord limite les valeurs de champ à 1024 caractères
    embed.addFields(
      fields.map(f => ({
        ...f,
        value: f.value?.slice(0, 1024) || '\u200b'
      }))
    );
  }
  return embed;
}

function buildDmPreview(content) {
  const value = String(content || '').trim();
  return value ? value.slice(0, 3500) : 'Aucun contenu.';
}

// ── Exports par catégorie ─────────────────────────────────────────────────────

/** Logs généraux : création/suppression/déplacement de salon */
export async function logGeneral(client, opts) {
  await sendLog(client, 'general', buildEmbed(opts));
}

/** Logs messages : modification ou suppression */
export async function logMessage(client, opts) {
  await sendLog(client, 'message', buildEmbed({ color: 0xF0A500, ...opts }));
}

/** Logs vocaux : rejoindre, quitter, déplacer */
export async function logVoice(client, opts) {
  await sendLog(client, 'voice', buildEmbed({ color: 0x5865F2, ...opts }));
}

/** Logs tickets */
export async function logTicket(client, opts) {
  await sendLog(client, 'ticket', buildEmbed(opts));
}

/** Logs annonces (/annonce) */
export async function logAnnouncement(client, opts) {
  await sendLog(client, 'announcement', buildEmbed({ color: 0x57F287, ...opts }));
}

/** Logs commandes slash et préfixe */
export async function logCommand(client, opts) {
  await sendLog(client, 'command', buildEmbed({ color: 0xEB459E, ...opts }));
}

/** Logs messages privés envoyés et reçus */
export async function logDm(client, opts) {
  const { direction = 'reçu', content, ...rest } = opts || {};
  const title = direction === 'envoyé' ? 'Message privé envoyé' : 'Message privé reçu';
  await sendLog(client, 'dm', buildEmbed({
    color: direction === 'envoyé' ? 0x57F287 : 0xF0A500,
    title,
    description: buildDmPreview(content),
    ...rest
  }));
}

/** Logs sanctions (warn, note, demote, promote, kick, ban) */
export async function logSanction(client, opts) {
  await sendLog(client, 'sanction', buildEmbed({ color: 0xED4245, ...opts }));
}

/** Logs candidatures staff */
export async function logStaffApply(client, opts) {
  await sendLog(client, 'staffApply', buildEmbed(opts));
}

/** Utilitaire exposé pour les events : type de salon lisible */
export function readableChannelType(type) {
  return CHANNEL_TYPES[type] ?? `Type ${type}`;
}

export default {
  logGeneral, logMessage, logVoice, logTicket,
  logAnnouncement, logCommand, logDm, logSanction, logStaffApply,
  readableChannelType
};
