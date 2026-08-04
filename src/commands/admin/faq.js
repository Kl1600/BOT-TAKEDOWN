import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js';
import { getLanguage, hasFrenchRole, isEnglishOnly, t } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { appendSeparatorComponent, sendV2Container } from '../../utils/v2Helper.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';
import config from '../../config/config.js';

registerPanelRefreshBuilder('faq', async ({ member }) => {
  const lang = await getLanguage(member);
  return buildFaqContainers(lang, member);
});

const FAQ_ITEMS = [
  {
    id: 'what_is_takedown',
    question: {
      fr: "Qu'est-ce que Takedown ?",
      en: 'What is Takedown?'
    },
    answer: {
      fr: 'Takedown est un serveur FiveM basé sur l’univers des courses-poursuites. Il mélange open world, mode Ranked compétitif basé sur le MMR et tournois avec récompenses.',
      en: 'Takedown is a FiveM server built around chase gameplay. It combines open-world play, a competitive Ranked mode based on MMR, and tournaments with rewards.'
    }
  },
  {
    id: 'how_join',
    question: {
      fr: 'Comment rejoindre le serveur ?',
      en: 'How do I join the server?'
    },
    answer: {
      fr: 'Tu peux rejoindre Takedown en cherchant "Takedown" dans la liste des serveurs FiveM, ou en ouvrant FiveM puis F8 et en tapant : connect play.takedown-fivem.com.\n\nLien direct : <#1520743657425211392>',
      en: 'You can join Takedown by searching for "Takedown" in the FiveM server list, or by opening FiveM, pressing F8, and typing: connect play.takedown-fivem.com.\n\nDirect link: <#1520743657425211392>'
    }
  },
  {
    id: 'game_goal',
    question: {
      fr: 'Quel est le but du jeu ?',
      en: 'What is the purpose of the game?'
    },
    answer: {
      fr: 'Le but est de profiter de courses-poursuites dynamiques en open world ou en mode compétitif selon ton style de jeu.',
      en: 'The goal is to enjoy dynamic chase gameplay in open world or in competitive modes depending on your playstyle.'
    }
  },
  {
    id: 'ranked',
    question: {
      fr: 'Comment fonctionne le mode Ranked ?',
      en: 'How does Ranked work?'
    },
    answer: {
      fr: 'Le mode Ranked fonctionne avec un système de MMR. Les deux joueurs spawn avec le même véhicule, les matchs sont équilibrés, et tu gagnes ou perds du MMR selon tes performances.',
      en: 'Ranked uses an MMR system. Both players spawn with the same vehicle, matches are balanced, and you gain or lose MMR depending on your performance.'
    }
  },
  {
    id: 'ranking',
    question: {
      fr: 'Y a-t-il un classement ?',
      en: 'Is there a leaderboard?'
    },
    answer: {
      fr: 'Oui, le classement est basé sur le MMR des joueurs. Les meilleurs joueurs peuvent gagner des récompenses.',
      en: 'Yes, the leaderboard is based on players’ MMR. Top players can win rewards.'
    }
  },
  {
    id: 'tournaments',
    question: {
      fr: 'Comment participer aux tournois ?',
      en: 'How do I join tournaments?'
    },
    answer: {
      fr: 'Les tournois sont annoncés sur Discord et en jeu. L’inscription se fait via les salons dédiés, les places sont limitées, et des récompenses sont possibles.',
      en: 'Tournaments are announced on Discord and in-game. Registration happens through dedicated channels, spots are limited, and rewards may be available.'
    }
  },
  {
    id: 'rewards',
    question: {
      fr: 'Quelles sont les récompenses des tournois ?',
      en: 'What rewards do tournaments offer?'
    },
    answer: {
      fr: 'Les récompenses peuvent être du cash price, des titres exclusifs, des récompenses en jeu ou une reconnaissance dans le classement.',
      en: 'Rewards may include cash prizes, exclusive titles, in-game rewards, or recognition on the leaderboard.'
    }
  },
  {
    id: 'play_with_friends',
    question: {
      fr: 'Puis-je jouer avec mes amis ?',
      en: 'Can I play with my friends?'
    },
    answer: {
      fr: 'Oui. En open world tu peux jouer librement avec tes amis, et certains événements ou tournois permettent aussi le jeu en équipe.',
      en: 'Yes. In open world you can freely play with your friends, and some events or tournaments also allow team play.'
    }
  },
  {
    id: 'placements',
    question: {
      fr: 'Les nouveaux joueurs peuvent-ils jouer en Ranked ?',
      en: 'Can new players play Ranked?'
    },
    answer: {
      fr: 'Oui. Les nouveaux joueurs doivent effectuer 10 parties de placement. Pendant ces 10 parties, aucun MMR n’est gagné ou perdu.',
      en: 'Yes. New players must complete 10 placement matches. During those 10 matches, no MMR is gained or lost.'
    }
  },
  {
    id: 'staff',
    question: {
      fr: 'Comment devenir membre du staff ?',
      en: 'How do I become staff?'
    },
    answer: {
      fr: 'Rends-toi ici : <#1519999288434888774>\nRemplis le questionnaire de recrutement. Si ta candidature est retenue, tu seras contacté via ticket.',
      en: 'Go here: <#1519999288434888774>\nFill out the recruitment questionnaire. If your application is selected, you will be contacted via ticket.'
    }
  },
  {
    id: 'bug',
    question: {
      fr: "J'ai trouvé un bug, que faire ?",
      en: 'I found a bug, what should I do?'
    },
    answer: {
      fr: 'Ouvre un ticket ici : <#1522349062832128100>\nExplique clairement le bug et ajoute des preuves si possible.',
      en: 'Open a ticket here: <#1522349062832128100>\nExplain the bug clearly and add proof if possible.'
    }
  },
  {
    id: 'news',
    question: {
      fr: 'Où suivre les nouveautés ?',
      en: 'Where can I follow the latest updates?'
    },
    answer: {
      fr: 'Les nouveautés sont disponibles en jeu et sur Discord ici : <#1519998704298496000>',
      en: 'The latest updates are available in-game and on Discord here: <#1519998704298496000>'
    }
  }
];

const FAQ_ITEMS_PER_MESSAGE = 6;

function buildFaqQuestionBlock(item) {
  return [
    `:flag_fr: **${item.question.fr}**`,
    `:flag_gb: **${item.question.en}**`
  ].join('\n');
}

async function buildFaqItemButtons(item, member) {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId(`faq_answer_${item.id}_fr`)
      .setLabel('Réponse')
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId(`faq_answer_${item.id}_en`)
      .setLabel('Answer')
      .setStyle(ButtonStyle.Secondary)
  );
}

async function buildFaqPageContainer(lang, items, pageIndex, pageCount, member) {
  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(`### FAQ - Takedown\n\nPage ${pageIndex + 1}/${pageCount}`)
    );

  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(buildFaqQuestionBlock(item))
    );
    container.addActionRowComponents(await buildFaqItemButtons(item, member));

    if (index < items.length - 1) {
      appendSeparatorComponent(container);
    }
  }

  return container;
}

async function buildFaqContainers(lang, member) {
  const pages = [];
  const pageCount = Math.ceil(FAQ_ITEMS.length / FAQ_ITEMS_PER_MESSAGE);

  for (let index = 0; index < FAQ_ITEMS.length; index += FAQ_ITEMS_PER_MESSAGE) {
    const items = FAQ_ITEMS.slice(index, index + FAQ_ITEMS_PER_MESSAGE);
    pages.push(await buildFaqPageContainer(lang, items, index / FAQ_ITEMS_PER_MESSAGE, pageCount, member));
  }

  return pages;
}

async function sendFaqContainers(interactionOrChannel, containers, isSlash = false) {
  const sentMessageIds = [];
  if (containers.length === 0) return sentMessageIds;

  if (isSlash) {
    await interactionOrChannel.reply({
      components: [containers[0]],
      flags: MessageFlags.IsComponentsV2
    });

    const firstReply = await interactionOrChannel.fetchReply().catch(() => null);
    if (firstReply?.id) sentMessageIds.push(firstReply.id);

    for (const container of containers.slice(1)) {
      const followUp = await interactionOrChannel.followUp({
        components: [container],
        flags: MessageFlags.IsComponentsV2
      });
      if (followUp?.id) sentMessageIds.push(followUp.id);
    }
    return sentMessageIds;
  }

  for (const container of containers) {
    const sentMessage = await sendV2Container(interactionOrChannel.channel, container);
    if (sentMessage?.id) sentMessageIds.push(sentMessage.id);
  }

  return sentMessageIds;
}

function getFaqItem(customId) {
  const id = customId.replace(/^faq_answer_(.*)_(fr|en)$/, '$1');
  return FAQ_ITEMS.find(item => item.id === id) || null;
}

function buildAnswerMessage(lang, item) {
  const answer = lang === 'en' ? item.answer.en : item.answer.fr;
  const question = lang === 'en' ? item.question.en : item.question.fr;
  return [
    `### ${question}`,
    '',
    answer
  ].join('\n');
}

export async function handleFaqButton(interaction) {
  const lang = interaction.customId.endsWith('_en') ? 'en' : 'fr';
  const item = getFaqItem(interaction.customId);
  const canUseEnglish = await isEnglishOnly(interaction.member);
  const canUseFrench = await hasFrenchRole(interaction.member);

  if (lang === 'en' && !canUseEnglish) {
    return interaction.reply({
      content: 'Permissions insuffisantes.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
  }

  if (lang === 'fr' && !canUseFrench) {
    return interaction.reply({
      content: 'Permissions insuffisantes.',
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
  }

  if (!item) {
    const fallbackLang = await getLanguage(interaction.member);
    return interaction.reply({
      content: t(fallbackLang, 'errors.command_error'),
      flags: MessageFlags.Ephemeral
    });
  }

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(buildAnswerMessage(lang, item))
    );

  return interaction.reply({
    components: [container],
    flags: MessageFlags.Ephemeral | MessageFlags.IsComponentsV2
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('faq')
    .setDescription('Afficher la FAQ interactive du serveur'),

  async executeSlash(interaction, lang) {
    if (!await checkPermissions(interaction, interaction.member)) return;
    const containers = await buildFaqContainers(lang, interaction.member);
    const sentMessageIds = await sendFaqContainers(interaction, containers, true);
    if (sentMessageIds.length > 0) {
      registerPanelRefresh({
        key: `faq:${sentMessageIds[0]}`,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageIds: sentMessageIds,
        memberId: interaction.user.id,
        refreshOnMemberUpdate: true,
        panelType: 'faq',
        buildComponents: async member => {
          const refreshedLang = await getLanguage(member);
          return buildFaqContainers(refreshedLang, member);
        }
      });
    }
  },

  async executePrefix(message, args, lang) {
    if (!await checkPermissions(message, message.member)) return;
    await message.delete().catch(() => null);
    const containers = await buildFaqContainers(lang, message.member);
    const sentMessageIds = await sendFaqContainers(message, containers, false);
    if (sentMessageIds.length > 0) {
      registerPanelRefresh({
        key: `faq:${sentMessageIds[0]}`,
        guildId: message.guildId,
        channelId: message.channelId,
        messageIds: sentMessageIds,
        memberId: message.author.id,
        refreshOnMemberUpdate: true,
        panelType: 'faq',
        buildComponents: async member => {
          const refreshedLang = await getLanguage(member);
          return buildFaqContainers(refreshedLang, member);
        }
      });
    }
  }
};
