const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.qlhcavfyllfcwifxbtbu:2Xy8IkpeFkVOE6qf@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    
    // Check active policies on contact_queries
    const polRes = await client.query(`
      SELECT policyname, cmd, roles 
      FROM pg_policies 
      WHERE tablename = 'contact_queries'
    `);
    
    // Count contact_queries
    const countRes = await client.query("SELECT COUNT(*) FROM public.contact_queries");
    
    // Select recent queries
    const rowsRes = await client.query("SELECT id, name, email, message, status, created_at FROM public.contact_queries ORDER BY created_at DESC LIMIT 5");

    console.log('\n🔍 contact_queries Policies & Table Data:\n');
    console.log('--- Active Policies ---');
    polRes.rows.forEach(p => {
      console.log(`- Policy: "${p.policyname}" | Cmd: ${p.cmd} | Roles: ${p.roles}`);
    });
    
    console.log(`\nTotal queries in DB: ${countRes.rows[0].count}`);
    
    console.log('\n--- Recent Queries in DB ---');
    rowsRes.rows.forEach((q, idx) => {
      console.log(`${idx + 1}. [Status: ${q.status}] ${q.name} (${q.email})`);
      console.log(`   Message: "${q.message.substring(0, 60)}..."`);
      console.log(`   Submitted At: ${q.created_at}\n`);
    });
    
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await client.end();
  }
}

run();
