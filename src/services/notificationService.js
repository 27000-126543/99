const Notification = require('../models/Notification');

class NotificationService {
  static async createNotification(data) {
    const notification = await Notification.create(data);
    return notification;
  }

  static async sendToStudent(studentId, type, title, content, relatedId, relatedModel) {
    return this.createNotification({
      recipientId: studentId,
      recipientRole: 'student',
      type,
      title,
      content,
      relatedId,
      relatedModel,
    });
  }

  static async sendToCounselor(counselorId, type, title, content, relatedId, relatedModel) {
    return this.createNotification({
      recipientId: counselorId,
      recipientRole: 'counselor',
      type,
      title,
      content,
      relatedId,
      relatedModel,
    });
  }

  static async sendToDormManager(managerId, type, title, content, relatedId, relatedModel) {
    return this.createNotification({
      recipientId: managerId,
      recipientRole: 'dorm_manager',
      type,
      title,
      content,
      relatedId,
      relatedModel,
    });
  }

  static async sendToMaintenance(workerId, type, title, content, relatedId, relatedModel) {
    return this.createNotification({
      recipientId: workerId,
      recipientRole: 'maintenance',
      type,
      title,
      content,
      relatedId,
      relatedModel,
    });
  }

  static async sendToSecurity(securityId, type, title, content, relatedId, relatedModel) {
    return this.createNotification({
      recipientId: securityId,
      recipientRole: 'security',
      type,
      title,
      content,
      relatedId,
      relatedModel,
    });
  }

  static async sendToAdmin(adminId, type, title, content, relatedId, relatedModel) {
    return this.createNotification({
      recipientId: adminId,
      recipientRole: 'admin',
      type,
      title,
      content,
      relatedId,
      relatedModel,
    });
  }

  static async getUnreadCount(userId) {
    return Notification.countDocuments({ recipientId: userId, isRead: false });
  }

  static async getUnreadStats(userId) {
    const stats = await Notification.aggregate([
      {
        $match: {
          recipientId: userId,
          isRead: false,
        },
      },
      {
        $group: {
          _id: '$type',
          count: { $sum: 1 },
        },
      },
    ]);

    const detailedMap = {
      dorm_assignment: 0,
      dorm_change: 0,
      repair_created: 0,
      repair_assigned: 0,
      repair_completed: 0,
      repair_escalated: 0,
      electricity_warning: 0,
      electricity_recharged: 0,
      electricity_cutoff: 0,
      electricity_restored: 0,
      visitor_pending: 0,
      visitor_approved: 0,
      visitor_denied: 0,
      visitor_overdue: 0,
      late_return: 0,
      late_return_violation: 0,
      late_return_interview: 0,
      interview_scheduled: 0,
      hygiene_inspection: 0,
      hygiene_failed: 0,
      hygiene_warning: 0,
      report_ready: 0,
      system: 0,
      other: 0,
    };

    for (const stat of stats) {
      if (detailedMap[stat._id] !== undefined) {
        detailedMap[stat._id] = stat.count;
      }
    }

    const total = Object.values(detailedMap).reduce((sum, count) => sum + count, 0);

    const categories = {
      repair: detailedMap.repair_created + detailedMap.repair_assigned + detailedMap.repair_completed + detailedMap.repair_escalated,
      electricity: detailedMap.electricity_warning + detailedMap.electricity_recharged + detailedMap.electricity_cutoff + detailedMap.electricity_restored,
      visitor: detailedMap.visitor_pending + detailedMap.visitor_approved + detailedMap.visitor_denied + detailedMap.visitor_overdue,
      late_return: detailedMap.late_return + detailedMap.late_return_violation + detailedMap.late_return_interview + detailedMap.interview_scheduled,
      hygiene: detailedMap.hygiene_inspection + detailedMap.hygiene_failed + detailedMap.hygiene_warning,
      dorm: detailedMap.dorm_assignment + detailedMap.dorm_change,
      system: detailedMap.system + detailedMap.report_ready,
      other: detailedMap.other,
    };

    return {
      total,
      categories,
      detailed: detailedMap,
    };
  }

  static async markAsRead(notificationId, userId) {
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      return null;
    }

    if (notification.recipientId.toString() !== userId.toString()) {
      throw new Error('无权操作此通知');
    }

    return Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true, readAt: Date.now() },
      { new: true }
    );
  }

  static async markAllAsRead(userId) {
    return Notification.updateMany(
      { recipientId: userId, isRead: false },
      { isRead: true, readAt: Date.now() }
    );
  }

  static async markCategoryAsRead(userId, category) {
    const categoryTypeMap = {
      repair: ['repair_created', 'repair_assigned', 'repair_completed', 'repair_escalated'],
      electricity: ['electricity_warning', 'electricity_recharged', 'electricity_cutoff', 'electricity_restored'],
      visitor: ['visitor_pending', 'visitor_approved', 'visitor_denied', 'visitor_overdue'],
      late_return: ['late_return', 'late_return_violation', 'late_return_interview', 'interview_scheduled'],
      hygiene: ['hygiene_inspection', 'hygiene_failed', 'hygiene_warning'],
      dorm: ['dorm_assignment', 'dorm_change'],
      system: ['system', 'report_ready'],
    };

    const types = categoryTypeMap[category];
    if (!types) {
      throw new Error(`不支持的通知大类: ${category}，可选值: ${Object.keys(categoryTypeMap).join(', ')}`);
    }

    const result = await Notification.updateMany(
      {
        recipientId: userId,
        isRead: false,
        type: { $in: types },
      },
      { isRead: true, readAt: Date.now() }
    );

    return {
      category,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }

  static async markTypesAsRead(userId, types) {
    if (!Array.isArray(types) || types.length === 0) {
      throw new Error('请提供要标记已读的通知类型列表');
    }

    const result = await Notification.updateMany(
      {
        recipientId: userId,
        isRead: false,
        type: { $in: types },
      },
      { isRead: true, readAt: Date.now() }
    );

    return {
      types,
      matchedCount: result.matchedCount,
      modifiedCount: result.modifiedCount,
    };
  }
}

module.exports = NotificationService;
