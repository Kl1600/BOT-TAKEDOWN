import { SlashCommandBuilder, ContainerBuilder, TextDisplayBuilder, ButtonBuilder, ButtonStyle, ActionRowBuilder } from 'discord.js';
import { sendStreamerPanel } from '../../services/streamerService.js';
import { isStaffOrAdmin, replyErr, prefixReply } from '../../services/moderationService.js';
import config from '../../config/config.js';
import { sendV2Container } from '../../utils/v2Helper.js';

export const data = new SlashCommandBuilder()
  .setName('panelstreamer')
  .setDescription('Envoyer le panel de lancement de live dans ce salon (staff uniquement)');

export async function executeSlash(interaction) {
  if (!isStaffOrAdmin(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }
  await sendStreamerPanel(interaction);
}

export async function executePrefix(message) {
  if (!isStaffOrAdmin(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  await message.delete().catch(() => null);

  const text = new TextDisplayBuilder().setContent(
    `### PANEL STREAMER\n\nTu es streamer sur **Takedown** ?? Lance ton live et annonce-le à la communauté !\n\n-# Clique sur le bouton ci-dessous, entre le lien de ton stream et l'annonce sera envoyée automatiquement.`
  );

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId('streamer_go_live').setLabel('🎥 Je lance mon live !').setStyle(ButtonStyle.Danger)
  );

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(text)
    .addActionRowComponents(row);

  await sendV2Container(message.channel, container).catch(() => null);
}

export default { data, executeSlash, executePrefix };
