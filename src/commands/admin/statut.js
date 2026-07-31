import { SlashCommandBuilder, ActivityType, MessageFlags } from 'discord.js';
import config from '../../config/config.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { replyErr, replyOk, prefixReply, replyUsage } from '../../services/moderationService.js';

const ACTIVITY_LABELS = {
  playing: 'Playing',
  watching: 'Watching',
  listening: 'Listening',
  competing: 'Competing'
};

const PRESENCE_VALUES = new Set(['online', 'idle', 'dnd', 'invisible']);

function normalizeActivityType(value) {
  if (!value) return config.status.type || 'Watching';

  const normalized = value.toString().trim().toLowerCase();
  return ACTIVITY_LABELS[normalized] || config.status.type || 'Watching';
}

function parsePrefixArgs(args) {
  const tokens = [...args];
  let activityType = config.status.type || 'Watching';
  let presence = config.status.presence || 'dnd';

  const first = tokens[0]?.toLowerCase();
  if (ACTIVITY_LABELS[first]) {
    activityType = normalizeActivityType(tokens.shift());
  } else if (PRESENCE_VALUES.has(first)) {
    presence = tokens.shift().toLowerCase();
  }

  const second = tokens[0]?.toLowerCase();
  if (ACTIVITY_LABELS[second]) {
    activityType = normalizeActivityType(tokens.shift());
  } else if (PRESENCE_VALUES.has(second)) {
    presence = tokens.shift().toLowerCase();
  }

  const text = tokens.join(' ').trim();
  return { activityType, presence, text };
}

function applyBotStatus(client, { text, activityType, presence }) {
  const cleanText = text.trim().slice(0, 128);
  config.status.text = cleanText;
  config.status.type = activityType;
  config.status.presence = presence;

  client.user.setPresence({
    activities: [{
      name: cleanText,
      type: ActivityType[activityType] ?? ActivityType.Watching
    }],
    status: presence
  });

  return {
    text: cleanText,
    activityType,
    presence
  };
}

export const data = new SlashCommandBuilder()
  .setName('statut')
  .setDescription('Changer le statut du bot')
  .addStringOption(option =>
    option
      .setName('texte')
      .setDescription('Texte du statut')
      .setRequired(true)
      .setMaxLength(128)
  )
  .addStringOption(option =>
    option
      .setName('type')
      .setDescription('Type de statut')
      .addChoices(
        { name: 'Playing', value: 'playing' },
        { name: 'Watching', value: 'watching' },
        { name: 'Listening', value: 'listening' },
        { name: 'Competing', value: 'competing' }
      )
      .setRequired(false)
  )
  .addStringOption(option =>
    option
      .setName('presence')
      .setDescription('Statut de présence')
      .addChoices(
        { name: 'Online', value: 'online' },
        { name: 'Idle', value: 'idle' },
        { name: 'DND', value: 'dnd' },
        { name: 'Invisible', value: 'invisible' }
      )
      .setRequired(false)
  );

export async function executeSlash(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const text = interaction.options.getString('texte', true);
  const activityType = normalizeActivityType(interaction.options.getString('type') || config.status.type);
  const presence = interaction.options.getString('presence') || config.status.presence || 'dnd';

  try {
    const result = applyBotStatus(interaction.client, {
      text,
      activityType,
      presence
    });

    return replyOk(
      interaction,
      `Statut du bot mis à jour : \`${result.text}\` (${result.activityType}, ${result.presence})`
    );
  } catch (error) {
    return replyErr(interaction, error?.message || 'Impossible de changer le statut du bot.');
  }
}

export async function executePrefix(message, args) {
  if (!await checkPermissions(message, message.member)) return;

  const { activityType, presence, text } = parsePrefixArgs(args);
  if (!text) {
    return replyUsage(
      message,
      `\`${config.prefix}statut [playing|watching|listening|competing] [online|idle|dnd|invisible] <texte>\``
    );
  }

  try {
    applyBotStatus(message.client, {
      text,
      activityType,
      presence
    });

    await prefixReply(message, `✅ Statut du bot mis à jour : ${text}`);
    await message.delete().catch(() => null);
  } catch (error) {
    await prefixReply(message, `❌ ${error?.message || 'Impossible de changer le statut du bot.'}`);
  }
}

export default { data, executeSlash, executePrefix };
