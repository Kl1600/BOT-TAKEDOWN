import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  SectionBuilder,
  ThumbnailBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  TextDisplayBuilder
} from 'discord.js';
import config from '../config/config.js';
import dbService from '../database/dbProxy.js';
import * as logger from '../utils/logger.js';
import { appendSeparatorComponent, sendV2Container } from '../utils/v2Helper.js';

const INVITE_LOG_CHANNEL_ID = '1526555009410400276';
const inviteCaches = new Map();

function getUnixNow() {
  return Math.floor(Date.now() / 1000);
}

function getDisplayTag(user) {
  return user?.tag || user?.username || 'Utilisateur inconnu';
}

function getMemberDisplayName(member) {
  return member?.displayName
    || member?.user?.tag
    || member?.user?.username
    || 'Membre inconnu';
}

async function getInviteRank(guildId, inviterId) {
  const result = await dbService.getInviteRank(guildId, inviterId).catch(() => null);
  return Number(result?.rank || 0) || null;
}

function getInviteCopy(lang = 'fr') {
  if (lang === 'en') {
    return {
      profileTitle: 'Invitations',
      totalInvites: 'Total invited',
      stillPresent: 'Still here',
      leftServer: 'Left',
      invitedMembers: 'Invited members',
      noInvites: 'This member has not invited anyone yet.'
    };
  }

  return {
    profileTitle: 'Invitations',
    totalInvites: 'Total invités',
    stillPresent: 'Toujours présents',
    leftServer: 'Ont quitté',
    invitedMembers: 'Membres invités',
    noInvites: "Tu n'as encore invité personne.",
    classement: 'Classement'
  };
}

function buildInviteSnapshot(invites) {
  const snapshot = new Map();

  for (const invite of invites.values()) {
    snapshot.set(invite.code, {
      uses: invite.uses ?? 0,
      inviterId: invite.inviter?.id || invite.inviterId || null
    });
  }

  return snapshot;
}

async function fetchInviteSnapshot(guild) {
  try {
    const invites = await guild.invites.fetch();
    const snapshot = buildInviteSnapshot(invites);
    inviteCaches.set(guild.id, snapshot);
    return snapshot;
  } catch (err) {
    logger.warn(`Impossible de récupérer les invites du serveur ${guild.id}: ${err?.message || err}`);
    return null;
  }
}

async function refreshInviteSnapshot(guild) {
  return fetchInviteSnapshot(guild);
}

async function ensureInviteSnapshot(guild) {
  return inviteCaches.get(guild.id) || await fetchInviteSnapshot(guild);
}

async function resolveUsedInvite(guild) {
  const previousSnapshot = inviteCaches.get(guild.id) || await ensureInviteSnapshot(guild);
  if (!previousSnapshot) {
    return null;
  }

  let currentInvites;
  try {
    currentInvites = await guild.invites.fetch();
  } catch (err) {
    logger.warn(`Impossible de comparer les invites du serveur ${guild.id}: ${err?.message || err}`);
    return null;
  }

  const currentSnapshot = buildInviteSnapshot(currentInvites);
  inviteCaches.set(guild.id, currentSnapshot);

  let selectedInvite = null;
  for (const invite of currentInvites.values()) {
    const currentUses = invite.uses ?? 0;
    const previousUses = previousSnapshot.get(invite.code)?.uses ?? 0;
    const delta = currentUses - previousUses;

    if (delta > 0 && (!selectedInvite || delta > selectedInvite.delta)) {
      selectedInvite = {
        code: invite.code,
        inviterId: invite.inviter?.id || invite.inviterId || previousSnapshot.get(invite.code)?.inviterId || null,
        uses: currentUses,
        delta
      };
    }
  }

  return selectedInvite;
}

function buildInviteLogContainer({ guild, inviteeId, inviteeTag, inviterId, inviteCode }) {
  const text = new TextDisplayBuilder().setContent([
    'NOUVELLE INVITATION DÉTECTÉE',
    '',
    `**Serveur** : ${guild.name}`,
    `**Invité** : <@${inviteeId}> (\`${inviteeTag}\`)`,
    `**Parrain** : <@${inviterId}>`
  ].join('\n'));

  return new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text);
}

async function buildInviteProfileContainer({ guild, inviterId, referrals, member, lang = 'fr' }) {
  const copy = getInviteCopy(lang);
  const totalInvites = referrals.length;
  const stillPresent = referrals.filter(referral => !referral.left_at).length;
  const leftServer = totalInvites - stillPresent;
  const displayName = getMemberDisplayName(member);
  const avatarUrl = member?.displayAvatarURL?.({ size: 256 })
    || member?.user?.displayAvatarURL?.({ size: 256 })
    || null;
  const inviteRank = totalInvites > 0 ? await getInviteRank(guild.id, inviterId) : null;

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addSectionComponents(
      new SectionBuilder()
        .setThumbnailAccessory(
          new ThumbnailBuilder().setURL(avatarUrl || 'https://cdn.discordapp.com/embed/avatars/0.png')
        )
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent([
            `**${displayName}**`,
            '**Profil de parrainage**',
            `**${totalInvites}** invitation(s) • **${stillPresent}** encore présentes • **${leftServer}** parties`
          ].join('\n'))
        )
    );

  appendSeparatorComponent(container);
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`invite_total_${guild.id}_${inviterId}`)
        .setLabel(`Invitations ${totalInvites}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`invite_present_${guild.id}_${inviterId}`)
        .setLabel(`Présents ${stillPresent}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`invite_left_${guild.id}_${inviterId}`)
        .setLabel(`Partis ${leftServer}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true),
      new ButtonBuilder()
        .setCustomId(`invite_rank_${guild.id}_${inviterId}`)
        .setLabel(`${copy.classement} ${inviteRank ? `#${inviteRank}` : '#-'}`)
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(true)
    )
  );

  return container;
}

function buildInviteLeaderboardContainer(guild, leaderboardRows) {
  const lines = leaderboardRows.length === 0
    ? ['> Aucun parrainage enregistré pour le moment.']
    : leaderboardRows.map((row, index) => `**${index + 1}.** ${row.inviter_id} — **${row.total_invites}** invitation(s)\nID : \`${row.inviter_id}\``);

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        '### CLASSEMENT DES PARRAINS',
        lines.join('\n')
      ].join('\n'))
    );

  if (leaderboardRows.length === 0) {
    return container;
  }

  appendSeparatorComponent(container);
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`invite_profile_modal_${guild.id}`)
        .setLabel('Détail')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

async function logInviteJoin(client, payload) {
  const logChannel = await client.channels.fetch(INVITE_LOG_CHANNEL_ID).catch(() => null);
  if (!logChannel || !logChannel.isTextBased()) {
    return;
  }

  const container = buildInviteLogContainer(payload);
  await sendV2Container(logChannel, container).catch(() => null);
}

export async function initializeInviteTracking(client) {
  if (!client?.guilds?.cache) {
    return;
  }

  for (const guild of client.guilds.cache.values()) {
    await refreshInviteSnapshot(guild).catch(() => null);
  }
}

export async function handleInviteCreate(invite) {
  if (!invite?.guild) return;
  const guild = invite.guild;
  const snapshot = inviteCaches.get(guild.id) || new Map();
  snapshot.set(invite.code, {
    uses: invite.uses ?? 0,
    inviterId: invite.inviter?.id || invite.inviterId || null
  });
  inviteCaches.set(guild.id, snapshot);
}

export async function handleInviteDelete(invite) {
  if (!invite?.guild) return;

  const snapshot = inviteCaches.get(invite.guild.id);
  if (snapshot) {
    snapshot.delete(invite.code);
  }
}

export async function handleGuildMemberInviteJoin(member, client) {
  if (!member?.guild || member.user?.bot) return null;

  const usedInvite = await resolveUsedInvite(member.guild);
  if (!usedInvite?.inviterId) {
    return null;
  }

  const joinedAt = getUnixNow();
  const inviteeTag = getDisplayTag(member.user);

  await dbService.upsertInviteReferral({
    guildId: member.guild.id,
    inviteeId: member.id,
    inviteeTag,
    inviterId: usedInvite.inviterId,
    inviteCode: usedInvite.code,
    joinedAt,
    leftAt: null
  }).catch(err => logger.warn(`Impossible d'enregistrer le parrainage de ${member.id}: ${err?.message || err}`));

  await logInviteJoin(client, {
    guild: member.guild,
    inviteeId: member.id,
    inviteeTag,
    inviterId: usedInvite.inviterId,
    inviteCode: usedInvite.code
  });

  return usedInvite;
}

export async function handleGuildMemberInviteLeave(member) {
  if (!member?.guild || member.user?.bot) return null;

  await dbService.markInviteReferralLeft(member.guild.id, member.id).catch(() => null);
  return true;
}

export async function handleInviteProfileButton(interaction) {
  const match = interaction.customId.match(/^invite_profile_modal_(\d{17,20})$/);
  if (!match) {
    return false;
  }

  const guildId = match[1];
  const guild = interaction.guild;
  if (!guild || guild.id !== guildId) {
    return interaction.reply({
      content: '-# Ce menu ne correspond pas à ce serveur.',
      flags: MessageFlags.Ephemeral
    });
  }

  const modal = new ModalBuilder()
    .setCustomId(`invite_profile_modal_submit_${guildId}`)
    .setTitle('Voir un profil de parrainage');

  const input = new TextInputBuilder()
    .setCustomId('invite_profile_inviter_id')
    .setLabel('ID du parrain')
    .setPlaceholder('Colle l’ID Discord du parrain ici')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(20);

  modal.addComponents(new ActionRowBuilder().addComponents(input));

  await interaction.showModal(modal);
  return true;
}

function parseInviteProfileId(value) {
  const raw = String(value || '').trim();
  const mention = raw.match(/^<@!?? (\d{17,20})>$/);
  if (mention) {
    return mention[1];
  }

  const id = raw.match(/^\d{17,20}$/);
  return id ? raw : null;
}

export async function handleInviteProfileModalSubmit(interaction) {
  const match = interaction.customId.match(/^invite_profile_modal_submit_(\d{17,20})$/);
  if (!match) {
    return false;
  }

  const guildId = match[1];
  const guild = interaction.guild;
  if (!guild || guild.id !== guildId) {
    return interaction.reply({
      content: '-# Ce formulaire ne correspond pas à ce serveur.',
      flags: MessageFlags.Ephemeral
    });
  }

  const inviterId = parseInviteProfileId(interaction.fields.getTextInputValue('invite_profile_inviter_id'));
  if (!inviterId) {
    return interaction.reply({
      content: '-# ID invalide. Colle un ID Discord valide ou une mention.',
      flags: MessageFlags.Ephemeral
    });
  }

  const referrals = await dbService.getInviteReferralsByInviter(guild.id, inviterId).catch(() => []);
  const member = guild.members.cache.get(inviterId) || await guild.members.fetch(inviterId).catch(() => null);
  const container = await buildInviteProfileContainer({ guild, inviterId, referrals, member });

  return interaction.reply({
    components: [container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
  });
}

export async function buildInviteProfileResponse(guild, inviterId, referrals, member = null, lang = 'fr') {
  return buildInviteProfileContainer({ guild, inviterId, referrals, member, lang });
}

export { buildInviteLeaderboardContainer };

export async function sendInviteLeaderboard() {
  return null;
}

export async function startInviteLeaderboardScheduler(client) {
  return null;
}

export default {
  initializeInviteTracking,
  handleInviteCreate,
  handleInviteDelete,
  handleGuildMemberInviteJoin,
  handleGuildMemberInviteLeave,
  handleInviteProfileButton,
  handleInviteProfileModalSubmit,
  buildInviteProfileResponse,
  sendInviteLeaderboard,
  startInviteLeaderboardScheduler
};
