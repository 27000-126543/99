const mongoose = require('mongoose');

const interviewTaskSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  counselorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  triggerType: {
    type: String,
    enum: ['late_return', 'hygiene', 'other'],
    required: true,
  },
  lateReturnCount: Number,
  description: String,
  scheduledTime: Date,
  status: {
    type: String,
    enum: ['pending', 'scheduled', 'completed', 'cancelled'],
    default: 'pending',
  },
  completedAt: Date,
  outcome: String,
  notes: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('InterviewTask', interviewTaskSchema);
