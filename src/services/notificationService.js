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

    const typeMap = {
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
      visitor_overdue: 0,
      late_return: 0,
      late_return_violation: 0,
      late_return_interview: 0,
      hygiene_inspection: 0,
      hygiene_warning: 0,
      system: 0,
      other: 0,
    };

    for (const stat of stats) {
      if (typeMap[stat._id] !== undefined) {
        typeMap[stat._id] = stat.count;
      }
    }

    const total = Object.values(typeMap).reduce((sum, count) => sum + count, 0);

    return {
      total,
      ...typeMap,
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
}

module.exports = NotificationService;
