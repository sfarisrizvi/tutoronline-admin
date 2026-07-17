const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.qlhcavfyllfcwifxbtbu:2Xy8IkpeFkVOE6qf@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const sql = `
-- Update trigger function to restrict tutor inserts to 'tutor' role only
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'client' THEN
    INSERT INTO public.client_profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  ELSIF NEW.raw_user_meta_data->>'role' = 'tutor' THEN
    INSERT INTO public.tutor_profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Clean up any existing admin accounts from tutor_profiles
DELETE FROM public.tutor_profiles 
WHERE email IN (
  SELECT email FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
) OR email = 'admin@findtutors.pk';

-- Clean up any admin accounts from client_profiles just in case
DELETE FROM public.client_profiles
WHERE email IN (
  SELECT email FROM auth.users WHERE raw_user_meta_data->>'role' = 'admin'
) OR email = 'admin@findtutors.pk';
`;

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('Trigger and user profile data cleaned up successfully.');
  } catch (err) {
    console.error('Error executing cleanup migration:', err.message);
  } finally {
    await client.end();
  }
}

run();
