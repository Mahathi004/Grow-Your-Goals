const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const db = require('../db');

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID);

// ─── Helpers ─────────────────────────────────────────────────────────────────

function issueJWT(user) {
  return jwt.sign(
    {
      id: user.id,
      email: user.email,
      onboardingCompleted: user.onboarding_completed,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
}

function formatUser(dbUser) {
  return {
    id:                  dbUser.id,
    email:               dbUser.email,
    username:            dbUser.username,
    firstName:           dbUser.first_name,
    lastName:            dbUser.last_name,
    avatarUrl:           dbUser.avatar_url,
    authProvider:        dbUser.auth_provider,
    onboardingCompleted: dbUser.onboarding_completed,
  };
}

// ─── POST /auth/signup ────────────────────────────────────────────────────────
// New manual user — email only, creates a pending account, returns JWT with
// onboardingCompleted: false so the route guard sends them to /onboarding.

exports.signupEmail = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email address is required.' });
    }

    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email.toLowerCase()]);

    if (existing.rows.length > 0) {
      const eu = existing.rows[0];
      if (eu.onboarding_completed) {
        return res.status(409).json({ error: 'An account with this email already exists. Please sign in.' });
      }
      // Pending account — allow them to continue onboarding
      const token = issueJWT(eu);
      return res.json({ token, user: formatUser(eu), onboardingCompleted: false });
    }

    const result = await db.query(
      `INSERT INTO users (email, auth_provider, onboarding_completed)
       VALUES ($1, 'local', false) RETURNING *`,
      [email.toLowerCase()]
    );

    const user = result.rows[0];
    const token = issueJWT(user);
    return res.json({ token, user: formatUser(user), onboardingCompleted: false });

  } catch (error) {
    console.error('SIGNUP EMAIL ERROR:', error);
    return res.status(500).json({ error: 'Signup failed. Please try again.' });
  }
};

// ─── POST /auth/login ─────────────────────────────────────────────────────────
// Returning user — username or email + password.

exports.login = async (req, res) => {
  try {
    const { identifier, password } = req.body;
    if (!identifier || !password) {
      return res.status(400).json({ error: 'Username/email and password are required.' });
    }

    const result = await db.query(
      `SELECT * FROM users
       WHERE (username = $1 OR email = $1) AND onboarding_completed = true`,
      [identifier.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const dbUser = result.rows[0];

    if (!dbUser.password_hash) {
      return res.status(401).json({
        error: 'This account uses Google sign-in. Please use "Continue with Google".',
      });
    }

    const match = await bcrypt.compare(password, dbUser.password_hash);
    if (!match) {
      return res.status(401).json({ error: 'Invalid credentials.' });
    }

    const token = issueJWT(dbUser);
    return res.json({ token, user: formatUser(dbUser) });

  } catch (error) {
    console.error('LOGIN ERROR:', error);
    return res.status(500).json({ error: 'Login failed. Please try again.' });
  }
};

// ─── POST /auth/google ────────────────────────────────────────────────────────
// Google OAuth — verify token, upsert user, return JWT.
// If new user or incomplete onboarding → onboardingCompleted: false → /onboarding.
// If fully set up → onboardingCompleted: true → /dashboard.

exports.googleAuth = async (req, res) => {
  try {
    const { credential } = req.body;
    if (!credential) {
      return res.status(400).json({ error: 'Google credential token is required.' });
    }

    // Verify server-side — NEVER trust manually decoded tokens
    let ticket;
    try {
      ticket = await client.verifyIdToken({
        idToken:  credential,
        audience: process.env.GOOGLE_CLIENT_ID,
      });
    } catch (verifyErr) {
      console.error('Google token verification failed:', verifyErr.message);
      return res.status(401).json({ error: 'Invalid Google token. Please try signing in again.' });
    }

    const payload = ticket.getPayload();

    if (!payload.email_verified) {
      return res.status(403).json({
        error: 'Your Google account email is not verified. Please verify it first.',
      });
    }

    const googleId  = payload.sub; // stable — never changes
    const email     = payload.email;
    const name      = payload.name || '';
    const picture   = payload.picture || null;
    const nameParts = name.trim().split(/\s+/);
    const firstName = nameParts[0] || '';
    const lastName  = nameParts.slice(1).join(' ') || '';

    // Optional domain restriction — uncomment to enable:
    // const allowedDomain = 'yourdomain.com';
    // if (!email.endsWith(`@${allowedDomain}`)) {
    //   return res.status(403).json({ error: `Only @${allowedDomain} accounts are permitted.` });
    // }

    let dbUser = null;

    // Step A: find by google_id (most reliable)
    const byGoogleId = await db.query('SELECT * FROM users WHERE google_id = $1', [googleId]);

    if (byGoogleId.rows.length > 0) {
      // Known Google user — refresh avatar
      const updated = await db.query(
        'UPDATE users SET avatar_url = $1 WHERE google_id = $2 RETURNING *',
        [picture, googleId]
      );
      dbUser = updated.rows[0];

    } else {
      // Step B: find by email
      const byEmail = await db.query('SELECT * FROM users WHERE email = $1', [email]);

      if (byEmail.rows.length > 0) {
        // Link Google to existing account
        const updated = await db.query(
          `UPDATE users
           SET google_id  = $1,
               avatar_url = $2,
               auth_provider = CASE
                 WHEN onboarding_completed = true AND auth_provider IN ('local','both') THEN 'both'
                 ELSE auth_provider
               END
           WHERE email = $3
           RETURNING *`,
          [googleId, picture, email]
        );
        dbUser = updated.rows[0];

      } else {
        // Step C: brand new user — pending account, needs onboarding
        const created = await db.query(
          `INSERT INTO users
             (email, first_name, last_name, google_id, avatar_url, auth_provider, onboarding_completed)
           VALUES ($1, $2, $3, $4, $5, 'google', false)
           RETURNING *`,
          [email, firstName, lastName, googleId, picture]
        );
        dbUser = created.rows[0];
      }
    }

    const token = issueJWT(dbUser);
    return res.json({
      token,
      user: formatUser(dbUser),
      onboardingCompleted: dbUser.onboarding_completed,
    });

  } catch (error) {
    console.error('GOOGLE AUTH ERROR:', error);
    return res.status(500).json({ error: 'Authentication failed. Please try again.' });
  }
};

// ─── POST /auth/complete-onboarding (protected) ───────────────────────────────
// Sets username + password, activates the account, returns fresh JWT.

exports.completeOnboarding = async (req, res) => {
  try {
    const { username, password } = req.body;
    const userId = req.user.id;

    // Validate username: 3–20 chars, letters/numbers/underscore only
    if (!username || !/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.status(400).json({
        error: 'Username must be 3–20 characters and contain only letters, numbers, or underscores.',
      });
    }

    // Validate password
    if (!password || password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters.' });
    }

    // Check username uniqueness
    const taken = await db.query(
      'SELECT id FROM users WHERE username = $1 AND id != $2',
      [username.toLowerCase(), userId]
    );
    if (taken.rows.length > 0) {
      return res.status(409).json({ error: 'That username is already taken. Please choose another.' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    const result = await db.query(
      `UPDATE users
       SET username             = $1,
           password_hash        = $2,
           onboarding_completed = true,
           auth_provider        = CASE
             WHEN google_id IS NOT NULL THEN 'both'
             ELSE 'local'
           END
       WHERE id = $3
       RETURNING *`,
      [username.toLowerCase(), hashedPassword, userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'User not found.' });
    }

    const dbUser = result.rows[0];
    const token  = issueJWT(dbUser);

    return res.json({ token, user: formatUser(dbUser) });

  } catch (error) {
    console.error('COMPLETE ONBOARDING ERROR:', error);
    return res.status(500).json({ error: 'Failed to complete setup. Please try again.' });
  }
};

// ─── GET /auth/check-username ─────────────────────────────────────────────────
// Live username availability check (used during onboarding).

exports.checkUsername = async (req, res) => {
  try {
    const { username } = req.query;

    if (!username) return res.json({ available: false, reason: 'Username required.' });

    if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
      return res.json({ available: false, reason: 'Must be 3–20 chars: letters, numbers, underscore.' });
    }

    const result = await db.query(
      'SELECT id FROM users WHERE username = $1',
      [username.toLowerCase()]
    );

    return res.json({ available: result.rows.length === 0 });

  } catch (error) {
    return res.status(500).json({ error: 'Could not check username.' });
  }
};

// ─── GET /auth/me (protected) ─────────────────────────────────────────────────

exports.getMe = async (req, res) => {
  try {
    const result = await db.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    return res.json(formatUser(result.rows[0]));
  } catch (error) {
    return res.status(500).json({ error: 'Server error' });
  }
};
