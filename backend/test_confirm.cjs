const { Pool } = require('pg');
const jwt = require('jsonwebtoken');
const axios = require('axios');
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
    const goalId = 'cf618766-ff19-4554-910a-7395f97ae990';
    const goalRes = await client.query('SELECT user_id FROM goals WHERE id = $1', [goalId]);
    if (goalRes.rows.length === 0) {
      console.log('Goal not found');
      return;
    }
    const userId = goalRes.rows[0].user_id;
    console.log('User ID for goal:', userId);

    const userRes = await client.query('SELECT email FROM users WHERE id = $1', [userId]);
    const email = userRes.rows[0].email;
    console.log('User email:', email);

    // Generate token
    const token = jwt.sign({ id: userId, email: email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    console.log('Token generated:', token);

    // Make POST request
    console.log('Making request...');
    const response = await axios.post('http://localhost:5000/api/ai/chat', {
      confirm: true,
      goalId: goalId,
      overrideValidation: false
    }, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    console.log('Response:', response.data);
  } catch (err) {
    console.error('Error during test:', err.response ? err.response.data : err.message);
  } finally {
    client.release();
    await pool.end();
  }
}

main();
