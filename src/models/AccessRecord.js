const mongoose = require('mongoose');

const accessRecordSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  doorType: {
    type: String,
    enum: ['entry', 'exit'],
    required: true,
  },
  accessTime: {
    type: Date,
    default: Date.now,
    required: true,
  },
  isLateReturn: {
    type: Boolean,
    default: false,
  },
  deviceId: String,
  location: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

accessRecordSchema.index({ studentId: 1, accessTime: -1 });
accessRecordSchema.index({ buildingId: 1, accessTime: -1 });

module.exports = mongoose.model('AccessRecord', accessRecordSchema);
