const mongoose = require('mongoose');

const dormitorySchema = new mongoose.Schema({
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  roomNumber: {
    type: String,
    required: true,
  },
  floor: {
    type: Number,
    required: true,
  },
  type: {
    type: String,
    enum: ['standard', 'deluxe', 'premium'],
    default: 'standard',
  },
  capacity: {
    type: Number,
    required: true,
    default: 4,
  },
  occupiedCount: {
    type: Number,
    default: 0,
  },
  beds: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bed',
  }],
  allowedMajors: [String],
  comprehensiveScore: {
    type: Number,
    default: 100,
  },
  hygieneScore: {
    type: Number,
    default: 80,
  },
  consecutiveFailedInspections: {
    type: Number,
    default: 0,
  },
  selectionLocked: {
    type: Boolean,
    default: false,
  },
  electricityMeterId: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

dormitorySchema.index({ buildingId: 1, roomNumber: 1 }, { unique: true });

module.exports = mongoose.model('Dormitory', dormitorySchema);
