const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// 1. Force load and overwrite OS-level environment variables from local .env
const envPath = path.join(__dirname, '.env');
if (fs.existsSync(envPath)) {
  const envConfig = dotenv.parse(fs.readFileSync(envPath));
  for (const k in envConfig) {
    process.env[k] = envConfig[k];
  }
  console.log(`\n[Prisma Studio Helper] Overriding MYSQL_DATABASE_URL to MySQL database...`);
} else {
  console.warn(`\n[Prisma Studio Helper] Warning: .env file not found at ${envPath}`);
}

// 2. Spawn Prisma Studio as a child process inheriting the corrected environment variables
console.log("[Prisma Studio Helper] Launching Prisma Studio (npx prisma studio)...");
const studio = spawn('npx', ['prisma', 'studio'], {
  stdio: 'inherit',
  shell: true,
  env: process.env // Explicitly inherit the overridden environment variables
});

studio.on('close', (code) => {
  console.log(`[Prisma Studio Helper] Prisma Studio exited with code ${code}`);
});
