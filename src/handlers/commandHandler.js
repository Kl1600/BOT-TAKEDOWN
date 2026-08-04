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
  client.prefixCommands = new Collection();
  client.commands = client.prefixCommands;
  client.applicationCommands = new Collection();
  client.slashCommandsData = []; // Stocke les données brutes pour l'enregistrement

  const commandsPath = join(__dirname, '../commands/admin');

  if (!fs.existsSync(commandsPath)) {
    logger.warn(`Commands folder does not exist at ${commandsPath}`);
    return;
  }

  const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js'));
  const loadedPrefixCommandNames = new Set();
  const loadedApplicationCommandKeys = new Set();

  for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    try {
      const commandUrl = `${pathToFileURL(filePath).href}?? update=${Date.now()}`;
      const { default: command } = await import(commandUrl);
      if (command && command.data && command.data.name) {
        const commandJson = command.data.toJSON();
        const commandTypeKey = commandJson.type === 2
          ? 'user'
          : commandJson.type === 3
            ? 'message'
            : 'chat';
        const applicationCommandKey = `${commandTypeKey}:${commandJson.name}`;

        if (loadedApplicationCommandKeys.has(applicationCommandKey)) {
          logger.warn(`Command name duplicate ignored: ${applicationCommandKey} (${file})`);
          continue;
        }
        loadedApplicationCommandKeys.add(applicationCommandKey);

        client.applicationCommands.set(applicationCommandKey, command);
        client.slashCommandsData.push(commandJson);

        if (typeof command.executePrefix === 'function') {
          if (loadedPrefixCommandNames.has(command.data.name)) {
            logger.warn(`Prefix command duplicate ignored: ${command.data.name} (${file})`);
            continue;
          }

          loadedPrefixCommandNames.add(command.data.name);
          client.prefixCommands.set(command.data.name, command);

          if (Array.isArray(command.aliases)) {
            for (const alias of command.aliases) {
              if (!alias || loadedPrefixCommandNames.has(alias)) continue;
              loadedPrefixCommandNames.add(alias);
              client.prefixCommands.set(alias, command);
            }
          }
        }
      }
    } catch (err) {
      logger.error(`Failed to load command file ${file}`, err);
    }
  }
}

export default { loadCommands };
