import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getLanguage } from '../../utils/language.js';
import { prefixReply, replyErr } from '../../services/moderationService.js';

async function getBotOwnerIds(client) {
  const application = client.application
    || (typeof client.application?.fetch === 'function'
      ? await client.application.fetch().catch(() => null)
      : null);
  const ownerIds = new Set();

  if (!application) {
    return ownerIds;
  }

  if (application.owner?.id) {
    ownerIds.add(application.owner.id);
  }

  if (application.team?.members) {
    for (const teamMember of application.team.members.values()) {
      if (teamMember?.id) {
        ownerIds.add(teamMember.id);
      }
    }
  }

  return ownerIds;
}

async function isBotOwner(client, userId) {
  if (!client || !userId) return false;

  const ownerIds = await getBotOwnerIds(client);
  return ownerIds.has(String(userId));
}

function getRestartMessage(lang) {
  return lang === 'en'
    ? '✅ Restarting the bot...'
    : '✅ Redémarrage du bot en cours...';
}

function getOwnerOnlyMessage(lang) {
  return lang === 'en'
    ? 'This command is reserved for the bot owner.'
    : 'Cette commande est réservée au propriétaire du bot.';
}

async function triggerRestart() {
  setTimeout(() => {
    process.exit(0);
  }, 1500);
}

export const data = new SlashCommandBuilder()
  .setName('restart')
  .setDescription('Redémarrer proprement le bot')
  .setDMPermission(false);

export async function executeSlash(interaction) {
  const lang = await getLanguage(interaction.member);

  if (!await isBotOwner(interaction.client, interaction.user.id)) {
    return replyErr(interaction, getOwnerOnlyMessage(lang));
  }

  await interaction.reply({
    content: getRestartMessage(lang),
    flags: MessageFlags.Ephemeral
  }).catch(() => null);

  await triggerRestart();
}

export async function executePrefix(message) {
  const lang = await getLanguage(message.member);

  if (!await isBotOwner(message.client, message.author.id)) {
    return prefixReply(message, `❌ ${getOwnerOnlyMessage(lang)}`);
  }

  await message.reply(getRestartMessage(lang)).catch(() => null);
  await triggerRestart();
}

export default {
  data,
  executeSlash,
  executePrefix
};
