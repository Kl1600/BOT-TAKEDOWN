import fs from 'fs';
import { execSync } from 'child_process';

let runtimeLogger = null;

function dependenciesReady() {
  return fs.existsSync('./node_modules/discord.js/package.json')
    && fs.existsSync('./node_modules/dotenv/package.json')
    && fs.existsSync('./node_modules/discord-api-types/package.json');
}

function installDependencies() {
  console.log('[BOOT] Installation des dépendances manquantes...');
  execSync('npm install', { stdio: 'inherit' });
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function isTransientGatewayError(err) {
  const message = String(err?.message || err || '');
  return /Unexpected server response:\s*503/i.test(message)
    || /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up|Opening handshake has timed out/i.test(message);
}

async function loginWithRetry(client, token, maxAttempts = 5) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      await client.login(token);
      return;
    } catch (err) {
      const transient = isTransientGatewayError(err);
      const lastAttempt = attempt >= maxAttempts;

      if (!transient || lastAttempt) {
        throw err;
      }

      const delayMs = Math.min(30000, attempt * 5000);
      console.warn(`[BOOT] Connexion Discord temporairement indisponible (tentative ${attempt}/${maxAttempts}). Nouvelle tentative dans ${Math.round(delayMs / 1000)}s.`);
      await wait(delayMs);
    }
  }
}

async function bootstrap() {
  if (!dependenciesReady()) {
    installDependencies();
  }

  const { Client, GatewayIntentBits } = await import('discord.js');
  const { applyV2FooterPatch } = await import('./src/utils/v2Helper.js');
  const { default: config } = await import('./src/config/config.js');
  const { loadCommands } = await import('./src/handlers/commandHandler.js');
  const { loadEvents } = await import('./src/handlers/eventHandler.js');
  const logger = await import('./src/utils/logger.js');
  runtimeLogger = logger;

  if (!config.token || config.token === 'YOUR_DISCORD_BOT_TOKEN_HERE') {
    logger.error('Token manquant. Veuillez configurer le fichier .env.');
    process.exit(1);
  }

  applyV2FooterPatch();

  const client = new Client({
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMessages,
      GatewayIntentBits.MessageContent,
      GatewayIntentBits.GuildMembers,
      GatewayIntentBits.GuildVoiceStates,
      GatewayIntentBits.GuildInvites,
      GatewayIntentBits.GuildPresences
    ]
  });
  let hasLoggedIn = false;
  let gatewayRecovery = null;

  process.on('unhandledRejection', (reason) => {
    logger.error('Rejet de promesse non géré:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Exception non interceptée:', err);

    if (!hasLoggedIn || !isTransientGatewayError(err)) {
      setTimeout(() => process.exit(1), 1500);
      return;
    }

    if (gatewayRecovery) return;

    logger.warn('Connexion au gateway Discord interrompue. Tentative de reconnexion automatique.');
    gatewayRecovery = (async () => {
      try {
        await client.destroy();
        await wait(2000);
        await loginWithRetry(client, config.token);
        logger.info('Reconnexion automatique au gateway Discord réussie.');
      } catch (reconnectErr) {
        logger.error('Échec de la reconnexion automatique au gateway Discord:', reconnectErr);
        setTimeout(() => process.exit(1), 1500);
      } finally {
        gatewayRecovery = null;
      }
    })();
  });

  logger.info('Lancement du bot Course-Poursuite...');
  if (config.debug) {
    logger.debug('Mode debug activé.');
  }

  await loadCommands(client);
  await loadEvents(client);

  try {
    await loginWithRetry(client, config.token);
    hasLoggedIn = true;
  } catch (err) {
    const errorMessage = isTransientGatewayError(err)
      ? 'Échec de la connexion au gateway Discord après plusieurs tentatives.'
      : 'Échec de la connexion à Discord. Vérifiez votre token.';
    logger.error(errorMessage, err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  if (runtimeLogger) {
    runtimeLogger.error('Erreur fatale au démarrage:', err);
  } else {
    console.error('[BOOT] Erreur fatale au démarrage:', err);
  }
  process.exit(1);
});
