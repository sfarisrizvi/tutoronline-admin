const { Client } = require('pg');

const DATABASE_URL = "postgresql://postgres.qlhcavfyllfcwifxbtbu:2Xy8IkpeFkVOE6qf@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres";

const sql = `
-- Drop existing policies if they exist to prevent duplication errors
DROP POLICY IF EXISTS "Admins can view all client profiles" ON client_profiles;
DROP POLICY IF EXISTS "Admins can update all client profiles" ON client_profiles;
DROP POLICY IF EXISTS "Admins can delete client profiles" ON client_profiles;

DROP POLICY IF EXISTS "Admins can update all tutor profiles" ON tutor_profiles;
DROP POLICY IF EXISTS "Admins can delete tutor profiles" ON tutor_profiles;

-- Create policies for client_profiles
CREATE POLICY "Admins can view all client profiles" 
ON client_profiles 
FOR SELECT 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

CREATE POLICY "Admins can update all client profiles" 
ON client_profiles 
FOR UPDATE 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' )
WITH CHECK ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

CREATE POLICY "Admins can delete client profiles" 
ON client_profiles 
FOR DELETE 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

-- Create policies for tutor_profiles
CREATE POLICY "Admins can update all tutor profiles" 
ON tutor_profiles 
FOR UPDATE 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' )
WITH CHECK ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

CREATE POLICY "Admins can delete tutor profiles" 
ON tutor_profiles 
FOR DELETE 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

-- Create policies for contact_queries
DROP POLICY IF EXISTS "Admins can view all contact queries" ON contact_queries;
DROP POLICY IF EXISTS "Admins can update contact queries" ON contact_queries;
DROP POLICY IF EXISTS "Admins can delete contact queries" ON contact_queries;

CREATE POLICY "Admins can view all contact queries" 
ON contact_queries 
FOR SELECT 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

CREATE POLICY "Admins can update contact queries" 
ON contact_queries 
FOR UPDATE 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' )
WITH CHECK ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );

CREATE POLICY "Admins can delete contact queries" 
ON contact_queries 
FOR DELETE 
TO authenticated 
USING ( (auth.jwt() -> 'user_metadata' ->> 'role') = 'admin' );
`;

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  try {
    await client.connect();
    console.log('Connected to database.');
    await client.query(sql);
    console.log('RLS policies updated successfully.');
  } catch (err) {
    console.error('Error updating RLS policies:', err.message);
  } finally {
    await client.end();
  }
}

run();
