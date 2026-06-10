const mongoose = require('mongoose');

const electricityAccountSchema = new mongoose.Schema({
  dormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
    required: true,
    unique: true,
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  meterId: {
    type: String,
    required: true,
    unique: true,
  },
  balance: {
    type: Number,
    default: 0,
  },
  totalRecharged: {
    type: Number,
    default: 0,
  },
  totalConsumed: {
    type: Number,
    default: 0,
  },
  status: {
    type: String,
    enum: ['normal', 'warning', 'cutoff', 'disabled'],
    default: 'normal',
  },
  lastReading: {
    type: Number,
    default: 0,
  },
  lastReadingDate: Date,
  warningSent: {
    type: Boolean,
    default: false,
  },
  cutoffTriggered: {
    type: Boolean,
    default: false,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('ElectricityAccount', electricityAccountSchema);
