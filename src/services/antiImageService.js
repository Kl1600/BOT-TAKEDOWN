function isImageAttachment(attachment) {
  const contentType = attachment.contentType || '';
  if (contentType.startsWith('image/')) return true;

  const name = String(attachment.name || '').toLowerCase();
  return /\.(png|jpe?g|gif|webp|bmp|tiff|avif)$/i.test(name);
}

function countImageAttachments(message) {
  return message.attachments?.reduce((count, attachment) => count + (isImageAttachment(attachment) ? 1 : 0), 0) || 0;
}

export async function handleAntiImageMessage(message) {
  if (!message.guild || message.author.bot) return false;
  const imageCount = countImageAttachments(message);
  if (imageCount <= 2) return false;

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
