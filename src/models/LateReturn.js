const mongoose = require('mongoose');

const lateReturnSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  accessRecordId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AccessRecord',
    required: true,
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  returnTime: {
    type: Date,
    required: true,
  },
  lateMinutes: {
    type: Number,
    required: true,
  },
  countInMonth: {
    type: Number,
    default: 0,
  },
  counselorNotified: {
    type: Boolean,
    default: false,
  },
  interviewTriggered: {
    type: Boolean,
    default: false,
  },
  status: {
    type: String,
    enum: ['recorded', 'notified', 'interview_scheduled', 'resolved', 'appealed'],
    default: 'recorded',
  },
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

lateReturnSchema.index({ studentId: 1, createdAt: -1 });

module.exports = mongoose.model('LateReturn', lateReturnSchema);
