const mongoose = require('mongoose');

const transferRequestSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  currentAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DormitoryAssignment',
    required: true,
  },
  currentBedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bed',
    required: true,
  },
  currentDormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
    required: true,
  },
  currentBuildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  reason: {
    type: String,
    required: true,
  },
  preferredBuildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
  },
  preferredDormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
  },
  preferredBedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bed',
  },
  additionalNotes: String,
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'completed', 'cancelled'],
    default: 'pending',
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  reviewedAt: Date,
  reviewNotes: String,
  targetBedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bed',
  },
  targetDormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
  },
  targetBuildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
  },
  newAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DormitoryAssignment',
  },
  completedAt: Date,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

transferRequestSchema.index({ studentId: 1, createdAt: -1 });
transferRequestSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('TransferRequest', transferRequestSchema);
