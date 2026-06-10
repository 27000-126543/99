const express = require('express');
const router = express.Router();
const authController = require('../controllers/authController');
const dormitoryController = require('../controllers/dormitoryController');
const repairController = require('../controllers/repairController');
const electricityController = require('../controllers/electricityController');
const visitorController = require('../controllers/visitorController');
const lateReturnController = require('../controllers/lateReturnController');
const hygieneController = require('../controllers/hygieneController');
const reportController = require('../controllers/reportController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

router.post('/auth/register', authController.register);
router.post('/auth/login', authController.login);

router.use(authMiddleware);

router.get('/auth/me', authController.getMe);
router.put('/auth/profile', authController.updateProfile);
router.put('/auth/password', authController.changePassword);
router.get('/auth/notifications', authController.getNotifications);
router.get('/auth/notifications/unread-stats', authController.getUnreadStats);
router.put('/auth/notifications/:id/read', authController.markNotificationRead);
router.put('/auth/notifications/read-all', authController.markAllNotificationsRead);
router.get('/auth/users/:role', roleMiddleware('admin'), authController.getUsersByRole);

router.get('/dormitory/assignments/me', roleMiddleware('student'), dormitoryController.getMyAssignment);
router.get('/dormitory/assignments/history', roleMiddleware('student'), dormitoryController.getAssignmentHistory);
router.get('/dormitory/available', roleMiddleware('student'), dormitoryController.getAvailableDormitories);
router.get('/dormitory/recommendations', roleMiddleware('student'), dormitoryController.getRecommendations);
router.post('/dormitory/auto-assign', roleMiddleware('student'), dormitoryController.autoAssign);
router.post('/dormitory/select-bed', roleMiddleware('student'), dormitoryController.selectBed);
router.get('/dormitory/buildings', dormitoryController.getBuildingList);
router.get('/dormitory/rooms', dormitoryController.getDormitoryList);
router.post('/dormitory/buildings', roleMiddleware('admin'), dormitoryController.createBuilding);
router.post('/dormitory/rooms', roleMiddleware('admin'), dormitoryController.createDormitory);

router.post('/dormitory/transfer', roleMiddleware('student'), dormitoryController.createTransferRequest);
router.get('/dormitory/transfer', dormitoryController.getTransferRequests);
router.put('/dormitory/transfer/:id/approve', roleMiddleware('counselor', 'dorm_manager', 'admin'), dormitoryController.approveTransferRequest);
router.put('/dormitory/transfer/:id/reject', roleMiddleware('counselor', 'dorm_manager', 'admin'), dormitoryController.rejectTransferRequest);
router.put('/dormitory/transfer/:id/cancel', roleMiddleware('student'), dormitoryController.cancelTransferRequest);
router.post('/dormitory/checkout', roleMiddleware('student'), dormitoryController.checkOutDormitory);

router.post('/repair/orders', roleMiddleware('student'), repairController.createOrder);
router.get('/repair/orders', repairController.getMyOrders);
router.get('/repair/orders/:id', repairController.getOrderById);
router.put('/repair/orders/:id/accept', roleMiddleware('maintenance'), repairController.acceptOrder);
router.put('/repair/orders/:id/start', roleMiddleware('maintenance'), repairController.startOrder);
router.put('/repair/orders/:id/complete', roleMiddleware('maintenance'), repairController.completeOrder);
router.put('/repair/orders/:id/rate', roleMiddleware('student'), repairController.rateOrder);
router.put('/repair/orders/:id/cancel', roleMiddleware('student'), repairController.cancelOrder);

router.get('/electricity/account/me', roleMiddleware('student'), electricityController.getMyAccount);
router.get('/electricity/account/:dormitoryId', electricityController.getAccountByDormitory);
router.post('/electricity/recharge/me', roleMiddleware('student'), electricityController.rechargeMyDormitory);
router.post('/electricity/recharge', roleMiddleware('admin', 'dorm_manager'), electricityController.recharge);
router.post('/electricity/consume', roleMiddleware('admin'), electricityController.consume);
router.get('/electricity/transactions/me', roleMiddleware('student'), electricityController.getMyTransactionHistory);
router.get('/electricity/transactions/:dormitoryId', electricityController.getTransactionHistory);
router.post('/electricity/account', roleMiddleware('admin'), electricityController.createAccount);

router.post('/visitors', roleMiddleware('student'), visitorController.createRequest);
router.get('/visitors/me', roleMiddleware('student'), visitorController.getMyVisitors);
router.get('/visitors', visitorController.getVisitorList);
router.get('/visitors/timeslots', visitorController.getAvailableTimeSlots);
router.get('/visitors/current/:buildingId', visitorController.getCurrentCount);
router.put('/visitors/:id/approve', roleMiddleware('dorm_manager', 'admin'), visitorController.approveVisitor);
router.put('/visitors/:id/reject', roleMiddleware('dorm_manager', 'admin'), visitorController.rejectVisitor);
router.post('/visitors/checkin', visitorController.checkIn);
router.put('/visitors/:id/checkout', visitorController.checkOut);

router.post('/access/record', roleMiddleware('admin', 'dorm_manager', 'security'), lateReturnController.recordAccess);
router.get('/access/records', lateReturnController.getAccessRecords);
router.get('/late-returns/me', roleMiddleware('student'), lateReturnController.getMyLateReturns);
router.get('/late-returns/counselor', roleMiddleware('counselor'), lateReturnController.getCounselorLateReturns);
router.get('/interview-tasks', lateReturnController.getInterviewTasks);
router.put('/interview-tasks/:id/schedule', roleMiddleware('counselor'), lateReturnController.scheduleInterview);
router.put('/interview-tasks/:id/complete', roleMiddleware('counselor'), lateReturnController.completeInterview);

router.post('/hygiene/generate-tasks', roleMiddleware('admin'), hygieneController.generateWeeklyTasks);
router.get('/hygiene/pending', hygieneController.getPendingTasks);
router.put('/hygiene/tasks/:id/submit', roleMiddleware('dorm_manager', 'admin'), hygieneController.submitInspection);
router.get('/hygiene/history', hygieneController.getInspectionHistory);
router.get('/hygiene/me', roleMiddleware('student'), hygieneController.getMyDormitoryHygiene);
router.get('/hygiene/building', hygieneController.getBuildingInspections);
router.put('/hygiene/dormitories/:id/unlock', roleMiddleware('admin', 'counselor'), hygieneController.unlockDormitorySelection);

router.get('/reports/generate/daily', roleMiddleware('admin'), reportController.generateDailyReport);
router.get('/reports/generate/building', roleMiddleware('admin'), reportController.generateBuildingReport);
router.get('/reports', reportController.getReports);
router.get('/reports/comparison', reportController.getBuildingComparison);
router.get('/reports/export', reportController.exportReport);
router.get('/reports/dashboard', reportController.getDashboardData);

module.exports = router;
