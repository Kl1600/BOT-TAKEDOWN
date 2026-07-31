import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import { executeMute, hasTicketManagementAccess, replyOk, replyErr, prefixReply, replyUsage, MUTE_DURATIONS, resolveMemberFromInput } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('mute')
  .setDescription('Mettre en sourdine un membre (timeout Discord)')
  .addUserOption(o => o.setName('membre').setDescription('Membre ? mute').setRequired(true))
  .addStringOption(o => o
    .setName('duree')
    .setDescription('Dur?e du mute')
    .setRequired(true)
    .addChoices(
      { name: '1 minute',  value: '60s'  },
      { name: '5 minutes', value: '5min' },
      { name: '10 minutes',value: '10min'},
      { name: '30 minutes',value: '30min'},
      { name: '1 heure',   value: '1h'   },
      { name: '6 heures',  value: '6h'   },
      { name: '12 heures', value: '12h'  },
      { name: '24 heures', value: '24h'  },
      { name: '7 jours',   value: '7j'   },
      { name: '28 jours',  value: '28j'  }
    )
  )
  .addStringOption(o => o.setName('raison').setDescription('Raison du mute').setRequired(false).setMaxLength(500));

export async function executeSlash(interaction) {
  if (!hasTicketManagementAccess(interaction.member))
    return replyErr(interaction, 'Permissions insuffisantes.');

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const target = interaction.options.getMember('membre');
  const dureeKey = interaction.options.getString('duree');
  const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
  const seconds = MUTE_DURATIONS[dureeKey] || 600;

  if (!target) return replyUsage(interaction, '`/mute <membre> <duree> [raison]`');
  if (target.id === interaction.user.id) return replyUsage(interaction, '`/mute <membre> <duree> [raison]`');

  try {
    const until = await executeMute({ guild: interaction.guild, mod: interaction.user, target, seconds, dureeLabel: dureeKey, raison, client: interaction.client });
    return replyOk(interaction, `? \`${target.user.username}\` est en sourdine pendant **${dureeKey}**.
-# Expire : <t:${Math.floor(until.getTime()/1000)}:R>
-# Raison : ${raison}`, 0xF0A500);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

const PREFIX_DURATION_MAP = {
  '60s': 60, '1m': 60, '5m': 300, '5min': 300, '10m': 600, '10min': 600,
  '30m': 1800, '30min': 1800, '1h': 3600, '6h': 21600, '12h': 43200,
  '24h': 86400, '1j': 86400, '7j': 604800, '7d': 604800, '28j': 2419200, '28d': 2419200
};

export async function executePrefix(message, args) {
  if (!hasTicketManagementAccess(message.member)) return prefixReply(message, '? Permissions insuffisantes.');

  const mention = await resolveMemberFromInput(message.guild, args[0], message.mentions.members?.first());
  const dureeRaw = args[1]?.toLowerCase();
  const seconds = PREFIX_DURATION_MAP[dureeRaw];

  if (!mention || !seconds) {
    return replyUsage(message, `\`${message.client.prefix || '+'}mute <id|@membre> <duree> [raison]\`
Dur?es : 5m, 10m, 30m, 1h, 6h, 12h, 24h, 7j, 28j`);
  }

  const raison = args.slice(2).join(' ') || 'Aucune raison fournie';

  try {
    const until = await executeMute({ guild: message.guild, mod: message.author, target: mention, seconds, dureeLabel: dureeRaw, raison, client: message.client });
    await message.reply(`? \`${mention.user.username}\` est en sourdine pendant **${dureeRaw}**. Raison : ${raison}`);
  } catch (e) {
    await prefixReply(message, `? ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
