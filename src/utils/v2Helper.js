import {
  ContainerBuilder,
  TextDisplayBuilder,
  SectionBuilder,
  SeparatorBuilder,
  SeparatorSpacingSize,
  Routes,
  MessageFlags
} from 'discord.js';
import config from '../config/config.js';

let footerPatchApplied = false;

function buildFooterText() {
  const now = new Date();
  const date = new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Europe/Paris'
  }).format(now);
  const time = new Intl.DateTimeFormat('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: 'Europe/Paris'
  }).format(now);

  return `-# © Takedown - Fivem • ${date} à ${time}`;
}

function buildFooterComponent() {
  return new TextDisplayBuilder().setContent(buildFooterText());
}
export function applyV2FooterPatch() {
  if (footerPatchApplied) return;
  footerPatchApplied = true;

  const originalToJSON = ContainerBuilder.prototype.toJSON;
  ContainerBuilder.prototype.toJSON = function patchedToJSON(...args) {
    if (!this.__takedownFooterAdded) {
      const footerComponent = buildFooterComponent();
      if (footerComponent instanceof SectionBuilder) {
        this.addSectionComponents(footerComponent);
      } else {
        this.addTextDisplayComponents(footerComponent);
      }

      Object.defineProperty(this, '__takedownFooterAdded', {
        value: true,
        enumerable: false,
        configurable: true
      });
    }

    return originalToJSON.apply(this, args);
  };
}

applyV2FooterPatch();

export function createErrorContainer(content) {
  const text = new TextDisplayBuilder().setContent(content);
  return new ContainerBuilder()
    .setAccentColor(config.colors.error)
    .addTextDisplayComponents(text);
}

export function createSuccessContainer(content) {
  const text = new TextDisplayBuilder().setContent(content);
  return new ContainerBuilder()
    .setAccentColor(config.colors.success)
    .addTextDisplayComponents(text);
}

export function createTextSection(content) {
  return new SectionBuilder().addTextDisplayComponents(
    new TextDisplayBuilder().setContent(content)
  );
}

export function createSeparatorComponent({ divider = true, spacing = SeparatorSpacingSize.Small } = {}) {
  return new SeparatorBuilder()
    .setDivider(divider)
    .setSpacing(spacing);
}

export function appendSeparatorComponent(container, options = {}) {
  container.addSeparatorComponents(createSeparatorComponent(options));
  return container;
}

export function splitContentBySeparator(content, separatorToken = 'separator') {
  return String(content ?? '')
    .split(/\r?? \n/)
    .reduce((sections, line) => {
      const trimmed = line.trim();
      if (trimmed.toLowerCase() === separatorToken.toLowerCase()) {
        sections.push('__SEPARATOR__');
        return sections;
      }

      const last = sections[sections.length - 1];
      if (!last || last === '__SEPARATOR__') {
        sections.push(line);
      } else {
        sections[sections.length - 1] = `${last}\n${line}`;
      }
      return sections;
    }, [])
    .filter(section => section && section !== '__SEPARATOR__');
}

export async function sendV2Container(channel, container) {
  const rawMessage = await channel.client.rest.post(
    Routes.channelMessages(channel.id),
    {
      body: {
        components: [container.toJSON()],
        flags: MessageFlags.IsComponentsV2
      }
    }
  );

  return channel.messages.cache.get(rawMessage.id) || await channel.messages.fetch(rawMessage.id).catch(() => null);
}

export async function editV2ChannelMessage(channel, messageId, container) {
  return await channel.client.rest.patch(
    Routes.channelMessage(channel.id, messageId),
    {
      body: {
        components: [container.toJSON()],
        flags: MessageFlags.IsComponentsV2
      }
    }
  );
}

export async function editV2InteractionReply(interaction, container) {
  return await interaction.client.rest.patch(
    Routes.webhookMessage(interaction.applicationId, interaction.token, '@original'),
    {
      body: {
        components: [container.toJSON()],
        flags: MessageFlags.IsComponentsV2
      }
    }
  );
}

export default {
  createErrorContainer,
  createSuccessContainer,
  createTextSection,
  sendV2Container,
  editV2ChannelMessage,
  editV2InteractionReply
};
