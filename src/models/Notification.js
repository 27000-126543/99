const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  recipientId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  recipientRole: {
    type: String,
    enum: ['student', 'dorm_manager', 'counselor', 'maintenance', 'security', 'admin'],
    required: true,
  },
  type: {
    type: String,
    enum: [
      'dorm_assignment', 'dorm_change',
      'repair_created', 'repair_assigned', 'repair_completed', 'repair_escalated',
      'electricity_warning', 'electricity_cutoff', 'electricity_restored', 'electricity_recharged',
      'visitor_pending', 'visitor_approved', 'visitor_denied', 'visitor_overdue',
      'late_return', 'late_return_violation', 'late_return_interview', 'interview_scheduled',
      'hygiene_inspection', 'hygiene_failed', 'hygiene_warning',
      'report_ready',
      'system', 'other',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  relatedId: mongoose.Schema.Types.ObjectId,
  relatedModel: String,
  isRead: {
    type: Boolean,
    default: false,
  },
  readAt: Date,
  isPushed: {
    type: Boolean,
    default: false,
  },
  pushChannel: {
    type: String,
    enum: ['socket', 'sms', 'email', 'app'],
    default: 'socket',
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

notificationSchema.index({ recipientId: 1, isRead: 1, createdAt: -1 });

module.exports = mongoose.model('Notification', notificationSchema);
