const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.qlhcavfyllfcwifxbtbu:2Xy8IkpeFkVOE6qf@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const sql = `
-- Add verified column to client_profiles if it does not exist
ALTER TABLE client_profiles ADD COLUMN IF NOT EXISTS verified boolean DEFAULT false;
`;

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('Verified column added to client_profiles successfully.');
  } catch (err) {
    console.error('Error adding verified column:', err.message);
  } finally {
    await client.end();
  }
}

run();
