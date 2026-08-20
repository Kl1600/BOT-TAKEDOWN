import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { isStaffOrAdmin, prefixReply, replyErr } from '../../services/moderationService.js';
import { sendBetaAccessPanel } from '../../services/betaService.js';
import { isEnglishOnly } from '../../utils/language.js';

export const data = new SlashCommandBuilder()
  .setName('accesbeta')
  .setDescription('Envoyer le panneau d’accès à la bêta');

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  const translateDisabled = !(await isEnglishOnly(interaction.member));
  await sendBetaAccessPanel(interaction.channel, 'fr', translateDisabled);
  await interaction.deleteReply().catch(() => null);
}

export async function executePrefix(message) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  await message.delete().catch(() => null);
  const translateDisabled = !(await isEnglishOnly(message.member));
  await sendBetaAccessPanel(message.channel, 'fr', translateDisabled);
}

export default { data, executeSlash, executePrefix };
