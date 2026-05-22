const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT),
});

// Test DB connection and run schema migrations
pool.connect((err, client, release) => {
  if (err) {
    console.error('❌ DB Connection FAILED:', err.message);
    console.error('   Check your .env: user=%s host=%s db=%s port=%s',
      process.env.DB_USER, process.env.DB_HOST, process.env.DB_NAME, process.env.DB_PORT);
  } else {
    console.log('✅ DB connected successfully to:', pool.options.database);
    
    // Add columns if they do not exist
    client.query(`
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS start_date DATE DEFAULT CURRENT_DATE;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_timeline_ai_generated BOOLEAN DEFAULT TRUE;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS timeline_validity VARCHAR(20) DEFAULT 'VALID';
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_aggressive_timeline BOOLEAN DEFAULT FALSE;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS confidence_score INTEGER DEFAULT 75;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS minimum_required_days INTEGER;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS complexity_score INTEGER;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS override_validation BOOLEAN DEFAULT FALSE;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_favorite BOOLEAN DEFAULT FALSE;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS active_context JSONB DEFAULT '{}'::jsonb;
      ALTER TABLE goals ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL;
      ALTER TABLE goal_sessions ADD COLUMN IF NOT EXISTS current_phase VARCHAR(50) DEFAULT 'Phase 1';
    `, (err, res) => {
      release();
      if (err) {
        console.error('❌ DB migration query failed:', err.message);
      } else {
        console.log('✅ Database migration check passed: all validation columns verified.');
        // Run cleanup on startup and set interval
        purgeOldDeletedGoals();
        setInterval(purgeOldDeletedGoals, 6 * 60 * 60 * 1000);
      }
    });
  }
});

const purgeOldDeletedGoals = () => {
  pool.query(`DELETE FROM goals WHERE deleted_at < NOW() - INTERVAL '7 days'`, (err, res) => {
    if (err) {
      console.error('❌ Failed to purge old deleted goals:', err.message);
    } else {
      if (res.rowCount > 0) {
        console.log('✅ Purged soft-deleted goals older than 7 days. Rows affected:', res.rowCount);
      }
    }
  });
};

module.exports = {
  query: (text, params) => pool.query(text, params),
};
