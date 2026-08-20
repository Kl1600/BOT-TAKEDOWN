import { MessageFlags, SlashCommandBuilder } from 'discord.js';
import config from '../../config/config.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';

const allowedMentions = {
  parse: ['users', 'roles', 'everyone']
};

function getPrefixContent(message) {
  const commandText = message.content.slice(config.prefix.length);
  const separatorIndex = commandText.search(/\s/);
  if (separatorIndex === -1) return '';
  return commandText.slice(separatorIndex + 1);
}

export const data = new SlashCommandBuilder()
  .setName('say')
  .setDescription('Faire envoyer un message normal par le bot')
  .addStringOption(option =>
    option
      .setName('message')
      .setDescription('Message à envoyer')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(2000)
  );

export async function executeSlash(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;

  const content = interaction.options.getString('message', true);
  if (!content.trim()) {
    return interaction.reply({
      content: 'Le message ne peut pas être vide.',
      flags: MessageFlags.Ephemeral
    });
  }

  return interaction.reply({ content, allowedMentions });
}

export async function executePrefix(message) {
  if (!await checkPermissions(message, message.member)) return;

  const content = getPrefixContent(message);
  if (!content.trim()) {
    return message.channel.send({
      content: `Utilisation : \`${config.prefix}say <message>\``
    });
  }

  return message.channel.send({ content, allowedMentions });
}

export default { data, executeSlash, executePrefix };
