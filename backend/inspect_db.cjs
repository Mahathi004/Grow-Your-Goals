const { Pool } = require('pg');
require('dotenv').config();

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
    const sessionRes = await client.query("SELECT messages FROM goal_sessions WHERE goal_id = 'cf618766-ff19-4554-910a-7395f97ae990'");
    console.log('--- MESSAGES ---');
    if (sessionRes.rows.length > 0) {
      console.log(JSON.stringify(sessionRes.rows[0].messages, null, 2));
    } else {
      console.log('No session found');
    }

    const roadmapsRes = await client.query("SELECT id, locked, created_at, roadmap_version FROM roadmaps WHERE goal_id = 'cf618766-ff19-4554-910a-7395f97ae990' ORDER BY created_at DESC");
    console.log('--- ROADMAPS ---');
    console.log(roadmapsRes.rows);
  } catch (err) {
    console.error('Error:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
