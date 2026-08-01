import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Chargement et liaison des événements au client Discord
export async function loadEvents(client) {
  const eventsDir = join(__dirname, '../events');

  if (!fs.existsSync(eventsDir)) {
    logger.warn(`Events directory does not exist at ${eventsDir}`);
    return;
  }

  const folders = fs.readdirSync(eventsDir);

  for (const folder of folders) {
    const folderPath = join(eventsDir, folder);

    if (!fs.statSync(folderPath).isDirectory()) continue;

    const files = fs.readdirSync(folderPath).filter(file => file.endsWith('.js'));
    for (const file of files) {
      const filePath = join(folderPath, file);
      try {
        const { default: event } = await import(pathToFileURL(filePath).href);
        if (event && event.name) {
          const names = [event.name];
          const execute = async (...args) => {
            try {
              await event.execute(...args, client);
            } catch (err) {
              logger.error(`Erreur lors de l'exécution de l'événement ${event.once ? 'unique ' : ''}${event.name}:`, err);
            }
          };

          if (event.once) {
            for (const name of names) {
              client.once(name, execute);
            }
          } else {
            for (const name of names) {
              client.on(name, execute);
            }
          }

          logger.info(`Event loaded: ${event.name} (${folder}/${file})`);
        }
      } catch (err) {
        logger.error(`Failed to load event file ${file}`, err);
      }
    }
  }
}

export default {
  loadEvents
};
