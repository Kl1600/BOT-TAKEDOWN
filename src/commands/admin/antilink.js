import { SlashCommandBuilder } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyErr, replyOk } from '../../services/moderationService.js';
import config from '../../config/config.js';
import { getGuildAntiLinkSnapshot, setGuildAntiLinkEnabled } from '../../services/antiLinkService.js';

function normalizeAction(input) {
  return String(input ?? '').trim().toLowerCase();
}

function statusText(enabled) {
  return enabled ? 'activé' : 'désactivé';
}

export const data = new SlashCommandBuilder()
  .setName('antilink')
  .setDescription('Activer ou désactiver le filtre de liens Discord')
  .addStringOption(option =>
    option
      .setName('action')
      .setDescription('Action à effectuer')
      .addChoices(
        { name: 'toggle', value: 'toggle' },
        { name: 'on', value: 'on' },
        { name: 'off', value: 'off' },
        { name: 'status', value: 'status' }
      )
  );

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const action = normalizeAction(interaction.options.getString('action'));
  const snapshot = await getGuildAntiLinkSnapshot(interaction.guildId);
  let enabled = snapshot.enabled;

  if (!action || action === 'toggle') {
    enabled = !enabled;
  } else if (action === 'on') {
    enabled = true;
  } else if (action === 'off') {
    enabled = false;
  } else if (action === 'status') {
    return replyOk(interaction, `🔗 Antilink ${statusText(enabled)} dans ce serveur.`);
  }

  await setGuildAntiLinkEnabled(interaction.guildId, enabled);
  return replyOk(interaction, `🔗 Antilink ${statusText(enabled)} dans ce serveur.`);
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const action = normalizeAction(args[0]);
  const snapshot = await getGuildAntiLinkSnapshot(message.guild.id);
  let enabled = snapshot.enabled;

  if (!action || action === 'toggle') {
    enabled = !enabled;
  } else if (action === 'on') {
    enabled = true;
  } else if (action === 'off') {
    enabled = false;
  } else if (action === 'status') {
    return prefixReply(message, `🔗 Antilink ${statusText(enabled)} dans ce serveur.`);
  }

  await setGuildAntiLinkEnabled(message.guild.id, enabled);
  return prefixReply(message, `🔗 Antilink ${statusText(enabled)} dans ce serveur.`);
}

export default { data, executeSlash, executePrefix };
