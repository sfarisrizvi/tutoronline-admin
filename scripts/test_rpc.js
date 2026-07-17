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
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

const rpcParams = {
  p_city: '',
  p_subjects: null,
  p_levels: null,
  p_gender: '',
  p_verified: false,
  p_immediate_hiring: false,
  p_min_price: null,
  p_max_price: null,
  p_min_experience: null,
  p_modes: null
};

async function run() {
  const { data, error } = await supabase.rpc('search_tutors', rpcParams);
  console.log('Data:', data?.length);
  console.log('Error:', error);
}

run();
