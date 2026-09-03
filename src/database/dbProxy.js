import * as logger from '../utils/logger.js';

let databaseModulePromise = null;
let databaseModuleFailure = null;
let warnedAboutFallback = false;

const CRITICAL_DATABASE_METHODS = new Set([
  'reserveNextTicketNumber',
  'createTicket'
]);

function getDatabaseModule() {
  if (databaseModuleFailure) {
    return Promise.reject(databaseModuleFailure);
  }
  if (!databaseModulePromise) {
    databaseModulePromise = import('./databaseService.js').catch((err) => {
      databaseModuleFailure = err;
      throw err;
    });
  }
  return databaseModulePromise;
}

function fallbackValue(property) {
  if (property === 'countGuildTagMembers') {
    return 0;
  }

  if (property === 'get' || property === 'getUserLanguage' || property === 'getStreamerStatus' || property === 'getPendingApplication' || property === 'getApplication' || property === 'getStaffApplyCooldown' || property === 'getStreamerApplyCooldown' || property === 'getPendingStreamerApplication' || property === 'getStreamerApplication' || property === 'getGuildAntiLinkState' || property === 'isGuildAntiLinkWhitelisted' || property === 'isGuildAntiLinkBlacklisted' || property === 'getTicket' || property === 'getUserActiveTicket' || property === 'getInviteReferral' || property === 'getInviteRank' || property === 'getBetaWelcomeQueue' || property === 'getXpProfile' || property === 'getXpRank') {
    return null;
  }

  if (property === 'query' || property === 'getPendingApplications' || property === 'getPendingStreamerApplications' || property === 'getGuildAntiLinkWhitelist' || property === 'getGuildAntiLinkBlacklist' || property === 'getInviteReferralsByInviter' || property === 'getInviteLeaderboard' || property === 'getPendingBetaWelcomes' || property === 'getXpLeaderboard' || property === 'getAllStaffActions' || property === 'getAllStreamerStatuses' || property === 'getTempBans' || property === 'getDueTempBans') {
    return [];
  }

  if (property === 'run' || property === 'initDb' || property.startsWith('set') || property.startsWith('add') || property.startsWith('create') || property.startsWith('update') || property.startsWith('delete') || property.startsWith('clear') || property.startsWith('promote') || property.startsWith('upsert') || property.startsWith('save') || property.startsWith('claim')) {
    return { id: null, changes: 0 };
  }

  return null;
}

const dbService = new Proxy({}, {
  get(_target, property) {
    return async (...args) => {
      try {
        const databaseModule = await getDatabaseModule();
        const handler = databaseModule[property];
        if (typeof handler !== 'function') {
          return handler;
        }
        return handler(...args);
      } catch (err) {
        if (!warnedAboutFallback) {
          warnedAboutFallback = true;
          const errorMessage = err instanceof Error
            ? err.message
            : (err && typeof err.message === 'string' ? err.message : String(err ?? 'Erreur inconnue'));
          logger.error(`Base de données indisponible, mode dégradé activé: ${errorMessage}`);
        }
        if (CRITICAL_DATABASE_METHODS.has(String(property))) {
          throw err;
        }
        return fallbackValue(String(property));
      }
    };
  }
});

export default dbService;
