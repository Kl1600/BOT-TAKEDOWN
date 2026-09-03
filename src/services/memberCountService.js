import config from '../config/config.js';
import * as logger from '../utils/logger.js';

let updateQueue = Promise.resolve(false);
let missingChannelWarningSent = false;

async function performMemberCountUpdate(client) {
  const channelId = config.channels.memberCount;
  if (!client || !channelId) return false;

  const channel = client.channels.cache.get(channelId)
    || await client.channels.fetch(channelId).catch(() => null);

  if (!channel?.isVoiceBased() || !channel.guild) {
    if (!missingChannelWarningSent) {
      missingChannelWarningSent = true;
      logger.warn(`Salon vocal du compteur de membres ${channelId} introuvable.`);
    }
    return false;
  }

  missingChannelWarningSent = false;
  const nextName = `Members : ${channel.guild.memberCount}`;
  if (channel.name === nextName) return true;

  await channel.setName(nextName, 'Actualisation du nombre de membres');
  return true;
}

export function updateMemberCountChannel(client) {
  const nextUpdate = updateQueue
    .catch(() => false)
    .then(() => performMemberCountUpdate(client));

  updateQueue = nextUpdate;
  return nextUpdate;
}

export default {
  updateMemberCountChannel
};
