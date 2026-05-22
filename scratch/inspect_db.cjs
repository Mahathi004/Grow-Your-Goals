const { Pool } = require('pg');
require('dotenv').config({ path: '../backend/.env' });

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT),
});

async function main() {
  const client = await pool.connect();
  try {
    const goalsRes = await client.query('SELECT id, title, status, start_date, target_date, is_timeline_ai_generated FROM goals ORDER BY updated_at DESC LIMIT 5');
    console.log('--- LATEST GOALS ---');
    console.log(goalsRes.rows);

    for (const goal of goalsRes.rows) {
      const roadmapsRes = await client.query('SELECT id, goal_id, duration_days, roadmap_version, generated_by_ai, locked FROM roadmaps WHERE goal_id = $1', [goal.id]);
      console.log(`--- ROADMAPS FOR GOAL ${goal.title} (${goal.id}) ---`);
      console.log(roadmapsRes.rows);
    }
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
