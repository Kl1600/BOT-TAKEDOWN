import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ContainerBuilder,
  MessageFlags,
  SlashCommandBuilder,
  TextDisplayBuilder
} from 'discord.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { t } from '../../utils/language.js';
import { appendSeparatorComponent, sendV2Container, splitContentBySeparator } from '../../utils/v2Helper.js';
import config from '../../config/config.js';

const translateHint = '-# 🇬🇧 Click below to translate to English.';

function buildCrewPanel(content) {
  const sections = splitContentBySeparator(content);
  const container = new ContainerBuilder().setAccentColor(config.colors.primary);

  sections.forEach((section, index) => {
    container.addTextDisplayComponents(
      new TextDisplayBuilder().setContent(section.trim())
    );
    if (index < sections.length - 1) {
      appendSeparatorComponent(container);
    }
  });

  appendSeparatorComponent(container);
  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(translateHint)
  );
  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('msg_translate_crew')
        .setLabel('🇬🇧 Translate')
        .setStyle(ButtonStyle.Secondary)
    )
  );

  return container;
}

export default {
  data: new SlashCommandBuilder()
    .setName('crew')
    .setDescription('Afficher les informations de création d’un Crew'),

  async executeSlash(interaction) {
    if (!await checkPermissions(interaction, interaction.member)) return;

    const content = t('fr', 'commands.crew.content');
    await interaction.reply({
      components: [buildCrewPanel(content)],
      flags: MessageFlags.IsComponentsV2
    });
  },

  async executePrefix(message) {
    if (!await checkPermissions(message, message.member)) return;

    await message.delete().catch(() => null);
    const content = t('fr', 'commands.crew.content');
    await sendV2Container(message.channel, buildCrewPanel(content));
  }
};
