import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';
import { Collection } from 'discord.js';
import * as logger from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Charge les fichiers de commandes et les stocke dans client.commands.
 * L'enregistrement des slash commands sur Discord est fait dans ready.js
 * pour éviter tout double déclenchement lié aux events ready/clientReady.
 */
export async function loadCommands(client) {
  client.commands = new Collection();
  client.slashCommandsData = []; // Stocke les données brutes pour l'enregistrement

  const commandsPath = join(__dirname, '../commands/admin');

  if (!fs.existsSync(commandsPath)) {
    logger.warn(`Commands folder does not exist at ${commandsPath}`);
    return;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  const loadedCommandNames = new Set();

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    try {
      const commandUrl = `${pathToFileURL(filePath).href}?? update=${Date.now()}`;
      const { default: command } = await import(commandUrl);
      if (command && command.data && command.data.name) {
        if (loadedCommandNames.has(command.data.name)) {
          logger.warn(`Command name duplicate ignored: ${command.data.name} (${file})`);
          continue;
        }
        loadedCommandNames.add(command.data.name);
        client.commands.set(command.data.name, command);
        client.slashCommandsData.push(command.data.toJSON());

        if (Array.isArray(command.aliases)) {
          for (const alias of command.aliases) {
            if (!alias || loadedCommandNames.has(alias)) continue;
            loadedCommandNames.add(alias);
            client.commands.set(alias, command);
            client.slashCommandsData.push({
              ...command.data.toJSON(),
              name: alias
            });
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to load command file ${file}`, err);
    }
  }
}

export default { loadCommands };
