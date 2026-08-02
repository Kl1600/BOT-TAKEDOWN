import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { getLanguage } from '../../utils/language.js';
import { prefixReply } from '../../services/moderationService.js';

const BOT_OWNER_ID = '1481543558715408426';

function getInsufficientPermissionsMessage(lang) {
  return lang === 'en'
    ? 'Permissions insufficient.'
    : 'Permissions insuffisante.';
}

function getRestartMessage(lang) {
  return '✅ Bot restart';
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

  await triggerRestart();
}

export async function executePrefix(message) {
  const lang = await getLanguage(message.member);

  if (message.author.id !== BOT_OWNER_ID) {
    return prefixReply(message, getInsufficientPermissionsMessage(lang));
  }

  await message.reply(getRestartMessage(lang)).catch(() => null);
  await triggerRestart();
}

export default {
  data,
  executeSlash,
  executePrefix
};
