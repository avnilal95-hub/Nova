// Initialize Lucide Icons globally
if (window.lucide) {
  lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guild_id') || params.get('guildId') || localStorage.getItem('selectedGuildId');

  if (guildId) {
    localStorage.setItem('selectedGuildId', guildId);
  }

  // 1. Initialize Global System Status & Metrics
  fetchBotStatus();

  // 2. Route Specific Initialization: Server Selector (servers.html)
  if (document.getElementById('activeServersContainer') || document.getElementById('serversContainer')) {
    loadRealServers();
    setupSearchFilter();
  }

  // 3. Route Specific Initialization: Server Dashboard (dashboard.html)
  if (guildId && document.getElementById('serverTitle')) {
    fetchGuildDetails(guildId);
    loadGuildMetaData(guildId);
  }

  // 4. UI Drawer & Tab Navigation Setup
  setupSidebarDrawer();
  setupTabNavigation();

  // 5. Setup Interactive Event Listeners
  setupFormListeners(guildId);
});

/* ==========================================================================
   GLOBAL APP STATE
   ========================================================================== */
let guildChannels = [];
let guildRoles = [];
let customCmdsCache = [];
let levelRewardsCache = [];

/* ==========================================================================
   API FETCH & METADATA FUNCTIONS
   ========================================================================== */

// Fetch overall Nova™ bot system status
async function fetchBotStatus() {
  try {
    const res = await fetch('/api/status');
    const data = await res.json();

    const userStatus = document.getElementById('userStatus');
    if (userStatus && data.status === 'Online') {
      userStatus.textContent = 'Nova™ Online';
    }

    const statLatency = document.getElementById('statLatency');
    if (statLatency && data.ping) {
      statLatency.textContent = `${data.ping} ms`;
    }
  } catch (err) {
    console.error('[API Status Error]', err);
  }
}

// Fetch and dynamically render actual joined Discord servers (servers.html)
async function loadRealServers() {
  const activeContainer = document.getElementById('activeServersContainer');
  const inactiveContainer = document.getElementById('inactiveServersContainer');
  const legacyContainer = document.getElementById('serversContainer');

  const totalCounter = document.getElementById('totalServerCount');
  const activeCounter = document.getElementById('activeServerCount');
  const activeCategoryCount = document.getElementById('activeCategoryCount');
  const inactiveCategoryCount = document.getElementById('inactiveCategoryCount');

  try {
    const res = await fetch('/api/user/guilds');
    const data = await res.json();

    if (!data.success || !data.guilds || data.guilds.length === 0) {
      const emptyHtml = `
        <div class="server-card">
          <div class="server-body" style="text-align: center; padding: 30px;">
            <p class="server-description">No servers found. Invite Nova™ to your server to begin!</p>
            <a href="/api/invite" class="btn btn-purple btn-full" style="margin-top: 12px;">Invite Bot</a>
          </div>
        </div>
      `;
      if (activeContainer) activeContainer.innerHTML = emptyHtml;
      if (inactiveContainer) inactiveContainer.innerHTML = '';
      if (legacyContainer) legacyContainer.innerHTML = emptyHtml;
      if (totalCounter) totalCounter.textContent = '0';
      if (activeCounter) activeCounter.textContent = '0';
      return;
    }

    const activeGuilds = data.guilds.filter(g => g.botJoined);
    const inactiveGuilds = data.guilds.filter(g => !g.botJoined);

    // Update Counter Badges
    if (totalCounter) totalCounter.textContent = data.guilds.length;
    if (activeCounter) activeCounter.textContent = activeGuilds.length;
    if (activeCategoryCount) activeCategoryCount.textContent = `${activeGuilds.length} Servers`;
    if (inactiveCategoryCount) inactiveCategoryCount.textContent = `${inactiveGuilds.length} Servers`;

    // 1. Render Active Servers Section
    if (activeContainer) {
      if (activeGuilds.length === 0) {
        activeContainer.innerHTML = `<p class="empty-server-msg">No active servers running Nova™.</p>`;
      } else {
        activeContainer.innerHTML = activeGuilds.map(guild => `
          <div class="server-card active-card" data-server-name="${guild.name.toLowerCase()}" data-status="active">
            <div class="server-banner ${guild.banner ? '' : 'fallback-banner'}" ${guild.banner ? `style="background-image: url('${guild.banner}');"` : ''}>
              <span class="status-indicator active-status">
                <span class="dot green"></span> Active Server
              </span>
            </div>
            <div class="server-body">
              <div class="server-header">
                <img class="server-avatar" src="${guild.icon}" alt="${guild.name} Icon">
                <div class="server-info">
                  <h3 class="server-name">${guild.name}</h3>
                  <span class="server-members"><i data-lucide="users"></i> ${(guild.memberCount || 0).toLocaleString()} Members</span>
                </div>
              </div>
              <p class="server-description">${guild.description || 'Active Nova™ protected server.'}</p>
              <div class="card-footer-actions">
                <a href="dashboard.html?guild_id=${guild.id}" class="btn btn-purple btn-full glowing-btn">
                  Go to Dashboard <i data-lucide="arrow-right"></i>
                </a>
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    // 2. Render Inactive Servers Section
    if (inactiveContainer) {
      if (inactiveGuilds.length === 0) {
        inactiveContainer.innerHTML = `<p class="empty-server-msg">All your servers have Nova™ added!</p>`;
      } else {
        inactiveContainer.innerHTML = inactiveGuilds.map(guild => `
          <div class="server-card inactive-card" data-server-name="${guild.name.toLowerCase()}" data-status="inactive">
            <div class="server-banner fallback-banner">
              <span class="status-indicator inactive-status">
                <span class="dot black"></span> Not Active
              </span>
            </div>
            <div class="server-body">
              <div class="server-header">
                <img class="server-avatar" src="${guild.icon}" alt="${guild.name} Icon">
                <div class="server-info">
                  <h3 class="server-name">${guild.name}</h3>
                  <span class="server-members"><i data-lucide="users"></i> ${(guild.memberCount || 0).toLocaleString()} Members</span>
                </div>
              </div>
              <p class="server-description">Nova™ is not in this server yet. Invite Nova™ to enable 24/7 moderation and web controls.</p>
              <div class="card-footer-actions">
                <a href="/api/invite?guild_id=${guild.id}" class="btn btn-outline btn-full invite-btn">
                  <i data-lucide="user-plus"></i> Invite Bot
                </a>
              </div>
            </div>
          </div>
        `).join('');
      }
    }

    if (window.lucide) lucide.createIcons();

  } catch (err) {
    console.error('[Load Servers Error]', err);
  }
}

// Fetch single guild metadata for topbar (dashboard.html)
async function fetchGuildDetails(guildId) {
  try {
    const res = await fetch(`/api/guild/${guildId}`);
    if (!res.ok) throw new Error('Guild not found');

    const data = await res.json();
    const titleElem = document.getElementById('serverTitle');
    const memberElem = document.getElementById('statMembers');

    if (titleElem) titleElem.textContent = data.name;
    if (memberElem) memberElem.textContent = data.memberCount.toLocaleString();
  } catch (err) {
    console.error('[Fetch Guild Details Error]', err);
    const titleElem = document.getElementById('serverTitle');
    if (titleElem) titleElem.textContent = 'Server Control Center';
  }
}

// Fetch Guild Sidebar Header & Dynamic Channels/Roles for Select Boxes
async function loadGuildMetaData(guildId) {
  try {
    const guildRes = await fetch(`/api/guild/${guildId}`);
    if (guildRes.ok) {
      const guildData = await guildRes.json();
      const sidebarName = document.getElementById('sidebarServerName');
      const sidebarIcon = document.getElementById('sidebarServerIcon');

      if (sidebarName) sidebarName.innerText = guildData.name || 'Server Control';
      if (sidebarIcon && guildData.icon) sidebarIcon.src = guildData.icon;
    }

    const detailsRes = await fetch(`/api/guild/${guildId}/details`);
    if (detailsRes.ok) {
      const detailsData = await detailsRes.json();
      guildChannels = detailsData.channels || [];
      guildRoles = detailsData.roles || [];

      populateDropdowns();
    }
  } catch (err) {
    console.error('[Load Guild Meta Error]', err);
  }
}

// Populate Channel and Role Select Menus
function populateDropdowns() {
  const channelSelects = [
    document.getElementById('ticketChannelSelect'),
    document.getElementById('targetChannelSelect')
  ];

  const roleSelects = [
    document.getElementById('ticketRoleSelect'),
    document.getElementById('levelRoleSelect')
  ];

  channelSelects.forEach((select) => {
    if (!select) return;
    select.innerHTML = '<option value="">Select a channel...</option>';
    guildChannels.forEach((ch) => {
      select.innerHTML += `<option value="${ch.id}">${ch.name}</option>`;
    });
  });

  roleSelects.forEach((select) => {
    if (!select) return;
    select.innerHTML = '<option value="">Select a role...</option>';
    guildRoles.forEach((r) => {
      select.innerHTML += `<option value="${r.id}">@${r.name}</option>`;
    });
  });
}

/* ==========================================================================
   UI CONTROLS & SIDEBAR NAVIGATION
   ========================================================================== */

function setupSearchFilter() {
  const searchInput = document.getElementById('serverSearchInput');
  const filterPills = document.querySelectorAll('.filter-pills .pill');
  const activeGroup = document.getElementById('activeSectionGroup');
  const inactiveGroup = document.getElementById('inactiveSectionGroup');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const term = e.target.value.toLowerCase().trim();
      const cards = document.querySelectorAll('.server-card');

      cards.forEach(card => {
        const name = card.getAttribute('data-server-name') || '';
        card.style.display = name.includes(term) ? 'flex' : 'none';
      });
    });
  }

  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');

      const filterType = pill.getAttribute('data-filter');

      if (filterType === 'active') {
        if (activeGroup) activeGroup.style.display = 'block';
        if (inactiveGroup) inactiveGroup.style.display = 'none';
      } else if (filterType === 'inactive') {
        if (activeGroup) activeGroup.style.display = 'none';
        if (inactiveGroup) inactiveGroup.style.display = 'block';
      } else {
        if (activeGroup) activeGroup.style.display = 'block';
        if (inactiveGroup) inactiveGroup.style.display = 'block';
      }
    });
  });
}

function setupSidebarDrawer() {
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const sidebarDrawer = document.getElementById('sidebarDrawer');

  if (menuToggleBtn && sidebarDrawer) {
    menuToggleBtn.addEventListener('click', () => sidebarDrawer.classList.toggle('open'));
  }

  if (closeSidebarBtn && sidebarDrawer) {
    closeSidebarBtn.addEventListener('click', () => sidebarDrawer.classList.remove('open'));
  }

  const logoutBtn = document.getElementById('logoutServerBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('selectedGuildId');
    });
  }
}

function setupTabNavigation() {
  const menuItems = document.querySelectorAll('.menu-item');
  const tabContents = document.querySelectorAll('.tab-content');
  const sidebarDrawer = document.getElementById('sidebarDrawer');

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');

      menuItems.forEach(i => i.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      item.classList.add('active');
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) activeContent.classList.add('active');

      if (sidebarDrawer) sidebarDrawer.classList.remove('open');
    });
  });
}

/* ==========================================================================
   FORM SUBMISSIONS & DYNAMIC LIST MODULES
   ========================================================================== */

function setupFormListeners(guildId) {
  // 1. Send Web Announcement
  const sendBtn = document.getElementById('sendMsgBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => sendAnnouncement());
  }

  // 2. Save Bot Prefix
  const savePrefixBtn = document.getElementById('savePrefixBtn');
  if (savePrefixBtn) {
    savePrefixBtn.addEventListener('click', () => savePrefix(guildId));
  }

  // 3. Deploy Ticket System
  const deployTicketBtn = document.getElementById('deployTicketBtn');
  if (deployTicketBtn) {
    deployTicketBtn.addEventListener('click', () => deployTickets(guildId));
  }

  // 4. Add Level Reward
  const addLevelRoleBtn = document.getElementById('addLevelRoleBtn');
  if (addLevelRoleBtn) {
    addLevelRoleBtn.addEventListener('click', () => addLevelReward(guildId));
  }

  // 5. Add Custom Command
  const addCustomCmdBtn = document.getElementById('addCustomCmdBtn');
  if (addCustomCmdBtn) {
    addCustomCmdBtn.addEventListener('click', () => addCustomCommand(guildId));
  }
}

// Save Prefix Request
async function savePrefix(guildId) {
  const prefixInput = document.getElementById('botPrefixInput');
  if (!prefixInput) return;

  const prefix = prefixInput.value.trim();
  try {
    const res = await fetch('/api/prefix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId: guildId || 'default', prefix })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast(`Prefix updated to: "${data.prefix}"`, 'success');
    } else {
      showToast('Failed to save prefix changes.', 'error');
    }
  } catch (err) {
    showToast('Server error while saving prefix.', 'error');
  }
}

// Send Web Announcement Request
async function sendAnnouncement() {
  const channelSelect = document.getElementById('targetChannelSelect');
  const channelInput = document.getElementById('targetChannelId');
  const channelId = channelSelect ? channelSelect.value : (channelInput ? channelInput.value.trim() : '');
  const content = document.getElementById('announcementText').value.trim();

  if (!channelId || !content) {
    showToast('Provide both target channel and announcement text.', 'error');
    return;
  }

  try {
    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, content })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      showToast('Announcement dispatched successfully!', 'success');
      document.getElementById('announcementText').value = '';
    } else {
      showToast(data.error || 'Failed to send announcement.', 'error');
    }
  } catch (err) {
    showToast('Server connection error.', 'error');
  }
}

// Deploy Ticket System
async function deployTickets(guildId) {
  const channelId = document.getElementById('ticketChannelSelect').value;
  const roleId = document.getElementById('ticketRoleSelect').value;
  const message = document.getElementById('ticketMessage').value.trim();

  if (!channelId) return showToast('Please select a target ticket channel.', 'error');

  try {
    const res = await fetch('/api/tickets/deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, channelId, roleId, message })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Ticket panel deployed successfully!', 'success');
    } else {
      showToast(data.error || 'Failed to deploy ticket panel.', 'error');
    }
  } catch (err) {
    showToast('Error deploying ticket panel.', 'error');
  }
}

// Add Level Role Reward & Render
async function addLevelReward(guildId) {
  const level = document.getElementById('levelReq').value;
  const roleId = document.getElementById('levelRoleSelect').value;

  if (!level || !roleId) return showToast('Specify required level and reward role.', 'error');

  try {
    const res = await fetch('/api/level-rewards', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, level, roleId })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('levelReq').value = '';
      document.getElementById('levelRoleSelect').value = '';
      levelRewardsCache = data.rewards || [];
      renderLevelRewards(guildId);
      showToast('Level reward created!', 'success');
    } else {
      showToast(data.error || 'Failed to add reward.', 'error');
    }
  } catch (err) {
    showToast('Error saving level reward.', 'error');
  }
}

function renderLevelRewards(guildId) {
  const listContainer = document.getElementById('levelRewardsList');
  const counterBadge = document.getElementById('levelRoleCount');
  if (!listContainer) return;

  if (counterBadge) counterBadge.innerText = `${levelRewardsCache.length} / 15`;
  listContainer.innerHTML = '';

  levelRewardsCache.forEach((item) => {
    const roleObj = guildRoles.find((r) => r.id === item.roleId);
    const roleName = roleObj ? `@${roleObj.name}` : item.roleId;

    const card = document.createElement('div');
    card.className = 'dynamic-card';
    card.innerHTML = `
      <div class="dynamic-card-info">
        <span class="dynamic-card-title">Level ${item.level} Reward</span>
        <span class="dynamic-card-sub">Role: ${roleName}</span>
      </div>
      <button class="btn-delete">Delete</button>
    `;

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      const res = await fetch('/api/level-rewards', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, level: item.level })
      });
      const data = await res.json();
      if (data.success) {
        levelRewardsCache = data.rewards || [];
        renderLevelRewards(guildId);
        showToast(`Level ${item.level} reward deleted.`, 'info');
      }
    });

    listContainer.appendChild(card);
  });
}

// Add Custom Command & Render
async function addCustomCommand(guildId) {
  const trigger = document.getElementById('cmdTrigger').value.trim();
  const response = document.getElementById('cmdResponse').value.trim();

  if (!trigger || !response) return showToast('Enter trigger and bot response.', 'error');

  try {
    const res = await fetch('/api/custom-commands', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, trigger, response })
    });
    const data = await res.json();
    if (data.success) {
      document.getElementById('cmdTrigger').value = '';
      document.getElementById('cmdResponse').value = '';
      customCmdsCache = data.commands || [];
      renderCustomCommands(guildId);
      showToast('Custom command created!', 'success');
    } else {
      showToast(data.error || 'Failed to save command.', 'error');
    }
  } catch (err) {
    showToast('Error saving custom command.', 'error');
  }
}

function renderCustomCommands(guildId) {
  const listContainer = document.getElementById('customCmdsList');
  const counterBadge = document.getElementById('customCmdCount');
  if (!listContainer) return;

  if (counterBadge) counterBadge.innerText = `${customCmdsCache.length} / 10`;
  listContainer.innerHTML = '';

  customCmdsCache.forEach((item) => {
    const card = document.createElement('div');
    card.className = 'dynamic-card';
    card.innerHTML = `
      <div class="dynamic-card-info">
        <span class="dynamic-card-title">${item.trigger}</span>
        <span class="dynamic-card-sub">${item.response}</span>
      </div>
      <button class="btn-delete">Delete</button>
    `;

    card.querySelector('.btn-delete').addEventListener('click', async () => {
      const res = await fetch('/api/custom-commands', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ guildId, trigger: item.trigger })
      });
      const data = await res.json();
      if (data.success) {
        customCmdsCache = data.commands || [];
        renderCustomCommands(guildId);
        showToast(`Command "${item.trigger}" deleted.`, 'info');
      }
    });

    listContainer.appendChild(card);
  });
}

// Toast Notifications Helper
function showToast(msg, type = 'info') {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerText = msg;

  container.appendChild(toast);
  setTimeout(() => toast.classList.add('show'), 100);

  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}
