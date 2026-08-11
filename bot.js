require('dotenv').config();
const path = require('path');
const fs = require('fs');
const express = require('express');
const { 
  Client, 
  GatewayIntentBits, 
  Collection, 
  REST, 
  Routes, 
  ActivityType,
  EmbedBuilder,
  AttachmentBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle
} = require('discord.js');
const { generateRankSvg, generateLevelUpSvg } = require('./rankCard');

// ---------------------------------------------------------
// 1. INITIALIZE EXPRESS WEB SERVER
// ---------------------------------------------------------
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

// Serve static website files from public/
app.use(express.static(path.join(__dirname, 'public')));

// Node.js Memory Storage for Guild Configuration
const guildPrefixes = new Map(); // Stores prefix mapping per guild in Node.js memory

// Express Endpoint: Health & System Status
app.get('/api/status', (req, res) => {
  res.json({
    status: client.isReady() ? 'Online' : 'Offline',
    botName: 'Nova™',
    botUser: client.user ? client.user.tag : null,
    guildCount: client.guilds.cache.size,
    ping: client.ws.ping,
    totalCommandsLoaded: client.commands.size,
  });
});

// Express Endpoint: Prefix Management
app.post('/api/prefix', (req, res) => {
  const { guildId, prefix } = req.body;

  if (!guildId || !prefix) {
    return res.status(400).json({ error: 'Missing guildId or prefix' });
  }

  // Update prefix mapping in Node.js memory (Default: '+')
  const newPrefix = prefix.trim() || '+';
  guildPrefixes.set(guildId, newPrefix);

  console.log(`[Nova™] Updated prefix for Guild ${guildId} to: "${newPrefix}"`);
  
  return res.json({ 
    success: true, 
    prefix: newPrefix 
  });
});

// Express Endpoint: Dispatch Remote Web Announcements
app.post('/api/message', async (req, res) => {
  const { channelId, content } = req.body;

  if (!channelId || !content) {
    return res.status(400).json({ error: 'Channel ID and content are required.' });
  }

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid text channel ID.' });
    }

    await channel.send(content);
    return res.json({ success: true, message: 'Broadcast dispatched successfully.' });
  } catch (err) {
    console.error('[Nova™ Broadcast Error]', err);
    return res.status(500).json({ error: 'Failed to dispatch message to Discord.' });
  }
});

// Express Endpoint: Fetch Guild Details for Dashboard
app.get('/api/guild/:id', async (req, res) => {
  try {
    const guild = await client.guilds.fetch(req.params.id);
    res.json({
      name: guild.name,
      memberCount: guild.memberCount,
      icon: guild.iconURL({ dynamic: true }),
    });
  } catch (err) {
    res.status(404).json({ error: 'Guild not found or bot not in server' });
  }
});

// Express Endpoint: Fetch Guild Channels & Roles for Dropdown Selectors
app.get('/api/guild/:id/details', async (req, res) => {
  try {
    const guild = await client.guilds.fetch(req.params.id);
    const channels = await guild.channels.fetch();
    const roles = await guild.roles.fetch();

    const textChannels = channels
      .filter(c => c && c.isTextBased())
      .map(c => ({ id: c.id, name: `#${c.name}` }));

    const serverRoles = roles
      .filter(r => r && r.name !== '@everyone')
      .map(r => ({ id: r.id, name: r.name }));

    return res.json({ channels: textChannels, roles: serverRoles });
  } catch (err) {
    console.error('[Nova™ Details Fetch Error]', err);
    return res.status(500).json({ error: 'Failed to fetch guild channels or roles.' });
  }
});

// ---------------------------------------------------------
// DATA STORES & DASHBOARD APIS (LEVELING, COMMANDS, TICKETS)
// ---------------------------------------------------------

const customCommands = new Map(); // guildId -> Array of { trigger, response }
const levelRewards = new Map();   // guildId -> Array of { level, roleId }
const userXpStore = new Map();    // guildId -> Map(userId -> { xp, level })
const guildTicketConfigs = new Map(); // guildId -> { channelId, roleId, message }

// Custom Commands API (Create & Add)
app.post('/api/custom-commands', (req, res) => {
  const { guildId, trigger, response } = req.body;
  if (!guildId || !trigger || !response) return res.status(400).json({ error: 'Missing parameters.' });

  const guildCmds = customCommands.get(guildId) || [];
  if (guildCmds.length >= 10) return res.status(400).json({ error: 'Maximum 10 custom commands allowed.' });

  const formattedTrigger = trigger.toLowerCase().trim();
  guildCmds.push({ trigger: formattedTrigger, response });
  customCommands.set(guildId, guildCmds);

  res.json({ success: true, count: guildCmds.length, commands: guildCmds });
});

// Custom Commands API (Delete)
app.delete('/api/custom-commands', (req, res) => {
  const { guildId, trigger } = req.body;
  if (!guildId || !trigger) return res.status(400).json({ error: 'Missing parameters.' });

  let guildCmds = customCommands.get(guildId) || [];
  guildCmds = guildCmds.filter(c => c.trigger !== trigger.toLowerCase().trim());
  customCommands.set(guildId, guildCmds);

  res.json({ success: true, count: guildCmds.length, commands: guildCmds });
});

// Level Rewards API (Create & Add)
app.post('/api/level-rewards', (req, res) => {
  const { guildId, level, roleId } = req.body;
  if (!guildId || !level || !roleId) return res.status(400).json({ error: 'Missing parameters.' });

  const guildRewards = levelRewards.get(guildId) || [];
  if (guildRewards.length >= 15) return res.status(400).json({ error: 'Maximum 15 reward roles allowed.' });

  guildRewards.push({ level: parseInt(level), roleId });
  levelRewards.set(guildId, guildRewards);

  res.json({ success: true, count: guildRewards.length, rewards: guildRewards });
});

// Level Rewards API (Delete)
app.delete('/api/level-rewards', (req, res) => {
  const { guildId, level } = req.body;
  if (!guildId || !level) return res.status(400).json({ error: 'Missing parameters.' });

  let guildRewards = levelRewards.get(guildId) || [];
  guildRewards = guildRewards.filter(r => r.level !== parseInt(level));
  levelRewards.set(guildId, guildRewards);

  res.json({ success: true, count: guildRewards.length, rewards: guildRewards });
});

// Ticket Panel Deploy API
app.post('/api/tickets/deploy', async (req, res) => {
  const { guildId, channelId, roleId, message } = req.body;
  if (!guildId || !channelId) return res.status(400).json({ error: 'Missing channel or server ID.' });

  try {
    const channel = await client.channels.fetch(channelId);
    if (!channel || !channel.isTextBased()) {
      return res.status(400).json({ error: 'Invalid target channel.' });
    }

    guildTicketConfigs.set(guildId, { channelId, roleId, message });

    const embed = new EmbedBuilder()
      .setTitle('🎫 Support Ticket Portal')
      .setDescription(message || 'Click the button below to open a private support ticket.')
      .setColor('#8b5cf6')
      .setTimestamp();

    const ticketBtn = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId('create_ticket_btn')
        .setLabel('Create Ticket')
        .setStyle(ButtonStyle.Primary)
        .setEmoji('🎫')
    );

    await channel.send({ embeds: [embed], components: [ticketBtn] });
    return res.json({ success: true });
  } catch (err) {
    console.error('[Ticket Deploy Error]', err);
    return res.status(500).json({ error: 'Failed to deploy ticket panel to channel.' });
  }
});

// ---------------------------------------------------------
// DISCORD OAUTH2 & INVITE ROUTE HANDLERS
// ---------------------------------------------------------

// 1. Dashboard Login Route
app.get('/api/auth/discord', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const domain = process.env.RAILWAY_PUBLIC_DOMAIN || 'nova-novatm.up.railway.app';
  const redirectUri = encodeURIComponent(`https://${domain}/api/auth/callback`);
  
  const scope = encodeURIComponent('identify guilds');
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=${scope}`;

  res.redirect(discordAuthUrl);
});

// 2. Direct Bot Invite Route
app.get('/api/invite', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const permissions = '8'; // Administrator
  const scope = encodeURIComponent('bot applications.commands');

  const inviteUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&permissions=${permissions}&scope=${scope}`;

  res.redirect(inviteUrl);
});

// 3. OAuth2 Callback Endpoint
app.get('/api/auth/callback', (req, res) => {
  res.redirect('/servers.html');
});

// Start Express Web Server
app.listen(PORT, () => {
  console.log(`[Web Server] Nova™ Dashboard live on http://localhost:${PORT}`);
});

// ---------------------------------------------------------
// 2. INITIALIZE DISCORD BOT CLIENT
// ---------------------------------------------------------
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildMembers,
  ],
});

client.commands = new Collection();

// ---------------------------------------------------------
// 3. DYNAMIC COMMAND HANDLER (Loads Commands)
// ---------------------------------------------------------
const commandsPath = path.join(__dirname, 'commands');
const slashCommandsData = [];

if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath);
}

function loadCommands(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath);
    } else if (file.name.endsWith('.js')) {
      const command = require(fullPath);
      if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
        slashCommandsData.push(command.data.toJSON());
      }
    }
  }
}

loadCommands(commandsPath);
console.log(`[Nova™ Commands] Loaded ${client.commands.size} commands into memory.`);

async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log(`[Nova™ API] Registering ${slashCommandsData.length} slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: slashCommandsData }
    );
    console.log('[Nova™ API] Successfully registered all global slash commands.');
  } catch (error) {
    console.error('[Nova™ API Error] Failed to register commands:', error);
  }
}

// ---------------------------------------------------------
// 4. ROTATING PRESENCE & ACTIVITIES
// ---------------------------------------------------------
const activities = [
  { name: '/help | Nova™ Dashboard', type: ActivityType.Listening },
  { name: 'over 200+ Commands', type: ActivityType.Watching },
  { name: 'Community Security Events', type: ActivityType.Streaming, url: 'https://twitch.tv/discord' },
  { name: 'Music & Anti-Nuke Engine', type: ActivityType.Listening },
  { name: 'Server Activity & Auto-Mod', type: ActivityType.Watching },
];

function setRotatingActivity() {
  let currentIndex = 0;
  setInterval(() => {
    const activity = activities[currentIndex];
    client.user.setPresence({
      activities: [{ name: activity.name, type: activity.type, url: activity.url || undefined }],
      status: 'online',
    });
    currentIndex = (currentIndex + 1) % activities.length;
  }, 15000);
}

// ---------------------------------------------------------
// 5. BOT READY & EVENT HANDLERS
// ---------------------------------------------------------

// Bot Startup Event
client.once('ready', async () => {
  console.log(`[Nova™ Bot] Logged in as ${client.user.tag}`);
  await registerSlashCommands();
  setRotatingActivity();
});

// XP, Level-Up, & Custom Commands Listener
client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  const guildId = message.guild.id;
  const userId = message.author.id;
  const content = message.content.trim().toLowerCase();

  // Custom Command Handler
  const guildCmds = customCommands.get(guildId) || [];
  const matchedCmd = guildCmds.find(c => c.trigger === content);
  if (matchedCmd) {
    return message.channel.send(matchedCmd.response);
  }

  // XP & Leveling Engine
  if (!userXpStore.has(guildId)) {
    userXpStore.set(guildId, new Map());
  }

  const guildXpMap = userXpStore.get(guildId);
  const userData = guildXpMap.get(userId) || { xp: 0, level: 1 };

  userData.xp += Math.floor(Math.random() * 5) + 1; // Grant 1-5 XP
  const neededXp = userData.level * 100;

  if (userData.xp >= neededXp) {
    const oldLevel = userData.level;
    userData.level += 1;

    const avatarUrl = message.author.displayAvatarURL({ extension: 'png', size: 128 });
    const levelUpSvg = generateLevelUpSvg(avatarUrl, oldLevel, userData.level);
    const attachment = new AttachmentBuilder(Buffer.from(levelUpSvg), { name: 'level-up.svg' });

    message.channel.send({
      content: `🎉 ${message.author}, you leveled up to **Level ${userData.level}**!`,
      files: [attachment]
    });

    const rewards = levelRewards.get(guildId) || [];
    const reward = rewards.find(r => r.level === userData.level);
    if (reward) {
      const role = message.guild.roles.cache.get(reward.roleId);
      if (role) message.member.roles.add(role).catch(() => {});
    }
  }

  guildXpMap.set(userId, userData);
});

// Unified Interaction Listener (Slash Commands & Ticket Buttons)
client.on('interactionCreate', async (interaction) => {

  // 1. Handle Slash Commands
  if (interaction.isChatInputCommand()) {
    if (interaction.commandName === 'rank') {
      await interaction.deferReply();

      const guildId = interaction.guild.id;
      const user = interaction.user;

      const guildXpMap = userXpStore.get(guildId);
      const userData = guildXpMap ? (guildXpMap.get(user.id) || { xp: 0, level: 1 }) : { xp: 0, level: 1 };
      const neededXp = userData.level * 100;
      const avatarUrl = user.displayAvatarURL({ extension: 'png', size: 256 });

      const svgString = generateRankSvg(
        user.username,
        avatarUrl,
        userData.level,
        userData.xp,
        neededXp,
        1
      );

      const attachment = new AttachmentBuilder(Buffer.from(svgString), { name: 'rank-card.svg' });
      return interaction.editReply({ files: [attachment] });
    }

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing ${interaction.commandName}:`, error);
      const errorPayload = { content: 'There was an error executing this command!', ephemeral: true };
      if (interaction.replied || interaction.deferred) {
        await interaction.followup(errorPayload);
      } else {
        await interaction.reply(errorPayload);
      }
    }
  }

  // 2. Handle Ticket Creation Button Clicks
  if (interaction.isButton() && interaction.customId === 'create_ticket_btn') {
    const guild = interaction.guild;
    const user = interaction.user;

    const ticketConfig = guildTicketConfigs.get(guild.id);
    const staffRoleId = ticketConfig ? ticketConfig.roleId : null;

    const existingChannel = guild.channels.cache.find(
      c => c.name === `ticket-${user.username.toLowerCase()}`
    );

    if (existingChannel) {
      return interaction.reply({
        content: `You already have an open ticket: ${existingChannel}`,
        ephemeral: true
      });
    }

    try {
      const permissionOverwrites = [
        {
          id: guild.id,
          deny: ['ViewChannel'],
        },
        {
          id: user.id,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'AttachFiles'],
        },
      ];

      if (staffRoleId) {
        permissionOverwrites.push({
          id: staffRoleId,
          allow: ['ViewChannel', 'SendMessages', 'ReadMessageHistory', 'ManageChannels'],
        });
      }

      const ticketChannel = await guild.channels.create({
        name: `ticket-${user.username}`,
        type: 0,
        permissionOverwrites: permissionOverwrites,
      });

      const welcomeEmbed = new EmbedBuilder()
        .setTitle(`🎫 Ticket: ${user.username}`)
        .setDescription(`Hello ${user}, thank you for reaching out! Support staff will assist you shortly.`)
        .setColor('#8b5cf6')
        .setTimestamp();

      const staffPing = staffRoleId ? `<@&${staffRoleId}>` : '';
      await ticketChannel.send({
        content: `${user} ${staffPing}`,
        embeds: [welcomeEmbed]
      });

      await interaction.reply({
        content: `Your ticket channel has been created: ${ticketChannel}`,
        ephemeral: true
      });

    } catch (err) {
      console.error('[Ticket Channel Creation Error]', err);
      await interaction.reply({
        content: 'Failed to create ticket channel. Verify bot permissions in server.',
        ephemeral: true
      });
    }
  }
});

// Express Endpoint: Fetch all actual servers
app.get('/api/user/guilds', async (req, res) => {
  try {
    const botGuilds = client.guilds.cache.map(guild => ({
      id: guild.id,
      name: guild.name,
      icon: guild.iconURL({ dynamic: true }) || 'https://cdn.discordapp.com/embed/avatars/0.png',
      banner: guild.bannerURL({ size: 600 }) || null,
      memberCount: guild.memberCount,
      description: guild.description || 'Active Nova™ protected server.',
      botJoined: true
    }));

    return res.json({
      success: true,
      guilds: botGuilds
    });
  } catch (err) {
    console.error('[Nova™ Guild Fetch Error]', err);
    return res.status(500).json({ error: 'Failed to fetch active bot servers.' });
  }
});

// Login using DISCORD_TOKEN
client.login(process.env.DISCORD_TOKEN);
