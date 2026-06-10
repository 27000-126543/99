const OperationReport = require('../models/OperationReport');
const Bed = require('../models/Bed');
const RepairOrder = require('../models/RepairOrder');
const LateReturn = require('../models/LateReturn');
const ElectricityTransaction = require('../models/ElectricityTransaction');
const ElectricityAccount = require('../models/ElectricityAccount');
const Visitor = require('../models/Visitor');
const HygieneInspection = require('../models/HygieneInspection');
const Building = require('../models/Building');
const ExcelJS = require('exceljs');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

class ReportService {
  static async generateDailyReport(date = new Date()) {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    const totalBeds = await Bed.countDocuments();
    const occupiedBeds = await Bed.countDocuments({ status: 'occupied' });
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 10000) / 100 : 0;

    const repairTotal = await RepairOrder.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const repairCompleted = await RepairOrder.countDocuments({
      completedAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const completedOrders = await RepairOrder.find({
      completedAt: { $gte: startOfDay, $lte: endOfDay },
      responseTime: { $exists: true },
      completionTime: { $exists: true },
    });
    const repairAvgResponseTime = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((sum, o) => sum + o.responseTime, 0) / completedOrders.length)
      : 0;
    const repairAvgCompletionTime = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((sum, o) => sum + o.completionTime, 0) / completedOrders.length)
      : 0;

    const lateReturnCount = await LateReturn.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const lateReturnStudentCount = (await LateReturn.aggregate([
      { $match: { createdAt: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: '$studentId' } },
      { $count: 'count' },
    ]))[0]?.count || 0;

    const rechargeTransactions = await ElectricityTransaction.find({
      type: 'recharge',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const consumptionTransactions = await ElectricityTransaction.find({
      type: 'consumption',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const electricityTotalRecharge = rechargeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const electricityTotalConsumption = Math.abs(
      consumptionTransactions.reduce((sum, t) => sum + t.amount, 0)
    );
    const electricityActiveAccounts = await ElectricityAccount.countDocuments({
      status: { $ne: 'disabled' },
    });

    const visitorTotal = await Visitor.countDocuments({
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const visitorCheckedIn = await Visitor.countDocuments({
      actualCheckInTime: { $gte: startOfDay, $lte: endOfDay },
    });
    const visitorOverdue = await Visitor.countDocuments({
      status: 'overdue',
      scheduledEndTime: { $gte: startOfDay, $lte: endOfDay },
    });

    const hygieneTotal = await HygieneInspection.countDocuments({
      inspectionDate: { $gte: startOfDay, $lte: endOfDay },
    });
    const hygienePassed = await HygieneInspection.countDocuments({
      inspectionDate: { $gte: startOfDay, $lte: endOfDay },
      isPassed: true,
    });

    const report = await OperationReport.findOneAndUpdate(
      { reportDate: startOfDay, reportType: 'daily' },
      {
        reportDate: startOfDay,
        reportType: 'daily',
        statistics: {
          occupancyRate,
          totalBeds,
          occupiedBeds,
          repairTotal,
          repairCompleted,
          repairAvgResponseTime,
          repairAvgCompletionTime,
          lateReturnCount,
          lateReturnStudentCount,
          electricityTotalRecharge,
          electricityTotalConsumption,
          electricityActiveAccounts,
          visitorTotal,
          visitorCheckedIn,
          visitorOverdue,
          hygieneTotal,
          hygienePassed,
        },
      },
      { upsert: true, new: true }
    );

    return report;
  }

  static async generateBuildingDailyReport(buildingId, date = new Date()) {
    const startOfDay = moment(date).startOf('day').toDate();
    const endOfDay = moment(date).endOf('day').toDate();

    const totalBeds = await Bed.countDocuments({ buildingId });
    const occupiedBeds = await Bed.countDocuments({ buildingId, status: 'occupied' });
    const occupancyRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 10000) / 100 : 0;

    const repairTotal = await RepairOrder.countDocuments({
      buildingId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const repairCompleted = await RepairOrder.countDocuments({
      buildingId,
      completedAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const completedOrders = await RepairOrder.find({
      buildingId,
      completedAt: { $gte: startOfDay, $lte: endOfDay },
      responseTime: { $exists: true },
      completionTime: { $exists: true },
    });
    const repairAvgResponseTime = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((sum, o) => sum + o.responseTime, 0) / completedOrders.length)
      : 0;
    const repairAvgCompletionTime = completedOrders.length > 0
      ? Math.round(completedOrders.reduce((sum, o) => sum + o.completionTime, 0) / completedOrders.length)
      : 0;

    const lateReturnCount = await LateReturn.countDocuments({
      buildingId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });

    const visitorTotal = await Visitor.countDocuments({
      buildingId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const visitorCheckedIn = await Visitor.countDocuments({
      buildingId,
      actualCheckInTime: { $gte: startOfDay, $lte: endOfDay },
    });

    const hygieneTotal = await HygieneInspection.countDocuments({
      buildingId,
      inspectionDate: { $gte: startOfDay, $lte: endOfDay },
    });
    const hygienePassed = await HygieneInspection.countDocuments({
      buildingId,
      inspectionDate: { $gte: startOfDay, $lte: endOfDay },
      isPassed: true,
    });

    const report = await OperationReport.findOneAndUpdate(
      { reportDate: startOfDay, reportType: 'building_daily', buildingId },
      {
        reportDate: startOfDay,
        reportType: 'building_daily',
        buildingId,
        statistics: {
          occupancyRate,
          totalBeds,
          occupiedBeds,
          repairTotal,
          repairCompleted,
          repairAvgResponseTime,
          repairAvgCompletionTime,
          lateReturnCount,
          lateReturnStudentCount: 0,
          electricityTotalRecharge: 0,
          electricityTotalConsumption: 0,
          electricityActiveAccounts: 0,
          visitorTotal,
          visitorCheckedIn,
          visitorOverdue: 0,
          hygieneTotal,
          hygienePassed,
        },
      },
      { upsert: true, new: true }
    );

    return report;
  }

  static async getReports(params) {
    let query = {};

    if (params.reportType) {
      query.reportType = params.reportType;
    }

    if (params.buildingId) {
      query.buildingId = params.buildingId;
    }

    if (params.startDate && params.endDate) {
      query.reportDate = {
        $gte: moment(params.startDate).startOf('day').toDate(),
        $lte: moment(params.endDate).endOf('day').toDate(),
      };
    }

    return await OperationReport.find(query)
      .sort({ reportDate: -1 })
      .populate('buildingId', 'name');
  }

  static async exportToExcel(buildingId, startDate, endDate) {
    const reports = await this.getReports({
      buildingId,
      startDate,
      endDate,
      reportType: buildingId ? 'building_daily' : 'daily',
    });

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('运营报表');

    worksheet.columns = [
      { header: '日期', key: 'reportDate', width: 15 },
      { header: '楼栋', key: 'buildingName', width: 15 },
      { header: '入住率(%)', key: 'occupancyRate', width: 12 },
      { header: '总床位数', key: 'totalBeds', width: 12 },
      { header: '已入住', key: 'occupiedBeds', width: 12 },
      { header: '报修总数', key: 'repairTotal', width: 12 },
      { header: '已完成', key: 'repairCompleted', width: 12 },
      { header: '平均响应(分)', key: 'repairAvgResponseTime', width: 15 },
      { header: '平均完成(分)', key: 'repairAvgCompletionTime', width: 15 },
      { header: '晚归次数', key: 'lateReturnCount', width: 12 },
      { header: '晚归人数', key: 'lateReturnStudentCount', width: 12 },
      { header: '电费充值(元)', key: 'electricityTotalRecharge', width: 15 },
      { header: '电费消耗(元)', key: 'electricityTotalConsumption', width: 15 },
      { header: '访客总数', key: 'visitorTotal', width: 12 },
      { header: '已登记', key: 'visitorCheckedIn', width: 12 },
      { header: '卫生检查', key: 'hygieneTotal', width: 12 },
      { header: '通过数', key: 'hygienePassed', width: 12 },
    ];

    for (const report of reports) {
      worksheet.addRow({
        reportDate: moment(report.reportDate).format('YYYY-MM-DD'),
        buildingName: report.buildingId ? report.buildingId.name : '全校',
        ...report.statistics,
      });
    }

    return workbook;
  }

  static async getDashboardData(buildingId) {
    const today = new Date();
    const startOfDay = moment(today).startOf('day').toDate();
    const endOfDay = moment(today).endOf('day').toDate();

    let bedQuery = {};
    let repairQuery = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
    let lateReturnQuery = { createdAt: { $gte: startOfDay, $lte: endOfDay } };
    let visitorQuery = { createdAt: { $gte: startOfDay, $lte: endOfDay } };

    if (buildingId) {
      bedQuery.buildingId = buildingId;
      repairQuery.buildingId = buildingId;
      lateReturnQuery.buildingId = buildingId;
      visitorQuery.buildingId = buildingId;
    }

    const totalBeds = await Bed.countDocuments(bedQuery);
    const occupiedBeds = await Bed.countDocuments({ ...bedQuery, status: 'occupied' });
    const pendingRepairs = await RepairOrder.countDocuments({
      ...repairQuery,
      status: { $in: ['pending', 'assigned', 'accepted'] },
    });
    const todayLateReturns = await LateReturn.countDocuments(lateReturnQuery);
    const todayVisitors = await Visitor.countDocuments(visitorQuery);
    const pendingHygiene = await HygieneInspection.countDocuments({
      status: 'scheduled',
      ...(buildingId && { buildingId }),
    });

    return {
      totalBeds,
      occupiedBeds,
      occupancyRate: totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0,
      pendingRepairs,
      todayLateReturns,
      todayVisitors,
      pendingHygiene,
    };
  }
}

module.exports = ReportService;
