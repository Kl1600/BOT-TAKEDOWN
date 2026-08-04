import {
  ChannelType,
  PermissionFlagsBits,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags,
  StringSelectMenuBuilder,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  escapeMarkdown
} from 'discord.js';
import { sendV2Container } from '../utils/v2Helper.js';
import config from '../config/config.js';
import { getLanguage, t } from '../utils/language.js';
import dbService from '../database/dbProxy.js';

const STAFF_APPLY_COOLDOWN_SECONDS = 7 * 24 * 60 * 60;
const STAFF_APPLY_CONTACT_PARENT_ID = '1531313845635907697';
const staffApplySessions = new Map();

const STAFF_APPLICATION_STATE = {
  pending: { fr: 'Attente de prise en charge', en: 'Waiting for review' },
  in_review: { fr: 'En cours d’examen', en: 'Under review' },
  contacted: { fr: 'En cours de contact', en: 'Under contact' },
  rejected: { fr: 'Refusée', en: 'Rejected' },
  error: { fr: 'Erreur', en: 'Error' }
};

const APPLY_COPY = {
  fr: {
    startTitle: '### PRÉ-SÉLECTION CANDIDATURE STAFF',
    startDescription: 'Avant de lancer l\'entretien, choisissez vos informations de base. Ensuite, un parcours de 2 modals se lancera automatiquement pour évaluer votre maturité et votre impartialité.',
    startButton: 'Commencer l\'évaluation',
    savedChoice: 'Choix enregistré.',
    missingChoices: 'Merci de compléter tous les sélecteurs avant de commencer.',
    chatInstructions: 'Répondez maintenant dans le modal, une réponse par question.',
    modalTitles: [
      'Candidature Staff Profil 1/2',
      'Candidature Staff Profil 2/2'
    ],
    selects: {
      age: {
        placeholder: 'Tranche d\'âge',
        title: 'Tranche d\'âge',
        options: [
          ['16-17 ans', '16-17'],
          ['18-20 ans', '18-20'],
          ['21-24 ans', '21-24'],
          ['25 ans et +', '25+']
        ]
      },
      availability: {
        placeholder: 'Disponibilités',
        title: 'Disponibilités',
        options: [
          ['Semaine en soirée', 'semaine_soir'],
          ['Week-ends', 'weekend'],
          ['Horaires flexibles', 'flexibles'],
          ['Très présent', 'tres_present']
        ]
      },
      experience: {
        placeholder: 'Expérience FiveM / Staff',
        title: 'Expérience FiveM / Staff',
        options: [
          ['Aucune expérience', 'noexp'],
          ['Bases sur Discord', 'discord_only'],
          ['Déjà staff FiveM', 'fivem_staff'],
          ['Très expérimenté', 'senior']
        ]
      },
      domain: {
        placeholder: 'Domaine préféré',
        title: 'Domaine préféré',
        options: [
          ['Tickets & support', 'tickets'],
          ['Modération & sanctions', 'moderation'],
          ['Tournois & événements', 'events'],
          ['Ranked & litiges', 'ranked'],
          ['Polyvalent', 'polyvalent']
        ]
      }
    },
    stepTitles: [
      'Profil du candidat Partie 1',
      'Profil du candidat Partie 2'
    ],
    questions: [
      [
        {
          id: 'q1',
          label: 'Rôle dans l’équipe',
          placeholder: 'Quel rôle penses-tu avoir dans une équipe staff et pourquoi ?'
        },
        {
          id: 'q2',
          label: 'Motivation',
          placeholder: 'Pourquoi veux-tu rejoindre le staff de Takedown ?'
        },
        {
          id: 'q3',
          label: 'Apport au serveur',
          placeholder: 'Qu’est-ce que tu peux apporter concrètement au serveur ?'
        },
        {
          id: 'q4',
          label: 'Qualité principale',
          placeholder: 'Quelle est ta plus grande qualité pour devenir staff ?'
        },
        {
          id: 'q5',
          label: 'Défaut',
          placeholder: 'Quel est ton plus gros défaut et comment tu le gères ?'
        }
      ],
      [
        {
          id: 'q6',
          label: 'Expérience FiveM',
          placeholder: 'Depuis combien de temps joues-tu à FiveM et sur quels types de serveurs ?'
        },
        {
          id: 'q7',
          label: 'Expérience staff',
          placeholder: 'As-tu d?j? eu une exp?rience en tant que staff ? Si oui, laquelle ?'
        },
        {
          id: 'q8',
          label: 'Gestion du respect',
          placeholder: 'Comment réagis-tu face à un joueur qui t’insulte ou manque de respect ?'
        },
        {
          id: 'q9',
          label: 'Impartialité',
          placeholder: 'Es-tu capable de rester impartial même si un ami est impliqué ? Explique.'
        },
        {
          id: 'q10',
          label: 'Pourquoi toi',
          placeholder: 'Pourquoi devrions-nous te choisir toi plutôt qu’un autre candidat ?'
        }
      ]
    ],
    reviewTitle: 'CANDIDATURE STAFF',
    summaryTitle: 'Profil',
    answersTitle: 'Réponses',
    sectionTitles: ['Questions sur le candidat Partie 1', 'Questions sur le candidat Partie 2'],
    buttons: {
      reject: 'Refuser',
      contact: 'Contacter'
    },
    contactChannelReason: 'Recrutement Staff'
  },
  en: {
    startTitle: '### STAFF APPLICATION SCREENING',
    startDescription: 'Before starting the interview, choose your basic profile details. Then a 2-modal flow will launch automatically to assess your maturity and impartiality.',
    startButton: 'Start evaluation',
    savedChoice: 'Choice saved.',
    missingChoices: 'Please complete every selector before starting.',
    chatInstructions: 'Answer now in the modal, one answer per question.',
    modalTitles: [
      'Staff Application Profile 1/2',
      'Staff Application Profile 2/2'
    ],
    selects: {
      age: {
        placeholder: 'Age range',
        title: 'Age range',
        options: [
          ['16-17', '16-17'],
          ['18-20', '18-20'],
          ['21-24', '21-24'],
          ['25+', '25+']
        ]
      },
      availability: {
        placeholder: 'Availability',
        title: 'Availability',
        options: [
          ['Weekday evenings', 'weekday_evenings'],
          ['Weekends', 'weekends'],
          ['Flexible schedule', 'flexible'],
          ['Highly available', 'highly_available']
        ]
      },
      experience: {
        placeholder: 'FiveM / staff experience',
        title: 'FiveM / staff experience',
        options: [
          ['No experience', 'noexp'],
          ['Discord basics', 'discord_only'],
          ['Already worked as FiveM staff', 'fivem_staff'],
          ['Very experienced', 'senior']
        ]
      },
      domain: {
        placeholder: 'Preferred area',
        title: 'Preferred area',
        options: [
          ['Tickets & support', 'tickets'],
          ['Moderation & sanctions', 'moderation'],
          ['Tournaments & events', 'events'],
          ['Ranked & disputes', 'ranked'],
          ['Versatile / all-rounder', 'polyvalent']
        ]
      }
    },
    stepTitles: [
      'Candidate profile Part 1',
      'Candidate profile Part 2'
    ],
    questions: [
      [
        { id: 'q1', label: 'Role in the team', placeholder: 'What role do you think you would have in a staff team and why?' },
        { id: 'q2', label: 'Motivation', placeholder: 'Why do you want to join the Takedown staff team?' },
        { id: 'q3', label: 'Contribution', placeholder: 'What can you concretely bring to the server?' },
        { id: 'q4', label: 'Main strength', placeholder: 'What is your strongest quality for becoming staff?' },
        { id: 'q5', label: 'Weakness', placeholder: 'What is your biggest weakness and how do you manage it?' }
      ],
      [
        { id: 'q6', label: 'FiveM experience', placeholder: 'How long have you been playing FiveM and on what types of servers?' },
        { id: 'q7', label: 'Staff experience', placeholder: 'Have you ever worked as staff before? If yes, which one(s)?' },
        { id: 'q8', label: 'Respect', placeholder: 'How do you react to a player insulting you or being disrespectful?' },
        { id: 'q9', label: 'Impartiality', placeholder: 'Can you stay impartial even if a friend is involved? Explain.' },
        { id: 'q10', label: 'Why you', placeholder: 'Why should we choose you instead of another candidate?' }
      ]
    ],
    reviewTitle: 'STAFF APPLICATION',
    summaryTitle: 'Profile',
    answersTitle: 'Answers',
    sectionTitles: ['Candidate questions Part 1', 'Candidate questions Part 2'],
    buttons: {
      reject: 'Reject',
      contact: 'Contact'
    },
    contactChannelReason: 'Staff Recruitment'
  }
};

function getCopy(lang) {
  return APPLY_COPY[lang] || APPLY_COPY.fr;
}

function cleanDisplayText(value, maxLength = 2000) {
  return escapeMarkdown(String(value ?? ''))
    .replace(/`/g, '\\`')
    .replace(/\r?? \n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function cleanModalPlaceholder(value, maxLength = 100) {
  return cleanDisplayText(value, maxLength).replace(/\s+/g, ' ').slice(0, maxLength);
}

function getOptionLabel(copy, field, value) {
  const selected = copy.selects[field]?.options.find(option => option[1] === value);
  return selected ? selected[0] : value;
}

function getSession(userId) {
  const session = staffApplySessions.get(userId);
  if (!session) return null;

  return session;
}

function createSession(userId, guildId, lang) {
  const session = {
    userId,
    guildId,
    lang,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    selections: {},
    chat: {
      active: false,
      channelId: null,
      index: 0
    },
    answers: {
      step1: {},
      step2: {}
    }
  };

  staffApplySessions.set(userId, session);
  return session;
}

function touchSession(session) {
  session.updatedAt = Date.now();
  return session;
}

function getUnixNow() {
  return Math.floor(Date.now() / 1000);
}

function formatCooldownDate(unixTimestamp, lang) {
  const locale = lang === 'en' ? 'en-GB' : 'fr-FR';
  return new Intl.DateTimeFormat(locale, {
    dateStyle: 'full',
    timeStyle: 'short'
  }).format(new Date(unixTimestamp * 1000));
}

function buildCooldownMessage(cooldown, lang) {
  const expiresText = formatCooldownDate(cooldown.expires_at, lang);
  if (lang === 'en') {
    return `-# You can submit a new staff application after ${expiresText}.`;
  }
  return `-# Tu pourras refaire une candidature staff après le ${expiresText}.`;
}

function getApplicationStateLabel(status, lang) {
  const state = STAFF_APPLICATION_STATE[status] || STAFF_APPLICATION_STATE.pending;
  return lang === 'en' ? state.en : state.fr;
}

function buildApplicationStateText(status, lang) {
  return `### STATUT DE LA CANDIDATURE\n\n**${getApplicationStateLabel(status, lang)}**`;
}

function buildApplicationStatusContainer(status, lang) {
  return new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        lang === 'en'
          ? `### Application status\n\n\`\`\`${getApplicationStateLabel(status, lang)}\`\`\``
          : `### Statut de la candidature\n\n\`\`\`${getApplicationStateLabel(status, lang)}\`\`\``
      )
    );
}

async function getActiveStaffApplyCooldown(userId) {
  const cooldown = await dbService.getStaffApplyCooldown(userId).catch(() => null);
  if (!cooldown) return null;

  const now = getUnixNow();
  if (cooldown.expires_at <= now) {
    await dbService.clearStaffApplyCooldown(userId).catch(() => null);
    return null;
  }

  return cooldown;
}

function deleteSession(userId) {
  staffApplySessions.delete(userId);
}

export function hasActiveStaffApplySession(userId) {
  return Boolean(getSession(userId));
}

function buildSelectRow(copy, field, userId) {
  const configSelect = copy.selects[field];
  const select = new StringSelectMenuBuilder()
    .setCustomId(`staffapply_select_${field}`)
    .setPlaceholder(configSelect.placeholder)
    .setMinValues(1)
    .setMaxValues(1);

  for (const [label, value] of configSelect.options) {
    select.addOptions({ label, value });
  }

  return new ActionRowBuilder().addComponents(select);
}

function buildStartPanel(session) {
  const copy = getCopy(session.lang);
  const text = new TextDisplayBuilder().setContent(`${copy.startTitle}\n\n${copy.startDescription}`);
  const startButton = new ButtonBuilder()
    .setCustomId('staffapply_start')
    .setLabel(copy.startButton)
    .setStyle(ButtonStyle.Primary);

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(buildSelectRow(copy, 'age', session.userId))
    .addActionRowComponents(buildSelectRow(copy, 'availability', session.userId))
    .addActionRowComponents(buildSelectRow(copy, 'experience', session.userId))
    .addActionRowComponents(buildSelectRow(copy, 'domain', session.userId))
    .addActionRowComponents(new ActionRowBuilder().addComponents(startButton));

  return container;
}

function buildModal(session, stepNumber) {
  const copy = getCopy(session.lang);
  const stepIndex = stepNumber - 1;
  const modal = new ModalBuilder()
    .setCustomId(`staffapply_modal_${stepNumber}`)
    .setTitle(copy.modalTitles[stepIndex]);

  for (const question of copy.questions[stepIndex]) {
    const input = new TextInputBuilder()
      .setCustomId(question.id)
      .setLabel(question.label)
      .setPlaceholder(cleanModalPlaceholder(question.placeholder, 100))
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true)
      .setMaxLength(500);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
  }

  return modal;
}

function formatSelectionSummary(copy, selections) {
  return [
    `**${copy.selects.age.title}** : ${cleanDisplayText(selections.age || '—', 28)}`,
    `**${copy.selects.availability.title}** : ${cleanDisplayText(selections.availability || '—', 28)}`,
    `**${copy.selects.experience.title}** : ${cleanDisplayText(selections.experience || '—', 28)}`,
    `**${copy.selects.domain.title}** : ${cleanDisplayText(selections.domain || '—', 28)}`
  ].join('\n');
}

function buildAnswerBlock(copy, title, questions, answers, options = {}) {
  const { itemLabel = 'Question', answerMaxLength = 100 } = options;
  const lines = [`### ${title}`];

  questions.forEach((question, index) => {
    const answer = cleanDisplayText(answers[question.id] || 'Non renseigné', answerMaxLength);
    lines.push(`**${itemLabel} ${index + 1} : ${cleanDisplayText(question.label, 80)}**`);
    lines.push(`> **Réponse** : ${answer}`);
    lines.push('');
  });

  return lines.join('\n').trim();
}

function buildApplicationPayload(session, user, appId) {
  const copy = getCopy(session.lang);
  const selectionBlocks = [
    `### ${copy.reviewTitle}`,
    `**Candidat** : <@${user.id}> (\`${cleanDisplayText(user.username, 50)}\`)`,
    `**ID candidature** : \`${cleanDisplayText(appId, 32)}\``,
    '',
    `### ${copy.summaryTitle}`,
    formatSelectionSummary(copy, {
      age: session.selections.age?.label,
      availability: session.selections.availability?.label,
      experience: session.selections.experience?.label,
      domain: session.selections.domain?.label
    })
  ];

  const answers = [
    buildAnswerBlock(copy, copy.sectionTitles[0], copy.questions[0], session.answers.step1, { answerMaxLength: 500 }),
    buildAnswerBlock(copy, copy.sectionTitles[1], copy.questions[1], session.answers.step2, { answerMaxLength: 500 }),
  ];

  return {
    summary: selectionBlocks.join('\n'),
    sections: answers,
    raw: {
      language: session.lang,
      selections: session.selections,
      answers: session.answers
    }
  };
}

function buildReviewContainer(session, user, appId, appStatus = 'pending', statusLabel = null, footerLabel = null) {
  const copy = getCopy(session.lang);
  const payload = buildApplicationPayload(session, user, appId);

  const headerText = new TextDisplayBuilder().setContent(payload.summary);
  const statusText = new TextDisplayBuilder().setContent(buildApplicationStateText(appStatus, session.lang));
  const section1 = new TextDisplayBuilder().setContent(payload.sections[0]);
  const section2 = new TextDisplayBuilder().setContent(payload.sections[1]);

  const container = new ContainerBuilder()
    .setAccentColor(statusLabel ? config.colors.secondary : config.colors.primary)
    .addTextDisplayComponents(headerText)
    .addTextDisplayComponents(statusText)
    .addTextDisplayComponents(section1)
    .addTextDisplayComponents(section2);

  if (!statusLabel) {
    const reviewBtn = new ButtonBuilder()
      .setCustomId(`staffapply_review_${appId}`)
      .setLabel(session.lang === 'en' ? 'Mark as reviewed' : 'Prendre en charge')
      .setStyle(ButtonStyle.Primary)
      .setDisabled(appStatus === 'in_review');

    const rejectBtn = new ButtonBuilder()
      .setCustomId(`staffapply_reject_${appId}`)
      .setLabel(copy.buttons.reject)
      .setStyle(ButtonStyle.Secondary);

    const contactBtn = new ButtonBuilder()
      .setCustomId(`staffapply_contact_${appId}`)
      .setLabel(copy.buttons.contact)
      .setStyle(ButtonStyle.Secondary);

    container.addActionRowComponents(new ActionRowBuilder().addComponents(reviewBtn));
    container.addActionRowComponents(new ActionRowBuilder().addComponents(rejectBtn, contactBtn));
    return { container, payload };
  }

  const terminalStatusText = new TextDisplayBuilder().setContent([
    `### ${statusLabel}`,
    footerLabel ? `**${footerLabel}**` : ''
  ].filter(Boolean).join('\n\n'));

  return {
    container: new ContainerBuilder()
      .setAccentColor(config.colors.secondary)
      .addTextDisplayComponents(headerText)
      .addTextDisplayComponents(section1)
      .addTextDisplayComponents(section2)
      .addTextDisplayComponents(terminalStatusText),
    payload
  };
}

async function sendApplicationToStaff(interaction, appId, session, user) {
  const reviewSession = { ...session, lang: 'fr' };
  const reviewChannelId = config.channels.staffapply;
  const reviewChannel = reviewChannelId ? await interaction.guild.channels.fetch(reviewChannelId).catch(() => null) : null;
  if (!reviewChannel || !reviewChannel.isTextBased()) {
    await dbService.updateApplicationStatus(appId, 'error');
    return interaction.editReply({ content: '-# Salon de recrutement introuvable dans la configuration du bot.' });
  }

  const { container, payload } = buildReviewContainer(reviewSession, user, appId, 'pending');
  const reviewMsg = await sendV2Container(reviewChannel, container);
  if (reviewMsg) {
    await dbService.updateApplicationStatus(appId, 'pending', reviewMsg.id);
  }

  try {
    const { logStaffApply } = await import('./logService.js');
    const copy = getCopy('fr');
    await logStaffApply(interaction.client, {
      title: copy.reviewTitle,
      fields: [
        { name: 'Candidat', value: `<@${user.id}> (\`${cleanDisplayText(user.username, 80)}\`)`, inline: true },
        { name: copy.selects.age.title, value: payload.raw.selections.age?.label || '—', inline: true },
        { name: copy.selects.availability.title, value: payload.raw.selections.availability?.label || '—', inline: true },
        { name: copy.selects.experience.title, value: payload.raw.selections.experience?.label || '—', inline: true },
        { name: copy.selects.domain.title, value: payload.raw.selections.domain?.label || '—', inline: true }
      ]
    });
  } catch {
    // ignore log failures
  }

  const applicantUser = await interaction.client.users.fetch(user.id).catch(() => null);
  if (applicantUser) {
    const statusButton = new ButtonBuilder()
      .setCustomId(`staffapply_status_view_${appId}`)
      .setLabel(session.lang === 'en' ? 'View status' : 'Voir le statut')
      .setStyle(ButtonStyle.Primary);

    const statusRow = new ActionRowBuilder().addComponents(statusButton);
    const dmContent = session.lang === 'en'
      ? '### Your staff application has been submitted\n\nIt is now waiting for review. You can check the current status with the button below.'
      : '### Votre candidature staff a été envoyée\n\nElle est maintenant en attente de prise en charge. Vous pouvez vérifier le statut actuel avec le bouton ci-dessous.';

    await applicantUser.send({
      content: dmContent,
      components: [statusRow]
    }).catch(async () => {
      const dmChannel = applicantUser.dmChannel || await applicantUser.createDM().catch(() => null);
      if (!dmChannel) return;

      const dmContainer = new ContainerBuilder()
        .setAccentColor(config.colors.primary)
        .addTextDisplayComponents(
          new TextDisplayBuilder().setContent(dmContent)
        )
        .addActionRowComponents(statusRow);

      await sendV2Container(dmChannel, dmContainer).catch(() => null);
    });
  }

  await interaction.editReply({ content: t(session.lang, 'recruitment.success_applied') });
  deleteSession(user.id);
}

async function finalizeStaffApplication(context, session, user) {
  const existingApp = await dbService.getPendingApplication(user.id);
  if (existingApp) {
    deleteSession(user.id);
    return context.editReply({ content: t(session.lang, 'recruitment.already_applied') });
  }

  const cooldown = await getActiveStaffApplyCooldown(user.id);
  if (cooldown) {
    deleteSession(user.id);
    return context.editReply({ content: buildCooldownMessage(cooldown, session.lang) });
  }

  const appResult = await dbService.createApplication(
    user.id,
    user.username,
    JSON.stringify(buildApplicationPayload(session, user, 0).raw)
  );
  const appId = appResult.id;

  try {
    await sendApplicationToStaff(context, appId, session, user);
  } catch (err) {
    await dbService.updateApplicationStatus(appId, 'error').catch(() => null);
    deleteSession(user.id);
    await context.editReply({ content: '-# Impossible d’envoyer votre candidature au salon staff. Réessayez plus tard.' }).catch(() => null);
    throw err;
  }
}

export async function handleStaffApplyOpen(interaction) {
  const lang = await getLanguage(interaction.member);
  const existingApp = await dbService.getPendingApplication(interaction.user.id);
  if (existingApp) {
    return interaction.reply({
      content: t(lang, 'recruitment.already_applied'),
      flags: MessageFlags.Ephemeral
    });
  }

  const cooldown = await getActiveStaffApplyCooldown(interaction.user.id);
  if (cooldown) {
    return interaction.reply({
      content: buildCooldownMessage(cooldown, lang),
      flags: MessageFlags.Ephemeral
    });
  }

  const session = createSession(interaction.user.id, interaction.guildId, lang);
  const container = buildStartPanel(session);

  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

export async function handleStaffApplySelectMenu(interaction) {
  const session = getSession(interaction.user.id);
  if (!session) {
    return interaction.reply({
      content: '-# Session de candidature expirée. Relancez le bouton Postuler.',
      flags: MessageFlags.Ephemeral
    });
  }

  const field = interaction.customId.replace('staffapply_select_', '');
  if (!session.selections[field]) {
    session.selections[field] = {};
  }

  const value = interaction.values[0];
  const copy = getCopy(session.lang);
  session.selections[field] = {
    value,
    label: getOptionLabel(copy, field, value)
  };
  touchSession(session);

  return interaction.deferUpdate().catch(() => null);
}

export async function handleStaffApplyStart(interaction) {
  const session = getSession(interaction.user.id);
  if (!session) {
    return interaction.reply({
      content: '-# Session de candidature expirée. Relancez le bouton Postuler.',
      flags: MessageFlags.Ephemeral
    });
  }

  const copy = getCopy(session.lang);
  const missing = ['age', 'availability', 'experience', 'domain'].filter(field => !session.selections[field]);
  if (missing.length > 0) {
    return interaction.reply({
      content: `-# ${copy.missingChoices}`,
      flags: MessageFlags.Ephemeral
    });
  }

  touchSession(session);
  return interaction.showModal(buildModal(session, 1));
}

function buildContinueContainer(copy, nextStepNumber) {
  const lang = copy === APPLY_COPY.en ? 'en' : 'fr';
  const button = new ButtonBuilder()
    .setCustomId(`staffapply_continue_${nextStepNumber}`)
    .setLabel(lang === 'en' ? `Continue to step ${nextStepNumber}` : `Continuer vers l'étape ${nextStepNumber}`)
    .setStyle(ButtonStyle.Primary);

  return new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        lang === 'en'
          ? `### Step validated\n\nClick below to open the next form.`
          : `### Étape validée\n\nCliquez ci-dessous pour ouvrir le formulaire suivant.`
      )
    )
    .addActionRowComponents(new ActionRowBuilder().addComponents(button));
}

export async function handleStaffApplyModalSubmit(interaction) {
  const stepMatch = interaction.customId.match(/^staffapply_modal_(\d+)$/);
  const stepNumber = stepMatch ? Number(stepMatch[1]) : 0;
  const session = getSession(interaction.user.id);
  const copy = getCopy(session?.lang || 'fr');

  if (!session || !stepNumber) {
    return interaction.reply({
      content: '-# Session de candidature introuvable ou expirée.',
      flags: MessageFlags.Ephemeral
    });
  }

  const cooldown = await getActiveStaffApplyCooldown(interaction.user.id);
  if (cooldown) {
    deleteSession(interaction.user.id);
    return interaction.reply({
      content: buildCooldownMessage(cooldown, session.lang),
      flags: MessageFlags.Ephemeral
    });
  }

  const stepQuestions = copy.questions[stepNumber - 1] || [];
  for (const question of stepQuestions) {
    session.answers[`step${stepNumber}`][question.id] = cleanDisplayText(interaction.fields.getTextInputValue(question.id), 800);
  }
  touchSession(session);

  if (stepNumber < 2) {
    const nextStep = stepNumber + 1;
    const continueContainer = buildContinueContainer(getCopy(session.lang), nextStep);
    return interaction.reply({
      components: [continueContainer],
      flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
    });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  await finalizeStaffApplication(interaction, session, interaction.user);
}

export async function handleStaffApplyContinue(interaction) {
  const stepMatch = interaction.customId.match(/^staffapply_continue_(\d+)$/);
  const nextStepNumber = stepMatch ? Number(stepMatch[1]) : 0;
  const session = getSession(interaction.user.id);

  if (!session || !nextStepNumber || nextStepNumber > 2) {
    return interaction.reply({
      content: '-# Session de candidature introuvable ou expirée.',
      flags: MessageFlags.Ephemeral
    });
  }

  if (nextStepNumber === 2) {
    touchSession(session);
    return interaction.showModal(buildModal(session, nextStepNumber));
  }

  return interaction.reply({
    content: '-# Étape introuvable.',
    flags: MessageFlags.Ephemeral
  });
}

export async function handleStaffApplyChatMessage(message) {
  return false;
}

export async function handleStaffApplyReject(interaction, applicationId) {
  const staff = interaction.user;
  const lang = await getLanguage(interaction.member);
  const isStaff = interaction.member.roles.cache.has(config.tickets.supportRoleId) || interaction.member.roles.cache.has(config.roles.admin);

  if (!isStaff) {
    return interaction.reply({
      content: t(lang, 'errors.no_permission'),
      flags: MessageFlags.Ephemeral
    });
  }

  const app = await dbService.getApplication(applicationId);
  if (!app) {
    return interaction.reply({ content: '-# Candidature introuvable.', flags: MessageFlags.Ephemeral });
  }

  const parsed = app.application_data ? safeParseApplicationData(app.application_data) : null;
  const session = parsed ? { lang: parsed.language || lang, selections: parsed.selections || {}, answers: parsed.answers || {} } : { lang, selections: {}, answers: {} };
  await dbService.updateApplicationStatus(applicationId, 'rejected');

  const rejectedAt = getUnixNow();
  const expiresAt = rejectedAt + STAFF_APPLY_COOLDOWN_SECONDS;
  await dbService.setStaffApplyCooldown(app.user_id, rejectedAt, expiresAt).catch(() => null);

  const reviewSession = { ...session, lang: 'fr' };
  const copy = getCopy('fr');
  const { container } = buildReviewContainer(reviewSession, { id: app.user_id, username: app.username }, applicationId, 'rejected', `${copy.reviewTitle} REFUSÉE`, `${copy.buttons.reject} par ${staff.username}`);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });

  const applicantUser = await interaction.client.users.fetch(app.user_id).catch(() => null);
  if (applicantUser) {
    await applicantUser.send({ content: t(lang, 'recruitment.dm.rejected') }).catch(() => null);
  }

  await dbService.addLog('STAFFAPPLY_REJECT', staff.id, `Rejected application ID ${applicationId} of ${app.username}`, interaction.channelId);
}

export async function handleStaffApplyContact(interaction, applicationId) {
  const staff = interaction.user;
  const lang = await getLanguage(interaction.member);
  const guild = interaction.guild;
  const isStaff = interaction.member.roles.cache.has(config.tickets.supportRoleId) || interaction.member.roles.cache.has(config.roles.admin);

  if (!isStaff) {
    return interaction.reply({ content: t(lang, 'errors.no_permission'), flags: MessageFlags.Ephemeral });
  }

  const app = await dbService.getApplication(applicationId);
  if (!app) {
    return interaction.reply({ content: '-# Candidature introuvable.', flags: MessageFlags.Ephemeral });
  }

  const applicantUser = await interaction.client.users.fetch(app.user_id).catch(() => null);
  if (!applicantUser) {
    return interaction.reply({ content: '-# Impossible de trouver ou de contacter le candidat sur ce serveur.', flags: MessageFlags.Ephemeral });
  }

  const parsed = app.application_data ? safeParseApplicationData(app.application_data) : null;
  const session = parsed ? { lang: parsed.language || lang, selections: parsed.selections || {}, answers: parsed.answers || {} } : { lang, selections: {}, answers: {} };

  await dbService.updateApplicationStatus(applicationId, 'contacted');

  const reviewSession = { ...session, lang: 'fr' };
  const copy = getCopy('fr');
  const { container } = buildReviewContainer(reviewSession, { id: app.user_id, username: app.username }, applicationId, 'contacted', `${copy.reviewTitle} EN COURS DE CONTACT`, `${copy.buttons.contact} par ${staff.username}`);
  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });

  const category = await guild.channels.fetch(STAFF_APPLY_CONTACT_PARENT_ID).catch(() => null)
    || (config.tickets.categoryId ? await guild.channels.fetch(config.tickets.categoryId).catch(() => null) : null);
  const permissionOverwrites = [
    { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: applicantUser.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: config.roles.admin, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }
  ];

  if (config.tickets.supportRoleId && config.tickets.supportRoleId !== config.roles.admin) {
    permissionOverwrites.push({
      id: config.tickets.supportRoleId,
      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory]
    });
  }

  const cleanName = cleanDisplayText(app.username, 40).replace(/[^a-z0-9-]/gi, '').toLowerCase() || 'candidate';
  const channel = await guild.channels.create({
    name: `recrut-${cleanName}`,
    type: ChannelType.GuildText,
    parent: category ? category.id : null,
    permissionOverwrites
  }).catch(err => {
    console.error('Failed to create recruitment channel:', err);
    return null;
  });

  if (!channel) {
    return interaction.followUp({ content: '-# Échec de la création du salon d\'entretien.', flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  await dbService.createTicket(channel.id, applicantUser.id, 0, copy.contactChannelReason);

  const ticketWelcomeTitle = copy.reviewTitle;
  const ticketWelcomeDesc = session.lang === 'en'
    ? `Hello ${applicantUser.username}, a staff member wants to contact you about your application. Please stay available and keep the conversation clear and respectful.`
    : `Bonjour ${applicantUser.username}, un membre du staff souhaite vous contacter concernant votre candidature. Merci de rester disponible et de garder un échange clair et respectueux.`;
  const ticketWelcomeText = new TextDisplayBuilder().setContent(`### ${ticketWelcomeTitle}\n\n${ticketWelcomeDesc}`);

  const closeBtn = new ButtonBuilder().setCustomId('ticket_close').setLabel(t(lang, 'tickets.buttons.close')).setStyle(ButtonStyle.Secondary);
  const ticketContainer = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(ticketWelcomeText)
    .addActionRowComponents(new ActionRowBuilder().addComponents(closeBtn));

  await channel.send({ content: `<@${applicantUser.id}>` }).catch(() => null);
  await sendV2Container(channel, ticketContainer);

  await interaction.followUp({ content: `Salon d'entretien créé: <#${channel.id}>`, flags: MessageFlags.Ephemeral }).catch(() => null);
  await dbService.addLog('STAFFAPPLY_CONTACT', staff.id, `Contacted candidate ${app.username} | Interview channel: ${channel.name}`, channel.id);
}

export async function handleStaffApplySetReview(interaction, applicationId) {
  const lang = await getLanguage(interaction.member);
  const isStaff = interaction.member.roles.cache.has(config.tickets.supportRoleId) || interaction.member.roles.cache.has(config.roles.admin);

  if (!isStaff) {
    return interaction.reply({ content: t(lang, 'errors.no_permission'), flags: MessageFlags.Ephemeral });
  }

  const app = await dbService.getApplication(applicationId);
  if (!app) {
    return interaction.reply({ content: '-# Candidature introuvable.', flags: MessageFlags.Ephemeral });
  }

  await dbService.updateApplicationStatus(applicationId, 'in_review');

  const parsed = app.application_data ? safeParseApplicationData(app.application_data) : null;
  const session = parsed ? { lang: parsed.language || lang, selections: parsed.selections || {}, answers: parsed.answers || {} } : { lang, selections: {}, answers: {} };
  const reviewSession = { ...session, lang: 'fr' };
  const { container } = buildReviewContainer(reviewSession, { id: app.user_id, username: app.username }, applicationId, 'in_review');

  await interaction.update({ components: [container], flags: MessageFlags.IsComponentsV2 });

  const applicantUser = await interaction.client.users.fetch(app.user_id).catch(() => null);
  if (applicantUser) {
    await applicantUser.send({
      content: session.lang === 'en'
        ? 'Your staff application is now under review.'
        : 'Votre candidature staff est maintenant en cours d’examen.'
    }).catch(() => null);
  }

  await dbService.addLog('STAFFAPPLY_REVIEW', interaction.user.id, `Set application ID ${applicationId} to in_review`, interaction.channelId).catch(() => null);
}

export async function handleStaffApplyStatusView(interaction, applicationId) {
  const app = await dbService.getApplication(applicationId).catch(() => null);
  if (!app) {
    return interaction.reply({ content: '-# Candidature introuvable.', flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  const parsed = app.application_data ? safeParseApplicationData(app.application_data) : null;
  const lang = parsed?.language || 'fr';
  const container = buildApplicationStatusContainer(app.status, lang);

  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

function safeParseApplicationData(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default {
  handleStaffApplyOpen,
  handleStaffApplySelectMenu,
  handleStaffApplyStart,
  handleStaffApplyContinue,
  handleStaffApplyChatMessage,
  handleStaffApplyModalSubmit,
  handleStaffApplyReject,
  handleStaffApplyContact,
  handleStaffApplySetReview,
  handleStaffApplyStatusView
};

export { getCopy as getRecruitmentCopy, buildReviewContainer, safeParseApplicationData };

