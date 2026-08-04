import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle
} from 'discord.js';
import { t, isEnglishOnly } from '../../utils/language.js';
import { checkPermissions } from '../../middlewares/permissionCheck.js';
import { appendSeparatorComponent, splitContentBySeparator, sendV2Container } from '../../utils/v2Helper.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';
import config from '../../config/config.js';

const translateHint = '-# ???? Click below to translate to English.';

registerPanelRefreshBuilder('guide', async ({ member }) => {
  const translateDisabled = !(await isEnglishOnly(member));
  const content = t('fr', 'commands.guide.content', getGuideReplacements());
  return [buildGuidePanel(content, translateDisabled)];
});

const getGuideReplacements = () => ({
  presentation: config.guide.channels.presentation,
  announcements: config.guide.channels.announcements,
  rules: config.guide.channels.rules,
  support: config.guide.channels.support,
  status: config.guide.channels.status,
  patchnotes: config.guide.channels.patchnotes
});

function buildGuideContainer(content, translateDisabled = false) {
  const sections = splitContentBySeparator(
    String(content).replace(/\n(?:[?-]{10,})\n/g, '\nseparator\n'),
    'separator'
  );

  const container = new ContainerBuilder().setAccentColor(config.colors.primary);

  sections.forEach((section, index) => {
    container.addTextDisplayComponents(new TextDisplayBuilder().setContent(section.trim()));
    if (index < sections.length - 1) {
      appendSeparatorComponent(container);
    }
  });

  return container;
}

function buildGuidePanel(content, translateDisabled = false) {
  const translateBtn = new ButtonBuilder()
    .setCustomId('msg_translate_guide')
    .setLabel('Translate')
    .setStyle(ButtonStyle.Secondary);

  const container = buildGuideContainer(content, translateDisabled);
  appendSeparatorComponent(container);
  container.addTextDisplayComponents(new TextDisplayBuilder().setContent(translateHint));
  container.addActionRowComponents(new ActionRowBuilder().addComponents(translateBtn));
  return container;
}

export default {
  data: new SlashCommandBuilder()
    .setName('guide')
    .setDescription('Afficher le guide du serveur'),

  async executeSlash(interaction, lang) {
    if (!await checkPermissions(interaction, interaction.member)) return;

    const content = t('fr', 'commands.guide.content', getGuideReplacements());
    const translateDisabled = !(await isEnglishOnly(interaction.member));

    await interaction.reply({ components: [buildGuidePanel(content, translateDisabled)], flags: MessageFlags.IsComponentsV2 });
    const replyMessage = await interaction.fetchReply().catch(() => null);
    if (replyMessage) {
      registerPanelRefresh({
        key: `guide:${replyMessage.id}`,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageIds: replyMessage.id,
        memberId: interaction.user.id,
        panelType: 'guide',
        payload: {},
      buildComponents: async member => {
          const refreshedContent = t('fr', 'commands.guide.content', getGuideReplacements());
          return [buildGuidePanel(refreshedContent, !(await isEnglishOnly(member)))];
        }
      });
    }
  },

  async executePrefix(message, args, lang) {
    if (!await checkPermissions(message, message.member)) return;

    await message.delete().catch(() => null);

    const content = t('fr', 'commands.guide.content', getGuideReplacements());
    const translateDisabled = !(await isEnglishOnly(message.member));

    const sentMessage = await sendV2Container(message.channel, buildGuidePanel(content, translateDisabled));
    registerPanelRefresh({
      key: `guide:${sentMessage?.id || message.channelId}`,
      guildId: message.guildId,
      channelId: message.channelId,
      messageIds: sentMessage?.id,
      memberId: message.author.id,
      panelType: 'guide',
      payload: {},
      buildComponents: async member => {
        const refreshedContent = t('fr', 'commands.guide.content', getGuideReplacements());
        return [buildGuidePanel(refreshedContent, !(await isEnglishOnly(member)))];
      }
    });
  }
};

