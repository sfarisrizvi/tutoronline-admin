// scripts/backup_db.js
// Local DB backup via Supabase REST API
// Run: node scripts/backup_db.js

const https = require('https');
const fs = require('fs');
const path = require('path');

// Read env manually since we're not in Next.js context
const envPath = path.join(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && !key.startsWith('#')) env[key.trim()] = val.join('=').trim();
});

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const SERVICE_KEY  = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
  process.exit(1);
}

// Tables to back up
const TABLES = [
  'profiles',
  'tutor_profiles',
  'client_profiles',
  'tutor_experience',
  'tutor_categories',
  'children',
  'job_posts',
];

// Backup directory: /backups/YYYY-MM-DD_HH-MM-SS/
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').replace('T', '_').substring(0, 19);
const backupDir = path.join(__dirname, '..', 'backups', timestamp);
fs.mkdirSync(backupDir, { recursive: true });

function fetchTable(tableName) {
  return new Promise((resolve, reject) => {
    const url = new URL(`${SUPABASE_URL}/rest/v1/${tableName}?select=*`);
    const options = {
      hostname: url.hostname,
      path: url.pathname + url.search,
      method: 'GET',
      headers: {
        'apikey': SERVICE_KEY,
        'Authorization': `Bearer ${SERVICE_KEY}`,
        'Accept': 'application/json',
        'Prefer': 'count=exact',
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          const count = res.headers['content-range']?.split('/')[1] || parsed.length;
          resolve({ rows: parsed, count });
        } catch (e) {
          reject(new Error(`Failed to parse ${tableName}: ${e.message}\nResponse: ${data.substring(0, 200)}`));
        }
      });
    });

    req.on('error', reject);
    req.end();
  });
}

async function main() {
  console.log(`\n📦 Tuitor App — DB Backup`);
  console.log(`📁 Output: ${backupDir}\n`);

  const manifest = { timestamp, tables: {}, supabase_url: SUPABASE_URL };

  for (const table of TABLES) {
    process.stdout.write(`  Backing up ${table}... `);
    try {
      const { rows, count } = await fetchTable(table);
      const filePath = path.join(backupDir, `${table}.json`);
      fs.writeFileSync(filePath, JSON.stringify(rows, null, 2));
      manifest.tables[table] = { rows: rows.length, file: `${table}.json` };
      console.log(`✅ ${rows.length} rows`);
    } catch (err) {
      console.log(`⚠️  skipped (${err.message.split('\n')[0]})`);
      manifest.tables[table] = { error: err.message.split('\n')[0] };
    }
  }

  // Write manifest
  fs.writeFileSync(
    path.join(backupDir, '_manifest.json'),
    JSON.stringify(manifest, null, 2)
  );

  console.log(`\n✅ Backup complete → backups/${timestamp}/\n`);
}

main().catch(err => {
  console.error('Backup failed:', err.message);
  process.exit(1);
});
