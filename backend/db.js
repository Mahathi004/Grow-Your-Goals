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
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS goal_id UUID REFERENCES goals(id) ON DELETE CASCADE;
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS priority VARCHAR(50) DEFAULT 'medium';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS severity VARCHAR(50) DEFAULT 'info';
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS action_link VARCHAR(255);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS category VARCHAR(100);
      ALTER TABLE notifications ADD COLUMN IF NOT EXISTS expires_at TIMESTAMP WITH TIME ZONE;

      -- Google OAuth Migration
      ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(255) UNIQUE;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar_url TEXT;
      ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(50);

      UPDATE users SET auth_provider = 'local' WHERE auth_provider IS NULL AND password_hash IS NOT NULL;
      UPDATE users SET auth_provider = 'google' WHERE auth_provider IS NULL AND google_id IS NOT NULL;

      CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
      CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

      -- Hybrid Auth Migration
      ALTER TABLE users ADD COLUMN IF NOT EXISTS username VARCHAR(50);
      ALTER TABLE users ADD COLUMN IF NOT EXISTS onboarding_completed BOOLEAN DEFAULT FALSE;
      CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username) WHERE username IS NOT NULL;

      -- Mark existing fully-set-up users as onboarding complete
      UPDATE users SET onboarding_completed = true WHERE password_hash IS NOT NULL AND onboarding_completed = false;
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
