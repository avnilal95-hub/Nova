const { 
  SlashCommandBuilder, 
  EmbedBuilder, 
  PermissionFlagsBits 
} = require('discord.js');

// Custom Emojis provided
const EMOJI_TICK = '<a:Tick:1536442130082562158>';
const EMOJI_CROSS = '<:Cross:1536442202027204698>';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ban')
    .setDescription('Bans a member from the server with detailed notifications.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) // Require Ban Members permission
    .addUserOption(option => 
      option.setName('user')
        .setDescription('The member to ban from the server')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the ban action')
        .setRequired(false))
    .addIntegerOption(option =>
      option.setName('delete_messages')
        .setDescription('Number of days of message history to delete')
        .setRequired(false)
        .addChoices(
          { name: 'Don\'t delete any', value: 0 },
          { name: 'Previous 24 hours', value: 1 },
          { name: 'Previous 7 days', value: 7 }
        )),

  async execute(interaction) {
    // Defer reply to prevent 3-second timeout issues
    await interaction.deferReply({ ephemeral: false });

    const targetUser = interaction.options.getUser('user');
    const reason = interaction.options.getString('reason') || 'No reason provided.';
    const deleteDays = interaction.options.getInteger('delete_messages') || 0;
    
    const executor = interaction.user;
    const guild = interaction.guild;

    // Helper: Generate Standardized Error Embeds
    const sendError = async (title, message) => {
      const errorEmbed = new EmbedBuilder()
        .setColor('#ef4444') // Red accent for errors
        .setTitle(`${EMOJI_CROSS} ${title}`)
        .setDescription(message)
        .setFooter({ text: `Requested by ${executor.tag}`, iconURL: executor.displayAvatarURL({ dynamic: true }) })
        .setTimestamp();

      return await interaction.editReply({ embeds: [errorEmbed] });
    };

    // ------------------------------------------------------------------
    // 1. ERROR HANDLING: MISSING REQUIRED ARGUMENTS / INVALID TARGET
    // ------------------------------------------------------------------
    if (!targetUser) {
      return await sendError('Missing Argument', 'You must specify a valid user to execute the ban command.');
    }

    if (targetUser.id === executor.id) {
      return await sendError('Invalid Target', 'You cannot ban yourself from the server.');
    }

    if (targetUser.id === interaction.client.user.id) {
      return await sendError('Invalid Target', 'I cannot ban myself from the server.');
    }

    // ------------------------------------------------------------------
    // 2. ERROR HANDLING: MISSING BOT PERMISSIONS
    // ------------------------------------------------------------------
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return await sendError('Missing Bot Permission', 'I do not have the **Ban Members** permission required to perform this action.');
    }

    // Attempt to fetch member inside guild (User might be outside server or already left)
    const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

    if (targetMember) {
      // ------------------------------------------------------------------
      // 3. ERROR HANDLING: MISSING USER PERMISSIONS / HIERARCHY CHECKS
      // ------------------------------------------------------------------
      // Check Executor Hierarchy
      if (executor.id !== guild.ownerId && targetMember.roles.highest.position >= interaction.member.roles.highest.position) {
        return await sendError('Permission Denied', 'You cannot ban this member because their highest role is equal to or higher than yours.');
      }

      // Check Bot Hierarchy
      if (targetMember.roles.highest.position >= botMember.roles.highest.position) {
        return await sendError('Permission Denied', 'I cannot ban this member because their highest role is equal to or higher than mine.');
      }

      // Check if target is owner
      if (targetUser.id === guild.ownerId) {
        return await sendError('Permission Denied', 'The Server Owner cannot be banned.');
      }
    }

    // ------------------------------------------------------------------
    // 4. NOTIFY USER VIA DIRECT MESSAGE (DM)
    // ------------------------------------------------------------------
    let dmSent = false;
    const dmEmbed = new EmbedBuilder()
      .setColor('#ef4444')
      .setTitle(`🔨 You have been banned from ${guild.name}`)
      .addFields(
        { name: '🛡️ Moderation Reason', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
        { name: '👮 Banned By', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
        { name: '🏛️ Server', value: `${guild.name}`, inline: true }
      )
      .setFooter({ text: 'If you think this was a mistake, contact server staff.' })
      .setTimestamp();

    try {
      await targetUser.send({ embeds: [dmEmbed] });
      dmSent = true;
    } catch (dmError) {
      // DMs locked or user blocked bot — proceed with server ban
      dmSent = false;
    }

    // ------------------------------------------------------------------
    // 5. EXECUTE BAN & SEND SERVER CONFIRMATION EMBED
    // ------------------------------------------------------------------
    try {
      await guild.members.ban(targetUser.id, { 
        reason: `${executor.tag}: ${reason}`,
        deleteMessageSeconds: deleteDays * 86400 
      });

      const successEmbed = new EmbedBuilder()
        .setColor('#8b5cf6') // Zyphra Purple Theme
        .setTitle(`${EMOJI_TICK} Action Executed: Member Banned`)
        .setDescription(`Successfully banned **${targetUser.tag}** from the server.`)
        .setThumbnail(targetUser.displayAvatarURL({ dynamic: true, size: 256 }))
        .addFields(
          { name: '👤 Target User', value: `${targetUser} (\`${targetUser.id}\`)`, inline: true },
          { name: '👮 Moderator', value: `${executor} (\`${executor.id}\`)`, inline: true },
          { name: '📩 DM Notification', value: dmSent ? `${EMOJI_TICK} Delivered` : `${EMOJI_CROSS} Failed (DMs Closed)`, inline: true },
          { name: '📝 Reason', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
          { name: '🗑️ History Cleared', value: `\`${deleteDays} Day(s)\``, inline: true }
        )
        .setFooter({ text: `Zyphra Protection System`, iconURL: guild.iconURL({ dynamic: true }) })
        .setTimestamp();

      await interaction.editReply({ embeds: [successEmbed] });

    } catch (banError) {
      console.error('[Ban Execution Error]', banError);
      return await sendError('Ban Execution Failed', `An unexpected error occurred while executing the ban: \`${banError.message}\``);
    }
  },
};
    
