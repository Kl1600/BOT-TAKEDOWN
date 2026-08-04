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
    createModeContainer('TAKEDOWN Ã¢â¬â Modes de jeu', [
      'Bienvenue sur la prÃÂ©sentation des diffÃÂ©rents modes de jeu de Takedown.',
      '',
      'Chaque mode a ses propres rÃÂ¨gles, objectifs et gains.'
    ]),
    createModeContainer('Course-Poursuite Ã¢â¬â Casual', [
      'Une course-poursuite en **1 contre 1** opposant un **Fuyard** ÃÂ  un **Chasseur**.',
      '',
      "Les deux joueurs utilisent un **vÃÂ©hicule identique**, choisi parmi l'ensemble des vÃÂ©hicules disponibles sur le serveur (visibles dans le garage).",
      '',
      '**DÃÂ©roulement**',
      '* Une seule manche par partie.',
      '* Revanche possible ÃÂ  la fin de la partie.',
      '* Le Fuyard dispose de **3 minutes** pour sÃ¢â¬â¢ÃÂ©chapper.',
      '',
      '**Conditions de victoire**',
      '',
      '**Victoire du Fuyard**',
      '* CrÃÂ©er un ÃÂ©cart de **500 mÃÂ¨tres** avec le Chasseur.',
      '* Sortir de son champ de vision et rÃÂ©ussir ÃÂ  se cacher.',
      '',
      '**Victoire du Chasseur**',
      '* EmpÃÂªcher le Fuyard de remplir une condition de victoire pendant les **3 minutes** de la manche.',
      '* Immobiliser le Fuyard : les deux vÃÂ©hicules doivent rester ÃÂ  lÃ¢â¬â¢arrÃÂªt, proches lÃ¢â¬â¢un de lÃ¢â¬â¢autre, pendant quelques secondes.',
      '',
      '**DÃÂ©faite immÃÂ©diate**',
      'La manche est immÃÂ©diatement perdue si un joueur :',
      '* Effectue un saut.',
      '* RÃÂ©alise **3 PIT volontaires**.',
      '* Tombe dans lÃ¢â¬â¢eau.',
      '* DÃÂ©truit son vÃÂ©hicule.',
      '* Laisse son vÃÂ©hicule retournÃÂ© trop longtemps.',
      '',
      '**RÃÂ©compenses**',
      '* Battle Pass (BP)',
      '* ExpÃÂ©rience (XP)'
    ]),
    createModeContainer('Course-Poursuite Ã¢â¬â Ranked', [
      'La version compÃÂ©titive du mode Course-Poursuite.',
      '',
      "Les joueurs utilisent un **pool de vÃÂ©hicules limitÃÂ©**, renouvelÃÂ© rÃÂ©guliÃÂ¨rement afin de garantir un meilleur ÃÂ©quilibrage.",
      '',
      '**DÃÂ©roulement**',
      '* Une seule manche.',
      '* Aucune revanche.',
      '* Le Fuyard dispose de **3 minutes** pour sÃ¢â¬â¢ÃÂ©chapper.',
      '* Les **10 premiÃÂ¨res parties** servent de matchs de placement. Elles sont obligatoires avant dÃ¢â¬â¢obtenir un classement et de gagner du MMR.',
      '',
      '**Conditions de victoire**',
      '',
      '**Victoire du Fuyard**',
      '* CrÃÂ©er un ÃÂ©cart de **500 mÃÂ¨tres** avec le Chasseur.',
      '* Sortir de son champ de vision et rester cachÃÂ©.',
      '',
      '**Victoire du Chasseur**',
      '* EmpÃÂªcher le Fuyard de remplir une condition de victoire pendant les 3 minutes.',
      '* Immobiliser le Fuyard.',
      '',
      '**DÃÂ©faite immÃÂ©diate**',
      '* Saut effectuÃÂ©.',
      '* 3 PIT volontaires.',
      '* Chute dans lÃ¢â¬â¢eau.',
      '* VÃÂ©hicule dÃÂ©truit.',
      '* VÃÂ©hicule retournÃÂ© trop longtemps.',
      '',
      '**RÃÂ©compenses**',
      '* Battle Pass (BP)',
      '* ExpÃÂ©rience (XP)',
      '* MMR'
    ]),
    createModeContainer('Course de Rue Ã¢â¬â Casual', [
      'Des courses multijoueurs accessibles avec lÃ¢â¬â¢ensemble des vÃÂ©hicules disponibles sur le serveur.',
      '',
      '**RÃÂ¨gles**',
      '* De **4 ÃÂ  6 joueurs** pour lancer une partie.',
      '* VÃÂ©hicule alÃÂ©atoire.',
      '* Parcours alÃÂ©atoire.',
      '* La sÃÂ©lection est effectuÃÂ©e au lancement de la partie.',
      '',
      '**RÃÂ©compenses**',
      '* Battle Pass (BP)',
      '* ExpÃÂ©rience (XP)'
    ]),
    createModeContainer('Course de Rue Ã¢â¬â Ranked', [
      'La version compÃÂ©titive des Courses de Rue.',
      '',
      "Les vÃÂ©hicules disponibles proviennent dÃ¢â¬â¢une **rotation rÃÂ©guliÃÂ¨re** afin de renouveler le gameplay et dÃ¢â¬â¢assurer un meilleur ÃÂ©quilibrage.",
      '',
      '**RÃÂ¨gles**',
      '* De **4 ÃÂ  6 joueurs** pour lancer une partie.',
      '* VÃÂ©hicule alÃÂ©atoire.',
      '* Parcours alÃÂ©atoire.',
      '',
      '**RÃÂ©compenses**',
      '* Battle Pass (BP)',
      '* ExpÃÂ©rience (XP)',
      '* MMR'
    ]),
    createModeContainer('Modes dÃ¢â¬â¢entraÃÂ®nement', [
      'PrÃÂ©sentation des modes dÃ¢â¬â¢entraÃÂ®nement disponibles sur Takedown.',
      '',
      'Ces modes servent ÃÂ  progresser librement, tester des trajectoires et prÃÂ©parer les modes compÃÂ©titifs.'
    ]),
    createModeContainer('Open World', [
      'Un espace libre permettant de sÃ¢â¬â¢entraÃÂ®ner sans contrainte.',
      '',
      '**FonctionnalitÃÂ©s**',
      '* 4 instances disponibles :',
      '  * 2 avec PNJ.',
      '  * 2 sans PNJ.',
      '* AccÃÂ¨s ÃÂ  tous les vÃÂ©hicules.',
      '* PossibilitÃÂ© de rejoindre ses amis.'
    ]),
    createModeContainer('Practice', [
      'Des parcours dÃ¢â¬â¢entraÃÂ®nement crÃÂ©ÃÂ©s par la communautÃÂ© pour perfectionner sa conduite et apprendre des techniques spÃÂ©cifiques.',
      '',
      '**FonctionnalitÃÂ©s**',
      '* Parcours crÃÂ©ÃÂ©s par la communautÃÂ©.',
      '* Travail des trajectoires, feintes et techniques avancÃÂ©es.',
      '* CrÃÂ©ation de parcours personnalisÃÂ©s prÃÂ©vue prochainement.'
    ]),
    createModeContainer('EntraÃÂ®nement Course de Rue', [
      'Un mode dÃÂ©diÃÂ© ÃÂ  lÃ¢â¬â¢entraÃÂ®nement sur circuit avec choix libre du vÃÂ©hicule et du parcours.',
      '',
      '**Mode Libre**',
      '* Aucun chrono.',
      '* Aucun nombre de tours imposÃÂ©.',
      '* IdÃÂ©al pour dÃÂ©couvrir un circuit ou travailler ses trajectoires.',
      '',
      '**Mode Officiel**',
      'Reproduit les conditions dÃ¢â¬â¢une vÃÂ©ritable course.',
      '',
      'Inclut :',
      '* Nombre de tours officiel.',
      '* Chrono global.',
      '* Chrono par tour.',
      '* Chrono par secteur.',
      '',
      '**Mode Tours Infinis**',
      '* Nombre de tours illimitÃÂ©.',
      '* Chrono par tour.',
      '* Chrono par secteur.'
    ]),
    createModeContainer('Partie PersonnalisÃÂ©e', [
      'CrÃÂ©ez une partie privÃÂ©e entiÃÂ¨rement configurable.',
      '',
      '**Options disponibles**',
      '* Choix du mode de jeu.',
      '* Choix de la carte.',
      '* Choix du vÃÂ©hicule.',
      '* Invitation dÃ¢â¬â¢amis.',
      '* Rejoindre une partie via un code dÃ¢â¬â¢accÃÂ¨s.'
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
    .setDescription('Afficher les diffÃÂ©rents modes de jeu de Takedown'),

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

