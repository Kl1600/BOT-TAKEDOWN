import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  MessageFlags
} from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import config from '../../config/config.js';
import dbService from '../../database/dbProxy.js';
import { buildReviewContainer, safeParseApplicationData } from '../../services/recruitmentService.js';

const LIST_SELECT_ID = 'candidatt_select';
const LIST_REFRESH_ID = 'candidatt_refresh';
const LIST_BACK_ID = 'candidatt_back';
const ACTIVE_STATUSES = new Set(['pending', 'in_review', 'contacted']);

const STATUS_LABELS = {
  pending: 'Attente de prise en charge',
  in_review: 'En cours d’examen',
  contacted: 'En cours de contact'
};

function formatCreatedAt(unixTimestamp) {
  return `<t:${unixTimestamp}:R>`;
}

function extractApplicationId(input) {
  const value = Number.parseInt(String(input ?? ''), 10);
  return Number.isInteger(value) && value > 0 ? value : null;
}

function buildListContainer(applications) {
  const container = new ContainerBuilder().setAccentColor(config.colors.primary);

  const header = new TextDisplayBuilder().setContent(
    `### CANDIDATURES EN COURS\n\n` +
    `Sélectionne une candidature pour l’ouvrir, puis utilise les boutons pour refuser ou contacter le candidat.`
  );
  container.addTextDisplayComponents(header);

  if (!applications.length) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('> Aucune candidature en cours pour le moment.')
    );
    return container;
  }

  const select = new StringSelectMenuBuilder()
    .setCustomId(LIST_SELECT_ID)
    .setPlaceholder('Choisir une candidature')
    .setMinValues(1)
    .setMaxValues(1);

  for (const application of applications.slice(0, 25)) {
    select.addOptions({
      label: `${application.username}`.slice(0, 100),
      value: String(application.id),
      description: `${STATUS_LABELS[application.status] || application.status} • ${formatCreatedAt(application.created_at)}`
    });
  }

  const selectRow = new ActionRowBuilder().addComponents(select);
  const refreshRow = new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(LIST_REFRESH_ID)
      .setLabel('🔄 Actualiser')
      .setStyle(ButtonStyle.Primary)
  );

  container.addActionRowComponents(selectRow);
  container.addActionRowComponents(refreshRow);

  if (applications.length > 25) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`-# Affichage limité aux 25 premières candidatures sur ${applications.length}.`)
    );
  }

  return container;
}

function buildDetailContainer(application) {
  const parsed = safeParseApplicationData(application.application_data) || {};
  const session = {
    lang: parsed.language || 'fr',
    selections: parsed.selections || {},
    answers: parsed.answers || {}
  };
  const { container } = buildReviewContainer(session, {
    id: application.user_id,
    username: application.username
  }, application.id, application.status);

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(LIST_BACK_ID)
        .setLabel('↩️ Retour à la liste')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

async function sendListResponse(target, applications) {
  const container = buildListContainer(applications);
  if (typeof target.update === 'function') {
    return target.update({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  return sendV2Container(target, container);
}

async function fetchPendingApplications() {
  return dbService.getPendingApplications().catch(() => []);
}

export const data = new SlashCommandBuilder()
  .setName('candidatt')
  .setDescription('Afficher les candidatures staff en cours');

export async function executeSlash(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const applications = await fetchPendingApplications();
  const container = buildListContainer(applications);

  return interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

export async function executePrefix(message) {
  if (!await checkPermissions(message, message.member)) return;

  await message.delete().catch(() => null);
  const applications = await fetchPendingApplications();
  const container = buildListContainer(applications);
  await sendV2Container(message.channel, container);
}

export async function handleCandidattSelect(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;

  const applicationId = extractApplicationId(interaction.values?.[0]);
  if (!applicationId) {
    return interaction.reply({ content: '-# Candidature invalide.', flags: MessageFlags.Ephemeral });
  }

  const application = await dbService.getApplication(applicationId).catch(() => null);
  if (!application || !ACTIVE_STATUSES.has(application.status)) {
    return interaction.reply({ content: '-# Candidature introuvable ou déjà traitée.', flags: MessageFlags.Ephemeral });
  }

  const container = buildDetailContainer(application);
  return interaction.update({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  }).catch(async () => {
    await interaction.reply({ content: '-# Impossible d’afficher la candidature.', flags: MessageFlags.Ephemeral }).catch(() => null);
  });
}

export async function handleCandidattRefresh(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;
  const applications = await fetchPendingApplications();
  return sendListResponse(interaction, applications);
}

export async function handleCandidattBack(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;
  const applications = await fetchPendingApplications();
  return sendListResponse(interaction, applications);
}

export default {
  data,
  executeSlash,
  executePrefix,
  handleCandidattSelect,
  handleCandidattRefresh,
  handleCandidattBack
};
