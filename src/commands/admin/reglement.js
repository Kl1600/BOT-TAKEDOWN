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
    createRuleContainer('RÃGLEMENT DISCORD â TAKEDOWN', [
      'Bienvenue sur le serveur Discord officiel de TAKEDOWN !',
      '',
      'Ce serveur est un espace communautaire dÃ©diÃ© au projet. Afin de garantir une ambiance conviviale, respectueuse et agrÃ©able pour tous, chaque membre est tenu de respecter le rÃ¨glement ci-dessous.'
    ]),
    createRuleContainer('Respect obligatoire', [
      'Le respect est exigÃ© envers **tous les membres**, les joueurs ainsi que les membres du staff.',
      '',
      '**Sont strictement interdits :**',
      '',
      'â¢ Les insultes',
      'â¢ Les provocations abusives',
      'â¢ Les menaces',
      'â¢ Les humiliations',
      'â¢ Les discriminations',
      'â¢ Les comportements toxiques'
    ]),
    createRuleContainer('Savoir-vivre', [
      'Chaque membre doit faire preuve de :',
      '',
      'â¢ Respect',
      'â¢ Politesse',
      'â¢ MaturitÃ©',
      'â¢ Bon sens',
      '',
      'Les dÃ©bats et dÃ©saccords sont autorisÃ©s, **Ã  condition quâils restent courtois et constructifs**.'
    ]),
    createRuleContainer('Aucun harcÃ¨lement', [
      'Le harcÃ¨lement, lâacharnement, les moqueries ciblÃ©es ainsi que les attaques rÃ©pÃ©tÃ©es envers un membre sont **strictement interdits**, que ce soit :',
      '',
      'â¢ En salon public',
      'â¢ En message privÃ©'
    ]),
    createRuleContainer('Spam & Flood', [
      'Afin de conserver un serveur propre et lisible, il est interdit de :',
      '',
      'â¢ Spammer',
      'â¢ Flooder',
      'â¢ RÃ©pÃ©ter plusieurs fois le mÃªme message',
      'â¢ Abuser des mentions (`@`)',
      'â¢ Ãcrire de maniÃ¨re excessive en **MAJUSCULES**'
    ]),
    createRuleContainer('Respect des salons', [
      'Chaque salon possÃ¨de une utilitÃ© prÃ©cise.',
      '',
      'Merci de :',
      '',
      'â¢ Utiliser le bon salon',
      'â¢ Ãviter les hors-sujets',
      'â¢ Garder le serveur organisÃ©'
    ]),
    createRuleContainer('Contenus interdits', [
      'Les contenus suivants sont interdits :',
      '',
      'â¢ IllÃ©gaux',
      'â¢ Choquants',
      'â¢ Pornographiques',
      'â¢ Violents',
      'â¢ Discriminatoires',
      'â¢ Haineux',
      'â¢ InappropriÃ©s'
    ]),
    createRuleContainer('PublicitÃ©', [
      'Toute publicitÃ© est interdite sans lâautorisation dâun membre du staff.',
      '',
      'Cela concerne notamment :',
      '',
      'â¢ Autres serveurs Discord',
      'â¢ RÃ©seaux sociaux',
      'â¢ Autres communautÃ©s',
      'â¢ Services',
      'â¢ Projets personnels'
    ]),
    createRuleContainer('Respect du Staff', [
      'Les dÃ©cisions du staff doivent Ãªtre respectÃ©es.',
      '',
      'En cas de dÃ©saccord :',
      '',
      '> Ouvrez un ticket ou utilisez les moyens prÃ©vus afin dâÃ©changer calmement avec lâÃ©quipe.',
      '',
      'Les comportements suivants ne seront pas tolÃ©rÃ©s :',
      '',
      'â¢ Provocations',
      'â¢ Contestations abusives',
      'â¢ Manque de respect',
      'â¢ HarcÃ¨lement envers le staff',
      '',
      '**Sanctions**',
      '',
      'Le non-respect du rÃ¨glement pourra entraÃ®ner une ou plusieurs sanctions selon la gravitÃ© des faits.',
      '',
      'â¢ Avertissement',
      'â¢ Mute / Timeout',
      'â¢ Expulsion temporaire',
      'â¢ Bannissement dÃ©finitif'
    ]),
    createRuleContainer('Acceptation du rÃ¨glement', [
      'En rejoignant le serveur **TAKEDOWN**, vous reconnaissez avoir pris connaissance de ce rÃ¨glement et vous vous engagez Ã  le respecter.',
      '',
      '> **Lâacceptation du rÃ¨glement Discord implique Ã©galement lâacceptation du rÃ¨glement in-game de TAKEDOWN.**',
      '>',
      '> En jouant sur le serveur, vous vous engagez Ã  respecter lâensemble des rÃ¨gles en jeu.',
      '',
      'Merci de contribuer Ã  faire de **TAKEDOWN** une communautÃ© agrÃ©able pour tous.'
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
    .setDescription('Envoyer le rÃ¨glement du serveur'),

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

