import { REST, Routes } from 'discord.js';
import { initializeInviteTracking } from '../../services/inviteService.js';
import { ensureBetaAccess } from '../../services/betaService.js';
import { initializeXpTracking, startXpMaintenance } from '../../services/xpService.js';
import { startTempBanScheduler } from '../../services/moderationService.js';
import { initializeVoiceState } from '../../services/voiceService.js';
import { consumeRestartPending } from '../../services/restartService.js';
import { startStatusMaintenance } from '../../services/statusService.js';
import { initializeGuildTagTracking } from '../../services/guildTagService.js';
import dbService from '../../database/dbProxy.js';
import config from '../../config/config.js';
import * as logger from '../../utils/logger.js';

const RESTART_SUCCESS_MESSAGE = '✅ Bot redémarré avec succès.';

function isUnknownWebhookError(error) {
  return Number(error?.code ?? error?.rawError?.code) === 10015;
}

async function sendRestartSuccessInChannel(client, channelId) {
  if (!channelId) return false;

  const channel = client.channels.cache.get(channelId)
    || await client.channels.fetch(channelId).catch(() => null);
  if (!channel?.isTextBased()) return false;

  return channel.send({
    content: RESTART_SUCCESS_MESSAGE,
    allowedMentions: { parse: [] }
  }).then(() => true).catch(() => false);
}

export default {
  name: 'clientReady',
  once: true,
  async execute(client) {
    logger.setDiscordClient(client);
    console.log('\n  BOT TAKEDOWN LANCEE\n');
    startStatusMaintenance(client);

    try {
      await dbService.initDb();
    } catch (err) {
      logger.error('Base de données indisponible au démarrage:', err);
    }

    await client.guilds.fetch().catch(err => {
      logger.error('Impossible de récupérer les serveurs au démarrage:', err);
      return null;
    });
    await initializeGuildTagTracking(client).catch(err => {
      logger.error('Impossible d’initialiser le suivi des tags serveur:', err);
    });
    await initializeInviteTracking(client).catch(err => {
      logger.error('Impossible d’initialiser le suivi des invitations:', err);
    });
    await initializeXpTracking(client).catch(err => {
      logger.error('Impossible d’initialiser le suivi XP:', err);
    });
    await initializeVoiceState(client).catch(err => {
      logger.error('Impossible de restaurer les salons vocaux temporaires:', err);
    });
    for (const guild of client.guilds.cache.values()) {
      await ensureBetaAccess(guild).catch(err => {
        logger.error(`Impossible de vérifier l’accès bêta sur le serveur ${guild.id}:`, err);
      });
    }

    startXpMaintenance(client);
    startTempBanScheduler(client).catch(err => {
      logger.error('Impossible de démarrer le planificateur des bannissements temporaires:', err);
    });

    const pendingRestart = await consumeRestartPending().catch(() => null);
    if (pendingRestart?.mode === 'slash' && pendingRestart?.token) {
      await client.rest.patch(
        Routes.webhookMessage(pendingRestart.applicationId || client.user.id, pendingRestart.token, '@original'),
        { body: { content: RESTART_SUCCESS_MESSAGE } }
      ).catch(err => {
        if (isUnknownWebhookError(err)) {
          void sendRestartSuccessInChannel(client, pendingRestart.channelId);
          return;
        }
        logger.error('Impossible de mettre à jour la réponse de restart slash:', err);
      });
    } else if (pendingRestart?.channelId && pendingRestart?.messageId) {
      const channel = await client.channels.fetch(pendingRestart.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(pendingRestart.messageId).catch(() => null);
        if (message) {
          await message.edit({ content: RESTART_SUCCESS_MESSAGE }).catch(err => {
            logger.error('Impossible de mettre à jour le message de restart:', err);
          });
        }
      }
    }

    const slashCommandsData = client.slashCommandsData || [];
    if (!config.token || slashCommandsData.length === 0) return;

    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
      const targetGuildIds = [...new Set([
        ...client.guilds.cache.keys(),
        config.guildId
      ].filter(Boolean))];

      for (const guildId of targetGuildIds) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, guildId), {
          body: slashCommandsData
        });
      }

      await rest.put(Routes.applicationCommands(client.user.id), {
        body: []
      });
    } catch (err) {
      logger.error('Echec enregistrement des slash commands', err);
    }
  }
};
