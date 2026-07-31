import {
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from 'discord.js';
import config from '../config/config.js';
import { isStaffOrAdmin } from './moderationService.js';
import { appendSeparatorComponent, sendV2Container } from '../utils/v2Helper.js';
import dbService from '../database/dbProxy.js';

const STREAMER_TEST_DURATION_SECONDS = 7 * 24 * 60 * 60;
let streamerMaintenanceInterval = null;

function getUnixNow() {
  return Math.floor(Date.now() / 1000);
}

function formatUnixDate(unixTimestamp) {
  if (!unixTimestamp) return '—';
  return new Date(unixTimestamp * 1000).toLocaleString('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short'
  });
}

export async function sendStreamerPanel(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const text = new TextDisplayBuilder().setContent(
    'PANEL STREAMER\n\n' +
    'Tu es streamer sur **Takedown** ? Lance ton live et annonce-le à la communauté !\n\n' +
    '-# Clique sur le bouton ci-dessous, entre le lien de ton stream et l\'annonce sera envoyée automatiquement.'
  );

  const liveBtn = new ButtonBuilder()
    .setCustomId('streamer_go_live')
    .setLabel('Je lance mon live !')
    .setStyle(ButtonStyle.Danger);

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text);

  appendSeparatorComponent(container);
  container.addActionRowComponents(new ActionRowBuilder().addComponents(liveBtn));

  await sendV2Container(interaction.channel, container);
  await interaction.deleteReply().catch(() => null);
}

export async function handleStreamerGoLive(interaction) {
  const hasRole =
    interaction.member.roles.cache.has(config.streamer.role) ||
    isStaffOrAdmin(interaction.member);

  if (!hasRole) {
    return interaction.reply({
      content: '-# Vous devez avoir le rôle **Streamer** pour utiliser ce bouton.',
      flags: MessageFlags.Ephemeral
    });
  }

  const modal = new ModalBuilder()
    .setCustomId('streamer_live_modal')
    .setTitle('Annoncer mon live');

  const linkInput = new TextInputBuilder()
    .setCustomId('stream_link')
    .setLabel('Lien de ton stream')
    .setPlaceholder('https://twitch.tv/tonpseudo  ou  https://youtube.com/...')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(200);

  const descInput = new TextInputBuilder()
    .setCustomId('stream_desc')
    .setLabel('Description (optionnel)')
    .setPlaceholder('Ex : Soirée course-poursuite en live !')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(false)
    .setMaxLength(300);

  modal.addComponents(
    new ActionRowBuilder().addComponents(linkInput),
    new ActionRowBuilder().addComponents(descInput)
  );

  await interaction.showModal(modal);
}

export async function handleStreamerLiveModalSubmit(interaction) {
  const streamLink = interaction.fields.getTextInputValue('stream_link').trim();
  const streamDesc = interaction.fields.getTextInputValue('stream_desc')?.trim() || null;

  const isValidUrl = /^https?:\/\/.+\..+/.test(streamLink);
  if (!isValidUrl) {
    return interaction.reply({
      content: '-# Lien invalide. Veuillez entrer une URL complète (https://...).',
      flags: MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const announceChannelId = config.streamer.announceChannel;
  const pingRoleId = config.streamer.pingRole;

  const announceChannel = interaction.guild.channels.cache.get(announceChannelId)
    || await interaction.guild.channels.fetch(announceChannelId).catch(() => null);

  if (!announceChannel) {
    return interaction.editReply({ content: '-# Salon d\'annonce introuvable. Contactez un admin.' });
  }

  const streamer = interaction.user;
  const descLine = streamDesc ? `\n> *${streamDesc}*` : '';
  const watchBtn = new ButtonBuilder()
    .setLabel('Regarder le live')
    .setStyle(ButtonStyle.Link)
    .setURL(streamLink);

  const container = new ContainerBuilder()
    .setAccentColor(0xED4245)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### LIVE EN COURS !\n\n<@${streamer.id}> est en live sur Takedown !${descLine}`
      )
    );

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `🔗 Lien du stream : ${streamLink}\n🖼️ Affiche du stream : ${streamLink}\n\n-# Rejoins maintenant et soutiens le stream !`
    )
  );
  container.addActionRowComponents(new ActionRowBuilder().addComponents(watchBtn));

  if (pingRoleId) {
    await announceChannel.send({ content: `<@&${pingRoleId}>` }).catch(() => null);
  }

  await sendV2Container(announceChannel, container);

  return interaction.editReply({
    content: `✅ Ton live a été annoncé dans <#${announceChannelId}> !`
  });
}

export default {
  sendStreamerPanel,
  handleStreamerGoLive,
  handleStreamerLiveModalSubmit
};
