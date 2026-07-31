import {
  handleTicketOpenClick,
  handleTicketLangClick,
  handleTicketCategorySelect,
  handleTicketClose,
  handleTicketReopen,
  handleTicketTranscript,
  handleTicketDelete
} from '../services/ticketService.js';
import { handleMessageTranslate } from '../services/translationService.js';
import { handleStaffApplyOpen, handleStaffApplyStart, handleStaffApplyContinue, handleStaffApplyReject, handleStaffApplyContact, handleStaffApplySetReview, handleStaffApplyStatusView } from '../services/recruitmentService.js';
import { handleFaqButton } from '../commands/admin/faq.js';
import { handleCandidattBack, handleCandidattRefresh } from '../commands/admin/candidatt.js';
import { handleStreamerGoLive } from '../services/streamerService.js';
import { handleRolePanelButton } from '../services/rolePanelService.js';
import { handlePollOpen, handlePollVote, handlePollSetupRoleSelect, handlePollSetupChannelSelect } from '../services/pollService.js';
import { handleInviteProfileButton } from '../services/inviteService.js';
import { handleBetaAccessButton } from '../services/betaService.js';
import { handleBanListButton } from '../commands/admin/banlist.js';

export async function handleComponentInteraction(interaction) {
  if (!interaction.isButton()) return;

  const customId = interaction.customId;

  if (customId === 'staffapply_open') {
    await handleStaffApplyOpen(interaction);
    return;
  }
  if (customId === 'staffapply_start') {
    await handleStaffApplyStart(interaction);
    return;
  }
  if (customId.startsWith('staffapply_continue_')) {
    await handleStaffApplyContinue(interaction);
    return;
  }
  if (customId.startsWith('poll_open_modal_')) {
    await handlePollOpen(interaction);
    return;
  }
  if (customId.startsWith('faq_')) {
    await handleFaqButton(interaction);
    return;
  }
  if (customId === 'candidatt_refresh') {
    await handleCandidattRefresh(interaction);
    return;
  }
  if (customId === 'candidatt_back') {
    await handleCandidattBack(interaction);
    return;
  }
  if (customId.startsWith('staffapply_review_')) {
    const appId = parseInt(customId.split('_')[2], 10);
    await handleStaffApplySetReview(interaction, appId);
    return;
  }
  if (customId.startsWith('staffapply_status_view_')) {
    const appId = parseInt(customId.split('_')[3], 10);
    await handleStaffApplyStatusView(interaction, appId);
    return;
  }
  if (customId === 'streamer_go_live') {
    await handleStreamerGoLive(interaction);
    return;
  }
  if (customId.startsWith('invite_profile_')) {
    const handled = await handleInviteProfileButton(interaction);
    if (handled !== false) {
      return;
    }
  }
  if (customId.startsWith('banlist_')) {
    const handled = await handleBanListButton(interaction);
    if (handled !== false) {
      return;
    }
  }
  if (customId === 'beta_access') {
    const handled = await handleBetaAccessButton(interaction);
    if (handled !== false) {
      return;
    }
  }
  if (await handleRolePanelButton(interaction)) {
    return;
  }
  if (await handlePollVote(interaction)) {
    return;
  }

  if (customId.startsWith('ticket_category_')) {
    await handleTicketCategorySelect(interaction);
    return;
  }

  switch (customId) {
    case 'ticket_open':
      await handleTicketOpenClick(interaction);
      break;
    case 'ticket_lang_fr':
    case 'ticket_lang_en':
      await handleTicketLangClick(interaction);
      break;
    case 'ticket_close':
      await handleTicketClose(interaction);
      break;
    case 'ticket_reopen':
      await handleTicketReopen(interaction);
      break;
    case 'ticket_transcript':
      await handleTicketTranscript(interaction);
      break;
    case 'ticket_delete':
      await handleTicketDelete(interaction);
      break;
    case 'msg_translate':
    case 'msg_translate_annonce':
    case 'msg_translate_patchnote':
    case 'msg_translate_guide':
    case 'msg_translate_modes':
    case 'msg_translate_ticket':
    case 'msg_translate_reglement':
    case 'msg_translate_beta':
    case 'msg_translate_connect':
    case 'msg_translate_staffapply':
      await handleMessageTranslate(interaction);
      break;
    default:
      if (customId.startsWith('staffapply_reject_')) {
        const appId = parseInt(customId.split('_')[2], 10);
        await handleStaffApplyReject(interaction, appId);
      } else if (customId.startsWith('staffapply_contact_')) {
        const appId = parseInt(customId.split('_')[2], 10);
        await handleStaffApplyContact(interaction, appId);
      }
      break;
  }
}

export default {
  handleComponentInteraction
};
