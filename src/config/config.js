import dotenv from 'dotenv';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '../../.env') });

function parseColor(val, fallback) {
  if (!val) return fallback;
  const cleaned = val.toString().replace('#', '').replace('0x', '');
  const parsed = parseInt(cleaned, 16);
  return isNaN(parsed) ? fallback : parsed;
}

function normalizeStatusType(value, fallback = 'Watching') {
  if (!value) return fallback;

  const normalized = value.toString().trim().toLowerCase();
  const mapping = {
    playing: 'Playing',
    watching: 'Watching',
    listening: 'Listening',
    competing: 'Competing'
  };

  return mapping[normalized] || fallback;
}

function normalizePresence(value, fallback = 'dnd') {
  if (!value) return fallback;

  const normalized = value.toString().trim().toLowerCase();
  const allowed = new Set(['online', 'idle', 'dnd', 'invisible']);
  return allowed.has(normalized) ? normalized : fallback;
}

export default {
  // Token Discord du bot
  token: process.env.DISCORD_TOKEN,
  // Optional guild ID for development slash command registration
  guildId: process.env.DEV_GUILD_ID || process.env.GUILD_ID || process.env.DISCORD_GUILD_ID || null,

  // Préfixe pour les commandes classiques
  prefix: process.env.BOT_PREFIX || '*',

  // Mode débug
  debug: process.argv.includes('--debug') || process.env.DEBUG === 'true',

  // Couleurs des Embeds
  colors: {
    primary: parseColor(process.env.COLOR_PRIMARY, 0x990000),
    secondary: parseColor(process.env.COLOR_SECONDARY, 0x1A1A1A),
    error: parseColor(process.env.COLOR_ERROR, 0x7F0000),
    success: parseColor(process.env.COLOR_SUCCESS, 0x990000)
  },

  // Identifiants de rôles
  roles: {
    admin: process.env.ROLE_ADMIN || '1519759444479836342',
    fr: process.env.ROLE_FR || '1519750090498244670',
    en: process.env.ROLE_EN || '1519750127323975793',
    staff: process.env.ROLE_STAFF || '1484977186933838097', // ID du rôle équipe staff
    autorole: process.env.ROLE_AUTOROLE || '1509613216114671661'
  },

  // Identifiants de salons
  channels: {
    welcome: process.env.CHANNEL_WELCOME || '',
    logs: process.env.CHANNEL_LOGS || '',
    staffapply: process.env.CHANNEL_STAFFAPPLY || '',
    inviteLeaderboard: process.env.CHANNEL_INVITE_LEADERBOARD || '',
    betaFeedback: '1520470579956682824'
  },

  ticketRoutingRoles: {
    moderation: process.env.TICKET_ROLE_MODERATION || '1524113089786544159',
    event: process.env.TICKET_ROLE_EVENT || '1509613216265797863',
    streamer: process.env.TICKET_ROLE_STREAMER || '1524121818074714303',
    support: process.env.TICKET_ROLE_SUPPORT || '1524113146699190352',
    server: process.env.TICKET_ROLE_SERVER || '1527609005718110259'
  },

  beta: {
    roleId: '1520470175403737138'
  },

  // Salons de logs avancés
  logs: {
    general: process.env.LOG_GENERAL || '',       // Suppression/modif de salon
    message: process.env.LOG_MESSAGE || '',       // Modif/suppression de message
    voice: process.env.LOG_VOICE || '',           // Activité vocale
    dm: process.env.LOG_DM || '153414611314855533', // Messages privés envoyés/reçus
    ticket: process.env.LOG_TICKET || '',         // Tickets
    announcement: process.env.LOG_ANNOUNCEMENT || '1519997992487358545', // /annonces
    command: process.env.LOG_COMMAND || '1519998276655513680',       // Commandes slash
    sanction: process.env.LOG_SANCTION || '',     // Sanctions staff
    staffApply: process.env.LOG_STAFFAPPLY || ''  // Candidatures staff
  },

  // Messages de bienvenue
  welcome: {
    banner: process.env.WELCOME_BANNER || 'https://i.imgur.com/example_banner.png',
    defaultLang: process.env.DEFAULT_LANG || 'fr'
  },

  // Rôles de notification
  notifications: {
    patchNotes: process.env.ROLE_PATCHNOTES || '1520116888879890593',
    ticket: process.env.ROLE_NOTIF_TICKET || '1533059907958608023'
  },

  // Système de tickets
  tickets: {
    categoryId: process.env.TICKET_CATEGORY_ID || '1484977225190215720',
    categoryFrId: process.env.TICKET_CATEGORY_FR_ID || process.env.TICKET_CATEGORY_ID_FR || null,
    categoryEnId: process.env.TICKET_CATEGORY_EN_ID || process.env.TICKET_CATEGORY_ID_EN || null,
    claimedCategoryId: process.env.TICKET_CLAIMED_CATEGORY_ID || null,
    closedCategoryId: process.env.TICKET_CLOSED_CATEGORY_ID || null,
    supportRoleId: process.env.TICKET_SUPPORT_ROLE_ID || '1484977187718172874',
    maxOpenTickets: parseInt(process.env.TICKET_MAX_OPEN || '1', 10),
    autoDeleteDays: parseInt(process.env.TICKET_AUTO_DELETE_DAYS || '0', 10)
  },

  // Guide
  guide: {
    channels: {
      presentation: process.env.GUIDE_CHANNEL_PRESENTATION || '1520743657425211392',
      announcements: process.env.GUIDE_CHANNEL_ANNOUNCEMENTS || '1509613219646410766',
      rules: process.env.GUIDE_CHANNEL_RULES || '1509613219646410766',
      support: process.env.GUIDE_CHANNEL_SUPPORT || '1509613220019572940',
      status: process.env.GUIDE_CHANNEL_STATUS || '1527375640817307758',
      patchnotes: process.env.GUIDE_CHANNEL_PATCHNOTES || '1519999182663061525'
    }
  },

  // Système streamer
  streamer: {
    role:            process.env.ROLE_STREAMER          || '1520492474639057089',
    announceChannel: process.env.CHANNEL_STREAM_ANNOUNCE || '1520494677915078887',
    pingRole:        process.env.ROLE_STREAM_NOTIFY      || '1520500366926413895'
  },

  // Rôles de notification
  notifications: {
    patchNotes: process.env.ROLE_PATCHNOTES || '1520116888879890593'
  },

  // Statut du bot
  // Types disponibles : Playing, Watching, Listening, Competing
  status: {
    text: process.env.BOT_STATUS_TEXT
      || process.env.STATUT_BOT
      || process.env.BOT_ACTIVITY_TEXT
      || 'Course-Poursuite',
    type: normalizeStatusType(process.env.BOT_STATUS_TYPE || process.env.BOT_ACTIVITY_TYPE, 'Watching'),
    presence: normalizePresence(process.env.BOT_PRESENCE, 'dnd')
  }
};





