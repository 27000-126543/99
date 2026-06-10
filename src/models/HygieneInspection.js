const mongoose = require('mongoose');

const hygieneInspectionSchema = new mongoose.Schema({
  taskNo: {
    type: String,
    unique: true,
    required: true,
  },
  weekNumber: {
    type: Number,
    required: true,
  },
  academicYear: String,
  semester: String,
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
    required: true,
  },
  dormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
    required: true,
  },
  inspectorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  scheduledDate: {
    type: Date,
    required: true,
  },
  inspectionDate: Date,
  status: {
    type: String,
    enum: ['scheduled', 'in_progress', 'completed', 'cancelled'],
    default: 'scheduled',
  },
  scores: {
    cleanliness: Number,
    tidiness: Number,
    safety: Number,
    overall: Number,
  },
  isPassed: Boolean,
  photos: [String],
  issues: [String],
  rectificationDeadline: Date,
  rectificationStatus: {
    type: String,
    enum: ['not_required', 'pending', 'completed'],
    default: 'not_required',
  },
  remarks: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

hygieneInspectionSchema.index({ dormitoryId: 1, createdAt: -1 });
hygieneInspectionSchema.index({ weekNumber: 1, buildingId: 1 });

module.exports = mongoose.model('HygieneInspection', hygieneInspectionSchema);
