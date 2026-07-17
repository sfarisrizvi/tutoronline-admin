const { Client } = require('pg');

const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = val.join('=').trim();
    }
  });
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL is not set in environment or .env.local');
    process.exit(1);
  }
  const client = new Client({
    connectionString
  });
  await client.connect();
  
  try {
    console.log('Creating teacher-media bucket...');
    await client.query(`
      insert into storage.buckets (id, name, public)
      values ('teacher-media', 'teacher-media', true)
      on conflict (id) do nothing;
    `);

    console.log('Creating select policy for teacher-media...');
    await client.query(`
      drop policy if exists "Anyone can view teacher media" on storage.objects;
      create policy "Anyone can view teacher media"
        on storage.objects for select
        using ( bucket_id = 'teacher-media' );
    `);

    console.log('Creating insert policy for teacher-media...');
    await client.query(`
      drop policy if exists "Tutors can upload their own media" on storage.objects;
      create policy "Tutors can upload their own media"
        on storage.objects for insert
        with check (
          bucket_id = 'teacher-media' AND
          auth.role() = 'authenticated'
        );
    `);

    console.log('Creating delete policy for teacher-media...');
    await client.query(`
      drop policy if exists "Tutors can delete their own media" on storage.objects;
      create policy "Tutors can delete their own media"
        on storage.objects for delete
        using (
          bucket_id = 'teacher-media' AND
          auth.role() = 'authenticated'
        );
    `);

    console.log('Database bucket and storage RLS policies set up successfully!');
  } catch (err) {
    console.error('Error setting up storage:', err);
  } finally {
    await client.end();
  }
}

main();
