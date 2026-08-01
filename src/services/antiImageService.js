function isImageAttachment(attachment) {
  const contentType = attachment.contentType || '';
  if (contentType.startsWith('image/')) return true;

  if (typeof attachment.width === 'number' || typeof attachment.height === 'number') return true;

  const name = String(attachment.name || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|tiff|avif)$/i.test(name);
}

function countImageAttachments(message) {
  let count = 0;
  for (const attachment of message.attachments?.values?.() || []) {
    if (isImageAttachment(attachment)) {
      count += 1;
    }
  }
  return count;
}

function hasMoreThanTwoImages(message) {
  const imageCount = countImageAttachments(message);
  if (imageCount > 2) return true;

  const attachmentCount = message.attachments?.size ?? 0;
  const hasImageLikeAttachment = imageCount > 0;
  return hasImageLikeAttachment && attachmentCount > 2;
}

export async function handleAntiImageMessage(message) {
  if (!message.guild || message.author.bot) return false;
  if (!hasMoreThanTwoImages(message)) return false;

  await message.delete().catch(() => null);
  await message.channel.send({
    content: `-# Le serveur bloque l'envoi de plus de 2 photo dans un même message. <@${message.author.id}>`
  }).then(sent => {
    setTimeout(() => sent.delete().catch(() => null), 5000);
  }).catch(() => null);

  return true;
}

export default {
  handleAntiImageMessage
};
