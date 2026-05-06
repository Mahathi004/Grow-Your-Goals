const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { authenticateToken } = require('./authRoutes');

router.use(authenticateToken);

router.get('/streak', userController.getStreak);
router.post('/checkin', userController.updateCheckin);

module.exports = router;
