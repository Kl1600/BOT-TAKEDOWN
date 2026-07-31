import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isStaffOrAdmin, replyErr, replyOk, prefixReply, replyUsage } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';

const SERVER_PARAM_KEY = 'welcome_enabled';

function parseEnabled(value) {
  return ['on', 'true', '1', 'yes', 'enable', 'enabled'].includes(String(value).toLowerCase());
}

async function setWelcomeEnabled(enabled) {
  await dbService.setServerParam(SERVER_PARAM_KEY, enabled ? 'true' : 'false');
  return enabled;
}

async function getWelcomeEnabled() {
  const stored = await dbService.getServerParam(SERVER_PARAM_KEY);
  if (stored === null || stored === undefined) return true;
  return parseEnabled(stored);
}

export const data = new SlashCommandBuilder()
  .setName('welcome')
  .setDescription('Activer ou désactiver le système de bienvenue')
  .addSubcommand(subcommand =>
    subcommand
      .setName('on')
      .setDescription('Activer le système de bienvenue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('off')
      .setDescription('Désactiver le système de bienvenue')
  )
  .addSubcommand(subcommand =>
    subcommand
      .setName('status')
      .setDescription('Afficher l’état du système de bienvenue')
  );

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const subcommand = interaction.options.getSubcommand();

  try {
    if (subcommand === 'on') {
      await setWelcomeEnabled(true);
      return replyOk(interaction, '✅ Le système de bienvenue est activé.');
    }

    if (subcommand === 'off') {
      await setWelcomeEnabled(false);
      return replyOk(interaction, '✅ Le système de bienvenue est désactivé.');
    }

    const enabled = await getWelcomeEnabled();
    return replyOk(interaction, `ℹ️ Le système de bienvenue est actuellement ${enabled ? 'activé' : 'désactivé'}.`);
  } catch (error) {
    return replyErr(interaction, error?.message || 'Impossible de modifier le système de bienvenue.');
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  const action = String(args[0] || '').toLowerCase();
  if (!action || !['on', 'off', 'status'].includes(action)) {
    return replyUsage(message, `\`${message.client.prefix || '+'}welcome on|off|status\``);
  }

  try {
    if (action === 'on') {
      await setWelcomeEnabled(true);
      await prefixReply(message, '✅ Le système de bienvenue est activé.');
      return message.delete().catch(() => null);
    }

    if (action === 'off') {
      await setWelcomeEnabled(false);
      await prefixReply(message, '✅ Le système de bienvenue est désactivé.');
      return message.delete().catch(() => null);
    }

    const enabled = await getWelcomeEnabled();
    await prefixReply(message, `ℹ️ Le système de bienvenue est actuellement ${enabled ? 'activé' : 'désactivé'}.`);
    return message.delete().catch(() => null);
  } catch (error) {
    await prefixReply(message, `❌ ${error?.message || 'Impossible de modifier le système de bienvenue.'}`);
  }
}

export default { data, executeSlash, executePrefix };
