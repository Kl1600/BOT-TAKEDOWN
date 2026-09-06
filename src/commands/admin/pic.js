import { SlashCommandBuilder, MessageFlags } from 'discord.js';

function getServerBannerUrl(guild) {
  return guild?.bannerURL({ extension: 'png', size: 4096 }) || null;
}

export const data = new SlashCommandBuilder()
  .setName('pic')
  .setDescription('Afficher la bannière du serveur Discord')
  .setDMPermission(false);

export async function executeSlash(interaction) {
  const bannerUrl = getServerBannerUrl(interaction.guild);

  if (!bannerUrl) {
    return interaction.reply({
      content: 'Ce serveur ne possède pas de bannière Discord.',
      flags: MessageFlags.Ephemeral
    });
  }

  return interaction.reply({ content: bannerUrl });
}

export async function executePrefix(message) {
  const bannerUrl = getServerBannerUrl(message.guild);

  if (!bannerUrl) {
    return message.channel.send({ content: 'Ce serveur ne possède pas de bannière Discord.' });
  }

  return message.channel.send({ content: bannerUrl });
}

export default { data, executeSlash, executePrefix };
