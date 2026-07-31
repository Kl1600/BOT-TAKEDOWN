import {
  SlashCommandBuilder,
  ContainerBuilder,
  TextDisplayBuilder,
  ButtonBuilder,
  ButtonStyle,
  ActionRowBuilder,
  MessageFlags
} from 'discord.js';
import { getLanguage, isEnglishOnly } from '../../utils/language.js';
import { sendV2Container, appendSeparatorComponent } from '../../utils/v2Helper.js';
import { registerPanelRefresh, registerPanelRefreshBuilder } from '../../services/panelRefreshService.js';
import config from '../../config/config.js';

const CONNECT_LINK = 'https://cfx.re/join/qqqqqzv';
const CONNECT_CHANNEL_ID = '1527375640817307758';
const translateHint = '-# 🇬🇧 Click below to translate to English.';

function buildConnectText(lang) {
  const isEnglish = lang === 'en';
  const title = isEnglish ? 'Connect :' : 'Se connecter :';
  const status = isEnglish ? 'Server status' : 'Statut Serveur';
  const optionsTitle = isEnglish ? '**Options:**' : '**Options :**';

  const firstStep = isEnglish
    ? '1. Join via the FiveM list by searching for Takedown in the server list'
    : '1. Se connecter via la liste fivem en recherchant Takedown dans la liste';
  const secondStep = isEnglish
    ? '2. Copy the connect command below and enter it in the F8 menu in FiveM'
    : '2. Copiez le connect ci-dessous et entrez le dans le f8 dans le menu fivem.';
  const thirdStep = isEnglish
    ? '3. Click the "Connect" button to launch FiveM directly and connect to the server'
    : '3. Cliquez sur le bouton "Se Connecter" pour directement lancer fivem et vous connectez au serveur';
  const connectLabel = isEnglish ? 'Connect' : 'Se Connecter';

  return {
    title,
    status,
    optionsTitle,
    firstStep,
    secondStep,
    thirdStep,
    connectLabel
  };
}

function buildConnectPanel(lang, translateDisabled = false) {
  const copy = buildConnectText(lang);

  const container = new ContainerBuilder()
    .setAccentColor(config.colors.primary)
    .addTextDisplayComponents(
      new TextDisplayBuilder().setContent(
        `### ${copy.title}\n\n${copy.status} : <#${CONNECT_CHANNEL_ID}>`
      )
    );

  appendSeparatorComponent(container);

  container.addTextDisplayComponents(
    new TextDisplayBuilder().setContent(
      `${copy.optionsTitle}\n\n${copy.firstStep}\n   ou\n${copy.secondStep}\n   \`\`\`connect play.takedown-fivem.com\`\`\`\n   ou\n${copy.thirdStep}\n\n${translateHint}`
    )
  );

  container.addActionRowComponents(
    new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setLabel(copy.connectLabel)
        .setStyle(ButtonStyle.Link)
        .setURL(CONNECT_LINK),
      new ButtonBuilder()
        .setCustomId('msg_translate_connect')
        .setLabel('🇬🇧 Translate')
        .setStyle(ButtonStyle.Secondary)
        .setDisabled(translateDisabled)
    )
  );

  return container;
}

registerPanelRefreshBuilder('connect', async ({ member }) => {
  const lang = await getLanguage(member);
  const translateDisabled = !(await isEnglishOnly(member));
  return [buildConnectPanel(lang, translateDisabled)];
});

export default {
  data: new SlashCommandBuilder()
    .setName('connect')
    .setDescription('Afficher le panneau de connexion au serveur'),

  async executeSlash(interaction, lang) {
    const translateDisabled = !(await isEnglishOnly(interaction.member));
    const container = buildConnectPanel(lang, translateDisabled);

    await interaction.reply({
      components: [container],
      flags: MessageFlags.IsComponentsV2
    });

    const replyMessage = await interaction.fetchReply().catch(() => null);
    if (replyMessage) {
      registerPanelRefresh({
        key: `connect:${replyMessage.id}`,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        messageIds: replyMessage.id,
        memberId: interaction.user.id,
        refreshOnMemberUpdate: true,
        panelType: 'connect',
        payload: {},
        buildComponents: async member => {
          const refreshedLang = await getLanguage(member);
          const refreshedTranslateDisabled = !(await isEnglishOnly(member));
          return [buildConnectPanel(refreshedLang, refreshedTranslateDisabled)];
        }
      });
    }
  },

  async executePrefix(message, args, lang) {
    await message.delete().catch(() => null);

    const translateDisabled = !(await isEnglishOnly(message.member));
    const container = buildConnectPanel(lang, translateDisabled);
    const sentMessage = await sendV2Container(message.channel, container);

    if (!sentMessage?.id) {
      return;
    }

    registerPanelRefresh({
      key: `connect:${sentMessage.id}`,
      guildId: message.guildId,
      channelId: message.channelId,
      messageIds: sentMessage.id,
      memberId: message.author.id,
      refreshOnMemberUpdate: true,
      panelType: 'connect',
      payload: {},
      buildComponents: async member => {
        const refreshedLang = await getLanguage(member);
        const refreshedTranslateDisabled = !(await isEnglishOnly(member));
        return [buildConnectPanel(refreshedLang, refreshedTranslateDisabled)];
      }
    });
  }
};
