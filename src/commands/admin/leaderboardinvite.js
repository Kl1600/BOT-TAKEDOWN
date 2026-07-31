import { ContainerBuilder, SlashCommandBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import { getLanguage } from '../../utils/language.js';
import dbService from '../../database/dbProxy.js';

function getCopy(lang = 'fr') {
  if (lang === 'en') {
    return {
      title: 'Invite Leaderboard',
      noData: 'No referrals recorded yet.'
    };
  }

  return {
    title: 'Classement Invite',
    noData: 'Aucun parrainage enregistré pour le moment.'
  };
}

function buildInviteLeaderboardContainer(guild, leaderboardRows, lang = 'fr') {
  const copy = getCopy(lang);
  const lines = leaderboardRows.length === 0
    ? [`> ${copy.noData}`]
    : leaderboardRows.map((row, index) => {
        const member = guild.members.cache.get(row.inviter_id);
        const displayName = member?.displayName || member?.user?.username || `ID ${row.inviter_id}`;
        return `**#${index + 1}** ${displayName} — **${row.total_invites}** invitation(s)`;
      });

  return new ContainerBuilder()
    .setAccentColor(0x990000)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent([
        `### ${copy.title}`,
        lines.join('\n')
      ].join('\n'))
    );
}

export const data = new SlashCommandBuilder()
  .setName('leaderboardinvite')
  .setDescription('Afficher le classement des parrains')
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeSlash(interaction) {
  const lang = await getLanguage(interaction.member);
  const leaderboard = await dbService.getInviteLeaderboard(interaction.guild.id, 20).catch(() => []);
  const container = buildInviteLeaderboardContainer(interaction.guild, leaderboard, lang);
  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

export async function executePrefix(message) {
  const lang = await getLanguage(message.member);
  const leaderboard = await dbService.getInviteLeaderboard(message.guild.id, 20).catch(() => []);
  const container = buildInviteLeaderboardContainer(message.guild, leaderboard, lang);
  await sendV2Container(message.channel, container);
  await message.delete().catch(() => null);
}

export default { data, executeSlash, executePrefix };
