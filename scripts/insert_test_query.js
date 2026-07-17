const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.qlhcavfyllfcwifxbtbu:2Xy8IkpeFkVOE6qf@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    
    const insertRes = await client.query(`
      INSERT INTO public.contact_queries (name, email, phone, role, message, status)
      VALUES (
        'John Doe Support Test', 
        'support-test@findtutors.pk', 
        '+923001234567', 
        'parent_student', 
        'This is a test contact query to verify that the admin panel can retrieve and resolve entries successfully!', 
        'pending'
      )
      RETURNING *
    `);

    console.log('\n✅ Successfully inserted test contact query:');
    console.log(insertRes.rows[0]);
    console.log('');
    
  } catch (err) {
    console.error('Error inserting test query:', err.message);
  } finally {
    await client.end();
  }
}

run();
