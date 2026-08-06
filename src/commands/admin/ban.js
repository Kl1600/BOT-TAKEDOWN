import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { executeBan, isStaffOrAdmin, replyOk, replyErr, prefixReply, replyUsage, resolveMemberFromInput, parseDurationInput, registerTempBan, extractDiscordId } from '../../services/moderationService.js';

export const data = new SlashCommandBuilder()
  .setName('ban')
  .setDescription('Bannir un membre du serveur')
  .addStringOption(o => o.setName('membre').setDescription('ID ou mention du membre à bannir').setRequired(true))
  .addStringOption(o => o.setName('duree').setDescription('Durée optionnelle du ban (ex: 7j, 24h)').setRequired(false).setMaxLength(20))
  .addStringOption(o => o.setName('raison').setDescription('Raison du ban').setRequired(false).setMaxLength(500))
  .addIntegerOption(o => o.setName('messages').setDescription('Supprimer les messages des X derniers jours (0-7)').setMinValue(0).setMaxValue(7).setRequired(false));

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  const memberInput = interaction.options.getString('membre', true);
  const target = await resolveMemberFromInput(interaction.guild, memberInput);
  const userId = extractDiscordId(memberInput);
  const durationRaw = interaction.options.getString('duree');
  const raison = interaction.options.getString('raison') || 'Aucune raison fournie';
  const days = interaction.options.getInteger('messages') ?? 0;
  const durationMs = durationRaw ? parseDurationInput(durationRaw) : null;
  const usage = `\`/ban <membre> [duree] [raison] [messages]\`
Exemples : \`/ban @user 7j Spam\` ou \`/ban @user Spam\``;

  if (!target && !userId) return replyUsage(interaction, usage);
  if (target?.id === interaction.user.id || userId === interaction.user.id) return replyUsage(interaction, usage);
  if (durationRaw && !durationMs) {
    return replyUsage(interaction, `\`/ban <membre> [duree] [raison] [messages]\`\nDurée valide : \`10m\`, \`1h\`, \`7j\`, \`28j\``);
  }

  try {
    await executeBan({
      guild: interaction.guild,
      mod: interaction.user,
      target,
      userId,
      raison,
      days,
      client: interaction.client,
      sendDm: Boolean(target)
    });

    const displayName = target?.user?.username || userId;
    if (durationMs) {
      const unbanAt = Math.floor((Date.now() + durationMs) / 1000);
      await registerTempBan(interaction.client, {
        guildId: interaction.guild.id,
        userId: target?.id || userId,
        moderatorId: interaction.user.id,
        reason: raison,
        unbanAt
      });
      const reasonLine = raison ? `\n-# Raison : ${raison}` : '';
      return replyOk(interaction, `✅ \`${displayName}\` a été banni pour ${raison || 'aucune raison fournie'} pendant <t:${unbanAt}:R>.${reasonLine}`, 0xED4245);
    }

    return replyOk(interaction, `✅ \`${displayName}\` a été banni pour ${raison || 'aucune raison fournie'}.`, 0xED4245);
  } catch (e) {
    return replyErr(interaction, e.message);
  }
}

export async function executePrefix(message, args) {
  if (!isStaffOrAdmin(message.member)) return prefixReply(message, '❌ Permissions insuffisantes.');

  const mention = await resolveMemberFromInput(message.guild, args[0], message.mentions.members?.first());
  const userId = extractDiscordId(args[0]);
  const usage = `\`${message.client.prefix || '+'}ban <id|@membre> [duree] [raison]\`
Exemples : \`${message.client.prefix || '+'}ban 123456789012345678 7j Spam\` ou \`${message.client.prefix || '+'}ban 123456789012345678 Spam\``;
  if (!mention && !userId) return replyUsage(message, usage);

  let durationMs = null;
  let reasonStartIndex = 1;
  if (args[1]) {
    const parsedDuration = parseDurationInput(args[1]);
    if (parsedDuration) {
      durationMs = parsedDuration;
      reasonStartIndex = 2;
    }
  }

  const raison = args.slice(reasonStartIndex).join(' ') || 'Aucune raison fournie';

  try {
    await executeBan({
      guild: message.guild,
      mod: message.author,
      target: mention,
      userId,
      raison,
      days: 0,
      client: message.client,
      sendDm: Boolean(mention)
    });

    const displayName = mention?.user?.username || userId;
    if (durationMs) {
      const unbanAt = Math.floor((Date.now() + durationMs) / 1000);
      await registerTempBan(message.client, {
        guildId: message.guild.id,
        userId: mention?.id || userId,
        moderatorId: message.author.id,
        reason: raison,
        unbanAt
      });
      const reasonLine = raison ? `\n-# Raison : ${raison}` : '';
      return message.channel.send(`✅ \`${displayName}\` a été banni pour ${raison || 'aucune raison fournie'} pendant <t:${unbanAt}:R>.${reasonLine}`);
    }

    return message.channel.send(`✅ \`${displayName}\` a été banni pour ${raison || 'aucune raison fournie'}.`);
  } catch (e) {
    await prefixReply(message, `❌ ${e.message}`);
  }
}

export default { data, executeSlash, executePrefix };
