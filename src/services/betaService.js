import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  TextDisplayBuilder
} from 'discord.js';
import config from '../config/config.js';
import { sendV2Container } from '../utils/v2Helper.js';
import * as logger from '../utils/logger.js';

const BETA_ROLE_ID = config.beta.roleId;
const BETA_FEEDBACK_CHANNEL_ID = config.channels.betaFeedback;
const BETA_END_DATE_LABEL = 'lundi 20 juillet 2026';

function getLanguageRole(member) {
  if (!member?.roles?.cache) return null;
  if (member.roles.cache.has(config.roles.fr)) return 'fr';
  if (member.roles.cache.has(config.roles.en)) return 'en';
  return null;
}

export function buildBetaAccessPanelContainer(lang = 'fr', translateDisabled = false) {
  const text = lang === 'en'
    ? [
        '### BETA ACCESS',
        '',
        'Takedown is currently in beta.',
        '',
        'If you want to participate, click the Beta button to get the beta role and access the server.',
        '',
        'Then open FiveM, search for `takedown`, and join.',
        '',
        `The beta lasts at least until ${BETA_END_DATE_LABEL}.`,
        'It is used to test the server, find bugs, and collect feedback about issues, improvements, additions, and flaws.',
        '',
        '-# 🇬🇧 Click below to translate to English.'
      ].join('\n')
    : [
        '### ACCÃËS BÃÅ TA',
        '',
        'Actuellement Takedown est en bÃÂªta.',
        '',
        'Si vous voulez participer ÃÂ  la bÃÂªta, vous avez juste ÃÂ  cliquer sur le bouton Beta pour rÃÂ©cupÃÂ©rer le rÃÂ´le beta et avoir accÃÂ¨s au serveur.',
        '',
        'Ensuite, tapez `takedown` dans FiveM et rejoignez.',
        '',
        `La bÃÂªta dure jusqu'au minimum ${BETA_END_DATE_LABEL}.`,
        'Elle sert ÃÂ  faire des tests et ÃÂ  trouver les bugs potentiels, ou mÃÂªme ÃÂ  recueillir vos retours sur les bugs, amÃÂ©liorations, ajouts et dÃÂ©fauts.',
        '',
        '-# 🇬🇧 Click below to translate to English.'
      ].join('\n');

  const translateButton = new ButtonBuilder()
    .setCustomId('msg_translate_beta')
    .setLabel('🇬🇧 Translate')
    .setStyle(ButtonStyle.Secondary);

  const betaButton = new ButtonBuilder()
    .setCustomId('beta_access')
    .setLabel('Beta')
    .setStyle(ButtonStyle.Success);

  return new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(new TextDisplayBuilder().setContent(text))
    .addActionRowComponents(new ActionRowBuilder().addComponents(betaButton, translateButton));
}

async function resolveBetaGuild(client) {
  if (config.guildId) {
    return client.guilds.cache.get(config.guildId) || await client.guilds.fetch(config.guildId).catch(() => null);
  }
  return client.guilds.cache.first() || null;
}

async function ensureBetaFeedbackAccess(guild) {
  if (!guild || !BETA_FEEDBACK_CHANNEL_ID || !BETA_ROLE_ID) return;

  const channel = guild.channels.cache.get(BETA_FEEDBACK_CHANNEL_ID)
    || await guild.channels.fetch(BETA_FEEDBACK_CHANNEL_ID).catch(() => null);

  if (!channel || !channel.isTextBased() || !channel.permissionOverwrites?.edit) {
    return;
  }

  await channel.permissionOverwrites.edit(BETA_ROLE_ID, {
    ViewChannel: true,
    SendMessages: true,
    ReadMessageHistory: true
  }).catch(err => logger.warn(`Impossible de configurer l'accÃÂ¨s beta: ${err?.message || err}`));
}

async function grantBetaRole(userId, client) {
  const guild = await resolveBetaGuild(client);
  if (!guild) {
    throw new Error('Serveur beta introuvable.');
  }

  const member = guild.members.cache.get(userId) || await guild.members.fetch(userId).catch(() => null);
  if (!member) {
    throw new Error('Membre introuvable sur le serveur.');
  }

  const role = guild.roles.cache.get(BETA_ROLE_ID) || await guild.roles.fetch(BETA_ROLE_ID).catch(() => null);
  if (!role) {
    throw new Error('RÃÂ´le beta introuvable.');
  }

  if (!member.roles.cache.has(BETA_ROLE_ID)) {
    await member.roles.add(role, 'AccÃÂ¨s bÃÂªta').catch(err => {
      throw new Error(err?.message || 'Impossible dÃ¢â¬â¢ajouter le rÃÂ´le beta.');
    });
  }

  await ensureBetaFeedbackAccess(guild);
  return { guild, member, role };
}

export async function sendBetaAccessPanel(channel, lang = 'fr', translateDisabled = false) {
  const container = buildBetaAccessPanelContainer(lang, translateDisabled);
  return await sendV2Container(channel, container);
}

export async function handleBetaAccessButton(interaction) {
  if (interaction.customId !== 'beta_access') return false;

  try {
    const { member } = await grantBetaRole(interaction.user.id, interaction.client);
    const lang = getLanguageRole(member) || 'fr';
    const guild = await resolveBetaGuild(interaction.client);
    const feedbackChannel = guild.channels.cache.get(BETA_FEEDBACK_CHANNEL_ID) || await guild.channels.fetch(BETA_FEEDBACK_CHANNEL_ID).catch(() => null);

    const replyContent = lang === 'en'
      ? [
          'Ã¢Åâ¦ The beta role has been added.',
          feedbackChannel ? `You can now access <#${BETA_FEEDBACK_CHANNEL_ID}>.` : null
        ].filter(Boolean).join('\n')
      : [
          'Ã¢Åâ¦ Le rÃÂ´le beta tÃ¢â¬â¢a ÃÂ©tÃÂ© ajoutÃÂ©.',
          feedbackChannel ? `Tu peux maintenant accÃÂ©der au salon <#${BETA_FEEDBACK_CHANNEL_ID}>.` : null
        ].filter(Boolean).join('\n');

    const replyPayload = { content: replyContent };
    if (interaction.inGuild?.()) {
      replyPayload.flags = MessageFlags.Ephemeral;
    }

    await interaction.reply(replyPayload).catch(() => null);
  } catch (err) {
    const lang = getLanguageRole(interaction.member) || 'fr';
    const errorPayload = {
      content: `-# ${err?.message || (lang === 'en' ? 'Unable to add the beta role.' : 'Impossible dÃ¢â¬â¢ajouter le rÃÂ´le beta.')}`
    };
    if (interaction.inGuild?.()) {
      errorPayload.flags = MessageFlags.Ephemeral;
    }
    await interaction.reply(errorPayload).catch(() => null);
  }

  return true;
}

export async function ensureBetaAccess(guild) {
  await ensureBetaFeedbackAccess(guild);
}

export default {
  sendBetaAccessPanel,
  handleBetaAccessButton,
  ensureBetaAccess
};


