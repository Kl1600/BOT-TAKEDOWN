import fs from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import config from '../config/config.js';
import { ContainerBuilder, TextDisplayBuilder, MessageFlags } from 'discord.js';
import { appendSeparatorComponent } from './v2Helper.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const logDir = join(__dirname, '../../logs');
const logFile = join(logDir, 'bot.log');

function ensureLogDirectory() {
  try {
    fs.mkdirSync(logDir, { recursive: true });
  } catch {
    return false;
  }

  return true;
}

function writeToFile(level, message) {
  const timestamp = new Date().toISOString();
  try {
    ensureLogDirectory();
    fs.appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
  } catch (err) {
    if (err?.code === 'ENOENT' && ensureLogDirectory()) {
      try {
        fs.appendFileSync(logFile, `[${timestamp}] [${level.toUpperCase()}] ${message}\n`);
        return;
      } catch (retryErr) {
        console.error('Failed to write log to file:', retryErr.message);
        return;
      }
    }

    console.error('Failed to write log to file:', err.message);
  }
}

export function info(message) {
  const formatted = `[INFO] ${message}`;
  console.log(formatted);
  writeToFile('info', message);
}

export function warn(message) {
  const formatted = `[WARN] ${message}`;
  console.warn(formatted);
  writeToFile('warn', message);
}

export function debug(message) {
  if (!config.debug) return;
  const formatted = `[DEBUG] ${message}`;
  console.log(formatted);
  writeToFile('debug', message);
}

export function error(message, err = null) {
  const normalizedError =
    err instanceof Error
      ? { message: err.message, stack: err.stack }
      : err && typeof err === 'object'
        ? {
            message: typeof err.message === 'string' ? err.message : JSON.stringify(err),
            stack: typeof err.stack === 'string' ? err.stack : null
          }
        : err != null
          ? { message: String(err), stack: null }
          : null;

  const errMsg = normalizedError
    ? `${message} | Error: ${normalizedError.message}${normalizedError.stack ? `\nStack: ${normalizedError.stack}` : ''}`
    : message;
  const formatted = `[ERROR] ${errMsg}`;
  console.error(formatted);
  writeToFile('error', errMsg);
}

// Log un événement dans le salon Discord configuré sous forme de Container V2
export async function discordLog(client, { title, description, fields = [], color = config.colors.primary }) {
  try {
    const channelId = config.channels.logs;
    if (!channelId) {
      warn('Salon de log Discord non configuré.');
      return;
    }

    const channel = await client.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      warn(`Le salon de log Discord ${channelId} est introuvable ou invalide.`);
      return;
    }

    // Reconstruction du texte pour le container V2
    let logText = `### **${title.toUpperCase()}**\n`;
    if (description) {
      logText += `${description}\n`;
    }
    const container = new ContainerBuilder()
      .setAccentColor(color)
      .addTextDisplayComponents(new TextDisplayBuilder().setContent(logText.trim()));

    if (fields.length > 0) {
      appendSeparatorComponent(container);
      for (const field of fields) {
        container.addTextDisplayComponents(
          new TextDisplayBuilder().setContent(`**${field.name}** : ${field.value}`)
        );
      }
    }

    await channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 });
  } catch (err) {
    error('Impossible d\'envoyer le log sur Discord', err);
  }
}

export default {
  info,
  warn,
  debug,
  error,
  discordLog
};
