import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  Routes
} from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { isEnglishOnly } from '../../utils/language.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';
import config from '../../config/config.js';

const translateHint = '-# 🇬🇧 Click below to translate to English.';

registerPanelRefreshBuilder('reglement', async ({ member }) => buildReglementContainers(!(await isEnglishOnly(member))));

function createRuleContainer(title, lines, withTranslateButton = false, translateDisabled = false) {
  const text = new TextDisplayBuilder().setContent(
    [`### ${title}`, '', ...lines, '', translateHint].join('\n')
  );

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text);

  if (withTranslateButton) {
    const translateButton = new ButtonBuilder()
      .setCustomId('msg_translate_reglement')
      .setLabel('🇬🇧 Translate')
      .setStyle(ButtonStyle.Secondary);

    container.addActionRowComponents(new ActionRowBuilder().addComponents(translateButton));
  }

  return container;
}

function buildReglementContainers(translateDisabled = false) {
  return [
    createRuleContainer('RÈGLEMENT DISCORD — TAKEDOWN', [
      'Bienvenue sur le serveur Discord officiel de TAKEDOWN !',
      '',
      'Ce serveur est un espace communautaire dédié au projet. Afin de garantir une ambiance conviviale, respectueuse et agréable pour tous, chaque membre est tenu de respecter le règlement ci-dessous.'
    ]),
    createRuleContainer('Respect obligatoire', [
      'Le respect est exigé envers **tous les membres**, les joueurs ainsi que les membres du staff.',
      '',
      '**Sont strictement interdits :**',
      '',
      '• Les insultes',
      '• Les provocations abusives',
      '• Les menaces',
      '• Les humiliations',
      '• Les discriminations',
      '• Les comportements toxiques'
    ]),
    createRuleContainer('Savoir-vivre', [
      'Chaque membre doit faire preuve de :',
      '',
      '• Respect',
      '• Politesse',
      '• Maturité',
      '• Bon sens',
      '',
      'Les débats et désaccords sont autorisés, **à condition qu’ils restent courtois et constructifs**.'
    ]),
    createRuleContainer('Aucun harcèlement', [
      'Le harcèlement, l’acharnement, les moqueries ciblées ainsi que les attaques répétées envers un membre sont **strictement interdits**, que ce soit :',
      '',
      '• En salon public',
      '• En message privé'
    ]),
    createRuleContainer('Spam & Flood', [
      'Afin de conserver un serveur propre et lisible, il est interdit de :',
      '',
      '• Spammer',
      '• Flooder',
      '• Répéter plusieurs fois le même message',
      '• Abuser des mentions (`@`)',
      '• Écrire de manière excessive en **MAJUSCULES**'
    ]),
    createRuleContainer('Respect des salons', [
      'Chaque salon possède une utilité précise.',
      '',
      'Merci de :',
      '',
      '• Utiliser le bon salon',
      '• Éviter les hors-sujets',
      '• Garder le serveur organisé'
    ]),
    createRuleContainer('Contenus interdits', [
      'Les contenus suivants sont interdits :',
      '',
      '• Illégaux',
      '• Choquants',
      '• Pornographiques',
      '• Violents',
      '• Discriminatoires',
      '• Haineux',
      '• Inappropriés'
    ]),
    createRuleContainer('Publicité', [
      'Toute publicité est interdite sans l’autorisation d’un membre du staff.',
      '',
      'Cela concerne notamment :',
      '',
      '• Autres serveurs Discord',
      '• Réseaux sociaux',
      '• Autres communautés',
      '• Services',
      '• Projets personnels'
    ]),
    createRuleContainer('Respect du Staff', [
      'Les décisions du staff doivent être respectées.',
      '',
      'En cas de désaccord :',
      '',
      '> Ouvrez un ticket ou utilisez les moyens prévus afin d’échanger calmement avec l’équipe.',
      '',
      'Les comportements suivants ne seront pas tolérés :',
      '',
      '• Provocations',
      '• Contestations abusives',
      '• Manque de respect',
      '• Harcèlement envers le staff',
      '',
      '**Sanctions**',
      '',
      'Le non-respect du règlement pourra entraîner une ou plusieurs sanctions selon la gravité des faits.',
      '',
      '• Avertissement',
      '• Mute / Timeout',
      '• Expulsion temporaire',
      '• Bannissement définitif'
    ]),
    createRuleContainer('Acceptation du règlement', [
      'En rejoignant le serveur **TAKEDOWN**, vous reconnaissez avoir pris connaissance de ce règlement et vous vous engagez à le respecter.',
      '',
      '> **L’acceptation du règlement Discord implique également l’acceptation du règlement in-game de TAKEDOWN.**',
      '>',
      '> En jouant sur le serveur, vous vous engagez à respecter l’ensemble des règles en jeu.',
      '',
      'Merci de contribuer à faire de **TAKEDOWN** une communauté agréable pour tous.'
    ], true, translateDisabled)
  ];
}

async function sendReglement(channel, translateDisabled = false) {
  const containers = buildReglementContainers(translateDisabled);
  await channel.client.rest.post(Routes.channelMessages(channel.id), {
    body: {
      components: containers.map(container => container.toJSON()),
      flags: MessageFlags.IsComponentsV2
    }
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('reglement')
    .setDescription('Envoyer le règlement du serveur'),

  async executeSlash(interaction) {
    if (!await checkPermissions(interaction, interaction.member)) return;
    const translateDisabled = !(await isEnglishOnly(interaction.member));

    await interaction.reply({
      components: buildReglementContainers(translateDisabled),
      flags: MessageFlags.IsComponentsV2
    });
    const replyMessage = await interaction.fetchReply().catch(() => null);
    if (replyMessage) {
      registerPanelRefresh({
        key: `reglement:${replyMessage.id}`,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageIds: replyMessage.id,
        memberId: interaction.user.id,
        refreshOnMemberUpdate: true,
        panelType: 'reglement',
        buildComponents: async member => buildReglementContainers(!(await isEnglishOnly(member)))
      });
    }
  },

  async executePrefix(message) {
    if (!await checkPermissions(message, message.member)) return;
    const translateDisabled = !(await isEnglishOnly(message.member));

    await message.delete().catch(() => null);
    const sentMessage = await sendReglement(message.channel, translateDisabled);
    registerPanelRefresh({
      key: `reglement:${sentMessage?.id || message.channelId}`,
      guildId: message.guildId,
      channelId: message.channelId,
      messageIds: sentMessage?.id,
      memberId: message.author.id,
      refreshOnMemberUpdate: true,
      panelType: 'reglement',
      buildComponents: async member => buildReglementContainers(!(await isEnglishOnly(member)))
    });
  }
};

