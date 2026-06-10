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
    const lateReturnStudentCount = (await LateReturn.aggregate([
      { $match: { buildingId, createdAt: { $gte: startOfDay, $lte: endOfDay } } },
      { $group: { _id: '$studentId' } },
      { $count: 'count' },
    ]))[0]?.count || 0;

    const dormitoriesInBuilding = await require('../models/Dormitory').find({ buildingId }).select('_id');
    const dormitoryIds = dormitoriesInBuilding.map((d) => d._id);

    const rechargeTransactions = await ElectricityTransaction.find({
      dormitoryId: { $in: dormitoryIds },
      type: 'recharge',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const consumptionTransactions = await ElectricityTransaction.find({
      dormitoryId: { $in: dormitoryIds },
      type: 'consumption',
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const electricityTotalRecharge = rechargeTransactions.reduce((sum, t) => sum + t.amount, 0);
    const electricityTotalConsumption = Math.abs(
      consumptionTransactions.reduce((sum, t) => sum + t.amount, 0)
    );
    const electricityActiveAccounts = await ElectricityAccount.countDocuments({
      buildingId,
      status: { $ne: 'disabled' },
    });

    const visitorTotal = await Visitor.countDocuments({
      buildingId,
      createdAt: { $gte: startOfDay, $lte: endOfDay },
    });
    const visitorCheckedIn = await Visitor.countDocuments({
      buildingId,
      actualCheckInTime: { $gte: startOfDay, $lte: endOfDay },
    });
    const visitorOverdue = await Visitor.countDocuments({
      buildingId,
      status: 'overdue',
      scheduledEndTime: { $gte: startOfDay, $lte: endOfDay },
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

  static async getReports(params) {
    let query = {};

    if (params.reportType) {
      query.reportType = params.reportType;
    }

    if (params.buildingId) {
      query.buildingId = params.buildingId;
    }

    if (params.buildingIds && params.buildingIds.length > 0) {
      query.buildingId = { $in: params.buildingIds };
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

  static async getBuildingComparison(params) {
    const { buildingIds, startDate, endDate } = params;
    const start = moment(startDate).startOf('day').toDate();
    const end = moment(endDate).endOf('day').toDate();

    const buildings = await Building.find({}).select('_id name code gender');
    const targetBuildings = buildingIds && buildingIds.length > 0
      ? buildings.filter((b) => buildingIds.includes(b._id.toString()))
      : buildings;

    const reports = await OperationReport.aggregate([
      {
        $match: {
          reportDate: { $gte: start, $lte: end },
          reportType: 'building_daily',
          ...(buildingIds && buildingIds.length > 0 && {
            buildingId: { $in: buildingIds.map((id) => new mongoose.Types.ObjectId(id)) },
          }),
        },
      },
      {
        $group: {
          _id: '$buildingId',
          avgOccupancyRate: { $avg: '$statistics.occupancyRate' },
          totalRepairTotal: { $sum: '$statistics.repairTotal' },
          totalRepairCompleted: { $sum: '$statistics.repairCompleted' },
          avgRepairResponseTime: { $avg: '$statistics.repairAvgResponseTime' },
          avgRepairCompletionTime: { $avg: '$statistics.repairAvgCompletionTime' },
          totalLateReturnCount: { $sum: '$statistics.lateReturnCount' },
          totalLateReturnStudents: { $sum: '$statistics.lateReturnStudentCount' },
          totalElectricityRecharge: { $sum: '$statistics.electricityTotalRecharge' },
          totalElectricityConsumption: { $sum: '$statistics.electricityTotalConsumption' },
          avgElectricityAccounts: { $avg: '$statistics.electricityActiveAccounts' },
          totalVisitorTotal: { $sum: '$statistics.visitorTotal' },
          totalVisitorOverdue: { $sum: '$statistics.visitorOverdue' },
          totalHygieneTotal: { $sum: '$statistics.hygieneTotal' },
          totalHygienePassed: { $sum: '$statistics.hygienePassed' },
          reportCount: { $sum: 1 },
        },
      },
    ]);

    const buildingStats = [];
    for (const building of targetBuildings) {
      const stat = reports.find((r) => r._id.toString() === building._id.toString()) || {
        avgOccupancyRate: 0,
        totalRepairTotal: 0,
        totalRepairCompleted: 0,
        avgRepairResponseTime: 0,
        avgRepairCompletionTime: 0,
        totalLateReturnCount: 0,
        totalLateReturnStudents: 0,
        totalElectricityRecharge: 0,
        totalElectricityConsumption: 0,
        avgElectricityAccounts: 0,
        totalVisitorTotal: 0,
        totalVisitorOverdue: 0,
        totalHygieneTotal: 0,
        totalHygienePassed: 0,
        reportCount: 0,
      };

      const repairCompletionRate = stat.totalRepairTotal > 0
        ? Math.round((stat.totalRepairCompleted / stat.totalRepairTotal) * 10000) / 100
        : 0;
      const hygienePassRate = stat.totalHygieneTotal > 0
        ? Math.round((stat.totalHygienePassed / stat.totalHygieneTotal) * 10000) / 100
        : 0;

      buildingStats.push({
        buildingId: building._id,
        buildingName: building.name,
        buildingCode: building.code,
        buildingGender: building.gender,
        avgOccupancyRate: Math.round(stat.avgOccupancyRate * 100) / 100,
        totalRepairTotal: stat.totalRepairTotal,
        totalRepairCompleted: stat.totalRepairCompleted,
        repairCompletionRate,
        avgRepairResponseTime: Math.round(stat.avgRepairResponseTime),
        avgRepairCompletionTime: Math.round(stat.avgRepairCompletionTime),
        totalLateReturnCount: stat.totalLateReturnCount,
        totalLateReturnStudents: stat.totalLateReturnStudents,
        totalElectricityRecharge: Math.round(stat.totalElectricityRecharge * 100) / 100,
        totalElectricityConsumption: Math.round(stat.totalElectricityConsumption * 100) / 100,
        avgElectricityAccounts: Math.round(stat.avgElectricityAccounts),
        totalVisitorTotal: stat.totalVisitorTotal,
        totalVisitorOverdue: stat.totalVisitorOverdue,
        totalHygieneTotal: stat.totalHygieneTotal,
        totalHygienePassed: stat.totalHygienePassed,
        hygienePassRate,
      });
    }

    const summary = {
      avgOccupancyRate: buildingStats.length > 0
        ? Math.round(
            buildingStats.reduce((sum, b) => sum + b.avgOccupancyRate, 0) / buildingStats.length * 100
          ) / 100
        : 0,
      totalRepairTotal: buildingStats.reduce((sum, b) => sum + b.totalRepairTotal, 0),
      totalRepairCompleted: buildingStats.reduce((sum, b) => sum + b.totalRepairCompleted, 0),
      repairCompletionRate: buildingStats.reduce((sum, b) => sum + b.totalRepairTotal, 0) > 0
        ? Math.round(
            buildingStats.reduce((sum, b) => sum + b.totalRepairCompleted, 0) /
            buildingStats.reduce((sum, b) => sum + b.totalRepairTotal, 0) * 10000
          ) / 100
        : 0,
      avgRepairResponseTime: buildingStats.length > 0
        ? Math.round(
            buildingStats.reduce((sum, b) => sum + b.avgRepairResponseTime, 0) / buildingStats.length
          )
        : 0,
      totalLateReturnCount: buildingStats.reduce((sum, b) => sum + b.totalLateReturnCount, 0),
      totalLateReturnStudents: buildingStats.reduce((sum, b) => sum + b.totalLateReturnStudents, 0),
      totalElectricityRecharge: Math.round(
        buildingStats.reduce((sum, b) => sum + b.totalElectricityRecharge, 0) * 100
      ) / 100,
      totalElectricityConsumption: Math.round(
        buildingStats.reduce((sum, b) => sum + b.totalElectricityConsumption, 0) * 100
      ) / 100,
      totalVisitorTotal: buildingStats.reduce((sum, b) => sum + b.totalVisitorTotal, 0),
      totalVisitorOverdue: buildingStats.reduce((sum, b) => sum + b.totalVisitorOverdue, 0),
      totalHygieneTotal: buildingStats.reduce((sum, b) => sum + b.totalHygieneTotal, 0),
      totalHygienePassed: buildingStats.reduce((sum, b) => sum + b.totalHygienePassed, 0),
      hygienePassRate: buildingStats.reduce((sum, b) => sum + b.totalHygieneTotal, 0) > 0
        ? Math.round(
            buildingStats.reduce((sum, b) => sum + b.totalHygienePassed, 0) /
            buildingStats.reduce((sum, b) => sum + b.totalHygieneTotal, 0) * 10000
          ) / 100
        : 0,
      buildingCount: buildingStats.length,
    };

    return {
      startDate: start,
      endDate: end,
      buildingStats,
      summary,
    };
  }

  static async exportToExcel(params) {
    const { buildingId, buildingIds, startDate, endDate, format = 'daily' } = params;

    if (format === 'comparison') {
      return await this.exportBuildingComparisonToExcel(params);
    }

    const reports = await this.getReports({
      buildingId,
      buildingIds,
      startDate,
      endDate,
      reportType: buildingId || buildingIds ? 'building_daily' : 'daily',
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
      { header: '报修完成率(%)', key: 'repairCompletionRate', width: 15 },
      { header: '平均响应(分)', key: 'repairAvgResponseTime', width: 15 },
      { header: '平均完成(分)', key: 'repairAvgCompletionTime', width: 15 },
      { header: '晚归次数', key: 'lateReturnCount', width: 12 },
      { header: '晚归人数', key: 'lateReturnStudentCount', width: 12 },
      { header: '电费充值(元)', key: 'electricityTotalRecharge', width: 15 },
      { header: '电费消耗(元)', key: 'electricityTotalConsumption', width: 15 },
      { header: '有效电费账户', key: 'electricityActiveAccounts', width: 15 },
      { header: '访客总数', key: 'visitorTotal', width: 12 },
      { header: '访客超时', key: 'visitorOverdue', width: 12 },
      { header: '已登记', key: 'visitorCheckedIn', width: 12 },
      { header: '卫生检查', key: 'hygieneTotal', width: 12 },
      { header: '通过数', key: 'hygienePassed', width: 12 },
      { header: '卫生通过率(%)', key: 'hygienePassRate', width: 15 },
    ];

    for (const report of reports) {
      const stats = report.statistics || {};
      const repairCompletionRate = stats.repairTotal > 0
        ? Math.round((stats.repairCompleted / stats.repairTotal) * 10000) / 100
        : 0;
      const hygienePassRate = stats.hygieneTotal > 0
        ? Math.round((stats.hygienePassed / stats.hygieneTotal) * 10000) / 100
        : 0;

      worksheet.addRow({
        reportDate: moment(report.reportDate).format('YYYY-MM-DD'),
        buildingName: report.buildingId ? report.buildingId.name : '全校',
        ...stats,
        repairCompletionRate,
        hygienePassRate,
      });
    }

    return workbook;
  }

  static async exportBuildingComparisonToExcel(params) {
    const comparisonData = await this.getBuildingComparison(params);

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('楼栋对比报表');

    worksheet.columns = [
      { header: '楼栋', key: 'buildingName', width: 20 },
      { header: '楼栋编号', key: 'buildingCode', width: 12 },
      { header: '入住率(%)', key: 'avgOccupancyRate', width: 12 },
      { header: '报修总数', key: 'totalRepairTotal', width: 12 },
      { header: '已完成', key: 'totalRepairCompleted', width: 12 },
      { header: '报修完成率(%)', key: 'repairCompletionRate', width: 15 },
      { header: '平均响应(分)', key: 'avgRepairResponseTime', width: 15 },
      { header: '平均完成(分)', key: 'avgRepairCompletionTime', width: 15 },
      { header: '晚归次数', key: 'totalLateReturnCount', width: 12 },
      { header: '晚归人数', key: 'totalLateReturnStudents', width: 12 },
      { header: '电费充值(元)', key: 'totalElectricityRecharge', width: 15 },
      { header: '电费消耗(元)', key: 'totalElectricityConsumption', width: 15 },
      { header: '有效电费账户', key: 'avgElectricityAccounts', width: 15 },
      { header: '访客总数', key: 'totalVisitorTotal', width: 12 },
      { header: '访客超时', key: 'totalVisitorOverdue', width: 12 },
      { header: '卫生检查', key: 'totalHygieneTotal', width: 12 },
      { header: '通过数', key: 'totalHygienePassed', width: 12 },
      { header: '卫生通过率(%)', key: 'hygienePassRate', width: 15 },
    ];

    for (const stat of comparisonData.buildingStats) {
      worksheet.addRow(stat);
    }

    worksheet.addRow({});
    worksheet.addRow({ buildingName: '全校汇总', buildingCode: '—' });
    const summaryRow = worksheet.lastRow;
    summaryRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFFF00' } };
    summaryRow.font = { bold: true };

    summaryRow.getCell('avgOccupancyRate').value = comparisonData.summary.avgOccupancyRate;
    summaryRow.getCell('totalRepairTotal').value = comparisonData.summary.totalRepairTotal;
    summaryRow.getCell('totalRepairCompleted').value = comparisonData.summary.totalRepairCompleted;
    summaryRow.getCell('repairCompletionRate').value = comparisonData.summary.repairCompletionRate;
    summaryRow.getCell('avgRepairResponseTime').value = comparisonData.summary.avgRepairResponseTime;
    summaryRow.getCell('totalLateReturnCount').value = comparisonData.summary.totalLateReturnCount;
    summaryRow.getCell('totalLateReturnStudents').value = comparisonData.summary.totalLateReturnStudents;
    summaryRow.getCell('totalElectricityRecharge').value = comparisonData.summary.totalElectricityRecharge;
    summaryRow.getCell('totalElectricityConsumption').value = comparisonData.summary.totalElectricityConsumption;
    summaryRow.getCell('totalVisitorTotal').value = comparisonData.summary.totalVisitorTotal;
    summaryRow.getCell('totalVisitorOverdue').value = comparisonData.summary.totalVisitorOverdue;
    summaryRow.getCell('totalHygieneTotal').value = comparisonData.summary.totalHygieneTotal;
    summaryRow.getCell('totalHygienePassed').value = comparisonData.summary.totalHygienePassed;
    summaryRow.getCell('hygienePassRate').value = comparisonData.summary.hygienePassRate;

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
