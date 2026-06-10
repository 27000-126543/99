const Visitor = require('../models/Visitor');
const Building = require('../models/Building');
const DormitoryAssignment = require('../models/DormitoryAssignment');
const User = require('../models/User');
const NotificationService = require('./notificationService');
const { AppError } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');
const moment = require('moment');

class VisitorService {
  static generatePassCode() {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }

  static async getAvailableTimeSlots(buildingId, date) {
    const building = await Building.findById(buildingId);
    if (!building) {
      throw new AppError('楼栋不存在', 404);
    }

    const now = moment();
    const maxVisitors = building.maxVisitors || parseInt(process.env.MAX_VISITORS_PER_BUILDING) || 20;
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    const currentVisitors = await Visitor.countDocuments({
      buildingId,
      status: { $in: ['approved', 'checked_in'] },
      $or: [
        { scheduledStartTime: { $gte: startOfDay, $lte: endOfDay } },
        { scheduledEndTime: { $gte: startOfDay, $lte: endOfDay } },
      ],
    });

    const slots = [];
    let currentTime = moment(date).hour(8).minute(0);
    const endTime = moment(date).hour(21).minute(0);
    const slotDuration = 60;

    while (currentTime.isBefore(endTime)) {
      const slotStart = currentTime.toDate();
      const slotEnd = currentTime.clone().add(slotDuration, 'minutes').toDate();

      const slotVisitors = await Visitor.countDocuments({
        buildingId,
        status: { $in: ['approved', 'checked_in'] },
        scheduledStartTime: { $lt: slotEnd },
        scheduledEndTime: { $gt: slotStart },
      });

      const isPast = currentTime.isBefore(now);

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        available: slotVisitors < maxVisitors && !isPast,
        remaining: maxVisitors - slotVisitors,
        isPast,
      });

      currentTime = currentTime.add(slotDuration, 'minutes');
    }

    const availableSlots = slots.filter((s) => s.available).sort((a, b) => {
      const diffA = a.startTime.getTime() - now.valueOf();
      const diffB = b.startTime.getTime() - now.valueOf();
      return diffA - diffB;
    });

    return {
      maxVisitors,
      currentVisitors,
      slots,
      availableSlots,
      date,
    };
  }

  static async getNextAvailableSlot(buildingId) {
    const now = moment();
    let checkDate = now.clone().startOf('day');
    const maxDaysToCheck = 7;

    for (let i = 0; i < maxDaysToCheck; i++) {
      const slotData = await this.getAvailableTimeSlots(buildingId, checkDate.toDate());
      if (slotData.availableSlots.length > 0) {
        return {
          date: checkDate.toDate(),
          slot: slotData.availableSlots[0],
          slotData,
        };
      }
      checkDate = checkDate.add(1, 'days');
    }

    return null;
  }

  static async getCurrentVisitorCount(buildingId) {
    return await Visitor.countDocuments({
      buildingId,
      status: 'checked_in',
      actualCheckOutTime: null,
    });
  }

  static async createVisitorRequest(student, data) {
    const assignment = await DormitoryAssignment.findOne({
      studentId: student._id,
      status: 'confirmed',
    });

    if (!assignment) {
      throw new AppError('您当前没有入住记录', 400);
    }

    const buildingId = data.buildingId || assignment.buildingId;
    const dormitoryId = assignment.dormitoryId;

    const building = await Building.findById(buildingId);
    if (!building) {
      throw new AppError('楼栋不存在', 404);
    }

    let startTime, endTime;
    const hasSpecifiedTime = data.scheduledStartTime && data.scheduledEndTime;

    if (hasSpecifiedTime) {
      startTime = new Date(data.scheduledStartTime);
      endTime = new Date(data.scheduledEndTime);

      if (startTime >= endTime) {
        throw new AppError('结束时间必须晚于开始时间', 400);
      }

      const durationMinutes = (endTime - startTime) / 60000;
      const maxDuration = parseInt(process.env.VISITOR_PASS_DURATION_MINUTES) || 120;
      if (durationMinutes > maxDuration) {
        throw new AppError(`访问时长不能超过${maxDuration}分钟`, 400);
      }
    } else {
      const nextAvailable = await this.getNextAvailableSlot(buildingId);
      if (!nextAvailable) {
        throw new AppError('未来7天内暂无可用时段，请稍后再试', 400);
      }

      const bestSlot = nextAvailable.slot;
      startTime = bestSlot.startTime;
      const defaultDuration = Math.min(
        parseInt(process.env.VISITOR_PASS_DURATION_MINUTES) || 60,
        (bestSlot.endTime - bestSlot.startTime) / 60000
      );
      endTime = new Date(startTime.getTime() + defaultDuration * 60000);
    }

    const slotStart = moment(startTime).startOf('hour').toDate();
    const slotEnd = moment(startTime).add(1, 'hour').toDate();

    const slotVisitors = await Visitor.countDocuments({
      buildingId,
      status: { $in: ['approved', 'checked_in'] },
      scheduledStartTime: { $lt: slotEnd },
      scheduledEndTime: { $gt: slotStart },
    });

    const maxVisitors = building.maxVisitors || parseInt(process.env.MAX_VISITORS_PER_BUILDING) || 20;
    if (slotVisitors >= maxVisitors) {
      const availableSlots = await this.getAvailableTimeSlots(buildingId, startTime);
      return {
        success: false,
        message: '该时段访客已满，请选择其他时段',
        availableSlots: availableSlots.availableSlots,
      };
    }

    const visitor = await Visitor.create({
      visitorName: data.visitorName,
      visitorPhone: data.visitorPhone,
      visitorIdCard: data.visitorIdCard,
      visitorType: data.visitorType || 'other',
      hostStudentId: student._id,
      buildingId,
      dormitoryId,
      purpose: data.purpose,
      scheduledStartTime: startTime,
      scheduledEndTime: endTime,
      status: 'pending',
    });

    if (building.managerId) {
      await NotificationService.sendToDormManager(
        building.managerId,
        'visitor_pending',
        '新访客申请',
        `${data.visitorName}申请访问${student.realName}，请及时审核`,
        visitor._id,
        'Visitor'
      );
    }

    const result = await Visitor.findById(visitor._id)
      .populate('hostStudentId', 'realName phone')
      .populate('buildingId', 'name');

    return {
      success: true,
      autoSelectedTime: !hasSpecifiedTime,
      autoSelectedDate: !hasSpecifiedTime ? moment(startTime).format('YYYY-MM-DD') : null,
      data: result,
    };
  }

  static async approveVisitor(manager, visitorId) {
    const visitor = await Visitor.findById(visitorId);

    if (!visitor) {
      throw new AppError('访客申请不存在', 404);
    }

    if (visitor.status !== 'pending') {
      throw new AppError('该申请已处理', 400);
    }

    const passCode = this.generatePassCode();
    const passCodeExpiresAt = visitor.scheduledEndTime;

    await Visitor.findByIdAndUpdate(visitorId, {
      status: 'approved',
      passCode,
      passCodeExpiresAt,
      approvedBy: manager._id,
    });

    await NotificationService.sendToStudent(
      visitor.hostStudentId,
      'visitor_approved',
      '访客申请已通过',
      `访客通行码：${passCode}，有效期至${moment(passCodeExpiresAt).format('YYYY-MM-DD HH:mm')}`,
      visitor._id,
      'Visitor'
    );

    return await Visitor.findById(visitorId);
  }

  static async rejectVisitor(manager, visitorId, reason) {
    const visitor = await Visitor.findById(visitorId);

    if (!visitor) {
      throw new AppError('访客申请不存在', 404);
    }

    if (visitor.status !== 'pending') {
      throw new AppError('该申请已处理', 400);
    }

    await Visitor.findByIdAndUpdate(visitorId, {
      status: 'rejected',
      rejectedReason: reason,
    });

    await NotificationService.sendToStudent(
      visitor.hostStudentId,
      'visitor_denied',
      '访客申请被拒绝',
      `拒绝原因：${reason || '不符合访问要求'}`,
      visitor._id,
      'Visitor'
    );

    return await Visitor.findById(visitorId);
  }

  static async checkInVisitor(passCode) {
    const visitor = await Visitor.findOne({
      passCode,
      status: 'approved',
      passCodeExpiresAt: { $gt: Date.now() },
    });

    if (!visitor) {
      throw new AppError('无效或过期的通行码', 400);
    }

    await Visitor.findByIdAndUpdate(visitor._id, {
      status: 'checked_in',
      actualCheckInTime: Date.now(),
    });

    return await Visitor.findById(visitor._id);
  }

  static async checkOutVisitor(visitorId) {
    const visitor = await Visitor.findById(visitorId);

    if (!visitor) {
      throw new AppError('访客记录不存在', 404);
    }

    if (visitor.status !== 'checked_in') {
      throw new AppError('访客未登记进入', 400);
    }

    await Visitor.findByIdAndUpdate(visitorId, {
      status: 'checked_out',
      actualCheckOutTime: Date.now(),
    });

    return await Visitor.findById(visitorId);
  }

  static async checkOverdueVisitors() {
    const now = new Date();

    const overdueVisitors = await Visitor.find({
      status: 'checked_in',
      scheduledEndTime: { $lt: now },
      securityNotified: false,
    }).populate('buildingId');

    for (const visitor of overdueVisitors) {
      await Visitor.findByIdAndUpdate(visitor._id, {
        status: 'overdue',
        securityNotified: true,
      });

      const securityUsers = await User.find({ role: 'security', status: 'active' });
      for (const security of securityUsers) {
        await NotificationService.sendToSecurity(
          security._id,
          'visitor_overdue',
          '访客超时未离',
          `访客${visitor.visitorName}在${visitor.buildingId.name}超时未离开，请及时处理`,
          visitor._id,
          'Visitor'
        );
      }
    }

    return overdueVisitors.length;
  }

  static async getVisitorList(buildingId, status, date) {
    let query = {};

    if (buildingId) {
      query.buildingId = buildingId;
    }

    if (status) {
      query.status = status;
    }

    if (date) {
      const startOfDay = moment(date).startOf('day').toDate();
      const endOfDay = moment(date).endOf('day').toDate();
      query.scheduledStartTime = { $gte: startOfDay, $lte: endOfDay };
    }

    return await Visitor.find(query)
      .sort({ createdAt: -1 })
      .populate('hostStudentId', 'realName phone')
      .populate('buildingId', 'name');
  }
}

module.exports = VisitorService;
