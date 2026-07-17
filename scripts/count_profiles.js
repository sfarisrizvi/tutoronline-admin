const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.qlhcavfyllfcwifxbtbu:2Xy8IkpeFkVOE6qf@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    
    // Count auth.users by role in metadata
    const authRes = await client.query(`
      SELECT 
        raw_user_meta_data->>'role' as role_meta,
        COUNT(*) as count
      FROM auth.users
      GROUP BY raw_user_meta_data->>'role'
    `);
    
    // Count client_profiles
    const clientRes = await client.query("SELECT COUNT(*) FROM public.client_profiles");
    
    // Count tutor_profiles
    const tutorRes = await client.query("SELECT COUNT(*) FROM public.tutor_profiles");
    
    // List client_profiles details
    const clientDetails = await client.query("SELECT id, full_name, email, client_type FROM public.client_profiles");

    console.log('\n📊 Database Profile Statistics:\n');
    console.log('--- auth.users Metadata Roles ---');
    authRes.rows.forEach(row => {
      console.log(`   Role: ${row.role_meta || 'NULL/None'} -> ${row.count} users`);
    });
    
    console.log('\n--- Profiles Table Counts ---');
    console.log(`   tutor_profiles:  ${tutorRes.rows[0].count} records`);
    console.log(`   client_profiles: ${clientRes.rows[0].count} records`);
    
    console.log('\n--- Client Profiles Detail ---');
    clientDetails.rows.forEach((c, i) => {
      console.log(`   ${i + 1}. [${c.client_type || 'not set'}] ${c.full_name} (${c.email}) - ID: ${c.id}`);
    });
    console.log('');
    
  } catch (err) {
    console.error('Error querying profiles stats:', err.message);
  } finally {
    await client.end();
  }
}

run();
