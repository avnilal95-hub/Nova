/**
 * Generates an SVG string matching the dark + cyan layout with diagonal cut
 * @param {string} username - User handle (e.g. "@sasukeuchiha.py")
 * @param {string} avatarUrl - Discord avatar image URL
 * @param {number} level - Current user level
 * @param {number} currentXp - Current XP
 * @param {number} neededXp - Target XP for next level
 * @param {number} rank - User rank position (e.g. 1)
 * @returns {string} SVG markup string
 */
function generateRankSvg(username, avatarUrl, level, currentXp, neededXp, rank = 1) {
  // Ensure display name starts with @ if not present
  const displayName = username.startsWith('@') ? username : `@${username}`;

  // Calculate progress bar width (Max width: 600px)
  const maxBarWidth = 600;
  const progressRatio = Math.min(currentXp / Math.max(neededXp, 1), 1);
  const fillWidth = Math.max(Math.floor(progressRatio * maxBarWidth), 20);

  return `
    <svg width="800" height="230" viewBox="0 0 800 230" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .bg-dark { fill: #22252a; }
          .cyan-accent { fill: #2cb3b2; }
          .bar-bg { fill: #ffffff; rx: 12px; }
          .bar-fill { fill: #2cb3b2; rx: 12px; }
          .text-username { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 32px; font-weight: 700; }
          .text-stats { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 22px; font-weight: 500; }
          .underline-cyan { stroke: #2cb3b2; stroke-width: 3; }
        </style>

        <clipPath id="card-corners">
          <rect width="800" height="230" rx="16" ry="16" />
        </clipPath>

        <clipPath id="avatar-clip">
          <circle cx="85" cy="115" r="50" />
        </clipPath>
      </defs>

      <!-- Base Container with Rounded Corners -->
      <g clip-path="url(#card-corners)">
        <!-- Dark Background -->
        <rect width="800" height="230" class="bg-dark" />

        <!-- Diagonal Cyan Accent Cut (Right Side) -->
        <polygon points="650,0 800,0 800,230 670,230" class="cyan-accent" />

        <!-- Circular User Avatar -->
        <image href="${avatarUrl}" x="35" y="65" width="100" height="100" clip-path="url(#avatar-clip)" />
        <circle cx="85" cy="115" r="50" stroke="#ffffff" stroke-width="2" fill="none" />

        <!-- Username with Cyan Underline -->
        <text x="175" y="75" class="text-username">${displayName}</text>
        <line x1="175" y1="90" x2="520" y2="90" class="underline-cyan" />

        <!-- Stats Row: Level | XP | Rank -->
        <text x="175" y="132" class="text-stats">
          Level: <tspan font-weight="700">${level}</tspan>   XP: <tspan font-weight="700">${currentXp} / ${neededXp}</tspan>   Rank: <tspan font-weight="700">${rank}</tspan>
        </text>

        <!-- Progress Bar Background (White) -->
        <rect x="175" y="155" width="${maxBarWidth}" height="24" class="bar-bg" />

        <!-- Progress Bar Fill (Cyan) -->
        <rect x="175" y="155" width="${fillWidth}" height="24" class="bar-fill" />
      </g>
    </svg>
  `;
}

/**
 * Generates a Level-Up Notification SVG String
 * @param {string} avatarUrl - Discord avatar URL
 * @param {number} oldLevel - Previous level
 * @param {number} newLevel - Newly reached level
 * @returns {string} SVG markup string
 */
function generateLevelUpSvg(avatarUrl, oldLevel, newLevel) {
  return `
    <svg width="340" height="110" viewBox="0 0 340 110" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <style>
          .bg-dark { fill: #22252a; rx: 16px; }
          .text-title { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 28px; font-weight: 800; }
          .text-level { fill: #ffffff; font-family: 'Segoe UI', Arial, sans-serif; font-size: 24px; font-weight: 700; }
        </style>
        <clipPath id="avatar-circle">
          <circle cx="55" cy="55" r="35" />
        </clipPath>
      </defs>

      <!-- Base Card -->
      <rect width="340" height="110" class="bg-dark" />

      <!-- Avatar -->
      <image href="${avatarUrl}" x="20" y="20" width="70" height="70" clip-path="url(#avatar-circle)" />

      <!-- Level Up Title -->
      <text x="120" y="52" class="text-title">Level-up!</text>

      <!-- Level Transition (e.g., "0 • 1") -->
      <text x="170" y="85" class="text-level">${oldLevel}  •  ${newLevel}</text>
    </svg>
  `;
}

module.exports = { generateRankSvg, generateLevelUpSvg };
