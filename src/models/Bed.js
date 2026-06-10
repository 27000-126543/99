const mongoose = require('mongoose');

const bedSchema = new mongoose.Schema({
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
  bedNumber: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['available', 'occupied', 'reserved', 'maintenance'],
    default: 'available',
  },
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  assignedAt: Date,
  semester: String,
  academicYear: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

bedSchema.index({ dormitoryId: 1, bedNumber: 1 }, { unique: true });

module.exports = mongoose.model('Bed', bedSchema);
