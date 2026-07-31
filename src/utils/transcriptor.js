import { AttachmentBuilder } from 'discord.js';

/**
 * Fetch all messages from a channel, sorted from oldest to newest
 * 
 * @param {any} channel Discord text channel
 * @returns {Promise<any[]>} Array of messages
 */
async function fetchAllMessages(channel) {
  const messages = [];
  let lastId = null;

  while (true) {
    const options = { limit: 100 };
    if (lastId) {
      options.before = lastId;
    }

    const fetched = await channel.messages.fetch(options).catch(() => null);
    if (!fetched || fetched.size === 0) break;

    messages.push(...fetched.values());
    lastId = fetched.lastKey();

    if (fetched.size < 100) break;
  }

  return messages.reverse();
}

/**
 * Generate transcript for a ticket and return it as a Discord attachment builder
 * 
 * @param {any} channel Discord text channel
 * @param {string} format 'html' or 'txt'
 * @returns {Promise<AttachmentBuilder>} Attachment containing the transcript
 */
export async function generateTranscript(channel, format = 'html') {
  const messages = await fetchAllMessages(channel);
  const channelName = channel.name;

  if (format === 'txt') {
    let txt = `TRANSCRIPT - TICKET #${channelName.toUpperCase()}\n`;
    txt += `Generated at: ${new Date().toLocaleString()}\n`;
    txt += `========================================================================\n\n`;

    for (const msg of messages) {
      const time = msg.createdAt.toLocaleString();
      const author = `${msg.author.tag} (${msg.author.id})`;
      const content = msg.content || (msg.attachments.size > 0 ? '[Fichier joint]' : '[Pas de texte]');
      txt += `[${time}] ${author}:\n${content}\n\n`;
    }

    return new AttachmentBuilder(Buffer.from(txt, 'utf-8'), { name: `transcript-${channelName}.txt` });
  }

  // HTML format
  let html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>Transcription - ${channelName}</title>
  <style>
    body {
      background-color: #121212;
      color: #e0e0e0;
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      margin: 0;
      padding: 30px;
    }
    .header {
      background-color: #990000;
      color: #ffffff;
      padding: 20px;
      border-radius: 6px;
      margin-bottom: 25px;
      border-bottom: 4px solid #000000;
    }
    .header h1 {
      margin: 0;
      font-size: 22px;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .header p {
      margin: 6px 0 0 0;
      font-size: 13px;
      color: #d1d1d1;
    }
    .message-container {
      display: flex;
      flex-direction: column;
      gap: 15px;
    }
    .message {
      background-color: #1a1a1a;
      border-left: 4px solid #990000;
      padding: 15px;
      border-radius: 0 6px 6px 0;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    .msg-header {
      display: flex;
      justify-content: space-between;
      margin-bottom: 8px;
      font-size: 12px;
      color: #888888;
      border-bottom: 1px solid #2a2a2a;
      padding-bottom: 4px;
    }
    .author {
      font-weight: bold;
      color: #ffffff;
    }
    .content {
      font-size: 14px;
      line-height: 1.6;
      white-space: pre-wrap;
      word-break: break-word;
    }
    .attachment {
      margin-top: 12px;
      padding: 10px;
      background-color: #0b0b0b;
      border-radius: 4px;
      font-size: 13px;
      display: inline-block;
    }
    .attachment a {
      color: #ff3333;
      text-decoration: none;
      font-weight: 500;
    }
    .attachment a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Transcription de ticket: ${channelName}</h1>
    <p>Généré le ${new Date().toLocaleString()}</p>
  </div>
  <div class="message-container">
  `;

  for (const msg of messages) {
    const time = msg.createdAt.toLocaleString();
    const author = `${msg.author.tag}`;
    const escapedContent = (msg.content || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html += `
    <div class="message">
      <div class="msg-header">
        <span class="author">${author}</span>
        <span>${time}</span>
      </div>
      <div class="content">${escapedContent}</div>`;

    if (msg.attachments.size > 0) {
      for (const attachment of msg.attachments.values()) {
        html += `
        <div class="attachment">
          Fichier: <a href="${attachment.url}" target="_blank">${attachment.name}</a> (${(attachment.size / 1024).toFixed(1)} KB)
        </div>`;
      }
    }

    html += `</div>`;
  }

  html += `
  </div>
</body>
</html>`;

  return new AttachmentBuilder(Buffer.from(html, 'utf-8'), { name: `transcript-${channelName}.html` });
}

export default {
  generateTranscript
};
