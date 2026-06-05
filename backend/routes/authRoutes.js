const express = require('express');
const router  = express.Router();
const authController = require('../controllers/authController');
const jwt = require('jsonwebtoken');

// ─── Auth Middleware ──────────────────────────────────────────────────────────

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) return res.sendStatus(401);
    req.user = user;
    next();
  });
};

// ─── Public Routes ────────────────────────────────────────────────────────────

router.post('/signup',  authController.signupEmail);   // email only → pending account
router.post('/login',   authController.login);          // username/email + password
router.post('/google',  authController.googleAuth);     // Google OAuth

router.get('/check-username', authController.checkUsername); // ?username=xxx

// ─── Protected Routes ─────────────────────────────────────────────────────────

router.post('/complete-onboarding', authenticateToken, authController.completeOnboarding);
router.get('/me', authenticateToken, authController.getMe);

module.exports = { router, authenticateToken };
