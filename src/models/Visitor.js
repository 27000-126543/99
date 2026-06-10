const mongoose = require('mongoose');

const visitorSchema = new mongoose.Schema({
  visitorName: {
    type: String,
    required: true,
  },
  visitorPhone: {
    type: String,
    required: true,
  },
  visitorIdCard: String,
  visitorType: {
    type: String,
    enum: ['family', 'friend', 'maintenance', 'delivery', 'other'],
    default: 'other',
  },
  hostStudentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  dormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
  },
  purpose: String,
  scheduledStartTime: {
    type: Date,
    required: true,
  },
  scheduledEndTime: {
    type: Date,
    required: true,
  },
  actualCheckInTime: Date,
  actualCheckOutTime: Date,
  passCode: {
    type: String,
    unique: true,
  },
  passCodeExpiresAt: Date,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'checked_in', 'checked_out', 'expired', 'overdue'],
    default: 'pending',
  },
  securityNotified: {
    type: Boolean,
    default: false,
  },
  approvedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  rejectedReason: String,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

visitorSchema.index({ buildingId: 1, status: 1, scheduledStartTime: 1 });

module.exports = mongoose.model('Visitor', visitorSchema);
