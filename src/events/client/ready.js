import { ActivityType, REST, Routes } from 'discord.js';
import { initializeInviteTracking } from '../../services/inviteService.js';
import { ensureBetaAccess } from '../../services/betaService.js';
import { initializeXpTracking, startXpMaintenance } from '../../services/xpService.js';
import { startTempBanScheduler } from '../../services/moderationService.js';
import { consumeRestartPending } from '../../services/restartService.js';
import dbService from '../../database/dbProxy.js';
import config from '../../config/config.js';
import * as logger from '../../utils/logger.js';

export default {
  name: 'clientReady',
  once: true,
  async execute(client) {
    console.log('\n  BOT TAKEDOWN LANCEE\n');

    try {
      await dbService.initDb();
    } catch (err) {
      logger.warn(`Base de données indisponible au démarrage: ${err?.message || err}`);
    }

    await client.guilds.fetch().catch(() => null);
    await initializeInviteTracking(client).catch(() => null);
    await initializeXpTracking(client).catch(() => null);
    for (const guild of client.guilds.cache.values()) {
      await ensureBetaAccess(guild).catch(() => null);
    }

    startXpMaintenance(client);
    startTempBanScheduler(client).catch(() => null);

    client.user.setPresence({
      activities: [{
        name: config.status.text,
        type: ActivityType[config.status.type] ?? ActivityType.Watching
      }],
      status: config.status.presence
    });

    const pendingRestart = await consumeRestartPending().catch(() => null);
    if (pendingRestart?.mode === 'slash' && pendingRestart?.token) {
      await client.rest.patch(
        Routes.webhookMessage(pendingRestart.applicationId || client.user.id, pendingRestart.token, '@original'),
        { body: { content: '✅ Bot redémarré avec succès.' } }
      ).catch(err => {
        logger.warn(`Impossible de mettre à jour la réponse de restart slash: ${err?.message || err}`);
      });
    } else if (pendingRestart?.channelId && pendingRestart?.messageId) {
      const channel = await client.channels.fetch(pendingRestart.channelId).catch(() => null);
      if (channel?.isTextBased()) {
        const message = await channel.messages.fetch(pendingRestart.messageId).catch(() => null);
        if (message) {
          await message.edit({ content: '✅ Bot redémarré avec succès.' }).catch(err => {
            logger.warn(`Impossible de mettre à jour le message de restart: ${err?.message || err}`);
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
