import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import * as logger from '../../utils/logger.js';

const PLAYER_ROLE_ID = '1509613216114671661';
const ROLE_ADD_BATCH_SIZE = 10;

async function synchronizePlayerRole(guild) {
  const role = guild.roles.cache.get(PLAYER_ROLE_ID)
    || await guild.roles.fetch(PLAYER_ROLE_ID).catch(() => null);

  if (!role) {
    throw new Error(`Le rôle Joueur (${PLAYER_ROLE_ID}) est introuvable.`);
  }

  if (!role.editable) {
    throw new Error('Le bot ne peut pas attribuer le rôle Joueur. Place son rôle au-dessus du rôle Joueur.');
  }

  const members = await guild.members.fetch();
  const targets = [...members.values()].filter(member =>
    !member.user.bot && !member.roles.cache.has(PLAYER_ROLE_ID)
  );
  const alreadySynced = members.filter(member =>
    !member.user.bot && member.roles.cache.has(PLAYER_ROLE_ID)
  ).size;

  let added = 0;
  let failed = 0;

  for (let index = 0; index < targets.length; index += ROLE_ADD_BATCH_SIZE) {
    const batch = targets.slice(index, index + ROLE_ADD_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map(member => member.roles.add(role, 'Synchronisation du rôle Joueur'))
    );

    for (const result of results) {
      if (result.status === 'fulfilled') added += 1;
      else failed += 1;
    }
  }

  return { added, failed, alreadySynced };
}

function buildResultMessage(result) {
  return [
    'Synchronisation du rôle Joueur terminée.',
    `Rôle ajouté : ${result.added}`,
    `Déjà synchronisés : ${result.alreadySynced}`,
    `Échecs : ${result.failed}`
  ].join('\n');
}

export const data = new SlashCommandBuilder()
  .setName('syncrole')
  .setDescription('Synchroniser le rôle Joueur des membres du serveur')
  .setDMPermission(false);

export async function executeSlash(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;

  await interaction.deferReply({ flags: MessageFlags.Ephemeral });
  try {
    const result = await synchronizePlayerRole(interaction.guild);
    return interaction.editReply({ content: buildResultMessage(result) });
  } catch (error) {
    logger.error('Impossible de synchroniser le rôle Joueur:', error);
    return interaction.editReply({
      content: error?.message || 'Impossible de synchroniser le rôle Joueur.'
    });
  }
}

export async function executePrefix(message) {
  if (!await checkPermissions(message, message.member)) return;

  const progressMessage = await message.channel.send({
    content: 'Synchronisation du rôle Joueur en cours...'
  });

  try {
    const result = await synchronizePlayerRole(message.guild);
    return progressMessage.edit({ content: buildResultMessage(result) });
  } catch (error) {
    logger.error('Impossible de synchroniser le rôle Joueur:', error);
    return progressMessage.edit({
      content: error?.message || 'Impossible de synchroniser le rôle Joueur.'
    });
  }
}

export default { data, executeSlash, executePrefix };
