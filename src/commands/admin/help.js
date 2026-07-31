import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  MessageFlags
} from 'discord.js';
import config from '../../config/config.js';
import { appendSeparatorComponent, sendV2Container } from '../../utils/v2Helper.js';

function buildHelpContainer(prefix) {
  const p = prefix;
  const sections = [
    [
      `### AIDE LISTE DES COMMANDES`,
      `-# Préfixe actuel : \`${p}\` — La plupart des commandes sont dispo en slash avec \`/\`, certaines aussi avec le préfixe.`
    ],
    [
      `### Tickets`,
      `> \`/ticket\` \`${p}ticket\` — Envoyer le panneau d'ouverture de ticket`,
      `> \`/close\` \`${p}close\` — Fermer le ticket actuel`,
      `> \`/add\` \`${p}add <id|@membre>\` — Ajouter un membre au ticket`,
      `> \`/remove\` \`${p}remove <id|@membre>\` — Retirer un membre du ticket`,
      `> \`/rename\` \`${p}rename <nom>\` — Renommer le ticket actuel`
    ],
    [
      `### Recrutement Staff`,
      `> \`/staffapply menu\` \`${p}staffapply\` — Envoyer le panneau de candidature`,
      `> \`/candidatt\` \`${p}candidatt\` — Afficher les candidatures staff en cours`
    ],
    [
      `### Modération`,
      `> \`/clear\` \`${p}clear\` — Vider tous les messages du salon`,
      `> \`/invite\` \`${p}invite [id|@membre]\` — Consulter les statistiques de parrainage`,
      `> \`/leaderboardinvite\` \`${p}leaderboardinvite\` — Afficher le classement des parrains`,
      `> \`/dm\` \`${p}dm <id> <message>\` — Envoyer un message privé à un utilisateur`,
      `> \`/antilink\` \`${p}antilink [on/off/toggle/status]\` — Activer ou désactiver le filtre de liens Discord`,
      `> \`/wllink\` \`${p}wllink [add/remove] <id>\` — Autoriser un membre à envoyer des liens Discord`,
      `> \`/wllinklist\` \`${p}wllinklist\` — Afficher la whitelist des liens Discord`,
      `> \`/bllink\` \`${p}bllink [add/remove] <id>\` — Bloquer un membre pour les liens Discord`,
      `> \`/saferc\` \`${p}saferc <id>\` — Retirer le cooldown staff apply d’un candidat`,
      `> \`/ban\` \`${p}ban <id|@membre> [raison]\` — Bannir un membre`,
      `> \`/banlist\` \`${p}banlist\` — Afficher la liste des bannis`,
      `> \`/unban\` \`${p}unban <userId> [raison]\` — Débannir un utilisateur`,
      `> \`/kick\` \`${p}kick <id|@membre> [raison]\` — Expulser un membre`,
      `> \`/mute\` \`${p}mute <id|@membre> <durée> [raison]\` — Mettre en sourdine`,
      `> \`/unmute\` \`${p}unmute <id|@membre>\` — Retirer le mute`,
      `> \`/lock\` \`${p}lock [#salon] [raison]\` — Verrouiller un salon`,
      `> \`/unlock\` \`${p}unlock [#salon]\` — Déverrouiller un salon`,
      `> \`/renew\` \`${p}renew [#salon]\` — Dupliquer un salon et supprimer l’ancien`
    ],
    [
      `### Annonces`,
      `> \`/annonce\` \`${p}annonce\` — Envoyer une annonce dans le serveur`
    ],
    [
      `### Patch notes`,
      `> \`/patchnote\` \`${p}patchnote\` — Envoyer un patch note dans le serveur`
    ],
    [
      `### Guide`,
      `> \`/guide\` \`${p}guide\` — Afficher le guide du serveur`
    ],
    [
      `### Connexion`,
      `> \`/connect\` \`${p}connect\` — Afficher le panneau de connexion au serveur`
    ],
    [
      `### Règlement`,
      `> \`/reglement\` \`${p}reglement\` — Afficher le règlement du serveur`
    ],
    [
      `### Modes de jeu`,
      `> \`/modes\` \`${p}modes\` — Afficher la présentation des modes de jeu`
    ],
    [
      `### XP`,
      `> \`/xp\` \`${p}xp\` — Afficher ton profil XP`,
      `> \`/leaderboardxp\` \`${p}leaderboardxp\` — Voir le classement XP`
    ],
    [
      `### FAQ`,
      `> \`/faq\` \`${p}faq\` — Afficher la FAQ interactive du serveur`
    ],
    [
      `### Stream`,
      `> \`/panelstreamer\` \`${p}panelstreamer\` — Envoyer le panel de lancement de live`
    ],
    [
      `### Rôles`,
      `> \`/panelrol\` \`${p}panelrol\` — Envoyer le panel de rôles`
    ],
    [
      `### Bienvenue`,
      `> \`/welcome on\` \`${p}welcome on\` — Activer le système de bienvenue`,
      `> \`/welcome off\` \`${p}welcome off\` — Désactiver le système de bienvenue`,
      `> \`/welcome status\` \`${p}welcome status\` — Voir l’état du système de bienvenue`,
      `> \`/accesbeta\` \`${p}accesbeta\` — Envoyer le panneau d’accès à la bêta`
    ],
    [
      `### Aide`,
      `> \`/help\` \`${p}help\` — Afficher cette liste`,
      `> \`/statut\` \`${p}statut\` — Changer le statut du bot`,
      `> \`/sync\` \`${p}sync\` — Synchroniser les commandes slash sur ce serveur`
    ],
    [
      `-# Seuls les membres avec le rôle **Staff** ou **Admin** peuvent utiliser ces commandes.`
    ]
  ];

  const container = new ContainerBuilder().setAccentColor(config.colors.primary);

  sections.forEach((section, index) => {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(section.join('\n')));
    if (index < sections.length - 1) {
      appendSeparatorComponent(container);
    }
  });

  return container;
}

export const data = new SlashCommandBuilder()
  .setName('help')
  .setDescription('Afficher la liste de toutes les commandes disponibles');

export async function executeSlash(interaction) {
  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const container = buildHelpContainer(config.prefix);

  return interaction.editReply({
    components: [container],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

export async function executePrefix(message) {
  const container = buildHelpContainer(config.prefix);
  await sendV2Container(message.channel, container);
  await message.delete().catch(() => null);
}

export default { data, executeSlash, executePrefix };
