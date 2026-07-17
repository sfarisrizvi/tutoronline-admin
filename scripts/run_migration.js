// scripts/run_migration.js
// Runs the split profiles migration directly via DATABASE_URL
// Usage: node scripts/run_migration.js

const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

const envPath = path.join(__dirname, '..', '.env.local');
const env = {};
fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
  const [key, ...val] = line.split('=');
  if (key && !key.startsWith('#')) env[key.trim()] = val.join('=').trim();
});

const DATABASE_URL = env['DATABASE_URL'];
if (!DATABASE_URL) { console.error('Missing DATABASE_URL'); process.exit(1); }

// Actual profiles columns (no email — join from auth.users):
// id, role, client_type, full_name, city, academic_route, kyc_status,
// connects, jss_score, created_at, phone, avatar_url, cover_url,
// intro_video_url, bio, about, hourly_rate, experience_years, languages,
// onboarding_step, onboarding_complete, teaching_modes, own_place_address,
// own_place_images, service_radius_km, service_cities, availability_days,
// availability_slots, kyc_docs, gender, area, verified, rating,
// immediate_hiring, reviews_count, kyc_verifications (if added)

const MIGRATION_SQL = `

-- ─── 1. Create tutor_profiles ────────────────────────────────
CREATE TABLE IF NOT EXISTS tutor_profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text,
  email               text,
  phone               text,
  city                text,
  area                text,
  gender              text,
  bio                 text,
  about               text,
  avatar_url          text,
  cover_url           text,
  intro_video_url     text,
  hourly_rate         numeric,
  experience_years    int,
  teaching_modes      text[],
  own_place_address   text,
  own_place_images    text[],
  service_radius_km   int DEFAULT 10,
  service_cities      text[],
  languages           text[],
  availability_days   text[],
  availability_slots  jsonb DEFAULT '{}',
  kyc_docs            jsonb DEFAULT '{}',
  kyc_status          text DEFAULT 'pending',
  kyc_verifications   jsonb DEFAULT '{}',
  jss_score           numeric DEFAULT 0,
  connects            int DEFAULT 0,
  rating              numeric,
  reviews_count       int DEFAULT 0,
  immediate_hiring    boolean DEFAULT false,
  onboarding_step     int DEFAULT 1,
  onboarding_complete boolean DEFAULT false,
  verified            boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ─── 2. Create client_profiles ───────────────────────────────
CREATE TABLE IF NOT EXISTS client_profiles (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name           text,
  email               text,
  phone               text,
  city                text,
  client_type         text,
  academic_route      text,
  avatar_url          text,
  onboarding_complete boolean DEFAULT false,
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

-- ─── 3. Enable RLS ───────────────────────────────────────────
ALTER TABLE tutor_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_profiles' AND policyname='Anyone can view tutor profiles') THEN
    CREATE POLICY "Anyone can view tutor profiles" ON tutor_profiles FOR SELECT TO authenticated, anon USING (true);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_profiles' AND policyname='Tutors can update own profile') THEN
    CREATE POLICY "Tutors can update own profile" ON tutor_profiles FOR UPDATE TO authenticated
      USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='tutor_profiles' AND policyname='Tutors can insert own profile') THEN
    CREATE POLICY "Tutors can insert own profile" ON tutor_profiles FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_profiles' AND policyname='Clients can view own profile') THEN
    CREATE POLICY "Clients can view own profile" ON client_profiles FOR SELECT TO authenticated
      USING ((select auth.uid()) = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_profiles' AND policyname='Clients can update own profile') THEN
    CREATE POLICY "Clients can update own profile" ON client_profiles FOR UPDATE TO authenticated
      USING ((select auth.uid()) = id) WITH CHECK ((select auth.uid()) = id);
  END IF;
END $$;
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename='client_profiles' AND policyname='Clients can insert own profile') THEN
    CREATE POLICY "Clients can insert own profile" ON client_profiles FOR INSERT TO authenticated
      WITH CHECK ((select auth.uid()) = id);
  END IF;
END $$;

-- ─── 4. Migrate tutors (join auth.users for email) ───────────
INSERT INTO tutor_profiles (
  id, full_name, email, phone, city, area, gender,
  bio, about, avatar_url, cover_url, intro_video_url,
  hourly_rate, experience_years, teaching_modes,
  own_place_address, own_place_images, service_radius_km, service_cities,
  languages, availability_days, availability_slots,
  kyc_docs, kyc_status,
  jss_score, connects, rating, reviews_count,
  immediate_hiring, onboarding_step, onboarding_complete, verified,
  created_at
)
SELECT
  p.id,
  p.full_name,
  u.email,
  p.phone,
  p.city,
  p.area,
  p.gender,
  p.bio,
  p.about,
  p.avatar_url,
  p.cover_url,
  p.intro_video_url,
  p.hourly_rate,
  p.experience_years,
  p.teaching_modes,
  p.own_place_address,
  p.own_place_images,
  COALESCE(p.service_radius_km, 10),
  p.service_cities,
  p.languages,
  p.availability_days,
  COALESCE(p.availability_slots, '{}'),
  COALESCE(p.kyc_docs, '{}'),
  COALESCE(p.kyc_status, 'pending'),
  COALESCE(p.jss_score, 0),
  COALESCE(p.connects, 0),
  p.rating,
  COALESCE(p.reviews_count, 0),
  COALESCE(p.immediate_hiring, false),
  COALESCE(p.onboarding_step, 1),
  COALESCE(p.onboarding_complete, false),
  COALESCE(p.verified, false),
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'tutor'
ON CONFLICT (id) DO NOTHING;

-- ─── 5. Migrate clients (join auth.users for email) ─────────
INSERT INTO client_profiles (
  id, full_name, email, phone, city,
  client_type, academic_route, avatar_url,
  onboarding_complete, created_at
)
SELECT
  p.id,
  p.full_name,
  u.email,
  p.phone,
  p.city,
  p.client_type,
  p.academic_route,
  p.avatar_url,
  COALESCE(p.onboarding_complete, false),
  p.created_at
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE p.role = 'client'
ON CONFLICT (id) DO NOTHING;

-- ─── 6. Update auth trigger ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  IF NEW.raw_user_meta_data->>'role' = 'client' THEN
    INSERT INTO public.client_profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  ELSE
    INSERT INTO public.tutor_profiles (id, full_name, email)
    VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', ''), NEW.email);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

`;

async function run() {
  const client = new Client({ connectionString: DATABASE_URL, ssl: { rejectUnauthorized: false } });
  console.log('\n🚀 Running profiles split migration...\n');
  try {
    await client.connect();
    console.log('✅ Connected\n');
    await client.query(MIGRATION_SQL);

    const { rows: [tRow] } = await client.query('SELECT COUNT(*) FROM tutor_profiles');
    const { rows: [cRow] } = await client.query('SELECT COUNT(*) FROM client_profiles');

    console.log('✅ Migration complete!\n');
    console.log(`   tutor_profiles:  ${tRow.count} rows migrated`);
    console.log(`   client_profiles: ${cRow.count} rows migrated`);
    console.log('\n💡 To archive old table (run manually when ready):');
    console.log('   ALTER TABLE profiles RENAME TO profiles_archive;\n');
  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

run();
