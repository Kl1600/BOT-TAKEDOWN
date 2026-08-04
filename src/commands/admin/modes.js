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
import config from '../../config/config.js';
import { registerModesTranslationGroup } from '../../services/modesService.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';

function createModeContainer(title, lines) {
  return new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        [`### ${title}`, '', ...lines].join('\n')
      )
    );
}

function buildModesContainers() {
  return [
    createModeContainer('TAKEDOWN — Modes de jeu', [
      'Bienvenue sur la présentation des différents modes de jeu de Takedown.',
      '',
      'Chaque mode a ses propres règles, objectifs et gains.'
    ]),
    createModeContainer('Course-Poursuite — Casual', [
      'Une course-poursuite en **1 contre 1** opposant un **Fuyard** à un **Chasseur**.',
      '',
      "Les deux joueurs utilisent un **véhicule identique**, choisi parmi l'ensemble des véhicules disponibles sur le serveur (visibles dans le garage).",
      '',
      '**Déroulement**',
      '* Une seule manche par partie.',
      '* Revanche possible à la fin de la partie.',
      '* Le Fuyard dispose de **3 minutes** pour s’échapper.',
      '',
      '**Conditions de victoire**',
      '',
      '**Victoire du Fuyard**',
      '* Créer un écart de **500 mètres** avec le Chasseur.',
      '* Sortir de son champ de vision et réussir à se cacher.',
      '',
      '**Victoire du Chasseur**',
      '* Empêcher le Fuyard de remplir une condition de victoire pendant les **3 minutes** de la manche.',
      '* Immobiliser le Fuyard : les deux véhicules doivent rester à l’arrêt, proches l’un de l’autre, pendant quelques secondes.',
      '',
      '**Défaite immédiate**',
      'La manche est immédiatement perdue si un joueur :',
      '* Effectue un saut.',
      '* Réalise **3 PIT volontaires**.',
      '* Tombe dans l’eau.',
      '* Détruit son véhicule.',
      '* Laisse son véhicule retourné trop longtemps.',
      '',
      '**Récompenses**',
      '* Battle Pass (BP)',
      '* Expérience (XP)'
    ]),
    createModeContainer('Course-Poursuite — Ranked', [
      'La version compétitive du mode Course-Poursuite.',
      '',
      "Les joueurs utilisent un **pool de véhicules limité**, renouvelé régulièrement afin de garantir un meilleur équilibrage.",
      '',
      '**Déroulement**',
      '* Une seule manche.',
      '* Aucune revanche.',
      '* Le Fuyard dispose de **3 minutes** pour s’échapper.',
      '* Les **10 premières parties** servent de matchs de placement. Elles sont obligatoires avant d’obtenir un classement et de gagner du MMR.',
      '',
      '**Conditions de victoire**',
      '',
      '**Victoire du Fuyard**',
      '* Créer un écart de **500 mètres** avec le Chasseur.',
      '* Sortir de son champ de vision et rester caché.',
      '',
      '**Victoire du Chasseur**',
      '* Empêcher le Fuyard de remplir une condition de victoire pendant les 3 minutes.',
      '* Immobiliser le Fuyard.',
      '',
      '**Défaite immédiate**',
      '* Saut effectué.',
      '* 3 PIT volontaires.',
      '* Chute dans l’eau.',
      '* Véhicule détruit.',
      '* Véhicule retourné trop longtemps.',
      '',
      '**Récompenses**',
      '* Battle Pass (BP)',
      '* Expérience (XP)',
      '* MMR'
    ]),
    createModeContainer('Course de Rue — Casual', [
      'Des courses multijoueurs accessibles avec l’ensemble des véhicules disponibles sur le serveur.',
      '',
      '**Règles**',
      '* De **4 à 6 joueurs** pour lancer une partie.',
      '* Véhicule aléatoire.',
      '* Parcours aléatoire.',
      '* La sélection est effectuée au lancement de la partie.',
      '',
      '**Récompenses**',
      '* Battle Pass (BP)',
      '* Expérience (XP)'
    ]),
    createModeContainer('Course de Rue — Ranked', [
      'La version compétitive des Courses de Rue.',
      '',
      "Les véhicules disponibles proviennent d’une **rotation régulière** afin de renouveler le gameplay et d’assurer un meilleur équilibrage.",
      '',
      '**Règles**',
      '* De **4 à 6 joueurs** pour lancer une partie.',
      '* Véhicule aléatoire.',
      '* Parcours aléatoire.',
      '',
      '**Récompenses**',
      '* Battle Pass (BP)',
      '* Expérience (XP)',
      '* MMR'
    ]),
    createModeContainer('Modes d’entraînement', [
      'Présentation des modes d’entraînement disponibles sur Takedown.',
      '',
      'Ces modes servent à progresser librement, tester des trajectoires et préparer les modes compétitifs.'
    ]),
    createModeContainer('Open World', [
      'Un espace libre permettant de s’entraîner sans contrainte.',
      '',
      '**Fonctionnalités**',
      '* 4 instances disponibles :',
      '  * 2 avec PNJ.',
      '  * 2 sans PNJ.',
      '* Accès à tous les véhicules.',
      '* Possibilité de rejoindre ses amis.'
    ]),
    createModeContainer('Practice', [
      'Des parcours d’entraînement créés par la communauté pour perfectionner sa conduite et apprendre des techniques spécifiques.',
      '',
      '**Fonctionnalités**',
      '* Parcours créés par la communauté.',
      '* Travail des trajectoires, feintes et techniques avancées.',
      '* Création de parcours personnalisés prévue prochainement.'
    ]),
    createModeContainer('Entraînement Course de Rue', [
      'Un mode dédié à l’entraînement sur circuit avec choix libre du véhicule et du parcours.',
      '',
      '**Mode Libre**',
      '* Aucun chrono.',
      '* Aucun nombre de tours imposé.',
      '* Idéal pour découvrir un circuit ou travailler ses trajectoires.',
      '',
      '**Mode Officiel**',
      'Reproduit les conditions d’une véritable course.',
      '',
      'Inclut :',
      '* Nombre de tours officiel.',
      '* Chrono global.',
      '* Chrono par tour.',
      '* Chrono par secteur.',
      '',
      '**Mode Tours Infinis**',
      '* Nombre de tours illimité.',
      '* Chrono par tour.',
      '* Chrono par secteur.'
    ]),
    createModeContainer('Partie Personnalisée', [
      'Créez une partie privée entièrement configurable.',
      '',
      '**Options disponibles**',
      '* Choix du mode de jeu.',
      '* Choix de la carte.',
      '* Choix du véhicule.',
      '* Invitation d’amis.',
      '* Rejoindre une partie via un code d’accès.'
    ])
  ];
}

registerPanelRefreshBuilder('modes', async ({ member }) => {
  const batches = chunkContainers(buildModesContainers(), 3);
  await addTranslateButtonToLastContainer(batches[batches.length - 1], member);
  return batches;
});

function chunkContainers(containers, size = 3) {
  const chunks = [];
  for (let index = 0; index < containers.length; index += size) {
    chunks.push(containers.slice(index, index + size));
  }
  return chunks;
}

async function addTranslateButtonToLastContainer(batch, member) {
  const translateButton = new ButtonBuilder()
    .setCustomId('msg_translate_modes')
    .setLabel('🇬🇧 Translate')
    .setStyle(ButtonStyle.Secondary);

  const lastContainer = batch[batch.length - 1];
  lastContainer.addTextDisplayComponents(
    new TextDisplayBuilder().setContent('-# 🇬🇧 Click below to translate to English.')
  );
  lastContainer.addActionRowComponents(new ActionRowBuilder().addComponents(translateButton));
}

async function sendModes(target, member, isSlash = false) {
  const batches = chunkContainers(buildModesContainers(), 3);
  await addTranslateButtonToLastContainer(batches[batches.length - 1], member);
  const sentMessageIds = [];

  if (isSlash) {
    await target.reply({
      components: batches[0],
      flags: MessageFlags.IsComponentsV2
    });
    const firstReply = await target.fetchReply().catch(() => null);
    if (firstReply) {
      sentMessageIds.push(firstReply.id);
    }

    for (const batch of batches.slice(1)) {
      const followUpMessage = await target.followUp({
        components: batch,
        flags: MessageFlags.IsComponentsV2
      });
      if (followUpMessage?.id) {
        sentMessageIds.push(followUpMessage.id);
      }
    }
    registerModesTranslationGroup(sentMessageIds[sentMessageIds.length - 1], sentMessageIds);
    registerPanelRefresh({
      key: `modes:${sentMessageIds[sentMessageIds.length - 1]}`,
      guildId: target.guildId,
      channelId: target.channelId,
      messageIds: sentMessageIds,
      memberId: member?.id || null,
      panelType: 'modes',
      buildComponents: async member => {
        const refreshedBatches = chunkContainers(buildModesContainers(), 3);
        await addTranslateButtonToLastContainer(refreshedBatches[refreshedBatches.length - 1], member);
        return refreshedBatches;
      }
    });
    return;
  }

  for (const batch of batches) {
    const rawMessage = await target.client.rest.post(Routes.channelMessages(target.id), {
      body: {
        components: batch.map(container => container.toJSON()),
        flags: MessageFlags.IsComponentsV2
      }
    });
    if (rawMessage?.id) {
      sentMessageIds.push(rawMessage.id);
    }
  }

  registerModesTranslationGroup(sentMessageIds[sentMessageIds.length - 1], sentMessageIds);
  registerPanelRefresh({
    key: `modes:${sentMessageIds[sentMessageIds.length - 1]}`,
    guildId: target.guildId,
    channelId: target.id,
    messageIds: sentMessageIds,
    memberId: member?.id || null,
    panelType: 'modes',
    buildComponents: async member => {
      const refreshedBatches = chunkContainers(buildModesContainers(), 3);
      await addTranslateButtonToLastContainer(refreshedBatches[refreshedBatches.length - 1], member);
      return refreshedBatches;
    }
  });
}

export default {
  data: new SlashCommandBuilder()
    .setName('modes')
    .setDescription('Afficher les différents modes de jeu de Takedown'),

  async executeSlash(interaction) {
    if (!await checkPermissions(interaction, interaction.member)) return;
    await sendModes(interaction, interaction.member, true);
  },

  async executePrefix(message) {
    if (!await checkPermissions(message, message.member)) return;
    await message.delete().catch(() => null);
    await sendModes(message.channel, message.member, false);
  }
};

