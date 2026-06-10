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

  static async markAsRead(notificationId) {
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
