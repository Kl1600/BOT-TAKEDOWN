import config from '../config/config.js';
import dbService from '../database/dbProxy.js';
import { getLanguage } from '../utils/language.js';

const DISCORD_LINK_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:canary\.|ptb\.)?(?:discord\.gg|discord(?:app)?\.com\/invite|discord\.com\/invite)\/\S+/i;

const guildAntiLinkCache = new Map();

function buildSnapshot(enabledRow, whitelistRows, blacklistRows) {
  return {
    enabled: Boolean(enabledRow?.enabled),
    whitelist: new Set((whitelistRows || []).map(row => row.user_id)),
    blacklist: new Set((blacklistRows || []).map(row => row.user_id)),
    refreshedAt: Date.now()
  };
}

async function loadGuildSnapshot(guildId) {
  const [enabledRow, whitelistRows, blacklistRows] = await Promise.all([
    dbService.getGuildAntiLinkState(guildId).catch(() => null),
    dbService.getGuildAntiLinkWhitelist(guildId).catch(() => []),
    dbService.getGuildAntiLinkBlacklist(guildId).catch(() => [])
  ]);

  const snapshot = buildSnapshot(enabledRow, whitelistRows, blacklistRows);
  guildAntiLinkCache.set(guildId, snapshot);
  return snapshot;
}

export async function getGuildAntiLinkSnapshot(guildId, refresh = false) {
  const cached = guildAntiLinkCache.get(guildId);
  if (!refresh && cached) {
    return cached;
  }

  return loadGuildSnapshot(guildId);
}

export async function setGuildAntiLinkEnabled(guildId, enabled) {
  await dbService.setGuildAntiLinkState(guildId, enabled).catch(() => null);
  return loadGuildSnapshot(guildId);
}

export async function addGuildAntiLinkWhitelist(guildId, userId, addedBy = null) {
  await dbService.addGuildAntiLinkWhitelist(guildId, userId, addedBy).catch(() => null);
  await dbService.removeGuildAntiLinkBlacklist(guildId, userId).catch(() => null);
  return loadGuildSnapshot(guildId);
}

export async function removeGuildAntiLinkWhitelist(guildId, userId) {
  await dbService.removeGuildAntiLinkWhitelist(guildId, userId).catch(() => null);
  return loadGuildSnapshot(guildId);
}

export async function addGuildAntiLinkBlacklist(guildId, userId, addedBy = null) {
  await dbService.addGuildAntiLinkBlacklist(guildId, userId, addedBy).catch(() => null);
  await dbService.removeGuildAntiLinkWhitelist(guildId, userId).catch(() => null);
  return loadGuildSnapshot(guildId);
}

export async function removeGuildAntiLinkBlacklist(guildId, userId) {
  await dbService.removeGuildAntiLinkBlacklist(guildId, userId).catch(() => null);
  return loadGuildSnapshot(guildId);
}

export async function handleAntiLinkMessage(message) {
  if (!message.guild || message.author.bot) return false;
  if (message.content.startsWith(config.prefix)) return false;
  if (!DISCORD_LINK_REGEX.test(message.content)) return false;

  const lang = await getLanguage(message.member).catch(() => 'fr');
  const snapshot = await getGuildAntiLinkSnapshot(message.guild.id).catch(() => null);
  if (!snapshot) return false;

  const userId = message.author.id;
  const isBlacklisted = snapshot.blacklist.has(userId);
  const isWhitelisted = snapshot.whitelist.has(userId);

  if (!snapshot.enabled && !isBlacklisted) {
    return false;
  }

  if (isWhitelisted && !isBlacklisted && snapshot.enabled) {
    return false;
  }

  const warning = lang === 'en'
    ? (isBlacklisted
      ? '-# You cannot send Discord links here.'
      : '-# Discord links are disabled on this server.')
    : (isBlacklisted
      ? '-# Tu ne peux pas envoyer de lien Discord ici.'
      : '-# Les liens Discord sont désactivés sur ce serveur.');

  await message.delete().catch(() => null);
  await message.channel.send({ content: `${warning} <@${userId}>` }).then(sent => {
    setTimeout(() => sent.delete().catch(() => null), 5000);
  }).catch(() => null);
  return true;
}

export default {
  getGuildAntiLinkSnapshot,
  setGuildAntiLinkEnabled,
  addGuildAntiLinkWhitelist,
  removeGuildAntiLinkWhitelist,
  addGuildAntiLinkBlacklist,
  removeGuildAntiLinkBlacklist,
  handleAntiLinkMessage
};
