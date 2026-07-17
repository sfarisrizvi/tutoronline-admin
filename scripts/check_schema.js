// scripts/check_schema.js — check actual profiles columns
const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && !key.startsWith('#')) env[key.trim()] = val.join('=').trim();
});

const client = new Client({ connectionString: env['DATABASE_URL'], ssl: { rejectUnauthorized: false } });

async function run() {
  await client.connect();
  const { rows } = await client.query(`
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles'
    ORDER BY ordinal_position;
  `);
  console.log('\n📋 profiles columns:\n');
  rows.forEach(r => console.log(`  ${r.column_name.padEnd(28)} ${r.data_type}`));
  await client.end();
}
run().catch(e => { console.error(e.message); process.exit(1); });
