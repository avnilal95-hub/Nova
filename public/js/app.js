// Initialize Lucide Icons globally across all views
if (window.lucide) {
  lucide.createIcons();
}

document.addEventListener('DOMContentLoaded', () => {
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guild_id');

  // 1. Initialize Global Status & Navigation Elements
  fetchBotStatus();

  // 2. Route Specific Initializations
  if (document.getElementById('serversContainer')) {
    loadRealServers();
    setupSearchFilter();
  }

  if (guildId && document.getElementById('serverTitle')) {
    fetchGuildDetails(guildId);
  }

  // 3. Initialize Sidebar Drawer & Tab Navigation (Dashboard View)
  setupSidebarDrawer();
  setupTabNavigation();

  // 4. Form Submission Listeners
  const sendBtn = document.getElementById('sendMsgBtn');
  if (sendBtn) {
    sendBtn.addEventListener('click', () => sendAnnouncement());
  }

  const savePrefixBtn = document.getElementById('savePrefixBtn');
  if (savePrefixBtn) {
    savePrefixBtn.addEventListener('click', () => savePrefix());
  }
});

/* ==========================================================================
   API FETCH FUNCTIONS
   ========================================================================== */

// Fetch overall Nova™ bot system metrics
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

// Fetch and dynamically render actual joined Discord servers
async function loadRealServers() {
  const container = document.getElementById('serversContainer');
  const totalCounter = document.getElementById('totalServerCount');
  const activeCounter = document.getElementById('activeServerCount');

  if (!container) return;

  try {
    const res = await fetch('/api/user/guilds');
    const data = await res.json();

    if (!data.success || !data.guilds || data.guilds.length === 0) {
      container.innerHTML = `
        <div class="server-card">
          <div class="server-body" style="text-align: center; padding: 40px;">
            <p class="server-description">No active servers found. Invite Nova™ to your server to begin!</p>
            <a href="/api/invite" class="btn btn-purple btn-full" style="margin-top: 12px;">Invite Bot</a>
          </div>
        </div>
      `;
      if (totalCounter) totalCounter.textContent = '0';
      if (activeCounter) activeCounter.textContent = '0';
      return;
    }

    // Update live server counter widgets
    if (totalCounter) totalCounter.textContent = data.guilds.length;
    if (activeCounter) activeCounter.textContent = data.guilds.filter(g => g.botJoined).length;

    // Render server cards dynamically
    container.innerHTML = data.guilds.map(guild => `
      <div class="server-card ${guild.botJoined ? 'active-card' : 'inactive-card'}" data-server-name="${guild.name.toLowerCase()}">
        <div class="server-banner ${guild.banner ? '' : 'fallback-banner'}" ${guild.banner ? `style="background-image: url('${guild.banner}');"` : ''}>
          <span class="status-indicator ${guild.botJoined ? 'active-status' : 'inactive-status'}">
            <span class="dot ${guild.botJoined ? 'green' : 'black'}"></span> ${guild.botJoined ? 'Active Server' : 'Not Active Server'}
          </span>
        </div>
        <div class="server-body">
          <div class="server-header">
            <img class="server-avatar" src="${guild.icon}" alt="${guild.name} Icon">
            <div class="server-info">
              <h3 class="server-name">${guild.name}</h3>
              <span class="server-members"><i data-lucide="users"></i> ${guild.memberCount.toLocaleString()} Members</span>
            </div>
          </div>
          <p class="server-description">${guild.description}</p>
          <div class="card-footer-actions">
            ${guild.botJoined 
              ? `<a href="dashboard.html?guild_id=${guild.id}" class="btn btn-purple btn-full glowing-btn">Go to Dashboard <i data-lucide="arrow-right"></i></a>`
              : `<a href="/api/invite" class="btn btn-outline btn-full invite-btn"><i data-lucide="user-plus"></i> Invite Bot</a>`
            }
          </div>
        </div>
      </div>
    `).join('');

    // Re-initialize icons for newly inserted HTML elements
    if (window.lucide) lucide.createIcons();

  } catch (err) {
    console.error('[Load Servers Error]', err);
    container.innerHTML = `
      <div class="server-card">
        <div class="server-body" style="text-align: center; padding: 20px;">
          <p class="server-description" style="color: #ef4444;">Failed to fetch servers from Node.js backend API.</p>
        </div>
      </div>
    `;
  }
}

// Fetch single guild metadata for dashboard view
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

/* ==========================================================================
   UI CONTROLS & INTERACTION HANDLERS
   ========================================================================== */

// Live search input filtering for servers.html
function setupSearchFilter() {
  const searchInput = document.getElementById('serverSearchInput');
  if (!searchInput) return;

  searchInput.addEventListener('input', (e) => {
    const term = e.target.value.toLowerCase().trim();
    const cards = document.querySelectorAll('.server-card');

    cards.forEach(card => {
      const name = card.getAttribute('data-server-name') || '';
      card.style.display = name.includes(term) ? 'flex' : 'none';
    });
  });
}

// Mobile sliding navigation drawer
function setupSidebarDrawer() {
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const sidebarDrawer = document.getElementById('sidebarDrawer');

  if (menuToggleBtn && sidebarDrawer) {
    menuToggleBtn.addEventListener('click', () => sidebarDrawer.classList.add('open'));
  }

  if (closeSidebarBtn && sidebarDrawer) {
    closeSidebarBtn.addEventListener('click', () => sidebarDrawer.classList.remove('open'));
  }
}

// Tabbed section navigation in dashboard.html
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
   FORM SUBMISSIONS & POST REQUESTS
   ========================================================================== */

// Dispatch remote web announcements to Discord channel
async function sendAnnouncement() {
  const channelId = document.getElementById('targetChannelId').value.trim();
  const content = document.getElementById('announcementText').value.trim();
  const statusBox = document.getElementById('statusMessage');

  if (!channelId || !content) {
    if (statusBox) {
      statusBox.style.color = '#ef4444';
      statusBox.textContent = 'Please provide both Target Channel ID and Message Content.';
    }
    return;
  }

  try {
    if (statusBox) {
      statusBox.style.color = '#3b82f6';
      statusBox.textContent = 'Dispatching message...';
    }

    const res = await fetch('/api/message', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ channelId, content })
    });

    const data = await res.json();

    if (res.ok && data.success) {
      statusBox.style.color = '#22c55e';
      statusBox.textContent = 'Announcement dispatched successfully!';
      document.getElementById('announcementText').value = '';
    } else {
      statusBox.style.color = '#ef4444';
      statusBox.textContent = data.error || 'Failed to send announcement.';
    }
  } catch (err) {
    if (statusBox) {
      statusBox.style.color = '#ef4444';
      statusBox.textContent = 'Server connection error.';
    }
  }
}

// Save custom bot prefix in Node.js Express memory
async function savePrefix() {
  const prefixInput = document.getElementById('botPrefixInput');
  if (!prefixInput) return;

  const prefix = prefixInput.value.trim();
  const params = new URLSearchParams(window.location.search);
  const guildId = params.get('guild_id') || 'default';

  try {
    const res = await fetch('/api/prefix', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guildId, prefix })
    });

    const data = await res.json();
    if (res.ok && data.success) {
      alert(`Prefix updated to: "${data.prefix}"`);
    } else {
      alert('Failed to save prefix changes.');
    }
  } catch (err) {
    alert('Server error while saving prefix.');
  }
    }
