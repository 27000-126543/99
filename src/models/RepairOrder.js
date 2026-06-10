const mongoose = require('mongoose');

const repairOrderSchema = new mongoose.Schema({
  orderNo: {
    type: String,
    unique: true,
    required: true,
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  dormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
    required: true,
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  faultType: {
    type: String,
    enum: ['electrical', 'plumbing', 'furniture', 'appliance', 'door_lock', 'other'],
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  images: [String],
  urgency: {
    type: String,
    enum: ['low', 'medium', 'high', 'emergency'],
    default: 'medium',
  },
  status: {
    type: String,
    enum: ['pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled', 'escalated'],
    default: 'pending',
  },
  assignedWorkerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedAt: Date,
  acceptedAt: Date,
  completedAt: Date,
  escalationNotified: {
    type: Boolean,
    default: false,
  },
  counselorNotified: {
    type: Boolean,
    default: false,
  },
  responseTime: Number,
  completionTime: Number,
  rating: {
    type: Number,
    min: 1,
    max: 5,
  },
  feedback: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

repairOrderSchema.index({ status: 1, createdAt: -1 });

module.exports = mongoose.model('RepairOrder', repairOrderSchema);
