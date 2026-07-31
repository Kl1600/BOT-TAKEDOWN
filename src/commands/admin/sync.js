import { SlashCommandBuilder, MessageFlags, REST, Routes, PermissionFlagsBits } from 'discord.js';
import { isStaffOrAdmin, replyErr, prefixReply } from '../../services/moderationService.js';
import config from '../../config/config.js';
import * as logger from '../../utils/logger.js';
import { loadCommands } from '../../handlers/commandHandler.js';

function canSync(member) {
  return Boolean(
    member?.permissions?.has(PermissionFlagsBits.Administrator) ||
    member?.permissions?.has(PermissionFlagsBits.ManageGuild) ||
    isStaffOrAdmin(member)
  );
}

async function syncGuildCommands(client, guildId) {
  await loadCommands(client);
  const slashCommandsData = client.slashCommandsData || [];
  if (!slashCommandsData.length) {
    throw new Error('Aucune commande à synchroniser.');
  }

  const rest = new REST({ version: '10' }).setToken(config.token);
  if (config.guildId) {
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: slashCommandsData
    });
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: []
    });
  } else {
    await rest.put(Routes.applicationCommands(client.user.id), {
      body: slashCommandsData
    });
    await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
      body: []
    });
  }

  return slashCommandsData.length;
}

export const data = new SlashCommandBuilder()
  .setName('sync')
  .setDescription('Synchroniser les commandes slash sur ce serveur');

export async function executeSlash(interaction) {
  if (!canSync(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });

  try {
    const count = await syncGuildCommands(interaction.client, interaction.guildId);
    return interaction.editReply({
      content: `✅ ${count} commandes synchronisées sur ce serveur.`
    });
  } catch (err) {
    logger.error('Erreur sync slash commands:', err);
    return interaction.editReply({
      content: `❌ ${err.message || 'Erreur lors de la synchronisation.'}`
    }).catch(() => null);
  }
}

export async function executePrefix(message) {
  if (!canSync(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  try {
    const count = await syncGuildCommands(message.client, message.guild.id);
    await message.reply(`✅ ${count} commandes synchronisées sur ce serveur.`).catch(() => null);
  } catch (err) {
    logger.error('Erreur sync slash commands:', err);
    await prefixReply(message, `❌ ${err.message}`);
  }
}

export default { data, executeSlash, executePrefix };
