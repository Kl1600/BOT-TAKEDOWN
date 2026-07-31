import { ActivityType, REST, Routes } from 'discord.js';
import { initializeInviteTracking } from '../../services/inviteService.js';
import { ensureBetaAccess } from '../../services/betaService.js';
import { rehydratePanelRefreshes, startPanelRefreshScheduler } from '../../services/panelRefreshService.js';
import { initializeXpTracking, startXpMaintenance } from '../../services/xpService.js';
import { startTempBanScheduler } from '../../services/moderationService.js';
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

    await rehydratePanelRefreshes(client).catch(() => null);
    startPanelRefreshScheduler(client);
    startXpMaintenance(client);
    startTempBanScheduler(client).catch(() => null);

    client.user.setPresence({
      activities: [{
        name: config.status.text,
        type: ActivityType[config.status.type] ?? ActivityType.Watching
      }],
      status: config.status.presence
    });

    const slashCommandsData = client.slashCommandsData || [];
    if (!config.token || slashCommandsData.length === 0) return;

    const rest = new REST({ version: '10' }).setToken(config.token);

    try {
      if (config.guildId) {
        await rest.put(Routes.applicationGuildCommands(client.user.id, config.guildId), {
          body: slashCommandsData
        });
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: []
        });
      } else {
        await rest.put(Routes.applicationCommands(client.user.id), {
          body: slashCommandsData
        });

        for (const guild of client.guilds.cache.values()) {
          await rest.put(Routes.applicationGuildCommands(client.user.id, guild.id), {
            body: []
          }).catch(() => null);
        }
      }
    } catch (err) {
      logger.error('Echec enregistrement des slash commands', err);
    }
  }
};
