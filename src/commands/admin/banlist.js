import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  ModalBuilder,
  TextDisplayBuilder,
  TextInputBuilder,
  TextInputStyle,
  SlashCommandBuilder
} from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { appendSeparatorComponent, sendV2Container } from '../../utils/v2Helper.js';
import { getLanguage } from '../../utils/language.js';

const PAGE_SIZE = 10;

function extractDiscordId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

function getCopy(lang = 'fr') {
  if (lang === 'en') {
    return {
      title: 'Banned users',
      empty: 'No banned users found.',
      page: 'Page',
      total: 'Total',
      search: 'Search',
      previous: 'Previous',
      next: 'Next',
      searchButton: 'Search by ID',
      searchPlaceholder: 'Paste the Discord ID of a banned user',
      searchLabel: 'Banned user ID',
      searchResultTitle: 'Ban lookup',
      searchNotFound: 'No ban found for this ID.',
      reason: 'Reason',
      noReason: 'No reason provided',
      moderator: 'Moderator'
    };
  }

  return {
    title: 'Liste des bannis',
    empty: 'Aucun membre banni pour le moment.',
    page: 'Page',
    total: 'Total',
    search: 'Rechercher',
    previous: 'Précédent',
    next: 'Suivant',
    searchButton: 'Rechercher par ID',
    searchPlaceholder: 'Colle l’ID Discord d’un banni',
    searchLabel: 'ID du banni',
    searchResultTitle: 'Recherche de bannissement',
    searchNotFound: 'Aucun ban trouvé pour cet ID.',
    reason: 'Raison',
    noReason: 'Aucune raison fournie',
    moderator: 'Modérateur'
  };
}

async function fetchAllBans(guild) {
  const bans = [];
  let before = null;

  while (true) {
    const batch = await guild.bans.fetch({ limit: 100, before: before || undefined }).catch(() => null);
    if (!batch || batch.size === 0) break;

    bans.push(...batch.map(ban => ban));
    if (batch.size < 100) break;

    before = batch.last()?.user?.id || null;
    if (!before) break;
  }

  bans.sort((a, b) => {
    const nameA = a.user?.username?.toLowerCase() || '';
    const nameB = b.user?.username?.toLowerCase() || '';
    return nameA.localeCompare(nameB, 'fr', { sensitivity: 'base' }) || (a.user?.id || '').localeCompare(b.user?.id || '');
  });

  return bans;
}

function getTotalPages(total) {
  return Math.max(1, Math.ceil(total / PAGE_SIZE));
}

function getPageSlice(bans, page) {
  const pageCount = getTotalPages(bans.length);
  const currentPage = Math.min(Math.max(page, 0), pageCount - 1);
  const start = currentPage * PAGE_SIZE;
  return {
    currentPage,
    pageCount,
    entries: bans.slice(start, start + PAGE_SIZE)
  };
}

function buildBanLine(ban, index) {
  const userId = ban.user?.id || 'unknown';
  const username = ban.user?.username || 'Utilisateur inconnu';
  const reason = ban.reason || 'Aucune raison fournie';
  return `**#${index + 1}** \`${username}\` (\`${userId}\`)\n-# ${reason}`;
}

function buildBanListContainer({ guild, bans, page, lang }) {
  const copy = getCopy(lang);
  const { currentPage, pageCount, entries } = getPageSlice(bans, page);

  const container = new ContainerBuilder()
    .setAccentColor(0x2B2D31)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${copy.title}\n\n${copy.total} : **${bans.length}** • ${copy.page} **${currentPage + 1}/${pageCount}**`
      )
    );

  appendSeparatorComponent(container);

  if (!entries.length) {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`> ${copy.empty}`)
    );
  } else {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(entries.map((ban, index) => buildBanLine(ban, currentPage * PAGE_SIZE + index)).join('\n\n'))
    );
  }

  appendSeparatorComponent(container);

  const buttons = [
    new ButtonBuilder()
      .setCustomId(`banlist_prev_${guild.id}_${currentPage}`)
      .setLabel(copy.previous)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage <= 0),
    new ButtonBuilder()
      .setCustomId(`banlist_search_${guild.id}`)
      .setLabel(copy.searchButton)
      .setStyle(ButtonStyle.Primary),
    new ButtonBuilder()
      .setCustomId(`banlist_next_${guild.id}_${currentPage}`)
      .setLabel(copy.next)
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(currentPage >= pageCount - 1)
  ];

  container.addActionRowComponents(new ActionRowBuilder().addComponents(buttons));
  return container;
}

function buildBanSearchResultContainer({ guild, ban, lang }) {
  const copy = getCopy(lang);
  const container = new ContainerBuilder()
    .setAccentColor(0x2B2D31)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${copy.searchResultTitle}\n\n\`${ban.user?.username || 'Utilisateur inconnu'}\` (\`${ban.user?.id || 'unknown'}\`)`
      )
    );

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `**${copy.reason}** : ${ban.reason || copy.noReason}`
    )
  );

  if (ban.mod && ban.mod.id) {
    appendSeparatorComponent(container);
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `**${copy.moderator}** : <@${ban.mod.id}> (\`${ban.mod.username || ban.mod.id}\`)`
      )
    );
  }

  return container;
}

async function replyBanList(interaction, guild, page, lang) {
  const bans = await fetchAllBans(guild);
  const container = buildBanListContainer({ guild, bans, page, lang });

  if (interaction.deferred || interaction.replied) {
    return interaction.editReply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });
  }

  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

export const data = new SlashCommandBuilder()
  .setName('banlist')
  .setDescription('Afficher la liste des membres bannis');

export async function executeSlash(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;

  const lang = await getLanguage(interaction.member);
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  return replyBanList(interaction, interaction.guild, 0, lang);
}

export async function executePrefix(message) {
  if (!await checkPermissions(message, message.member)) return;

  const lang = await getLanguage(message.member);
  await message.delete().catch(() => null);
  const bans = await fetchAllBans(message.guild);
  const container = buildBanListContainer({ guild: message.guild, bans, page: 0, lang });
  await sendV2Container(message.channel, container);
}

export async function handleBanListButton(interaction) {
  if (!interaction.customId.startsWith('banlist_')) return false;

  const lang = await getLanguage(interaction.member);

  if (interaction.customId.startsWith('banlist_search_')) {
    const guildId = interaction.customId.split('_')[2];
    if (guildId !== interaction.guildId) {
      await interaction.reply({ content: '-# Ce panneau ne correspond pas à ce serveur.', flags: MessageFlags.Ephemeral }).catch(() => null);
      return true;
    }

    const modal = new ModalBuilder()
      .setCustomId(`banlist_search_modal_${guildId}`)
      .setTitle(getCopy(lang).searchButton);

    const input = new TextInputBuilder()
      .setCustomId('banlist_search_id')
      .setLabel(getCopy(lang).searchLabel)
      .setPlaceholder(getCopy(lang).searchPlaceholder)
      .setStyle(TextInputStyle.Short)
      .setRequired(true)
      .setMaxLength(20);

    modal.addComponents(new ActionRowBuilder().addComponents(input));
    await interaction.showModal(modal);
    return true;
  }

  const match = interaction.customId.match(/^banlist_(prev|next)_(\d{17,20})_(\d+)$/);
  if (!match) return false;

  const [, direction, guildId, pageText] = match;
  if (guildId !== interaction.guildId) {
    await interaction.reply({ content: '-# Ce panneau ne correspond pas à ce serveur.', flags: MessageFlags.Ephemeral }).catch(() => null);
    return true;
  }

  const page = Number(pageText) + (direction === 'next' ? 1 : -1);
  await interaction.deferUpdate().catch(() => null);
  return replyBanList(interaction, interaction.guild, page, lang);
}

export async function handleBanListSearchModal(interaction) {
  const match = interaction.customId.match(/^banlist_search_modal_(\d{17,20})$/);
  if (!match) return false;

  const guildId = match[1];
  if (guildId !== interaction.guildId) {
    return interaction.reply({ content: '-# Ce formulaire ne correspond pas à ce serveur.', flags: MessageFlags.Ephemeral });
  }

  const lang = await getLanguage(interaction.member);
  const targetId = extractDiscordId(interaction.fields.getTextInputValue('banlist_search_id'));
  if (!targetId) {
    return interaction.reply({ content: '-# ID Discord invalide.', flags: MessageFlags.Ephemeral });
  }

  const ban = await interaction.guild.bans.fetch(targetId).catch(() => null);
  if (!ban) {
    return interaction.reply({ content: `-# ${getCopy(lang).searchNotFound}`, flags: MessageFlags.Ephemeral });
  }

  const container = buildBanSearchResultContainer({ guild: interaction.guild, ban, lang });
  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

export default {
  data,
  executeSlash,
  executePrefix,
  handleBanListButton,
  handleBanListSearchModal
};
