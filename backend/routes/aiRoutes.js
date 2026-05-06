const express = require('express');
const router = express.Router();
const aiController = require('../controllers/aiController');
const { authenticateToken } = require('./authRoutes');

router.use(authenticateToken);

// AI Engine
router.post('/chat', aiController.chat);
router.get('/today', aiController.getTodayTasks);

// Goal Portfolio
router.get('/goals', aiController.getAllGoals);
router.get('/goals/:id/history', aiController.getGoalHistory);
router.get('/goals/:id', aiController.getGoalById);
router.put('/goals/:id/rename', aiController.renameGoal);
router.put('/goals/:id/archive', aiController.archiveGoal);
router.put('/goals/:id/primary', aiController.setPrimaryGoal);
router.put('/goals/:id/status', aiController.updateGoalStatus);
router.put('/goals/:id/progress', aiController.updateProgress);
router.post('/goals/bulk-delete', aiController.bulkDeleteGoals);
router.post('/goals/bulk-archive', aiController.bulkArchiveGoals);
router.post('/goals/:id/duplicate', aiController.duplicateGoal);
router.post('/goals/:id/finish-setup', aiController.finishGoalSetup);
router.delete('/goals/:id', aiController.deleteGoal);

// Calendar & Bulk
router.get('/calendar', aiController.getCalendar);
router.get('/goals/:id/calendar/:month', aiController.getGoalCalendarByMonth);
router.patch('/tasks/:id/status', aiController.patchTaskStatus);
router.delete('/goals/bulk', aiController.bulkDeleteGoalsActual);

// Task Instances
router.put('/tasks/:id/status', aiController.updateTaskStatus);

module.exports = router;
