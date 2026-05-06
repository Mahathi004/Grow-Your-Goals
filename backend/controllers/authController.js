const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db');

exports.signup = async (req, res) => {
  try {
    const { email, password, firstName, lastName } = req.body;
    const existing = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(400).json({ error: 'Email already exists' });
    
    const hashedPassword = await bcrypt.hash(password, 10);
    const result = await db.query(
      'INSERT INTO users (email, password_hash, first_name, last_name) VALUES ($1, $2, $3, $4) RETURNING id, email, first_name, last_name',
      [email, hashedPassword, firstName, lastName]
    );
    const user = {
      id: result.rows[0].id,
      email: result.rows[0].email,
      firstName: result.rows[0].first_name,
      lastName: result.rows[0].last_name
    };
    
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (error) {
    console.error('SIGNUP ERROR:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
    if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid credentials' });
    
    const dbUser = result.rows[0];
    const match = await bcrypt.compare(password, dbUser.password_hash);
    if (!match) return res.status(400).json({ error: 'Invalid credentials' });
    
    const user = {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name
    };
    
    const token = jwt.sign({ id: user.id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });
    res.json({ token, user });
  } catch (error) {
    console.error('LOGIN ERROR:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
};

exports.getMe = async (req, res) => {
  try {
    const result = await db.query('SELECT id, email, first_name, last_name FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    
    const dbUser = result.rows[0];
    const user = {
      id: dbUser.id,
      email: dbUser.email,
      firstName: dbUser.first_name,
      lastName: dbUser.last_name
    };
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
