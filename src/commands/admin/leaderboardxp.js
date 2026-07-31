import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import { buildXpLeaderboardContainer } from '../../services/xpService.js';
import { getLanguage } from '../../utils/language.js';

export const data = new SlashCommandBuilder()
  .setName('leaderboardxp')
  .setDescription('Afficher le classement XP')
  .setDefaultMemberPermissions(null)
  .setDMPermission(false);

export async function executeSlash(interaction) {
  const lang = await getLanguage(interaction.member);
  const container = await buildXpLeaderboardContainer(interaction.guild, 10, lang);
  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

export async function executePrefix(message) {
  const lang = await getLanguage(message.member);
  const container = await buildXpLeaderboardContainer(message.guild, 10, lang);
  await sendV2Container(message.channel, container);
  await message.delete().catch(() => null);
}

export default { data, executeSlash, executePrefix };
