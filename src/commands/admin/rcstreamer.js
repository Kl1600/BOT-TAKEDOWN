import { SlashCommandBuilder } from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';

const STREAMER_FORM = `Bonjour je te laisses remplir ce court formulaire, merci.

**Pseudo / Âge :**
→
**Plateforme + lien de ta chaîne :**
→
**À quelle fréquence stream-tu ?**
→
**Pourquoi souhaites-tu devenir Streamer Takedown ?**
→`;

export const data = new SlashCommandBuilder()
  .setName('rcstreamer')
  .setDescription('Envoyer le formulaire de candidature Streamer Takedown')
  .setDMPermission(false);

export async function executeSlash(interaction) {
  if (!await checkPermissions(interaction, interaction.member)) return;
  return interaction.reply({ content: STREAMER_FORM });
}

export async function executePrefix(message) {
  if (!await checkPermissions(message, message.member)) return;
  return message.channel.send({ content: STREAMER_FORM });
}

export default { data, executeSlash, executePrefix };
