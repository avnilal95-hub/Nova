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
    .setName('unban')
    .setDescription('Unbans a user from the server using their User ID.')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers) // Require Ban Members permission
    .addStringOption(option => 
      option.setName('user_id')
        .setDescription('The ID of the user to unban')
        .setRequired(true))
    .addStringOption(option => 
      option.setName('reason')
        .setDescription('Reason for the unban action')
        .setRequired(false)),

  async execute(interaction) {
    // Defer reply to prevent 3-second timeout issues
    await interaction.deferReply({ ephemeral: false });

    const userId = interaction.options.getString('user_id').trim();
    const reason = interaction.options.getString('reason') || 'No reason provided.';
    
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
    // 1. ERROR HANDLING: INVALID USER ID FORMAT
    // ------------------------------------------------------------------
    if (!/^\d{17,20}$/.test(userId)) {
      return await sendError('Invalid User ID', 'Please provide a valid 17 to 20-digit Discord User ID.');
    }

    // ------------------------------------------------------------------
    // 2. ERROR HANDLING: MISSING BOT PERMISSIONS
    // ------------------------------------------------------------------
    const botMember = await guild.members.fetchMe();
    if (!botMember.permissions.has(PermissionFlagsBits.BanMembers)) {
      return await sendError('Missing Bot Permission', 'I do not have the **Ban Members** permission required to perform this action.');
    }

    // ------------------------------------------------------------------
    // 3. FETCH BAN RECORD & VERIFY USER IS BANNED
    // ------------------------------------------------------------------
    let banRecord;
    try {
      banRecord = await guild.bans.fetch(userId);
    } catch (err) {
      return await sendError('Not Banned', `No ban record found for User ID \`${userId}\` in this server.`);
    }

    const bannedUser = banRecord.user;

    // ------------------------------------------------------------------
    // 4. UNBAN EXECUTION
    // ------------------------------------------------------------------
    try {
      await guild.members.unban(userId, `${executor.tag}: ${reason}`);
    } catch (unbanError) {
      console.error('[Unban Execution Error]', unbanError);
      return await sendError('Unban Execution Failed', `An unexpected error occurred while unbanning: \`${unbanError.message}\``);
    }

    // ------------------------------------------------------------------
    // 5. NOTIFY USER VIA DIRECT MESSAGE (DM)
    // ------------------------------------------------------------------
    let dmSent = false;
    const dmEmbed = new EmbedBuilder()
      .setColor('#22c55e') // Green accent for unban notification
      .setTitle(`🔓 You have been unbanned from ${guild.name}`)
      .addFields(
        { name: '🛡️ Moderation Reason', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false },
        { name: '👮 Unbanned By', value: `${executor.tag} (\`${executor.id}\`)`, inline: true },
        { name: '🏛️ Server', value: `${guild.name}`, inline: true }
      )
      .setFooter({ text: 'You may now rejoin the server using a valid invite link.' })
      .setTimestamp();

    try {
      await bannedUser.send({ embeds: [dmEmbed] });
      dmSent = true;
    } catch (dmError) {
      // DMs locked or user blocked bot
      dmSent = false;
    }

    // ------------------------------------------------------------------
    // 6. SEND SERVER CONFIRMATION EMBED
    // ------------------------------------------------------------------
    const successEmbed = new EmbedBuilder()
      .setColor('#8b5cf6') // Zyphra Purple Theme
      .setTitle(`${EMOJI_TICK} Action Executed: Member Unbanned`)
      .setDescription(`Successfully revoked ban for **${bannedUser.tag}** (\`${bannedUser.id}\`).`)
      .setThumbnail(bannedUser.displayAvatarURL({ dynamic: true, size: 256 }))
      .addFields(
        { name: '👤 Unbanned User', value: `${bannedUser} (\`${bannedUser.id}\`)`, inline: true },
        { name: '👮 Moderator', value: `${executor} (\`${executor.id}\`)`, inline: true },
        { name: '📩 DM Notification', value: dmSent ? `${EMOJI_TICK} Delivered` : `${EMOJI_CROSS} Failed (DMs Closed)`, inline: true },
        { name: '📝 Reason', value: `\`\`\`text\n${reason}\n\`\`\``, inline: false }
      )
      .setFooter({ text: `Zyphra Protection System`, iconURL: guild.iconURL({ dynamic: true }) })
      .setTimestamp();

    await interaction.editReply({ embeds: [successEmbed] });
  },
};
        
