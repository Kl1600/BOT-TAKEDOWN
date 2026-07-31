import { ContainerBuilder, SectionBuilder, TextDisplayBuilder, ThumbnailBuilder, MessageFlags } from 'discord.js';
import config from '../../config/config.js';
import { t } from '../../utils/language.js';
import * as logger from '../../utils/logger.js';
import { sendV2Container } from '../../utils/v2Helper.js';
import dbService from '../../database/dbProxy.js';
import { handleGuildMemberInviteJoin } from '../../services/inviteService.js';
import { ensureBetaAccess } from '../../services/betaService.js';

export default {
  name: 'guildMemberAdd',
  once: false,
  async execute(member, client) {
    const autoroleId = config.roles.autorole || '1509613216114671661';
    if (autoroleId) {
      const role = member.guild.roles.cache.get(autoroleId) || await member.guild.roles.fetch(autoroleId).catch(() => null);
      if (role) {
        await member.roles.add(role).catch(err => logger.warn(`Failed to assign autorole ${autoroleId} to ${member.user.tag}: ${err.message}`));
      }
    }

    await handleGuildMemberInviteJoin(member, client).catch(() => null);
    await ensureBetaAccess(member.guild).catch(() => null);

    const welcomeEnabled = await dbService.getServerParam('welcome_enabled').catch(() => null);
    if (welcomeEnabled !== null && welcomeEnabled !== undefined && !['true', '1', 'yes', 'on', 'enabled'].includes(String(welcomeEnabled).toLowerCase())) {
      return;
    }

    const welcomeChannelId = config.channels.welcome;
    if (!welcomeChannelId) return;

    const channel = await member.guild.channels.fetch(welcomeChannelId).catch(() => null);
    if (!channel || !channel.isTextBased()) {
      logger.warn(`Welcome channel with ID ${welcomeChannelId} not found or is not text-based.`);
      return;
    }

    const memberCount = member.guild.memberCount;
    const welcomeDescription = [
      `Hey ${member.toString()}, welcome to Takedown FiveM!`,
      '',
      `Go to <#1519754587022692503> to get started.`
    ].join('\n');

    // Build welcome card using Components V2
    const section = new SectionBuilder()
      .addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`**Welcome to Takedown**\n\n${welcomeDescription}`)
      );

    // Attach banner as a Section Thumbnail Accessory
    if (config.welcome.banner) {
      section.setThumbnailAccessory(
        new ThumbnailBuilder().setURL(member.displayAvatarURL({ extension: 'png', size: 256 }))
      );
    }

    const container = new ContainerBuilder()
      .setAccentColor(config.colors.primary)
      .addSectionComponents(section);

    // Send the welcome V2 container component, with a fallback if Discord rejects the payload
    try {
      await sendV2Container(channel, container);
    } catch (err) {
      logger.error('Failed to send welcome message to channel', err);
      await channel.send({
        content: `${member.toString()}\n${welcomeDescription}`
      }).catch(fallbackErr => {
        logger.error('Fallback welcome message also failed', fallbackErr);
      });
    }
  }
};
