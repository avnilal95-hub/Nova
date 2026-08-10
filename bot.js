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
// (HTML files at root, CSS at public/css, JS at public/js)
app.use(express.static(path.join(__dirname, 'public')));

// Explicit Route Fallbacks
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// API Endpoint to check bot readiness and statistics
app.get('/api/status', (req, res) => {
  res.json({
    status: client.isReady() ? 'Online' : 'Offline',
    botUser: client.user ? client.user.tag : null,
    guildCount: client.guilds.cache.size,
    ping: client.ws.ping,
    totalCommandsLoaded: client.commands.size,
  });
});

// API Endpoint for Discord OAuth2 Login
app.get('/api/auth/discord', (req, res) => {
  const clientId = process.env.CLIENT_ID;
  const redirectUri = encodeURIComponent(`${req.protocol}://${req.get('host')}/api/auth/callback`);
  const discordAuthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=identify%20guilds`;
  res.redirect(discordAuthUrl);
});

app.get('/api/auth/callback', (req, res) => {
  res.redirect('/servers.html');
});

// Start Express Listener
app.listen(PORT, () => {
  console.log(`[Web Server] Running on http://localhost:${PORT}`);
  console.log(`[Web Server] Serving public website files from: ${path.join(__dirname, 'public')}`);
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
// 3. DYNAMIC COMMAND HANDLER (Scalable for 200+ Commands)
// ---------------------------------------------------------
const commandsPath = path.join(__dirname, 'commands');
const slashCommandsData = [];

// Ensure commands directory exists
if (!fs.existsSync(commandsPath)) {
  fs.mkdirSync(commandsPath);
}

// Recursively load all command files from commands/ folder
function loadCommands(directory) {
  const files = fs.readdirSync(directory, { withFileTypes: true });

  for (const file of files) {
    const fullPath = path.join(directory, file.name);
    if (file.isDirectory()) {
      loadCommands(fullPath); // Load subfolders (e.g. commands/moderation/, commands/fun/)
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
console.log(`[Commands] Loaded ${client.commands.size} commands into memory.`);

// Register Slash Commands with Discord Gateway API
async function registerSlashCommands() {
  const rest = new REST({ version: '10' }).setToken(process.env.DISCORD_TOKEN);
  try {
    console.log(`[Discord API] Registering ${slashCommandsData.length} global slash commands...`);
    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body: slashCommandsData }
    );
    console.log('[Discord API] Successfully registered all slash commands.');
  } catch (error) {
    console.error('[Discord API] Error registering commands:', error);
  }
}

// ---------------------------------------------------------
// 4. RICH PRESENCE & ACTIVITY ROTATION
// ---------------------------------------------------------
const activities = [
  { name: '/help | Zyphra Dashboard', type: ActivityType.Listening },
  { name: 'over 200+ Commands', type: ActivityType.Watching },
  { name: 'Community Events', type: ActivityType.Streaming, url: 'https://twitch.tv/discord' },
  { name: 'Music & Anti-Nuke', type: ActivityType.Listening },
  { name: 'Server Activity', type: ActivityType.Watching },
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
  }, 15000); // Rotates activity every 15 seconds
}

// ---------------------------------------------------------
// 5. BOT EVENTS & INTERACTION HANDLER
// ---------------------------------------------------------
client.once('ready', async () => {
  console.log(`[Discord Bot] Logged in as ${client.user.tag}`);
  
  // Register Slash Commands
  await registerSlashCommands();

  // Start Status Activity Loop
  setRotatingActivity();
});

// Handle Slash Command Executions
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;

  const command = client.commands.get(interaction.commandName);
  if (!command) return;

  try {
    await command.execute(interaction);
  } catch (error) {
    console.error(`Error executing command ${interaction.commandName}:`, error);
    if (interaction.replied || interaction.deferred) {
      await interaction.followup({ content: 'There was an error executing this command!', ephemeral: true });
    } else {
      await interaction.reply({ content: 'There was an error executing this command!', ephemeral: true });
    }
  }
});

// ---------------------------------------------------------
// 6. LOGIN WITH DISCORD_TOKEN
// ---------------------------------------------------------
if (!process.env.DISCORD_TOKEN) {
  console.error('[Error] DISCORD_TOKEN is missing in .env file!');
  process.exit(1);
}

client.login(process.env.DISCORD_TOKEN);
