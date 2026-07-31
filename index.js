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
    await client.login(config.token);
  } catch (err) {
    logger.error('Échec de la connexion à Discord. Vérifiez votre token.', err);
    process.exit(1);
  }
}

bootstrap().catch((err) => {
  console.error('[BOOT] Erreur fatale au démarrage:', err);
  process.exit(1);
});
