const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT),
});

// Test DB connection on startup
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ DB Connection FAILED:', err.message);
    console.error('   Check your .env: user=%s host=%s db=%s port=%s',
      process.env.DB_USER, process.env.DB_HOST, process.env.DB_NAME, process.env.DB_PORT);
  } else {
    console.log('✅ DB connected successfully to:', process.env.DB_NAME);
    release();
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};
