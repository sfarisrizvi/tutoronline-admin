const { createClient } = require('@supabase/supabase-js');

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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const filesToMigrate = [
  'm.fahadsuleman@gmail.com/profile/1783330923358.png',
  'nafeesrizvi4@gmail.com/profile/1783428017223.jpg',
  'nafeesrizvi4@gmail.com/profile/1783428018170.png'
];

async function main() {
  console.log('Starting profile media migration...');

  for (const filePath of filesToMigrate) {
    console.log(`Downloading: ${filePath} from teacher-files...`);
    const { data: fileData, error: downloadError } = await supabase.storage
      .from('teacher-files')
      .download(filePath);

    if (downloadError) {
      console.error(`Failed to download ${filePath}:`, downloadError.message);
      continue;
    }

    console.log(`Uploading: ${filePath} to teacher-media...`);
    const { error: uploadError } = await supabase.storage
      .from('teacher-media')
      .upload(filePath, fileData, {
        contentType: filePath.endsWith('.png') ? 'image/png' : 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error(`Failed to upload ${filePath} to teacher-media:`, uploadError.message);
    } else {
      console.log(`Successfully migrated ${filePath} to teacher-media!`);
    }
  }

  console.log('Migration finished.');
}

main();
