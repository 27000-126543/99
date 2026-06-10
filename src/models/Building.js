const mongoose = require('mongoose');

const buildingSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  code: {
    type: String,
    required: true,
    unique: true,
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'mixed'],
    required: true,
  },
  floors: {
    type: Number,
    required: true,
  },
  roomsPerFloor: {
    type: Number,
    required: true,
  },
  maxVisitors: {
    type: Number,
    default: 20,
  },
  managerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  location: String,
  description: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('Building', buildingSchema);
