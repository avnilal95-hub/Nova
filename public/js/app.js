document.addEventListener('DOMContentLoaded', () => {
  // 1. Sidebar Drawer Toggle
  const menuToggleBtn = document.getElementById('menuToggleBtn');
  const closeSidebarBtn = document.getElementById('closeSidebarBtn');
  const sidebarDrawer = document.getElementById('sidebarDrawer');

  if (menuToggleBtn && sidebarDrawer) {
    menuToggleBtn.addEventListener('click', () => {
      sidebarDrawer.classList.add('open');
    });

    closeSidebarBtn.addEventListener('click', () => {
      sidebarDrawer.classList.remove('open');
    });
  }

  // 2. Menu Item Module Switching
  const menuItems = document.querySelectorAll('.menu-item');
  const tabContents = document.querySelectorAll('.tab-content');

  menuItems.forEach(item => {
    item.addEventListener('click', () => {
      const targetTab = item.getAttribute('data-tab');

      menuItems.forEach(i => i.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      item.classList.add('active');
      const activeContent = document.getElementById(`tab-${targetTab}`);
      if (activeContent) activeContent.classList.add('active');

      // Close sidebar on mobile after choosing a menu option
      if (sidebarDrawer) sidebarDrawer.classList.remove('open');
    });
  });

  // 3. Save Prefix API Trigger
  const savePrefixBtn = document.getElementById('savePrefixBtn');
  if (savePrefixBtn) {
    savePrefixBtn.addEventListener('click', async () => {
      const prefix = document.getElementById('botPrefixInput').value;
      const params = new URLSearchParams(window.location.search);
      const guildId = params.get('guild_id') || 'default';

      try {
        const res = await fetch('/api/prefix', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ guildId, prefix })
        });
        const data = await res.json();
        if (data.success) {
          alert(`Prefix successfully updated to: ${data.prefix}`);
        }
      } catch (err) {
        alert('Failed to update prefix on server.');
      }
    });
  }
});

