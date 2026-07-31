import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChannelSelectMenuBuilder,
  ChannelType,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  RoleSelectMenuBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { randomUUID } from 'node:crypto';
import { translateText } from '../utils/language.js';
import { appendSeparatorComponent, sendV2Container } from '../utils/v2Helper.js';
import config from '../config/config.js';

const pollSessions = new Map();
const activePolls = new Map();

function parseChoices(rawChoices) {
  return rawChoices
    .split('\n')
    .map(choice => choice.trim().replace(/^[-*•\d.\s]+/, ''))
    .filter(Boolean);
}

function parseBoolean(rawValue) {
  const value = rawValue.trim().toLowerCase();
  return ['oui', 'yes', 'true', 'multiple', 'multi', '1'].includes(value);
}

function parseDuration(rawValue) {
  const value = rawValue.trim().toLowerCase();
  const match = value.match(/^(\d+)\s*([smhd]?)$/);
  if (!match) return null;

  const amount = Number(match[1]);
  const unit = match[2] || 'm';
  if (!Number.isInteger(amount) || amount <= 0) return null;

  const multipliers = {
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000
  };

  return amount * multipliers[unit];
}

function normalizeTitle(title) {
  return title.trim().replace(/\s+/g, ' ');
}

function getPollCounts(poll) {
  const votes = poll.votes instanceof Map ? poll.votes : new Map();
  return poll.choices.map((_, index) => {
    let count = 0;
    for (const selections of votes.values()) {
      if (selections.has(index)) count += 1;
    }
    return count;
  });
}

function formatChoiceLabel(choice) {
  return `\`${choice}\``;
}

function buildPollText(poll) {
  const lines = [
    '### SONDAGE',
    `**${poll.titleFr}**`
  ];

  if (poll.titleEn && poll.titleEn !== poll.titleFr) {
    lines.push(`-# ${poll.titleEn}`);
  }

  return lines.join('\n').trimEnd();
}

function buildPollVoteRows(poll, disabled = false) {
  return poll.choices.map((choice, index) => ({
    text: new TextDisplayBuilder().setContent(
      `**${index + 1}.** ${formatChoiceLabel(choice.fr)} / ${formatChoiceLabel(choice.en)}`
    ),
    row: new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`poll_vote_${poll.pollId}_${index}_fr`)
        .setLabel('🇫🇷 Voter')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled),
      new ButtonBuilder()
        .setCustomId(`poll_vote_${poll.pollId}_${index}_en`)
        .setLabel('🇬🇧 Vote')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(disabled)
    )
  }));
}

function buildPollResultsText(poll) {
  const counts = getPollCounts(poll);

  const lines = ['### RÉSULTATS'];
  poll.choices.forEach((choice, index) => {
    const count = counts[index];
    lines.push(
      `- ${formatChoiceLabel(choice.fr)} / ${formatChoiceLabel(choice.en)} — ${count} vote(s)`
    );
  });

  return lines.join('\n');
}

function getPollWinnerSummary(poll) {
  const counts = getPollCounts(poll);
  const maxVotes = Math.max(0, ...counts);
  if (maxVotes === 0) {
    return 'Aucun vote n’a été enregistré.';
  }

  const winners = counts
    .map((count, index) => ({ count, choice: poll.choices[index] }))
    .filter(entry => entry.count === maxVotes);

  if (winners.length === 1) {
    const winner = winners[0];
    return `Résultat : **${formatChoiceLabel(winner.choice.fr)} / ${formatChoiceLabel(winner.choice.en)}** avec **${winner.count}** vote${winner.count > 1 ? 's' : ''}.`;
  }

  const tieLabels = winners
    .map(entry => `${formatChoiceLabel(entry.choice.fr)} / ${formatChoiceLabel(entry.choice.en)}`)
    .join(', ');

  return `Égalité : **${tieLabels}** avec **${maxVotes}** vote${maxVotes > 1 ? 's' : ''} chacun.`;
}

function buildPollContainer(poll, isClosed = false) {
  const container = new ContainerBuilder()
    .setAccentColor(isClosed ? config.colors.secondary : config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        isClosed
          ? `${buildPollText(poll)}\n\n### SONDAGE TERMINÉ`
          : buildPollText(poll)
      )
    );

  appendSeparatorComponent(container);

  const blocks = buildPollVoteRows(poll, isClosed);
  blocks.forEach(block => {
    container.addTextDisplayComponents(block.text);
    container.addActionRowComponents(block.row);
  });

  if (isClosed) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent('### SONDAGE TERMINÉ')
    );
  }
  return container;
}

function registerPoll(message, poll) {
  activePolls.set(message.id, {
    ...poll,
    pollId: poll.pollId || message.id,
    messageId: message.id,
    votes: new Map(),
    closed: false,
    timeoutId: null
  });
}

function getPollByMessageId(messageId) {
  return activePolls.get(messageId) || null;
}

function getSession(userId) {
  return pollSessions.get(userId) || {
    roleId: null,
    channelId: null,
    creatorId: userId
  };
}

function setSession(userId, patch) {
  const current = getSession(userId);
  const updated = { ...current, ...patch, creatorId: userId };
  pollSessions.set(userId, updated);
  return updated;
}

function cleanupSession(userId) {
  pollSessions.delete(userId);
}

async function sendPoll(channel, poll) {
  poll.pollId = poll.pollId || randomUUID();

  if (poll.roleId) {
    await channel.send({ content: `<@&${poll.roleId}>` }).catch(() => null);
  }

  const container = buildPollContainer(poll);
  const message = await sendV2Container(channel, container);

  if (message) {
    registerPoll(message, poll);
  }

  return message;
}

function schedulePollEnd(message, durationMs) {
  const poll = getPollByMessageId(message.id);
  if (!poll) return;

  if (poll.timeoutId) {
    clearTimeout(poll.timeoutId);
  }

  poll.timeoutId = setTimeout(async () => {
    const currentPoll = getPollByMessageId(message.id);
    if (!currentPoll || currentPoll.closed) return;
    currentPoll.closed = true;
    const resultText = getPollWinnerSummary(currentPoll);
    await message.edit({ components: [buildPollContainer(currentPoll, true)], content: null }).catch(() => null);
    await message.reply({ content: resultText }).catch(() => null);
  }, durationMs);
}

export async function sendPollSetupPanel(channel, creatorId) {
  setSession(creatorId, { roleId: null, channelId: null });

  const text = new TextDisplayBuilder().setContent(
    '### Créer un sondage\n\nChoisis le rôle et le salon, puis clique sur le bouton pour ouvrir le formulaire.'
  );

  const roleMenu = new RoleSelectMenuBuilder()
    .setCustomId(`poll_role_select_${creatorId}`)
    .setPlaceholder('Sélectionner un rôle à ping')
    .setMinValues(0)
    .setMaxValues(1);

  const channelMenu = new ChannelSelectMenuBuilder()
    .setCustomId(`poll_channel_select_${creatorId}`)
    .setPlaceholder('Sélectionner le salon de destination')
    .addChannelTypes(ChannelType.GuildText)
    .setMinValues(0)
    .setMaxValues(1);

  const openButton = new ButtonBuilder()
    .setCustomId(`poll_open_modal_${creatorId}`)
    .setLabel('Ouvrir le formulaire')
    .setStyle(ButtonStyle.Primary);

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(
      new ActionRowBuilder().addComponents(roleMenu),
      new ActionRowBuilder().addComponents(channelMenu),
      new ActionRowBuilder().addComponents(openButton)
    );

  await sendV2Container(channel, container);
}

export async function handlePollSetupRoleSelect(interaction) {
  const creatorId = interaction.customId.split('_').pop();
  if (interaction.user.id !== creatorId) {
    return interaction.reply({ content: 'Tu ne peux pas configurer ce sondage.', flags: MessageFlags.Ephemeral });
  }

  const roleId = interaction.values?.[0] || null;
  setSession(creatorId, { roleId: roleId || null });
  await interaction.reply({ content: roleId ? 'Rôle sélectionné.' : 'Aucun rôle sélectionné.', flags: MessageFlags.Ephemeral });
}

export async function handlePollSetupChannelSelect(interaction) {
  const creatorId = interaction.customId.split('_').pop();
  if (interaction.user.id !== creatorId) {
    return interaction.reply({ content: 'Tu ne peux pas configurer ce sondage.', flags: MessageFlags.Ephemeral });
  }

  const channelId = interaction.values?.[0] || null;
  setSession(creatorId, { channelId: channelId || null });
  await interaction.reply({ content: channelId ? 'Salon sélectionné.' : 'Aucun salon sélectionné.', flags: MessageFlags.Ephemeral });
}

export async function handlePollOpen(interaction) {
  const creatorId = interaction.user.id;
  const session = getSession(creatorId);

  const modal = new ModalBuilder()
    .setCustomId(`poll_modal_create_${creatorId}`)
    .setTitle('Créer un sondage');

  const titleInput = new TextInputBuilder()
    .setCustomId('poll_title_input')
    .setLabel('Titre du sondage')
    .setPlaceholder('Ex : Quel jour pour le tournoi ?')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(100);

  const choicesInput = new TextInputBuilder()
    .setCustomId('poll_choices_input')
    .setLabel('Choix (1 par ligne)')
    .setPlaceholder('Option 1\nOption 2\nOption 3')
    .setStyle(TextInputStyle.Paragraph)
    .setRequired(true)
    .setMaxLength(1000);

  const multipleInput = new TextInputBuilder()
    .setCustomId('poll_multiple_input')
    .setLabel('Choix multiple ? (oui/non)')
    .setPlaceholder('oui')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  const durationInput = new TextInputBuilder()
    .setCustomId('poll_duration_input')
    .setLabel('Durée du sondage')
    .setPlaceholder('Ex : 30m, 2h, 1d')
    .setStyle(TextInputStyle.Short)
    .setRequired(true)
    .setMaxLength(10);

  modal.addComponents(
    new ActionRowBuilder().addComponents(titleInput),
    new ActionRowBuilder().addComponents(choicesInput),
    new ActionRowBuilder().addComponents(multipleInput),
    new ActionRowBuilder().addComponents(durationInput)
  );

  await interaction.showModal(modal);
}

export async function handlePollModalSubmit(interaction, lang = 'fr') {
  const creatorId = interaction.customId.split('_').pop();
  if (interaction.user.id !== creatorId) {
    return interaction.reply({ content: 'Tu ne peux pas finaliser ce sondage.', flags: MessageFlags.Ephemeral });
  }

  const session = getSession(creatorId);
  const title = normalizeTitle(interaction.fields.getTextInputValue('poll_title_input'));
  const rawChoices = parseChoices(interaction.fields.getTextInputValue('poll_choices_input'));
  const multiple = parseBoolean(interaction.fields.getTextInputValue('poll_multiple_input'));
  const durationMs = parseDuration(interaction.fields.getTextInputValue('poll_duration_input'));

  if (!title || rawChoices.length < 2) {
    return interaction.reply({ content: 'Le sondage doit contenir un titre et au moins 2 choix.', flags: MessageFlags.Ephemeral });
  }

  if (rawChoices.length > 5) {
    return interaction.reply({ content: 'Le sondage accepte au maximum 5 choix, sinon les boutons dépassent la limite Discord.', flags: MessageFlags.Ephemeral });
  }

  if (!durationMs) {
    return interaction.reply({ content: 'Durée invalide. Utilise par exemple 30m, 2h ou 1d.', flags: MessageFlags.Ephemeral });
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const targetLang = lang === 'fr' ? 'en' : 'fr';
  const titleTranslation = await translateText(title, lang, targetLang).catch(() => title);
  const translatedChoices = [];

  for (const choice of rawChoices) {
    translatedChoices.push(await translateText(choice, lang, targetLang).catch(() => choice));
  }

  const targetChannel = session.channelId
    ? await interaction.guild.channels.fetch(session.channelId).catch(() => null)
    : interaction.channel;

  if (!targetChannel || !targetChannel.isTextBased()) {
    return interaction.editReply({ content: 'Le salon de destination est invalide.' });
  }

  const poll = {
    pollId: randomUUID(),
    titleFr: lang === 'fr' ? title : titleTranslation,
    titleEn: lang === 'fr' ? titleTranslation : title,
    choices: rawChoices.map((choice, index) => ({
      fr: lang === 'fr' ? choice : translatedChoices[index],
      en: lang === 'fr' ? translatedChoices[index] : choice
    })),
    multiple,
    roleId: session.roleId
  };

  const message = await sendPoll(targetChannel, poll);
  if (!message) {
    return interaction.editReply({ content: 'Impossible de créer le sondage.' });
  }

  schedulePollEnd(message, durationMs);
  cleanupSession(creatorId);

  await interaction.editReply({ content: `Sondage créé : <#${targetChannel.id}>` });
}

export async function handlePollVote(interaction) {
  if (!interaction.customId.startsWith('poll_vote_')) return false;

  const parts = interaction.customId.split('_');
  const pollId = parts[2];
  const optionIndex = Number(parts[3]);
  if (!pollId || !Number.isInteger(optionIndex)) return false;

  const poll = getPollByMessageId(interaction.message.id);
  if (!poll) {
    await interaction.reply({ content: 'Ce sondage n’est plus actif.', flags: MessageFlags.Ephemeral }).catch(() => null);
    return true;
  }

  if (poll.pollId !== pollId) {
    await interaction.reply({ content: 'Ce bouton ne correspond plus à ce sondage.', flags: MessageFlags.Ephemeral }).catch(() => null);
    return true;
  }

  if (poll.closed) {
    await interaction.reply({ content: 'Ce sondage est terminé.', flags: MessageFlags.Ephemeral }).catch(() => null);
    return true;
  }

  if (optionIndex < 0 || optionIndex >= poll.choices.length) {
    await interaction.reply({ content: 'Choix invalide.', flags: MessageFlags.Ephemeral }).catch(() => null);
    return true;
  }

  const userId = interaction.user.id;
  const currentVotes = poll.votes.get(userId) || new Set();
  const wasAlreadySelected = currentVotes.has(optionIndex);
  let removedVote = false;

  if (poll.multiple) {
    if (wasAlreadySelected) {
      currentVotes.delete(optionIndex);
      removedVote = true;
    } else {
      currentVotes.add(optionIndex);
    }
  } else {
    if (wasAlreadySelected && currentVotes.size === 1) {
      currentVotes.clear();
      removedVote = true;
    } else {
      currentVotes.clear();
      currentVotes.add(optionIndex);
    }
  }

  if (currentVotes.size === 0) {
    poll.votes.delete(userId);
  } else {
    poll.votes.set(userId, currentVotes);
  }

  await interaction.update({ components: [buildPollContainer(poll)] }).catch(async () => {
    await interaction.deferUpdate().catch(() => null);
    await interaction.message.edit({ components: [buildPollContainer(poll)] }).catch(() => null);
  });

  if (removedVote) {
    await interaction.followUp({
      content: 'Votre vote a été retiré.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
    return true;
  }

  const selectedChoice = poll.choices[optionIndex];
  await interaction.followUp({
    content: `Vous avez voté pour : ${selectedChoice.fr} / ${selectedChoice.en}`,
    flags: MessageFlags.Ephemeral
  }).catch(() => null);

  return true;
}

export default {
  sendPollSetupPanel,
  handlePollSetupRoleSelect,
  handlePollSetupChannelSelect,
  handlePollOpen,
  handlePollModalSubmit,
  handlePollVote
};
