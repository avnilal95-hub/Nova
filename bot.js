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
  ActivityType 
} = require('discord.js');

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
      icon: guild.iconURL(),
    });
  } catch (err) {
    res.status(404).json({ error: 'Guild not found or bot not in server' });
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

// Start Express Web Server (Line 69)
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
// 3. DYNAMIC COMMAND HANDLER (Loads 200+ Commands)
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
// 5. BOT READY & INTERACTION HANDLERS
// ---------------------------------------------------------
client.once('ready', async () => {
  console.log(`[Nova™ Bot] Logged in as ${client.user.tag}`);
  await registerSlashCommands();
  setRotatingActivity();
});

client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

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
});

// Express Endpoint: Fetch all actual servers
app.get('/api/user/guilds', async (req, res) => {
  try {
    // Map all real guilds Nova™ is currently joined to
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
