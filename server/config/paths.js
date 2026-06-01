const path = require('path');
const fs = require('fs');

// Where persistent data lives. On Railway, attach a Volume and the platform
// sets RAILWAY_VOLUME_MOUNT_PATH automatically (e.g. /data). Locally it falls
// back to the repo's ./data folder. You can also override with DATA_DIR.
//
// IMPORTANT: without a mounted volume the container filesystem is ephemeral —
// every redeploy/restart wipes it. This is the single thing that keeps your
// expenses and uploaded bills from disappearing on Railway.
const DATA_DIR =
  process.env.DATA_DIR ||
  process.env.RAILWAY_VOLUME_MOUNT_PATH ||
  path.join(__dirname, '../../data');

const DB_PATH = path.join(DATA_DIR, 'agthia.db');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');

// Ensure both directories exist
for (const dir of [DATA_DIR, UPLOADS_DIR]) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Surface the resolved location once at boot so it's visible in Railway logs.
const persistent = !!(process.env.RAILWAY_VOLUME_MOUNT_PATH || process.env.DATA_DIR);
console.log(`[storage] data dir: ${DATA_DIR}  (persistent volume: ${persistent ? 'YES' : 'NO — data will reset on restart!'})`);

module.exports = { DATA_DIR, DB_PATH, UPLOADS_DIR };
