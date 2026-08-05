import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getLanguage } from '../../utils/language.js';
import { prefixReply } from '../../services/moderationService.js';
import { markRestartPending } from '../../services/restartService.js';

const BOT_OWNER_ID = '1481543558715408426';

function getInsufficientPermissionsMessage(lang) {
  return lang === 'en'
    ? 'Permissions insufficient.'
    : 'Permissions insuffisantes.';
}

function getRestartMessage(lang) {
  return lang === 'en'
    ? ':arrows_counterclockwise: Restarting the bot...'
    : ':arrows_counterclockwise: Redémarrage en cours...';
}

async function triggerRestart() {
  const uptimeMs = Math.floor(process.uptime() * 1000);
  const restartDelayMs = uptimeMs < 60000
    ? Math.max(4000, 65000 - uptimeMs)
    : 4000;

  setTimeout(() => {
    process.exit(1);
  }, restartDelayMs);
}

export const data = new SlashCommandBuilder()
  .setName('restart')
  .setDescription('Redémarrer proprement le bot')
  .setDMPermission(false);

export async function executeSlash(interaction) {
  const lang = await getLanguage(interaction.member);

  if (interaction.user.id !== BOT_OWNER_ID) {
    return interaction.reply({
      content: getInsufficientPermissionsMessage(lang),
      flags: MessageFlags.Ephemeral
    }).catch(() => null);
  }

  await interaction.reply({
    content: getRestartMessage(lang),
    flags: MessageFlags.Ephemeral
  }).catch(() => null);

  await markRestartPending({
    mode: 'slash',
    applicationId: interaction.applicationId,
    token: interaction.token,
    guildId: interaction.guildId,
    channelId: interaction.channelId
  });

  await triggerRestart();
}

export async function executePrefix(message) {
  const lang = await getLanguage(message.member);

  if (message.author.id !== BOT_OWNER_ID) {
    return prefixReply(message, getInsufficientPermissionsMessage(lang));
  }

  const sentMessage = await message.reply(getRestartMessage(lang)).catch(() => null);
  await markRestartPending({
    mode: 'prefix',
    guildId: message.guild.id,
    channelId: message.channel.id,
    messageId: sentMessage?.id || null
  });
  await triggerRestart();
}

export default {
  data,
  executeSlash,
  executePrefix
};
