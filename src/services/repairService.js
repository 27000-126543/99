const RepairOrder = require('../models/RepairOrder');
const User = require('../models/User');
const DormitoryAssignment = require('../models/DormitoryAssignment');
const NotificationService = require('./notificationService');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

class RepairService {
  static generateOrderNo() {
    const date = moment().format('YYYYMMDDHHmmss');
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    return `RP${date}${random}`;
  }

  static async findSuitableWorker(faultType, buildingId) {
    const faultSkillMap = {
      electrical: ['电工', '电器维修'],
      plumbing: ['水管工', '水暖'],
      furniture: ['木工', '家具维修'],
      appliance: ['电器维修', '家电维修'],
      door_lock: ['锁具维修', '电工'],
      other: ['综合维修'],
    };

    const requiredSkills = faultSkillMap[faultType] || ['综合维修'];

    const workers = await User.find({
      role: 'maintenance',
      status: 'active',
      'maintenanceInfo.skills': { $in: requiredSkills },
    }).sort({ 'maintenanceInfo.currentLoad': 1, 'maintenanceInfo.rating': -1 });

    return workers.length > 0 ? workers[0] : null;
  }

  static async createRepairOrder(student, data) {
    const assignment = await DormitoryAssignment.findOne({
      studentId: student._id,
      status: 'confirmed',
    });

    if (!assignment) {
      throw new AppError('您当前没有入住记录', 400);
    }

    const orderNo = this.generateOrderNo();

    const order = await RepairOrder.create({
      orderNo,
      studentId: student._id,
      dormitoryId: assignment.dormitoryId,
      buildingId: assignment.buildingId,
      faultType: data.faultType,
      description: data.description,
      images: data.images || [],
      urgency: data.urgency || 'medium',
      status: 'pending',
    });

    const worker = await this.findSuitableWorker(data.faultType, assignment.buildingId);

    if (worker) {
      await RepairOrder.findByIdAndUpdate(order._id, {
        status: 'assigned',
        assignedWorkerId: worker._id,
        assignedAt: Date.now(),
      });

      await NotificationService.sendToMaintenance(
        worker._id,
        'repair_assigned',
        '新维修工单',
        `工单${orderNo}：${data.faultType} - ${data.description.substring(0, 30)}`,
        order._id,
        'RepairOrder'
      );
    }

    await NotificationService.sendToStudent(
      student._id,
      'repair_created',
      '报修成功',
      `您的报修工单${orderNo}已提交，我们将尽快安排维修人员`,
      order._id,
      'RepairOrder'
    );

    return await RepairOrder.findById(order._id)
      .populate('studentId', 'realName phone')
      .populate('assignedWorkerId', 'realName phone');
  }

  static async acceptOrder(worker, orderId) {
    const order = await RepairOrder.findById(orderId);

    if (!order) {
      throw new AppError('工单不存在', 404);
    }

    if (order.assignedWorkerId.toString() !== worker._id.toString()) {
      throw new AppError('您无权接单此工单', 403);
    }

    if (order.status !== 'assigned') {
      throw new AppError('工单状态不允许接单', 400);
    }

    const responseTime = Math.round((Date.now() - order.assignedAt.getTime()) / 60000);

    await RepairOrder.findByIdAndUpdate(orderId, {
      status: 'accepted',
      acceptedAt: Date.now(),
      responseTime,
    });

    await User.findByIdAndUpdate(worker._id, {
      $inc: { 'maintenanceInfo.currentLoad': 1 },
    });

    await NotificationService.sendToStudent(
      order.studentId,
      'repair_assigned',
      '维修人员已接单',
      `维修人员已接单，预计很快会到达您的宿舍`,
      order._id,
      'RepairOrder'
    );

    return await RepairOrder.findById(orderId);
  }

  static async completeOrder(worker, orderId, data = {}) {
    const order = await RepairOrder.findById(orderId);

    if (!order) {
      throw new AppError('工单不存在', 404);
    }

    if (order.assignedWorkerId.toString() !== worker._id.toString()) {
      throw new AppError('您无权完成此工单', 403);
    }

    if (!['accepted', 'in_progress'].includes(order.status)) {
      throw new AppError('工单状态不允许完成', 400);
    }

    const completionTime = Math.round((Date.now() - order.acceptedAt.getTime()) / 60000);

    await RepairOrder.findByIdAndUpdate(orderId, {
      status: 'completed',
      completedAt: Date.now(),
      completionTime,
    });

    await User.findByIdAndUpdate(worker._id, {
      $inc: { 'maintenanceInfo.currentLoad': -1 },
    });

    await NotificationService.sendToStudent(
      order.studentId,
      'repair_completed',
      '维修已完成',
      `您的报修工单已完成，请对维修服务进行评价`,
      order._id,
      'RepairOrder'
    );

    return await RepairOrder.findById(orderId);
  }

  static async checkAndEscalateOrders() {
    const timeoutMinutes = parseInt(process.env.MAINTENANCE_TIMEOUT_MINUTES) || 30;
    const cutoffTime = moment().subtract(timeoutMinutes, 'minutes').toDate();

    const pendingOrders = await RepairOrder.find({
      status: 'assigned',
      assignedAt: { $lte: cutoffTime },
      escalationNotified: false,
    }).populate('studentId');

    for (const order of pendingOrders) {
      await RepairOrder.findByIdAndUpdate(order._id, {
        status: 'escalated',
        escalationNotified: true,
      });

      if (order.studentId && order.studentId.studentInfo && order.studentId.studentInfo.counselorId) {
        await NotificationService.sendToCounselor(
          order.studentId.studentInfo.counselorId,
          'repair_escalated',
          '维修工单超时升级',
          `工单${order.orderNo}已超过${timeoutMinutes}分钟未接单，请及时关注处理`,
          order._id,
          'RepairOrder'
        );
      }
    }

    return pendingOrders.length;
  }

  static async rateOrder(student, orderId, rating, feedback) {
    const order = await RepairOrder.findById(orderId);

    if (!order) {
      throw new AppError('工单不存在', 404);
    }

    if (order.studentId.toString() !== student._id.toString()) {
      throw new AppError('您无权评价此工单', 403);
    }

    if (order.status !== 'completed') {
      throw new AppError('工单未完成，无法评价', 400);
    }

    await RepairOrder.findByIdAndUpdate(orderId, { rating, feedback });

    if (order.assignedWorkerId) {
      const worker = await User.findById(order.assignedWorkerId);
      const oldRating = worker.maintenanceInfo.rating || 5;
      const newRating = (oldRating + rating) / 2;
      await User.findByIdAndUpdate(order.assignedWorkerId, {
        'maintenanceInfo.rating': newRating,
      });
    }

    return await RepairOrder.findById(orderId);
  }

  static async getMyOrders(userId, role, status) {
    let query = {};

    if (role === 'student') {
      query.studentId = userId;
    } else if (role === 'maintenance') {
      query.assignedWorkerId = userId;
    } else if (role === 'dorm_manager' || role === 'counselor') {
    }

    if (status) {
      query.status = status;
    }

    return await RepairOrder.find(query)
      .sort({ createdAt: -1 })
      .populate('studentId', 'realName phone')
      .populate('assignedWorkerId', 'realName phone')
      .populate('dormitoryId', 'roomNumber')
      .populate('buildingId', 'name');
  }
}

module.exports = RepairService;
