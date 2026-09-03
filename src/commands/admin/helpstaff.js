import {
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder
} from 'discord.js';
import config from '../../config/config.js';
import { hasTicketManagementAccess, prefixReply, replyErr } from '../../services/moderationService.js';
import { appendSeparatorComponent, sendV2Container } from '../../utils/v2Helper.js';

function buildStaffHelpContainer(prefix) {
  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        '### COMMANDES STAFF\n-# Commandes disponibles pour l’équipe de gestion des tickets.'
      )
    );

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([
      '### TICKETS',
      `> \`/add\` \`${prefix}add <id|@membre>\` — Ajouter un membre`,
      `> \`/remove\` \`${prefix}remove <id|@membre>\` — Retirer un membre`,
      `> \`/rename\` \`${prefix}rename <nom>\` — Renommer le ticket`,
      '> `/categorie` — Déplacer le ticket vers une catégorie',
      `> \`/close\` \`${prefix}close [raison]\` — Fermer le ticket`
    ].join('\n'))
  );

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([
      '### MODÉRATION',
      `> \`/mute\` \`${prefix}mute <id|@membre> <durée> [raison]\` — Mettre en sourdine`,
      `> \`/unmute\` \`${prefix}unmute <id|@membre> [raison]\` — Retirer le mute`,
      '> Menu utilisateur `mute_user` — Mettre un membre en sourdine'
    ].join('\n'))
  );

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent([
      '### TRADUCTION',
      '> `/en` — Traduire un texte français en anglais',
      '> Menu utilisateur `en_user` — Traduire un texte pour un membre',
      '> Menu message `en` — Traduire un texte en anglais depuis un message',
      '> Menu message `Translate` — Traduire un message anglais en français'
    ].join('\n'))
  );

  return container;
}

export const data = new SlashCommandBuilder()
  .setName('helpstaff')
  .setDescription('Afficher les commandes disponibles pour le staff')
  .setDMPermission(false);

export async function executeSlash(interaction) {
  if (!hasTicketManagementAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  return interaction.reply({
    components: [buildStaffHelpContainer(config.prefix)],
    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral
  });
}

export async function executePrefix(message) {
  if (!hasTicketManagementAccess(message.member)) {
    return prefixReply(message, 'Permissions insuffisantes.');
  }

  return sendV2Container(message.channel, buildStaffHelpContainer(config.prefix));
}

export default {
  data,
  executeSlash,
  executePrefix
};
