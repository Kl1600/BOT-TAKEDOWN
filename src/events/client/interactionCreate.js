import { getLanguage, t } from '../../utils/language.js';
import { handleComponentInteraction } from '../../handlers/componentHandler.js';
import { handleTicketCategorySelect, handleTicketModalSubmit } from '../../services/ticketService.js';
import { handleStaffApplySelectMenu, handleStaffApplyModalSubmit } from '../../services/recruitmentService.js';
import { handleStreamerLiveModalSubmit } from '../../services/streamerService.js';
import { handlePollModalSubmit, handlePollSetupRoleSelect, handlePollSetupChannelSelect } from '../../services/pollService.js';
import { handleCandidattSelect } from '../../commands/admin/candidatt.js';
import { logCommand } from '../../services/logService.js';
import { MessageFlags } from 'discord.js';
import * as logger from '../../utils/logger.js';
import { handleInviteProfileModalSubmit } from '../../services/inviteService.js';
import { handleBanListSearchModal } from '../../commands/admin/banlist.js';
import { handleEnModalSubmit } from '../../commands/admin/en.js';
import { handleBanUserModalSubmit } from '../../commands/admin/banUser.js';
import { handleKickUserModalSubmit } from '../../commands/admin/kickUser.js';
import { handleMuteUserModalSubmit } from '../../commands/admin/muteUser.js';
import { handleDmUserModalSubmit } from '../../commands/admin/dmUser.js';

export default {
  name: 'interactionCreate',
  once: false,
  async execute(interaction, client) {
    // 1. Route Slash Commands
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const lang = 'fr';
      logger.debug(`Slash Command: /${interaction.commandName} par ${interaction.user.tag} (${interaction.user.id})`);
      const optionsText = interaction.options.data
        .map(option => `${option.name}=${option.value ?? option.options?.map(sub => `${sub.name}=${sub.value}`).join(',') ?? ''}`)
        .join(' | ') || 'aucune option';

      try {
        await command.executeSlash(interaction, lang);
      } catch (err) {
        logger.error(`Erreur commande slash ${interaction.commandName}:`, err);
        const errMsg = t(lang, 'errors.command_error');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
        } else {
          await interaction.reply({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
        }
      }

      await logCommand(client, {
        title: 'Commande slash',
        description: `\`/${interaction.commandName}\` utilisée dans <#${interaction.channelId}>`,
        fields: [
          { name: 'Utilisateur', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
          { name: 'Salon', value: `<#${interaction.channelId}>`, inline: true },
          { name: 'Options', value: optionsText.slice(0, 1024), inline: false }
        ]
      }).catch(() => null);
      return;
    }

    // 1b. Route Message Context Menu Commands
    if (interaction.isMessageContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const lang = 'fr';
      logger.debug(`Context menu message: ${interaction.commandName} par ${interaction.user.tag} (${interaction.user.id})`);

      try {
        if (typeof command.executeContextMenu === 'function') {
          await command.executeContextMenu(interaction, lang);
        } else if (typeof command.executeSlash === 'function') {
          await command.executeSlash(interaction, lang);
        }
      } catch (err) {
        logger.error(`Erreur menu message ${interaction.commandName}:`, err);
        const errMsg = t(lang, 'errors.command_error');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
        } else {
          await interaction.reply({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
        }
      }

      await logCommand(client, {
        title: 'Commande contextuelle message',
        description: `\`${interaction.commandName}\` utilisée dans <#${interaction.channelId}>`,
        fields: [
          { name: 'Utilisateur', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
          { name: 'Salon', value: `<#${interaction.channelId}>`, inline: true },
          { name: 'Message cible', value: interaction.targetMessage?.id ? `\`${interaction.targetMessage.id}\`` : 'inconnu', inline: false }
        ]
      }).catch(() => null);
      return;
    }

    // 1c. Route User Context Menu Commands
    if (interaction.isUserContextMenuCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;

      const lang = 'fr';
      logger.debug(`Context menu user: ${interaction.commandName} par ${interaction.user.tag} (${interaction.user.id})`);

      try {
        if (typeof command.executeUserContextMenu === 'function') {
          await command.executeUserContextMenu(interaction, lang);
        }
      } catch (err) {
        logger.error(`Erreur menu utilisateur ${interaction.commandName}:`, err);
        const errMsg = t(lang, 'errors.command_error');
        if (interaction.replied || interaction.deferred) {
          await interaction.followUp({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
        } else {
          await interaction.reply({ content: errMsg, flags: MessageFlags.Ephemeral }).catch(() => null);
        }
      }

      await logCommand(client, {
        title: 'Commande contextuelle utilisateur',
        description: `\`${interaction.commandName}\` utilisée sur <@${interaction.targetUser?.id || 'inconnu'}>`,
        fields: [
          { name: 'Utilisateur', value: `<@${interaction.user.id}> (\`${interaction.user.tag}\`)`, inline: true },
          {
            name: 'Cible',
            value: interaction.targetUser
              ? `<@${interaction.targetUser.id}> (\`${interaction.targetUser.username}\`)`
              : 'inconnue',
            inline: true
          },
          { name: 'Salon', value: `<#${interaction.channelId}>`, inline: true }
        ]
      }).catch(() => null);
      return;
    }

    // 2. Route Button Components
    if (interaction.isButton()) {
      logger.debug(`Bouton cliqué: ${interaction.customId} par ${interaction.user.tag} (${interaction.user.id})`);
      try {
        await handleComponentInteraction(interaction);
      } catch (err) {
        logger.error(`Erreur bouton ${interaction.customId}:`, err);
      }
      return;
    }

    // 3. Route Select Menus
    if (interaction.isAnySelectMenu()) {
      logger.debug(`Select menu: ${interaction.customId} par ${interaction.user.tag}`);
      try {
        if (interaction.customId.startsWith('staffapply_select_')) {
          await handleStaffApplySelectMenu(interaction);
        } else if (interaction.customId.startsWith('ticket_category_')) {
          await handleTicketCategorySelect(interaction);
        } else if (interaction.customId.startsWith('poll_role_select_')) {
          await handlePollSetupRoleSelect(interaction);
        } else if (interaction.customId.startsWith('poll_channel_select_')) {
          await handlePollSetupChannelSelect(interaction);
        } else if (interaction.customId === 'candidatt_select') {
          await handleCandidattSelect(interaction);
        }
      } catch (err) {
        logger.error(`Erreur select menu ${interaction.customId}:`, err);
      }
      return;
    }

    // 3. Route Modal Submissions
    if (interaction.isModalSubmit()) {
      logger.debug(`Modal soumis: ${interaction.customId} par ${interaction.user.tag} (${interaction.user.id})`);

      if (interaction.customId.startsWith('ticket_modal_')) {
        try {
          await handleTicketModalSubmit(interaction);
        } catch (err) {
          logger.error(`Erreur modal ${interaction.customId}:`, err);
        }
      } else if (interaction.customId.startsWith('annonce_modal')) {
        try {
          const { handleAnnonceModalSubmit } = await import('../../commands/admin/annonce.js');
          const lang = await getLanguage(interaction.member);
          await handleAnnonceModalSubmit(interaction, lang);
        } catch (err) {
          logger.error('Erreur modal annonce:', err);
        }
      } else if (interaction.customId.startsWith('patchnote_modal')) {
        try {
          const { handlePatchNoteModalSubmit } = await import('../../commands/admin/patchnote.js');
          const lang = await getLanguage(interaction.member);
          await handlePatchNoteModalSubmit(interaction, lang);
        } catch (err) {
          logger.error('Erreur modal patchnote:', err);
        }
      } else if (interaction.customId.startsWith('staffapply_modal_')) {
        try {
          await handleStaffApplyModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal staffapply:', err);
        }
      } else if (interaction.customId.startsWith('invite_profile_modal_submit_')) {
        try {
          await handleInviteProfileModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal invite profile:', err);
        }
      } else if (interaction.customId.startsWith('banlist_search_modal_')) {
        try {
          await handleBanListSearchModal(interaction);
        } catch (err) {
          logger.error('Erreur modal banlist:', err);
        }
      } else if (interaction.customId === 'streamer_live_modal') {
        try {
          await handleStreamerLiveModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal streamer live:', err);
        }
      } else if (interaction.customId.startsWith('translate_en_modal:')) {
        try {
          await handleEnModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal traduction en:', err);
        }
      } else if (interaction.customId.startsWith('userctx_ban_reason_')) {
        try {
          await handleBanUserModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal ban user:', err);
        }
      } else if (interaction.customId.startsWith('userctx_kick_reason_')) {
        try {
          await handleKickUserModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal kick user:', err);
        }
      } else if (interaction.customId.startsWith('userctx_mute_reason_')) {
        try {
          await handleMuteUserModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal mute user:', err);
        }
      } else if (interaction.customId.startsWith('userctx_dm_message_')) {
        try {
          await handleDmUserModalSubmit(interaction);
        } catch (err) {
          logger.error('Erreur modal dm user:', err);
        }
      } else if (interaction.customId.startsWith('poll_modal_create_')) {
        try {
          const lang = await getLanguage(interaction.member);
          await handlePollModalSubmit(interaction, lang);
        } catch (err) {
          logger.error('Erreur modal sondage:', err);
        }
      }
    }
  }
};
