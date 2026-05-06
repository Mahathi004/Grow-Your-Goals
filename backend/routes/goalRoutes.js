const express = require('express');
const router = express.Router();
const goalController = require('../controllers/goalController');
const { authenticateToken } = require('./authRoutes');

router.use(authenticateToken);

// Goals
router.get('/', goalController.getGoals);
router.post('/', goalController.createGoal);
router.put('/:id', goalController.updateGoal);
router.delete('/:id', goalController.deleteGoal);

// Steps (Since they are nested logic, we keep them here or separate, here is fine)
router.post('/steps', goalController.createStep);
router.put('/steps/:id', goalController.updateStep);
router.delete('/steps/:id', goalController.deleteStep);

module.exports = router;
