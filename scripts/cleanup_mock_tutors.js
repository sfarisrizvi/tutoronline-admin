const { Client } = require('pg');

const DATABASE_URL = process.env.DATABASE_URL;

async function cleanup() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase database. Starting mock tutor cleanup...');

    // 1. Delete from public.tutor_categories for mock tutors
    console.log('Cleaning up public.tutor_categories...');
    await client.query(`
      DELETE FROM public.tutor_categories 
      WHERE tutor_id IN (
        SELECT id FROM public.profiles 
        WHERE id IN (
          SELECT id FROM auth.users WHERE email LIKE 'mock.tutor.%@findtutor.test'
        )
      )
    `);

    // 2. Delete from public.profiles for mock tutors
    console.log('Cleaning up public.profiles...');
    await client.query(`
      DELETE FROM public.profiles 
      WHERE id IN (
        SELECT id FROM auth.users WHERE email LIKE 'mock.tutor.%@findtutor.test'
      )
    `);

    // 3. Delete from auth.users for mock tutors
    console.log('Cleaning up auth.users...');
    const res = await client.query(`
      DELETE FROM auth.users 
      WHERE email LIKE 'mock.tutor.%@findtutor.test'
    `);

    console.log(`Cleanup complete! Successfully deleted ${res.rowCount} mock tutor accounts and all their associated profile data.`);

  } catch (err) {
    console.error('Cleanup failed:', err);
  } finally {
    await client.end();
  }
}

cleanup();
