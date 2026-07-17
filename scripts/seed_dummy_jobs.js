const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Load env vars
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  fs.readFileSync(envPath, 'utf8').split('\n').forEach(line => {
    const [key, ...val] = line.split('=');
    if (key && !key.startsWith('#')) {
      process.env[key.trim()] = val.join('=').trim();
    }
  });
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error('DATABASE_URL is not set');
  process.exit(1);
}

const DUMMY_JOBS = [
  {
    title: 'Need O-Level Physics Tutor',
    subject: 'Physics',
    mode: 'online',
    budget_type: 'hourly',
    budget_amount: 3500
  },
  {
    title: 'Home Tutor for A-Level Chemistry in DHA',
    subject: 'Chemistry',
    mode: 'home',
    budget_type: 'hourly',
    budget_amount: 4500
  },
  {
    title: 'FSc Part 2 Mathematics Crash Course',
    subject: 'Mathematics',
    mode: 'online',
    budget_type: 'fixed',
    budget_amount: 25000
  },
  {
    title: 'MDCAT Biology Prep Specialist Needed',
    subject: 'Biology',
    mode: 'online',
    budget_type: 'hourly',
    budget_amount: 5000
  },
  {
    title: 'English Spoken Classes for Matric Student',
    subject: 'English',
    mode: 'home',
    budget_type: 'fixed',
    budget_amount: 15000
  },
  {
    title: 'Computer Science (Java & OOP) University Level',
    subject: 'Computer Science',
    mode: 'online',
    budget_type: 'hourly',
    budget_amount: 4000
  }
];

async function main() {
  const client = new Client({ connectionString });
  await client.connect();

  try {
    // 1. Get a client user ID from client_profiles
    const { rows: clientUsers } = await client.query(
      "SELECT id FROM public.client_profiles LIMIT 1"
    );

    if (clientUsers.length === 0) {
      console.error('No client user found in public.client_profiles. Please register a client first.');
      process.exit(1);
    }

    const clientId = clientUsers[0].id;
    console.log(`Using client ID ${clientId} to seed dummy jobs...`);

    // 2. Clear existing dummy jobs to prevent duplication
    await client.query("DELETE FROM public.jobs WHERE client_id = $1", [clientId]);
    console.log('Cleared old dummy jobs.');

    // 3. Insert new dummy jobs
    for (const job of DUMMY_JOBS) {
      await client.query(
        `INSERT INTO public.jobs (client_id, title, subject, mode, budget_type, budget_amount, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'open')`,
        [clientId, job.title, job.subject, job.mode, job.budget_type, job.budget_amount]
      );
      console.log(`Inserted job: "${job.title}"`);
    }

    console.log('Dummy jobs seeded successfully!');
  } catch (err) {
    console.error('Error seeding dummy jobs:', err);
  } finally {
    await client.end();
  }
}

main();
