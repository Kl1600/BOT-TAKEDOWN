import fs from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const restartStatePath = join(__dirname, '../../logs/restart-state.json');

export async function markRestartPending(payload) {
  await fs.mkdir(join(__dirname, '../../logs'), { recursive: true }).catch(() => null);
  await fs.writeFile(restartStatePath, JSON.stringify({
    ...payload,
    createdAt: Date.now()
  }), 'utf8').catch(() => null);
}

export async function consumeRestartPending() {
  const raw = await fs.readFile(restartStatePath, 'utf8').catch(() => null);
  if (!raw) return null;

  await fs.unlink(restartStatePath).catch(() => null);

  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
