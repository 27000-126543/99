const mongoose = require('mongoose');

const operationReportSchema = new mongoose.Schema({
  reportDate: {
    type: Date,
    required: true,
  },
  buildingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Building',
  },
  reportType: {
    type: String,
    enum: ['daily', 'weekly', 'monthly', 'building_daily'],
    required: true,
  },
  statistics: {
    occupancyRate: Number,
    totalBeds: Number,
    occupiedBeds: Number,
    repairTotal: Number,
    repairCompleted: Number,
    repairAvgResponseTime: Number,
    repairAvgCompletionTime: Number,
    lateReturnCount: Number,
    lateReturnStudentCount: Number,
    electricityTotalRecharge: Number,
    electricityTotalConsumption: Number,
    electricityActiveAccounts: Number,
    visitorTotal: Number,
    visitorCheckedIn: Number,
    visitorOverdue: Number,
    hygieneTotal: Number,
    hygienePassed: Number,
  },
  generatedAt: {
    type: Date,
    default: Date.now,
  },
  generatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
});

operationReportSchema.index({ reportDate: 1, reportType: 1, buildingId: 1 }, { unique: true });

module.exports = mongoose.model('OperationReport', operationReportSchema);
