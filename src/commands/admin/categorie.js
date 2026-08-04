import { SlashCommandBuilder, ChannelType, MessageFlags } from 'discord.js';
import { hasTicketManagementAccess, replyErr, replyUsage, prefixReply } from '../../services/moderationService.js';
import dbService from '../../database/dbProxy.js';
import { logTicket } from '../../services/logService.js';
import config from '../../config/config.js';
import { TICKET_CATEGORY_OPTIONS, TICKET_CATEGORY_IDS } from '../../services/ticketService.js';

async function moveTicketCategory(interactionOrMessage, channel, targetCategory, actor, client, lang = 'fr') {
  const ticket = await dbService.getTicket(channel.id);
  if (!ticket) {
    return replyErr(interactionOrMessage, 'Ce salon n\'est pas un ticket.');
  }

  await channel.setParent(targetCategory.id, { lockPermissions: false }).catch(err => {
    throw new Error(`Impossible de déplacer le ticket : ${err?.message || err}`);
  });

  await dbService.addLog(
    'TICKET_CATEGORY_MOVE',
    actor.id,
    `Moved ticket ${channel.name} to category ${targetCategory.name}`,
    channel.id
  ).catch(() => null);

  await logTicket(client, {
    title: '📁 Ticket déplacé',
    color: config.colors.primary,
    fields: [
      { name: 'Ticket', value: `<#${channel.id}>`, inline: true },
      { name: 'Déplacé par', value: `<@${actor.id}> (\`${actor.username}\`)`, inline: true },
      { name: 'Nouvelle catégorie', value: `${targetCategory.name} (\`${targetCategory.id}\`)`, inline: false }
    ]
  }).catch(() => null);

  const successMessage = `Ticket déplacé vers <#${targetCategory.id}>.`;

  if (typeof interactionOrMessage.editReply === 'function' && (interactionOrMessage.deferred || interactionOrMessage.replied)) {
    await interactionOrMessage.editReply({ content: successMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
    return null;
  }

  if (typeof interactionOrMessage.reply === 'function') {
    return interactionOrMessage.reply({ content: successMessage, flags: MessageFlags.Ephemeral }).catch(() => null);
  }

  return null;
}

export const data = new SlashCommandBuilder()
  .setName('categorie')
  .setDescription('Déplacer le ticket actuel vers une catégorie')
  .addStringOption(option =>
    option
      .setName('categorie')
      .setDescription('Catégorie cible du ticket')
      .addChoices(
        ...TICKET_CATEGORY_OPTIONS.fr.map(option => ({ name: `FR - ${option.label}`, value: option.value })),
        ...TICKET_CATEGORY_OPTIONS.en.map(option => ({ name: `EN - ${option.label}`, value: option.value }))
      )
      .setRequired(true)
  );

export async function executeSlash(interaction) {
  if (!hasTicketManagementAccess(interaction.member)) {
    return replyErr(interaction, 'Permissions insuffisantes.');
  }

  const ticket = await dbService.getTicket(interaction.channel.id);
  if (!ticket) {
    return replyErr(interaction, 'Cette commande doit être utilisée dans un ticket.');
  }

  const targetCategoryId = interaction.options.getString('categorie', true);
  if (!TICKET_CATEGORY_IDS.has(targetCategoryId)) {
    return replyErr(interaction, 'Catégorie invalide.');
  }

  const targetCategory = await interaction.guild.channels.fetch(targetCategoryId).catch(() => null);
  if (!targetCategory || targetCategory.type !== ChannelType.GuildCategory) {
    return replyErr(interaction, 'Catégorie introuvable.');
  }
  await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => null);

  try {
    await moveTicketCategory(interaction, interaction.channel, targetCategory, interaction.user, interaction.client);
  } catch (error) {
    return replyErr(interaction, error.message);
  }
}

export async function executePrefix(message, args) {
  if (!hasTicketManagementAccess(message.member)) {
    return prefixReply(message, '❌ Permissions insuffisantes.');
  }

  return replyUsage(message, `\`${config.prefix}categorie <#categorie>\``);
}

export default { data, executeSlash, executePrefix };
