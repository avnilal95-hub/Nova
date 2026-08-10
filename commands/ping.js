const { SlashCommandBuilder, EmbedBuilder } = require('discord.js');

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Displays advanced bot performance and latency metrics.'),
  async execute(interaction) {
    // 1. Defer the reply to accurately calculate server round-trip time
    const sent = await interaction.deferReply({ fetchReply: true });

    // 2. Calculate latency metrics
    const serverLatency = sent.createdTimestamp - interaction.createdTimestamp;
    const gatewayLatency = interaction.client.ws.ping;
    const nodeVersion = process.version;

    // 3. Dynamic status indicator based on latency health
    const getStatusEmoji = (ms) => {
      if (ms < 100) return '🟢 Excellent';
      if (ms < 200) return '🟡 Moderate';
      return '🔴 High Latency';
    };

    // 4. Build the modern embed
    const pingEmbed = new EmbedBuilder()
      .setColor('#8b5cf6') // Accent purple to match Zyphra theme
      .setTitle('⚡ System Performance Metrics')
      .setDescription('Real-time connection health and environment status.')
      .addFields(
        { 
          name: '🟢 Node.js', 
          value: `\`\`\`text\n${nodeVersion}\n\`\`\``, 
          inline: true 
        },
        { 
          name: '🌐 Server', 
          value: `\`\`\`text\n${serverLatency}ms\n\`\`\``, 
          inline: true 
        },
        { 
          name: '📡 Gateway Latency', 
          value: `\`\`\`text\n${gatewayLatency}ms\n\`\`\``, 
          inline: true 
        },
        { 
          name: '📊 Network Health', 
          value: `${getStatusEmoji(gatewayLatency)}`, 
          inline: false 
        }
      )
      .setFooter({ 
        text: `Requested by ${interaction.user.tag}`, 
        iconURL: interaction.user.displayAvatarURL({ dynamic: true }) 
      })
      .setTimestamp();

    // 5. Update interaction with the embed
    await interaction.editReply({ embeds: [pingEmbed] });
  },
};
