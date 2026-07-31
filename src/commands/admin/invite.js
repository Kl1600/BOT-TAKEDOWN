import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { prefixReply, replyErr } from '../../services/moderationService.js';
import { getLanguage } from '../../utils/language.js';
import dbService from '../../database/dbProxy.js';
import { buildInviteProfileResponse } from '../../services/inviteService.js';
import { sendV2Container } from '../../utils/v2Helper.js';

function extractUserId(input) {
  if (!input) return null;
  const cleaned = String(input).replace(/[^0-9]/g, '');
  return cleaned.length >= 17 ? cleaned : null;
}

async function resolveTarget(client, guild, rawValue, fallbackUserId) {
  const userId = extractUserId(rawValue) || fallbackUserId;
  if (!userId) {
    return null;
  }

  const member = guild ? await guild.members.fetch(userId).catch(() => null) : null;
  const user = member?.user || await client.users.fetch(userId).catch(() => null);

  if (!user) {
    return null;
  }

  return { user, member };
}

async function buildInviteProfilePayload(interactionOrMessage, targetUserId, lang = 'fr') {
  const guild = interactionOrMessage.guild;
  const referrals = await dbService.getInviteReferralsByInviter(guild.id, targetUserId).catch(() => []);
  const member = guild.members.cache.get(targetUserId) || await guild.members.fetch(targetUserId).catch(() => null);
  return buildInviteProfileResponse(guild, targetUserId, referrals, member, lang);
}

export const data = new SlashCommandBuilder()
  .setName('invite')
  .setDescription('Consulter les statistiques de parrainage d’un membre')
  .setDefaultMemberPermissions(null)
  .addUserOption(option =>
    option
      .setName('member')
      .setDescription('Membre à consulter')
      .setRequired(false)
  );

export async function executeSlash(interaction) {
  const target = await resolveTarget(
    interaction.client,
    interaction.guild,
    null,
    interaction.options.getUser('member')?.id || interaction.user.id
  );

  if (!target) {
    return replyErr(interaction, 'Membre introuvable.');
  }

  const lang = await getLanguage(interaction.member);
  const container = await buildInviteProfilePayload(interaction, target.user.id, lang);
  return interaction.reply({
    components: [container],
    flags: MessageFlags.IsComponentsV2
  });
}

export async function executePrefix(message, args) {
  const target = await resolveTarget(message.client, message.guild, args[0], message.author.id);
  if (!target) {
    return prefixReply(message, '❌ Membre introuvable.');
  }

  const lang = await getLanguage(message.member);
  const container = await buildInviteProfilePayload(message, target.user.id, lang);
  await sendV2Container(message.channel, container);
  await message.delete().catch(() => null);
}

export default { data, executeSlash, executePrefix };
