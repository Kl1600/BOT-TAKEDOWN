import fs from 'fs';
import { execSync } from 'child_process';

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
    || /ECONNRESET|ETIMEDOUT|EAI_AGAIN|socket hang up/i.test(message);
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

  process.on('unhandledRejection', (reason) => {
    logger.error('Rejet de promesse non géré:', reason);
  });

  process.on('uncaughtException', (err) => {
    logger.error('Exception non interceptée:', err);
  });

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

  logger.info('Lancement du bot Course-Poursuite...');
  if (config.debug) {
    logger.debug('Mode debug activé.');
  }

  await loadCommands(client);
  await loadEvents(client);

  try {
    await loginWithRetry(client, config.token);
  } catch (err) {
    const errorMessage = isTransientGatewayError(err)
      ? 'Échec de la connexion au gateway Discord après plusieurs tentatives.'
      : 'Échec de la connexion à Discord. Vérifiez votre token.';
    logger.error(errorMessage, err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('[BOOT] Erreur fatale au démarrage:', err);
  process.exit(1);
});
