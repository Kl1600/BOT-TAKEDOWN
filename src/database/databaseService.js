import db from './db.js';

/**
 * Initialize all database tables if they do not exist
 */
export async function initDb() {
  // 1. Tickets table
  await db.run(`
    CREATE TABLE IF NOT EXISTS tickets (
      channel_id TEXT PRIMARY KEY,
      creator_id TEXT NOT NULL,
      ticket_number INTEGER NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      created_at INTEGER NOT NULL,
      closed_at INTEGER,
      closed_by TEXT
    )
  `);

  // 2. Dynamic Config table
  await db.run(`
    CREATE TABLE IF NOT EXISTS config (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  // 3. Persistent logs table
  await db.run(`
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp INTEGER NOT NULL,
      type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      details TEXT
    )
  `);

  // 4. User languages override table
  await db.run(`
    CREATE TABLE IF NOT EXISTS languages (
      user_id TEXT PRIMARY KEY,
      lang TEXT NOT NULL
    )
  `);

  // 5. Server parameters table
  await db.run(`
    CREATE TABLE IF NOT EXISTS server_parameters (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS ticket_counters (
      user_id TEXT PRIMARY KEY,
      last_number INTEGER NOT NULL DEFAULT 0
    )
  `);

  try {
    await db.run('ALTER TABLE tickets ADD COLUMN ticket_number INTEGER');
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await db.run('ALTER TABLE tickets ADD COLUMN claimed_by TEXT');
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await db.run('ALTER TABLE tickets ADD COLUMN claimed_at INTEGER');
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await db.run('ALTER TABLE tickets ADD COLUMN reason TEXT');
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await db.run('ALTER TABLE staff_applications ADD COLUMN application_data TEXT');
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await db.run('ALTER TABLE guild_xp_profiles ADD COLUMN total_takedown_seconds INTEGER NOT NULL DEFAULT 0');
  } catch (err) {
    // Column already exists, ignore
  }
  try {
    await db.run('ALTER TABLE guild_xp_profiles ADD COLUMN takedown_seconds_since_reward INTEGER NOT NULL DEFAULT 0');
  } catch (err) {
    // Column already exists, ignore
  }

  // 6. Staff Applications table
  await db.run(`
    CREATE TABLE IF NOT EXISTS staff_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      message_id TEXT,
      application_data TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS streamer_applications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at INTEGER NOT NULL,
      message_id TEXT,
      application_data TEXT
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS staff_apply_cooldowns (
      user_id TEXT PRIMARY KEY,
      rejected_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS streamer_apply_cooldowns (
      user_id TEXT PRIMARY KEY,
      rejected_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS guild_invite_referrals (
      guild_id TEXT NOT NULL,
      invitee_id TEXT NOT NULL,
      invitee_tag TEXT NOT NULL,
      inviter_id TEXT NOT NULL,
      invite_code TEXT,
      joined_at INTEGER NOT NULL,
      left_at INTEGER,
      PRIMARY KEY (guild_id, invitee_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS beta_welcome_queue (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      lang TEXT,
      queued_at INTEGER NOT NULL,
      sent_at INTEGER,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS guild_antilink_settings (
      guild_id TEXT PRIMARY KEY,
      enabled INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS guild_antilink_whitelist (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      added_by TEXT,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS guild_antilink_blacklist (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      added_by TEXT,
      added_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS guild_temp_bans (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      moderator_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      unban_at INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS guild_xp_profiles (
      guild_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      total_xp INTEGER NOT NULL DEFAULT 0,
      total_messages INTEGER NOT NULL DEFAULT 0,
      messages_since_reward INTEGER NOT NULL DEFAULT 0,
      total_voice_seconds INTEGER NOT NULL DEFAULT 0,
      voice_seconds_since_reward INTEGER NOT NULL DEFAULT 0,
      updated_at INTEGER NOT NULL,
      PRIMARY KEY (guild_id, user_id)
    )
  `);

  await db.run(`
    CREATE TABLE IF NOT EXISTS panel_refresh_records (
      key TEXT PRIMARY KEY,
      guild_id TEXT NOT NULL,
      channel_id TEXT NOT NULL,
      message_ids TEXT NOT NULL,
      member_id TEXT,
      refresh_on_member_update INTEGER NOT NULL DEFAULT 0,
      panel_type TEXT,
      payload TEXT,
      updated_at INTEGER NOT NULL
    )
  `);

  // 7. Staff Actions table (warn, note, promote, demote, kick)
  await db.run(`
    CREATE TABLE IF NOT EXISTS staff_actions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      executor_id TEXT NOT NULL,
      target_id TEXT NOT NULL,
      action_type TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at INTEGER NOT NULL
    )
  `);

  // 8. Streamer status tracking table
  await db.run(`
    CREATE TABLE IF NOT EXISTS streamer_statuses (
      user_id TEXT PRIMARY KEY,
      status TEXT NOT NULL DEFAULT 'test',
      started_at INTEGER NOT NULL,
      test_until INTEGER,
      updated_at INTEGER NOT NULL
    )
  `);

  console.log('Database tables initialized.');
}

/* ==========================================================================
   TICKETS OPERATIONS
   ========================================================================== */

export async function createTicket(channelId, creatorId, ticketNumber = 0, reason = '') {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    'INSERT INTO tickets (channel_id, creator_id, ticket_number, status, created_at, reason) VALUES (?, ?, ?, ?, ?, ?)',
    [channelId, creatorId, ticketNumber, 'open', now, reason]
  );
}

export async function reserveNextTicketNumber(userId) {
  const current = await db.get('SELECT last_number FROM ticket_counters WHERE user_id = ?', [userId]);
  const nextNumber = (current?.last_number || 0) + 1;

  await db.run(
    'INSERT INTO ticket_counters (user_id, last_number) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET last_number = excluded.last_number',
    [userId, nextNumber]
  );

  return nextNumber;
}

export async function assignTicketNumber(channelId, ticketNumber) {
  return db.run(
    'UPDATE tickets SET ticket_number = ? WHERE channel_id = ?',
    [ticketNumber, channelId]
  );
}

export async function closeTicket(channelId, closedBy) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    'UPDATE tickets SET status = ?, closed_at = ?, closed_by = ? WHERE channel_id = ?',
    ['closed', now, closedBy, channelId]
  );
}

export async function claimTicket(channelId, claimedBy) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    'UPDATE tickets SET status = ?, claimed_by = ?, claimed_at = ? WHERE channel_id = ?',
    ['claimed', claimedBy, now, channelId]
  );
}

export async function reopenTicket(channelId) {
  return db.run(
    'UPDATE tickets SET status = ?, closed_at = NULL, closed_by = NULL, claimed_by = NULL, claimed_at = NULL WHERE channel_id = ?',
    ['open', channelId]
  );
}

export async function deleteTicket(channelId) {
  return db.run('DELETE FROM tickets WHERE channel_id = ?', [channelId]);
}

export async function getExpiredClosedTickets(olderThanUnix) {
  return db.query(
    'SELECT * FROM tickets WHERE status = ? AND closed_at < ?',
    ['closed', olderThanUnix]
  );
}

export async function getTicket(channelId) {
  return db.get('SELECT * FROM tickets WHERE channel_id = ?', [channelId]);
}

export async function getUserActiveTicket(creatorId) {
  return db.get(
    'SELECT * FROM tickets WHERE creator_id = ? AND status IN (?, ?)',
    [creatorId, 'open', 'claimed']
  );
}

/* ==========================================================================
   LOGS OPERATIONS
   ========================================================================== */

export async function addLog(type, userId, action, details = '') {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    'INSERT INTO logs (timestamp, type, user_id, action, details) VALUES (?, ?, ?, ?, ?)',
    [now, type, userId, action, details]
  );
}

/* ==========================================================================
   LANGUAGES OPERATIONS (Manual Overrides)
   ========================================================================== */

export async function setUserLanguage(userId, lang) {
  return db.run(
    'INSERT INTO languages (user_id, lang) VALUES (?, ?) ON CONFLICT(user_id) DO UPDATE SET lang = excluded.lang',
    [userId, lang]
  );
}

export async function getUserLanguage(userId) {
  const row = await db.get('SELECT lang FROM languages WHERE user_id = ?', [userId]);
  return row ? row.lang : null;
}

/* ==========================================================================
   DYNAMIC CONFIGURATION & SERVER PARAMETERS
   ========================================================================== */

export async function setConfigValue(key, value) {
  return db.run(
    'INSERT INTO config (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, JSON.stringify(value)]
  );
}

export async function getConfigValue(key) {
  const row = await db.get('SELECT value FROM config WHERE key = ?', [key]);
  if (!row) return null;
  try {
    return JSON.parse(row.value);
  } catch {
    return row.value;
  }
}

export async function setServerParam(key, value) {
  return db.run(
    'INSERT INTO server_parameters (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value]
  );
}

export async function getServerParam(key) {
  const row = await db.get('SELECT value FROM server_parameters WHERE key = ?', [key]);
  return row ? row.value : null;
}

export async function createApplication(userId, username, applicationData = null) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    'INSERT INTO staff_applications (user_id, username, status, created_at, application_data) VALUES (?, ?, ?, ?, ?)',
    [userId, username, 'pending', now, applicationData]
  );
}

export async function getPendingApplication(userId) {
  return db.get(
    'SELECT * FROM staff_applications WHERE user_id = ? AND status IN (?, ?, ?)',
    [userId, 'pending', 'in_review', 'contacted']
  );
}

export async function getPendingApplications() {
  return db.query(
    'SELECT * FROM staff_applications WHERE status IN (?, ?, ?) ORDER BY created_at ASC',
    ['pending', 'in_review', 'contacted']
  );
}

export async function updateApplicationStatus(id, status, messageId = null) {
  if (messageId) {
    return db.run(
      'UPDATE staff_applications SET status = ?, message_id = ? WHERE id = ?',
      [status, messageId, id]
    );
  }
  return db.run(
    'UPDATE staff_applications SET status = ? WHERE id = ?',
    [status, id]
  );
}

export async function updateApplicationData(id, applicationData) {
  return db.run(
    'UPDATE staff_applications SET application_data = ? WHERE id = ?',
    [applicationData, id]
  );
}

export async function getApplication(id) {
  return db.get(
    'SELECT * FROM staff_applications WHERE id = ?',
    [id]
  );
}

export async function setStaffApplyCooldown(userId, rejectedAt, expiresAt) {
  return db.run(
    `INSERT INTO staff_apply_cooldowns (user_id, rejected_at, expires_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       rejected_at = excluded.rejected_at,
       expires_at = excluded.expires_at`,
    [userId, rejectedAt, expiresAt]
  );
}

export async function getStaffApplyCooldown(userId) {
  return db.get(
    'SELECT * FROM staff_apply_cooldowns WHERE user_id = ?',
    [userId]
  );
}

export async function clearStaffApplyCooldown(userId) {
  return db.run(
    'DELETE FROM staff_apply_cooldowns WHERE user_id = ?',
    [userId]
  );
}

export async function createStreamerApplication(userId, username, applicationData = null) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    'INSERT INTO streamer_applications (user_id, username, status, created_at, application_data) VALUES (?, ?, ?, ?, ?)',
    [userId, username, 'pending', now, applicationData]
  );
}

export async function getPendingStreamerApplication(userId) {
  return db.get(
    'SELECT * FROM streamer_applications WHERE user_id = ? AND status IN (?, ?, ?)',
    [userId, 'pending', 'in_review', 'contacted']
  );
}

export async function getPendingStreamerApplications() {
  return db.query(
    'SELECT * FROM streamer_applications WHERE status IN (?, ?, ?) ORDER BY created_at ASC',
    ['pending', 'in_review', 'contacted']
  );
}

export async function updateStreamerApplicationStatus(id, status, messageId = null) {
  if (messageId) {
    return db.run(
      'UPDATE streamer_applications SET status = ?, message_id = ? WHERE id = ?',
      [status, messageId, id]
    );
  }
  return db.run(
    'UPDATE streamer_applications SET status = ? WHERE id = ?',
    [status, id]
  );
}

export async function updateStreamerApplicationData(id, applicationData) {
  return db.run(
    'UPDATE streamer_applications SET application_data = ? WHERE id = ?',
    [applicationData, id]
  );
}

export async function getStreamerApplication(id) {
  return db.get(
    'SELECT * FROM streamer_applications WHERE id = ?',
    [id]
  );
}

export async function setStreamerApplyCooldown(userId, rejectedAt, expiresAt) {
  return db.run(
    `INSERT INTO streamer_apply_cooldowns (user_id, rejected_at, expires_at)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       rejected_at = excluded.rejected_at,
       expires_at = excluded.expires_at`,
    [userId, rejectedAt, expiresAt]
  );
}

export async function getStreamerApplyCooldown(userId) {
  return db.get(
    'SELECT * FROM streamer_apply_cooldowns WHERE user_id = ?',
    [userId]
  );
}

export async function clearStreamerApplyCooldown(userId) {
  return db.run(
    'DELETE FROM streamer_apply_cooldowns WHERE user_id = ?',
    [userId]
  );
}

/* ========================================================================== 
   BETA OPERATIONS
   ========================================================================== */

export async function queueBetaWelcome(guildId, userId) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO beta_welcome_queue (guild_id, user_id, queued_at)
     VALUES (?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       queued_at = excluded.queued_at`,
    [guildId, userId, now]
  );
}

export async function getBetaWelcomeQueue(guildId, userId) {
  return db.get(
    'SELECT * FROM beta_welcome_queue WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

export async function markBetaWelcomeSent(guildId, userId, lang = null) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO beta_welcome_queue (guild_id, user_id, lang, queued_at, sent_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       lang = excluded.lang,
       sent_at = excluded.sent_at`,
    [guildId, userId, lang, now, now]
  );
}

export async function getPendingBetaWelcomes(guildId) {
  return db.query(
    'SELECT * FROM beta_welcome_queue WHERE guild_id = ? AND sent_at IS NULL',
    [guildId]
  );
}

/* ========================================================================== 
   INVITE REFERRAL OPERATIONS
   ========================================================================== */

export async function upsertInviteReferral({
  guildId,
  inviteeId,
  inviteeTag,
  inviterId,
  inviteCode = null,
  joinedAt = Math.floor(Date.now() / 1000),
  leftAt = null
}) {
  return db.run(
    `INSERT INTO guild_invite_referrals (
       guild_id, invitee_id, invitee_tag, inviter_id, invite_code, joined_at, left_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, invitee_id) DO UPDATE SET
       invitee_tag = excluded.invitee_tag,
       inviter_id = excluded.inviter_id,
       invite_code = excluded.invite_code,
       joined_at = excluded.joined_at,
       left_at = excluded.left_at`,
    [guildId, inviteeId, inviteeTag, inviterId, inviteCode, joinedAt, leftAt]
  );
}

export async function markInviteReferralLeft(guildId, inviteeId, leftAt = Math.floor(Date.now() / 1000)) {
  return db.run(
    'UPDATE guild_invite_referrals SET left_at = ? WHERE guild_id = ? AND invitee_id = ?',
    [leftAt, guildId, inviteeId]
  );
}

export async function getInviteReferral(guildId, inviteeId) {
  return db.get(
    'SELECT * FROM guild_invite_referrals WHERE guild_id = ? AND invitee_id = ?',
    [guildId, inviteeId]
  );
}

export async function getInviteReferralsByInviter(guildId, inviterId) {
  return db.query(
    'SELECT * FROM guild_invite_referrals WHERE guild_id = ? AND inviter_id = ? ORDER BY joined_at DESC',
    [guildId, inviterId]
  );
}

export async function getInviteLeaderboard(guildId, limit = 20) {
  return db.query(
    `SELECT inviter_id, COUNT(*) AS total_invites
     FROM guild_invite_referrals
     WHERE guild_id = ?
     GROUP BY inviter_id
     ORDER BY total_invites DESC, inviter_id ASC
     LIMIT ?`,
    [guildId, limit]
  );
}

export async function getInviteRank(guildId, inviterId) {
  return db.get(
    `WITH ranked AS (
       SELECT inviter_id, COUNT(*) AS total_invites
       FROM guild_invite_referrals
       WHERE guild_id = ?
       GROUP BY inviter_id
     )
     SELECT 1 + COUNT(*) AS rank
     FROM ranked current
     WHERE current.total_invites > (
       SELECT COUNT(*)
       FROM guild_invite_referrals
       WHERE guild_id = ? AND inviter_id = ?
     )
     OR (
       current.total_invites = (
         SELECT COUNT(*)
         FROM guild_invite_referrals
         WHERE guild_id = ? AND inviter_id = ?
       )
       AND current.inviter_id < ?
     )`,
    [guildId, guildId, inviterId, guildId, inviterId, inviterId]
  );
}

export async function setGuildAntiLinkState(guildId, enabled) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO guild_antilink_settings (guild_id, enabled, updated_at)
     VALUES (?, ?, ?)
     ON CONFLICT(guild_id) DO UPDATE SET
       enabled = excluded.enabled,
       updated_at = excluded.updated_at`,
    [guildId, enabled ? 1 : 0, now]
  );
}

export async function getGuildAntiLinkState(guildId) {
  return db.get(
    'SELECT * FROM guild_antilink_settings WHERE guild_id = ?',
    [guildId]
  );
}

export async function addGuildAntiLinkWhitelist(guildId, userId, addedBy = null) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO guild_antilink_whitelist (guild_id, user_id, added_by, added_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       added_by = excluded.added_by,
       added_at = excluded.added_at`,
    [guildId, userId, addedBy, now]
  );
}

export async function removeGuildAntiLinkWhitelist(guildId, userId) {
  return db.run(
    'DELETE FROM guild_antilink_whitelist WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

export async function getGuildAntiLinkWhitelist(guildId) {
  return db.query(
    'SELECT * FROM guild_antilink_whitelist WHERE guild_id = ? ORDER BY added_at ASC',
    [guildId]
  );
}

export async function isGuildAntiLinkWhitelisted(guildId, userId) {
  return db.get(
    'SELECT 1 FROM guild_antilink_whitelist WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

export async function addGuildAntiLinkBlacklist(guildId, userId, addedBy = null) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO guild_antilink_blacklist (guild_id, user_id, added_by, added_at)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       added_by = excluded.added_by,
       added_at = excluded.added_at`,
    [guildId, userId, addedBy, now]
  );
}

export async function removeGuildAntiLinkBlacklist(guildId, userId) {
  return db.run(
    'DELETE FROM guild_antilink_blacklist WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

export async function getGuildAntiLinkBlacklist(guildId) {
  return db.query(
    'SELECT * FROM guild_antilink_blacklist WHERE guild_id = ? ORDER BY added_at ASC',
    [guildId]
  );
}

export async function isGuildAntiLinkBlacklisted(guildId, userId) {
  return db.get(
    'SELECT 1 FROM guild_antilink_blacklist WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

/* ========================================================================== 
   TEMP BAN OPERATIONS
   ========================================================================== */

export async function upsertTempBan({ guildId, userId, moderatorId, reason, unbanAt }) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO guild_temp_bans (guild_id, user_id, moderator_id, reason, unban_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       moderator_id = excluded.moderator_id,
       reason = excluded.reason,
       unban_at = excluded.unban_at,
       created_at = excluded.created_at`,
    [guildId, userId, moderatorId, reason, unbanAt, now]
  );
}

export async function deleteTempBan(guildId, userId) {
  return db.run(
    'DELETE FROM guild_temp_bans WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

export async function getDueTempBans(nowUnix = Math.floor(Date.now() / 1000)) {
  return db.query(
    'SELECT * FROM guild_temp_bans WHERE unban_at <= ? ORDER BY unban_at ASC',
    [nowUnix]
  );
}

export async function getTempBans() {
  return db.query(
    'SELECT * FROM guild_temp_bans ORDER BY unban_at ASC',
    []
  );
}

/* ========================================================================== 
   XP OPERATIONS
   ========================================================================== */

export async function getXpProfile(guildId, userId) {
  return db.get(
    'SELECT * FROM guild_xp_profiles WHERE guild_id = ? AND user_id = ?',
    [guildId, userId]
  );
}

export async function saveXpProfile(guildId, userId, profile) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO guild_xp_profiles (
       guild_id, user_id, total_xp, total_messages,
       messages_since_reward, total_voice_seconds,
       voice_seconds_since_reward, total_takedown_seconds,
       takedown_seconds_since_reward, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(guild_id, user_id) DO UPDATE SET
       total_xp = excluded.total_xp,
       total_messages = excluded.total_messages,
       messages_since_reward = excluded.messages_since_reward,
       total_voice_seconds = excluded.total_voice_seconds,
       voice_seconds_since_reward = excluded.voice_seconds_since_reward,
       total_takedown_seconds = excluded.total_takedown_seconds,
       takedown_seconds_since_reward = excluded.takedown_seconds_since_reward,
       updated_at = excluded.updated_at`,
    [
      guildId,
      userId,
      profile.total_xp ?? 0,
      profile.total_messages ?? 0,
      profile.messages_since_reward ?? 0,
      profile.total_voice_seconds ?? 0,
      profile.voice_seconds_since_reward ?? 0,
      profile.total_takedown_seconds ?? 0,
      profile.takedown_seconds_since_reward ?? 0,
      now
    ]
  );
}

export async function getXpLeaderboard(guildId, limit = 10) {
  return db.query(
    `SELECT guild_id, user_id, total_xp, total_messages, total_voice_seconds, total_takedown_seconds
     FROM guild_xp_profiles
     WHERE guild_id = ?
     ORDER BY total_xp DESC, total_messages DESC, user_id ASC
     LIMIT ?`,
    [guildId, limit]
  );
}

export async function getXpRank(guildId, userId) {
  const profile = await getXpProfile(guildId, userId);
  if (!profile) return null;

  const row = await db.get(
    `SELECT COUNT(*) AS rank
     FROM guild_xp_profiles
     WHERE guild_id = ?
       AND (
         total_xp > ?
         OR (total_xp = ? AND total_messages > ?)
         OR (total_xp = ? AND total_messages = ? AND user_id <= ?)
       )`,
    [
      guildId,
      profile.total_xp,
      profile.total_xp,
      profile.total_messages,
      profile.total_xp,
      profile.total_messages,
      userId
    ]
  );

  return row ? Number(row.rank) : null;
}

/* ========================================================================== 
   PANEL REFRESH OPERATIONS
   ========================================================================== */

export async function upsertPanelRefreshRecord(record) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    `INSERT INTO panel_refresh_records (
       key, guild_id, channel_id, message_ids, member_id,
       refresh_on_member_update, panel_type, payload, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       guild_id = excluded.guild_id,
       channel_id = excluded.channel_id,
       message_ids = excluded.message_ids,
       member_id = excluded.member_id,
       refresh_on_member_update = excluded.refresh_on_member_update,
       panel_type = excluded.panel_type,
       payload = excluded.payload,
       updated_at = excluded.updated_at`,
    [
      record.key,
      record.guildId,
      record.channelId,
      JSON.stringify(record.messageIds || []),
      record.memberId || null,
      record.refreshOnMemberUpdate ? 1 : 0,
      record.panelType || null,
      record.payload ? JSON.stringify(record.payload) : null,
      now
    ]
  );
}

export async function deletePanelRefreshRecord(key) {
  return db.run('DELETE FROM panel_refresh_records WHERE key = ?', [key]);
}

export async function getPanelRefreshRecords() {
  return db.query('SELECT * FROM panel_refresh_records', []);
}

/* ==========================================================================
   STAFF ACTIONS OPERATIONS
   ========================================================================== */

export async function addStaffAction({ executorId, targetId, actionType, reason }) {
  const now = Math.floor(Date.now() / 1000);
  return db.run(
    'INSERT INTO staff_actions (executor_id, target_id, action_type, reason, created_at) VALUES (?, ?, ?, ?, ?)',
    [executorId, targetId, actionType, reason, now]
  );
}

export async function getStaffActions(targetId) {
  return db.query(
    'SELECT * FROM staff_actions WHERE target_id = ? ORDER BY created_at DESC',
    [targetId]
  );
}

export async function getAllStaffActions() {
  return db.query('SELECT * FROM staff_actions ORDER BY created_at DESC', []);
}

/**
 * Supprime une action staff (warn/note) par son ID.
 * Seuls les types WARN et NOTE sont supprimables.
 */
export async function deleteStaffAction(id) {
  return db.run(
    'DELETE FROM staff_actions WHERE id = ? AND action_type IN ("WARN", "NOTE")',
    [id]
  );
}

/* ========================================================================== 
   STREAMER STATUS OPERATIONS
   ========================================================================== */

export async function upsertStreamerStatus(userId, status = 'test', startedAt = null, testUntil = null) {
  const now = Math.floor(Date.now() / 1000);
  const effectiveStartedAt = startedAt ?? now;
  return db.run(
    `INSERT INTO streamer_statuses (user_id, status, started_at, test_until, updated_at)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       status = excluded.status,
       started_at = excluded.started_at,
       test_until = excluded.test_until,
       updated_at = excluded.updated_at`,
    [userId, status, effectiveStartedAt, testUntil, now]
  );
}

export async function clearStreamerStatus(userId) {
  return db.run('DELETE FROM streamer_statuses WHERE user_id = ?', [userId]);
}

export async function getStreamerStatus(userId) {
  return db.get('SELECT * FROM streamer_statuses WHERE user_id = ?', [userId]);
}

export async function getAllStreamerStatuses() {
  return db.query('SELECT * FROM streamer_statuses', []);
}

export async function promoteExpiredStreamerTests(nowUnix = Math.floor(Date.now() / 1000)) {
  return db.run(
    `UPDATE streamer_statuses
     SET status = 'active', test_until = NULL, updated_at = ?
     WHERE status = 'test' AND test_until IS NOT NULL AND test_until <= ?`,
    [nowUnix, nowUnix]
  );
}

export default {
  initDb,
  createTicket,
  reserveNextTicketNumber,
  assignTicketNumber,
  closeTicket,
  claimTicket,
  reopenTicket,
  deleteTicket,
  getTicket,
  getUserActiveTicket,
  getExpiredClosedTickets,
  addLog,
  setUserLanguage,
  getUserLanguage,
  upsertInviteReferral,
  markInviteReferralLeft,
  getInviteReferral,
  getInviteReferralsByInviter,
  getInviteLeaderboard,
  setConfigValue,
  getConfigValue,
  setServerParam,
  getServerParam,
  createApplication,
  getPendingApplication,
  getPendingApplications,
  updateApplicationStatus,
  updateApplicationData,
  getApplication,
  setStaffApplyCooldown,
  getStaffApplyCooldown,
  clearStaffApplyCooldown,
  createStreamerApplication,
  getPendingStreamerApplication,
  getPendingStreamerApplications,
  updateStreamerApplicationStatus,
  updateStreamerApplicationData,
  getStreamerApplication,
  setStreamerApplyCooldown,
  getStreamerApplyCooldown,
  clearStreamerApplyCooldown,
  queueBetaWelcome,
  getBetaWelcomeQueue,
  markBetaWelcomeSent,
  getPendingBetaWelcomes,
  setGuildAntiLinkState,
  getGuildAntiLinkState,
  addGuildAntiLinkWhitelist,
  removeGuildAntiLinkWhitelist,
  getGuildAntiLinkWhitelist,
  isGuildAntiLinkWhitelisted,
  addGuildAntiLinkBlacklist,
  removeGuildAntiLinkBlacklist,
  getGuildAntiLinkBlacklist,
  isGuildAntiLinkBlacklisted,
  upsertTempBan,
  deleteTempBan,
  getDueTempBans,
  getTempBans,
  getXpProfile,
  saveXpProfile,
  getXpLeaderboard,
  getXpRank,
  upsertPanelRefreshRecord,
  deletePanelRefreshRecord,
  getPanelRefreshRecords,
  addStaffAction,
  getStaffActions,
  getAllStaffActions,
  deleteStaffAction,
  upsertStreamerStatus,
  clearStreamerStatus,
  getStreamerStatus,
  getAllStreamerStatuses,
  promoteExpiredStreamerTests
};
