const mongoose = require('mongoose');

const dormitoryAssignmentSchema = new mongoose.Schema({
  studentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  bedId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Bed',
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
  assignmentType: {
    type: String,
    enum: ['auto_match', 'manual_select', 'admin_assign', 'transfer', 'check_out'],
    required: true,
  },
  previousAssignmentId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'DormitoryAssignment',
  },
  matchScore: Number,
  matchCriteria: {
    major: Boolean,
    gender: Boolean,
    sleepPreference: Boolean,
  },
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'cancelled', 'moved_out'],
    default: 'pending',
  },
  confirmedAt: Date,
  movedOutAt: Date,
  semester: String,
  academicYear: String,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

module.exports = mongoose.model('DormitoryAssignment', dormitoryAssignmentSchema);
