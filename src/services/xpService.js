import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  TextDisplayBuilder
} from 'discord.js';
import config from '../config/config.js';
import dbService from '../database/dbProxy.js';
import * as logger from '../utils/logger.js';
import { appendSeparatorComponent } from '../utils/v2Helper.js';

const MESSAGE_XP_TRIGGER_COUNT = 30;
const MESSAGE_XP_REWARD = 90;
const VOICE_XP_TRIGGER_SECONDS = 20 * 60;
const VOICE_XP_REWARD = 25;
const XP_REFRESH_INTERVAL_MS = 60 * 1000;
const XP_PANEL_ACCENT_COLOR = 0x2B2D31;

const XP_RANKS = [
  { name: { fr: 'Bronze', en: 'Bronze' }, minXp: 0, color: 0xCD7F32 },
  { name: { fr: 'Argent', en: 'Silver' }, minXp: 6000, color: 0xC0C0C0 },
  { name: { fr: 'Or', en: 'Gold' }, minXp: 18000, color: 0xFFD700 },
  { name: { fr: 'Platine', en: 'Platinum' }, minXp: 36000, color: 0xE5E4E2 }
];

const XP_COPY = {
  fr: {
    profileTitle: 'Profil XP',
    profileError: 'Impossible de charger le profil XP.',
    progression: 'Progression',
    rankLabel: 'Rang',
    rankButton: 'Rang',
    memberSince: 'Membre depuis',
    leaderboardTitle: 'Classement XP',
    noData: 'Aucun XP enregistré pour le moment.',
    messages: 'Messages',
    vocal: 'Vocal',
    game: 'Jeu',
    classement: 'Classement',
    maxRank: 'rang maximum atteint'
  },
  en: {
    profileTitle: 'XP Profile',
    profileError: 'Unable to load the XP profile.',
    progression: 'Progress',
    rankLabel: 'Rank',
    rankButton: 'Rank',
    memberSince: 'Member since',
    leaderboardTitle: 'XP Leaderboard',
    noData: 'No XP recorded yet.',
    messages: 'Messages',
    vocal: 'Voice',
    game: 'Game',
    classement: 'Ranking',
    maxRank: 'max rank reached'
  }
};

const voiceSessions = new Map();
let xpMaintenanceInterval = null;

function getSessionKey(guildId, userId) {
  return `${guildId}:${userId}`;
}

function getXpCopy(lang) {
  return XP_COPY[lang] || XP_COPY.fr;
}

function formatDuration(totalSeconds) {
  const seconds = Math.max(0, Math.floor(totalSeconds || 0));
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h${String(minutes).padStart(2, '0')}`;
  }

  return `${minutes}m`;
}

function buildProgressBar(currentXp, nextThreshold) {
  if (!nextThreshold) {
    return '🟥🟥🟥🟥🟥🟥🟥🟥🟥🟥';
  }

  const percent = Math.max(0, Math.min(100, (currentXp / nextThreshold) * 100));
  const filled = Math.max(1, Math.min(10, Math.round(percent / 10)));
  return `${'🟥'.repeat(filled)}${'⬛'.repeat(10 - filled)} ${Math.round(percent)}%`;
}

function getRankInfo(totalXp) {
  let current = XP_RANKS[0];
  let next = XP_RANKS[1] || null;

  for (let index = 0; index < XP_RANKS.length; index += 1) {
    const rank = XP_RANKS[index];
    const following = XP_RANKS[index + 1] || null;
    if (totalXp >= rank.minXp) {
      current = rank;
      next = following;
    }
  }

  return { current, next };
}

async function ensureXpProfile(guildId, userId) {
  try {
    const existing = await dbService.getXpProfile(guildId, userId);
    if (existing) {
      return existing;
    }
  } catch (err) {
    logger.warn(`Impossible de lire le profil XP ${guildId}/${userId}: ${err?.message || err}`);
    return null;
  }

  await dbService.saveXpProfile(guildId, userId, {
    total_xp: 0,
    total_messages: 0,
    messages_since_reward: 0,
    total_voice_seconds: 0,
    voice_seconds_since_reward: 0,
    total_takedown_seconds: 0,
    takedown_seconds_since_reward: 0
  }).catch(() => null);

  return dbService.getXpProfile(guildId, userId).catch(() => null);
}

async function saveXpProfile(guildId, userId, profile) {
  return dbService.saveXpProfile(guildId, userId, profile);
}

async function addMessageProgress(guildId, userId, increment = 1) {
  if (!guildId || !userId || increment <= 0) return null;

  const profile = await ensureXpProfile(guildId, userId);
  if (!profile) return null;

  let totalMessages = Number(profile.total_messages || 0) + increment;
  let messagesSinceReward = Number(profile.messages_since_reward || 0) + increment;
  let totalXp = Number(profile.total_xp || 0);

  while (messagesSinceReward >= MESSAGE_XP_TRIGGER_COUNT) {
    messagesSinceReward -= MESSAGE_XP_TRIGGER_COUNT;
    totalXp += MESSAGE_XP_REWARD;
  }

  await saveXpProfile(guildId, userId, {
    total_xp: totalXp,
    total_messages: totalMessages,
    messages_since_reward: messagesSinceReward,
    total_voice_seconds: Number(profile.total_voice_seconds || 0),
    voice_seconds_since_reward: Number(profile.voice_seconds_since_reward || 0),
    total_takedown_seconds: Number(profile.total_takedown_seconds || 0),
    takedown_seconds_since_reward: Number(profile.takedown_seconds_since_reward || 0)
  }).catch(() => null);

  return {
    ...profile,
    total_xp: totalXp,
    total_messages: totalMessages,
    messages_since_reward: messagesSinceReward
  };
}

async function addVoiceProgress(guildId, userId, elapsedSeconds = 0) {
  if (!guildId || !userId || elapsedSeconds <= 0) return null;

  const profile = await ensureXpProfile(guildId, userId);
  if (!profile) return null;

  let totalVoiceSeconds = Number(profile.total_voice_seconds || 0) + elapsedSeconds;
  let voiceSecondsSinceReward = Number(profile.voice_seconds_since_reward || 0) + elapsedSeconds;
  let totalXp = Number(profile.total_xp || 0);

  while (voiceSecondsSinceReward >= VOICE_XP_TRIGGER_SECONDS) {
    voiceSecondsSinceReward -= VOICE_XP_TRIGGER_SECONDS;
    totalXp += VOICE_XP_REWARD;
  }

  await saveXpProfile(guildId, userId, {
    total_xp: totalXp,
    total_messages: Number(profile.total_messages || 0),
    messages_since_reward: Number(profile.messages_since_reward || 0),
    total_voice_seconds: totalVoiceSeconds,
    voice_seconds_since_reward: voiceSecondsSinceReward,
    total_takedown_seconds: Number(profile.total_takedown_seconds || 0),
    takedown_seconds_since_reward: Number(profile.takedown_seconds_since_reward || 0)
  }).catch(() => null);

  return {
    ...profile,
    total_xp: totalXp,
    total_voice_seconds: totalVoiceSeconds,
    voice_seconds_since_reward: voiceSecondsSinceReward
  };
}

async function addTakedownProgress() {
  return null;
}

async function syncActiveTakedownSessions() {
  return null;
}

async function syncActiveVoiceSessions(client) {
  if (!client?.guilds?.cache?.size) return;

  const now = Date.now();
  for (const [key, session] of voiceSessions.entries()) {
    const guild = client.guilds.cache.get(session.guildId);
    if (!guild) continue;

    const member = guild.members.cache.get(session.userId)
      || await guild.members.fetch(session.userId).catch(() => null);
    if (!member?.voice?.channelId || member.user?.bot) {
      voiceSessions.delete(key);
      continue;
    }

    const elapsedSeconds = Math.floor((now - session.lastAwardAt) / 1000);
    if (elapsedSeconds <= 0) continue;

    await addVoiceProgress(session.guildId, session.userId, elapsedSeconds).catch(() => null);
    session.lastAwardAt = now;
  }
}

function buildProfileHeader(profile, rankInfo, copy, lang) {
  const currentXp = Number(profile.total_xp || 0);
  const progressThreshold = rankInfo.next?.minXp || null;
  const progressBar = buildProgressBar(currentXp, progressThreshold);
  const nextLine = rankInfo.next
    ? `${currentXp} XP ? ${rankInfo.next.minXp} XP vers ${rankInfo.next.name[lang] || rankInfo.next.name.fr}`
    : `${currentXp} XP ? ${copy.maxRank}`;

  return [
    `**${copy.progression}**`,
    progressBar,
    nextLine,
    `**${copy.rankLabel}** : ${rankInfo.current.name[lang] || rankInfo.current.name.fr}`
  ].join('\n');
}

function truncateText(value, maxLength) {
  const text = String(value ?? '');
  if (text.length <= maxLength) return text;
  if (maxLength <= 1) return text.slice(0, maxLength);
  return `${text.slice(0, maxLength - 1)}…`;
}

function padCell(value, width, align = 'left') {
  const text = String(value ?? '');
  if (text.length >= width) return text;
  return align === 'right' ? text.padStart(width) : text.padEnd(width);
}

function buildLeaderboardTable(leaderboardRows, lang) {
  const rows = leaderboardRows.map((entry, index) => {
    const displayName = entry.member?.displayName || entry.member?.user?.username || `<@${entry.entry.user_id}>`;
    const xp = Number(entry.entry.total_xp || 0).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');
    const messages = Number(entry.entry.total_messages || 0).toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR');
    const voice = formatDuration(entry.entry.total_voice_seconds || 0);
    const rankInfo = getRankInfo(Number(entry.entry.total_xp || 0));
    const rank = rankInfo.current.name[lang] || rankInfo.current.name.fr;
    return `**#${index + 1}** ${displayName} - ${rank} - ${xp} XP - ${messages} msg - ${voice}`;
  });
  return rows.join('\n');
}

export async function initializeXpTracking(client) {
  if (!client?.guilds?.cache) return;

  const now = Date.now();
  for (const guild of client.guilds.cache.values()) {
    for (const voiceState of guild.voiceStates.cache.values()) {
      const member = voiceState.member;
      if (!member || member.user.bot || !voiceState.channelId) continue;

      voiceSessions.set(getSessionKey(guild.id, member.id), {
        guildId: guild.id,
        userId: member.id,
        lastAwardAt: now
      });

      await ensureXpProfile(guild.id, member.id).catch(() => null);
    }
  }
}

export async function handleXpMessage(message) {
  if (!message?.guild || message.author?.bot) return false;
  await addMessageProgress(message.guild.id, message.author.id, 1).catch(() => null);
  return true;
}

export async function handleXpVoiceState(oldState, newState) {
  const member = newState.member ?? oldState.member;
  if (!member || member.user.bot) return;

  const guildId = member.guild.id;
  const userId = member.id;
  const key = getSessionKey(guildId, userId);
  const oldChannelId = oldState.channelId || null;
  const newChannelId = newState.channelId || null;

  if (!oldChannelId && newChannelId) {
    voiceSessions.set(key, {
      guildId,
      userId,
      lastAwardAt: Date.now()
    });
    await ensureXpProfile(guildId, userId).catch(() => null);
    return;
  }

  if (oldChannelId && !newChannelId) {
    const session = voiceSessions.get(key);
    if (!session) return;

    const elapsedSeconds = Math.floor((Date.now() - session.lastAwardAt) / 1000);
    voiceSessions.delete(key);
    if (elapsedSeconds > 0) {
      await addVoiceProgress(guildId, userId, elapsedSeconds).catch(() => null);
    }
  }
}

export async function buildXpProfileContainer(guild, member, lang = 'fr') {
  const copy = getXpCopy(lang);
  const profile = await ensureXpProfile(guild.id, member.id).catch(() => null);
  if (!profile) {
    return new ContainerBuilder()
      .setAccentColor(config.colors.error)
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**${copy.profileTitle}**\n\n${copy.profileError}`)
      );
  }

  const rankInfo = getRankInfo(Number(profile.total_xp || 0));
  const memberRank = await dbService.getXpRank(guild.id, member.id).catch(() => null) || 1;
  const joinDate = member.joinedAt
    ? member.joinedAt.toLocaleString(lang === 'en' ? 'en-US' : 'fr-FR', {
        dateStyle: 'long',
        timeStyle: 'short'
      })
    : '—';

  const container = new ContainerBuilder()
    .setAccentColor(XP_PANEL_ACCENT_COLOR)
    .addSectionComponents(
      new SectionBuilder()
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(member.displayAvatarURL({ size: 256 }))
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent([
            `**${member.displayName}**`,
            buildProfileHeader(profile, rankInfo, copy, lang)
          ].join('\n'))
        )
    );

  appendSeparatorComponent(container);
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`xp_messages_${guild.id}_${member.id}`)
        .setLabel(`${copy.messages} ${Number(profile.total_messages || 0)}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`xp_voice_${guild.id}_${member.id}`)
        .setLabel(`${copy.vocal} ${formatDuration(profile.total_voice_seconds || 0)}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`xp_rank_${guild.id}_${member.id}`)
        .setLabel(`${copy.classement} #${memberRank}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`xp_tier_${guild.id}_${member.id}`)
        .setLabel(`${copy.rankButton} ${rankInfo.current.name[lang] || rankInfo.current.name.fr}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    )
  );

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([
      `**${copy.memberSince}**`,
      joinDate
    ].join('\n'))
  );

  return container;
}

export async function buildXpLeaderboardContainer(guild, limit = 10, lang = 'fr') {
  const copy = getXpCopy(lang);
  const leaderboard = await dbService.getXpLeaderboard(guild.id, limit).catch(() => []);
  const container = new ContainerBuilder().setAccentColor(XP_PANEL_ACCENT_COLOR);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(`**${copy.leaderboardTitle}**`)
  );

  if (!leaderboard.length) {
    appendSeparatorComponent(container);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> ${copy.noData}`)
    );
    return container;
  }

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(lang === 'en'
      ? '**Name - Rank - XP - Messages - Voice time**'
      : '**Nom - Rang - XP - Messages - Temps en voc**')
  );
  appendSeparatorComponent(container);
  const rows = [];
  for (const [index, entry] of leaderboard.entries()) {
    const member = guild.members.cache.get(entry.user_id)
      || await guild.members.fetch(entry.user_id).catch(() => null);
    rows.push({ entry, member, index });
  }

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(buildLeaderboardTable(rows, lang))
  );

  return container;
}

export function startXpMaintenance(client) {
  if (xpMaintenanceInterval) return;

  xpMaintenanceInterval = setInterval(() => {
    syncActiveVoiceSessions(client).catch(() => null);
  }, XP_REFRESH_INTERVAL_MS);
}

export async function refreshXpSessions(client) {
  await syncActiveVoiceSessions(client).catch(() => null);
}

export default {
  initializeXpTracking,
  handleXpMessage,
  handleXpVoiceState,
  buildXpProfileContainer,
  buildXpLeaderboardContainer,
  startXpMaintenance,
  refreshXpSessions
};


