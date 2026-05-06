const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const jwt = require('jsonwebtoken');

// Auth Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  if (!token) return res.sendStatus(401);

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      // Token invalid or expired
      return res.sendStatus(401);
    }
    req.user = user;
    next();
  });
};

router.post('/signup', authController.signup);
router.post('/login', authController.login);
router.get('/me', authenticateToken, authController.getMe);

module.exports = { router, authenticateToken };
