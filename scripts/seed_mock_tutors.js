const { Client } = require('pg');
const crypto = require('crypto');

const DATABASE_URL = process.env.DATABASE_URL

const CITIES = ['Islamabad', 'Rawalpindi', 'Attock', 'Lahore', 'Karachi'];
const AREAS = {
  'Islamabad': ['Sector G-11', 'Sector F-7', 'DHA Phase 2', 'Bahria Town', 'I-8'],
  'Lahore': ['DHA Phase 5', 'Johar Town', 'Gulberg', 'Model Town', 'Wapda Town'],
  'Karachi': ['Clifton', 'DHA Phase 6', 'Gulshan-e-Iqbal', 'North Nazimabad', 'Tariq Road'],
  'Rawalpindi': ['Saddar', 'Bahria Town Phase 7', 'Westridge', 'Satellite Town'],
  'Attock': ['Pleasure Park', 'Cantt Area', 'People Colony']
};
const GENDERS = ['Male', 'Female'];
const LANGUAGES = ['English', 'Urdu', 'Punjabi', 'Pashto'];
const MODES = ['online', 'home_tuition', 'tutor_home'];

// Dynamic Level and Subject settings mapping
const RANGE_LEVELS = ['Kindergarten', 'Primary', 'Secondary', 'Matric', 'Inter', 'BS/MS'];
const LEVEL_SUBJECTS = {
  'Matric': ['Arts', 'Biology', 'Computer'],
  'Inter': ['Arts', 'Pre-Engineering', 'Pre-Medical', 'Commerce', 'ICs', 'O Levels'],
  'BS/MS': [
    'Mathematics', 'Physics', 'Chemistry', 'Biology', 'English', 'Computer Science', 'Urdu', 'AI', 'Digital Marketing',
    'Data Science', 'Software Engineering', 'Cybersecurity', 'Information Technology', 'Electrical Engineering',
    'Mechanical Engineering', 'Civil Engineering', 'Biotechnology', 'Environmental Sciences', 'Psychology',
    'Sociology', 'Economics', 'Business Administration', 'Finance & Accounting', 'Mass Communication',
    'International Relations', 'Political Science', 'Statistics', 'Architecture', 'Fine Arts', 'Other'
  ]
};

const randomItem = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randomItems = (arr, count) => {
  const shuffled = [...arr].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, count);
};
const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const randomFloat = (min, max) => (Math.random() * (max - min) + min).toFixed(2);

const FIRST_NAMES = {
  'Male': [
    'Ahmad', 'Ali', 'Bilal', 'Hamza', 'Hasnain', 'Mustafa', 'Zain', 'Ausjah', 'Murtaza', 'Aqeel',
    'Abbas', 'Zayan', 'Ibrahim', 'Qambar', 'Ayaan', 'Sulman', 'Haider', 'Hur', 'Asad', 'Imran',
    'Arsalan', 'Mehdi', 'Shehryar', 'Taimoor', 'Kumail', 'Junaid', 'Farhan', 'Saad', 'Nabeel', 'Shahzad'
  ],
  'Female': [
    'Zainab', 'Sana', 'Fatima', 'Ayat', 'Mariam', 'Hina', 'Sara', 'Rida', 'Khadija', 'Sadia',
    'Marziya', 'Amna', 'Maham', 'Eshal', 'Anaya', 'Hania', 'Iqra', 'Nimra', 'Mahnoor', 'Laiba',
    'Zoya', 'Aliza', 'Kinza', 'Wajiha', 'Rimsha', 'Fiza', 'Mehak', 'Jannat', 'Kiran', 'Sakeena'
  ]
};

const LAST_NAMES = [
  'Khan', 'Kardar', 'Bukhari', 'Shah', 'Rizvi', 'Naqvi', 'Malik', 'Butt', 'Sheikh', 'Dar',
  'Ahmed', 'Qureshi', 'Siddiqui', 'Rehman', 'Javed', 'Abbasi', 'Bajwa', 'Chaudhry', 'Gill', 'Lodhi',
  'Mir', 'Raja', 'Tareen', 'Zaidi', 'Ghias', 'Hashmi', 'Farooq', 'Ansari', 'Iqbal', 'Hussain'
];

async function seed() {
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase database. Starting mock tutor seeding with dynamic levels/subjects...');

    // Clear existing mock tutors to prevent unique constraint failures
    console.log('Cleaning up existing mock tutors...');
    await client.query("DELETE FROM public.profiles WHERE id IN (SELECT id FROM auth.users WHERE email LIKE 'mock.tutor.%@findtutor.test')");
    await client.query("DELETE FROM auth.users WHERE email LIKE 'mock.tutor.%@findtutor.test'");

    // Generate 100 tutors
    for (let i = 1; i <= 100; i++) {
      const id = crypto.randomUUID();
      const email = `mock.tutor.${i}@findtutor.test`;
      const gender = randomItem(GENDERS);
      const firstName = randomItem(FIRST_NAMES[gender]);
      const lastName = randomItem(LAST_NAMES);
      const fullName = `${gender === 'Male' ? 'Sir' : 'Miss'} ${firstName} ${lastName}`;

      const city = randomItem(CITIES);
      const area = randomItem(AREAS[city]);
      const hourlyRate = randomInt(1, 12) * 500;
      const experience = randomInt(1, 15);
      const isVerified = Math.random() > 0.3; // 70% verified
      const isImmediate = Math.random() > 0.6; // 40% immediate
      const rating = isVerified ? randomFloat(4.0, 5.0) : randomFloat(0.0, 4.2);
      const reviewsCount = randomInt(0, 50);
      const myModes = randomItems(MODES, randomInt(1, 2));
      const myLanguages = randomItems(LANGUAGES, randomInt(1, 2));

      // Choose a dynamic teaching range
      const startIdx = randomInt(0, 3); // Starts between Kindergarten and Matric
      const endIdx = randomInt(startIdx, 5); // Ends between startIdx and BS/MS
      const activeLevels = RANGE_LEVELS.slice(startIdx, endIdx + 1);

      const bio = `Hi, I am ${fullName}, a dedicated tutor teaching grades ${activeLevels.join(' to ')}. I specialize in home and online coaching.`;

      // 1. Insert into auth.users (so profiles trigger fires and creates profile correctly)
      const rawUserMetaData = JSON.stringify({
        full_name: fullName,
        role: 'tutor'
      });

      await client.query(`
        INSERT INTO auth.users (
          id, instance_id, aud, role, email, encrypted_password, 
          email_confirmed_at, recovery_sent_at, last_sign_in_at, 
          raw_app_meta_data, raw_user_meta_data, created_at, updated_at
        ) VALUES (
          $1, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 
          $2, '$2a$10$wS2CqD6N6b9zBebx2sC8q.fUaKk8i5QZUp.QJ1b0l/2G.uC02lEJu', -- bcrypt for 'password123'
          NOW(), NOW(), NOW(), 
          '{"provider":"email","providers":["email"]}'::jsonb, 
          $3::jsonb, NOW(), NOW()
        )
      `, [id, email, rawUserMetaData]);

      // 2. Update the public.profiles record with tutor specific search fields
      await client.query(`
        UPDATE public.profiles
        SET 
          city = $2,
          area = $3,
          gender = $4,
          hourly_rate = $5,
          experience_years = $6,
          verified = $7,
          immediate_hiring = $8,
          rating = $9,
          reviews_count = $10,
          teaching_modes = $11,
          languages = $12,
          bio = $13,
          onboarding_complete = true,
          onboarding_step = 4
        WHERE id = $1
      `, [
        id, city, area, gender, hourlyRate, experience, isVerified, isImmediate,
        rating, reviewsCount, myModes, myLanguages, bio
      ]);

      // 3. Insert categories dynamically for active levels
      for (const level of activeLevels) {
        const hasSubjects = ['Matric', 'Inter', 'BS/MS'].includes(level);
        const subjects = LEVEL_SUBJECTS[level] || [];

        if (hasSubjects && subjects.length > 0) {
          // Select 1 or 2 random subjects for this level
          const selectedSubs = randomItems(subjects, randomInt(1, 2));
          for (const subject of selectedSubs) {
            await client.query(`
              INSERT INTO public.tutor_categories (tutor_id, level, category, subject)
              VALUES ($1, $2, 'Academic', $3)
              ON CONFLICT DO NOTHING
            `, [id, level, subject]);
          }
        } else {
          // Level without subjects (KG, Primary, Secondary) gets subject = null row
          await client.query(`
            INSERT INTO public.tutor_categories (tutor_id, level, category, subject)
            VALUES ($1, $2, 'Academic', NULL)
            ON CONFLICT DO NOTHING
          `, [id, level]);
        }
      }

      if (i % 20 === 0) {
        console.log(`Generated and inserted ${i}/100 mock tutors...`);
      }
    }

    console.log('Seeding complete! 100 highly diversified mock tutors with dynamic categories are now live.');

  } catch (err) {
    console.error('Seeding failed:', err);
  } finally {
    await client.end();
  }
}

seed();
