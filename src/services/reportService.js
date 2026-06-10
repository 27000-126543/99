const mongoose = require('mongoose');
const OperationReport = require('../models/OperationReport');
const Bed = require('../models/Bed');
const Dormitory = require('../models/Dormitory');
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

    if (!startDate || !endDate) {
      throw new AppError('请提供开始日期和结束日期', 400);
    }

    const start = moment(startDate);
    const end = moment(endDate);

    if (!start.isValid() || !end.isValid()) {
      throw new AppError('日期格式不正确，请使用 YYYY-MM-DD 格式', 400);
    }

    if (start.isAfter(end)) {
      throw new AppError('开始日期不能晚于结束日期', 400);
    }

    const startDateObj = start.startOf('day').toDate();
    const endDateObj = end.endOf('day').toDate();

    let validBuildingIds = [];
    let invalidIds = [];

    if (buildingIds && buildingIds.length > 0) {
      for (const id of buildingIds) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          validBuildingIds.push(id);
        } else {
          invalidIds.push(id);
        }
      }

      if (invalidIds.length > 0) {
        throw new AppError(`无效的楼栋ID: ${invalidIds.join(', ')}`, 400);
      }
    }

    const buildings = await Building.find({}).select('_id name code gender');
    let targetBuildings = buildings;

    if (validBuildingIds.length > 0) {
      targetBuildings = buildings.filter((b) => validBuildingIds.includes(b._id.toString()));
      const foundIds = targetBuildings.map((b) => b._id.toString());
      const notFoundIds = validBuildingIds.filter((id) => !foundIds.includes(id));
      if (notFoundIds.length > 0) {
        throw new AppError(`以下楼栋ID不存在: ${notFoundIds.join(', ')}`, 400);
      }
    }

    const matchConditions = {
      reportDate: { $gte: startDateObj, $lte: endDateObj },
      reportType: 'building_daily',
    };

    if (validBuildingIds.length > 0) {
      matchConditions.buildingId = {
        $in: validBuildingIds.map((id) => new mongoose.Types.ObjectId(id)),
      };
    }

    const reports = await OperationReport.aggregate([
      { $match: matchConditions },
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
      avgRepairCompletionTime: buildingStats.length > 0
        ? Math.round(
            buildingStats.reduce((sum, b) => sum + b.avgRepairCompletionTime, 0) / buildingStats.length
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
      avgElectricityAccounts: buildingStats.length > 0
        ? Math.round(
            buildingStats.reduce((sum, b) => sum + b.avgElectricityAccounts, 0) / buildingStats.length
          )
        : 0,
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
      startDate: startDateObj,
      endDate: endDateObj,
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
    summaryRow.getCell('avgRepairCompletionTime').value = comparisonData.summary.avgRepairCompletionTime;
    summaryRow.getCell('totalLateReturnCount').value = comparisonData.summary.totalLateReturnCount;
    summaryRow.getCell('totalLateReturnStudents').value = comparisonData.summary.totalLateReturnStudents;
    summaryRow.getCell('totalElectricityRecharge').value = comparisonData.summary.totalElectricityRecharge;
    summaryRow.getCell('totalElectricityConsumption').value = comparisonData.summary.totalElectricityConsumption;
    summaryRow.getCell('avgElectricityAccounts').value = comparisonData.summary.avgElectricityAccounts;
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

  static async validateBuildingIds(buildingIds, gender) {
    let validBuildingIds = [];
    let invalidIds = [];

    if (buildingIds && buildingIds.length > 0) {
      for (const id of buildingIds) {
        if (mongoose.Types.ObjectId.isValid(id)) {
          validBuildingIds.push(id);
        } else {
          invalidIds.push(id);
        }
      }
      if (invalidIds.length > 0) {
        throw new AppError(`无效的楼栋ID: ${invalidIds.join(', ')}`, 400);
      }
    }

    let buildings = await Building.find({}).select('_id name code gender');

    if (gender && ['male', 'female', 'mixed'].includes(gender)) {
      buildings = buildings.filter((b) => b.gender === gender);
    }

    if (validBuildingIds.length > 0) {
      const target = buildings.filter((b) => validBuildingIds.includes(b._id.toString()));
      const foundIds = target.map((b) => b._id.toString());
      const notFoundIds = validBuildingIds.filter((id) => !foundIds.includes(id));
      if (notFoundIds.length > 0) {
        throw new AppError(`以下楼栋ID不存在: ${notFoundIds.join(', ')}`, 400);
      }
      return { targetBuildings: target, buildingObjectIds: validBuildingIds.map((id) => new mongoose.Types.ObjectId(id)) };
    }

    return {
      targetBuildings: buildings,
      buildingObjectIds: buildings.map((b) => b._id),
    };
  }

  static async getTrendAnalysis(params) {
    const { buildingIds, startDate, endDate, interval = 'weekly', gender } = params;

    if (!startDate || !endDate) {
      throw new AppError('请提供开始日期和结束日期', 400);
    }

    const start = moment(startDate);
    const end = moment(endDate);

    if (!start.isValid() || !end.isValid()) {
      throw new AppError('日期格式不正确，请使用 YYYY-MM-DD 格式', 400);
    }

    if (!['weekly', 'monthly'].includes(interval)) {
      throw new AppError('interval 参数只支持 weekly 或 monthly', 400);
    }

    const { targetBuildings, buildingObjectIds } = await this.validateBuildingIds(buildingIds, gender);

    if (targetBuildings.length === 0) {
      throw new AppError('未找到匹配的楼栋', 400);
    }

    const startDateObj = start.startOf('day').toDate();
    const endDateObj = end.endOf('day').toDate();

    const reports = await OperationReport.aggregate([
      {
        $match: {
          reportDate: { $gte: startDateObj, $lte: endDateObj },
          reportType: 'building_daily',
          buildingId: { $in: buildingObjectIds },
        },
      },
      {
        $sort: { reportDate: 1 },
      },
    ]);

    const periods = [];
    let current = start.clone();

    if (interval === 'weekly') {
      current = current.startOf('week');
      while (current.isBefore(end)) {
        const periodStart = current.clone();
        const periodEnd = current.clone().endOf('week');
        periods.push({
          label: `${periodStart.format('MM/DD')}-${periodEnd.format('MM/DD')}`,
          start: periodStart.toDate(),
          end: periodEnd.toDate(),
        });
        current = current.add(1, 'weeks');
      }
    } else {
      current = current.startOf('month');
      while (current.isBefore(end)) {
        const periodStart = current.clone();
        const periodEnd = current.clone().endOf('month');
        periods.push({
          label: periodStart.format('YYYY-MM'),
          start: periodStart.toDate(),
          end: periodEnd.toDate(),
        });
        current = current.add(1, 'months');
      }
    }

    const trendData = periods.map((period) => {
      const periodReports = reports.filter(
        (r) => r.reportDate >= period.start && r.reportDate <= period.end
      );

      const occupancyRate = periodReports.length > 0
        ? Math.round(periodReports.reduce((sum, r) => sum + (r.statistics.occupancyRate || 0), 0) / periodReports.length * 100) / 100
        : null;

      const repairTotal = periodReports.reduce((sum, r) => sum + (r.statistics.repairTotal || 0), 0);
      const repairCompleted = periodReports.reduce((sum, r) => sum + (r.statistics.repairCompleted || 0), 0);
      const electricityRecharge = Math.round(periodReports.reduce((sum, r) => sum + (r.statistics.electricityTotalRecharge || 0), 0) * 100) / 100;
      const electricityConsumption = Math.round(periodReports.reduce((sum, r) => sum + (r.statistics.electricityTotalConsumption || 0), 0) * 100) / 100;
      const lateReturnCount = periodReports.reduce((sum, r) => sum + (r.statistics.lateReturnCount || 0), 0);
      const hygieneTotal = periodReports.reduce((sum, r) => sum + (r.statistics.hygieneTotal || 0), 0);
      const hygienePassed = periodReports.reduce((sum, r) => sum + (r.statistics.hygienePassed || 0), 0);
      const hygienePassRate = hygieneTotal > 0
        ? Math.round(hygienePassed / hygieneTotal * 10000) / 100
        : null;

      return {
        period: period.label,
        occupancyRate,
        repairTotal,
        repairCompleted,
        repairCompletionRate: repairTotal > 0 ? Math.round(repairCompleted / repairTotal * 10000) / 100 : null,
        electricityRecharge,
        electricityConsumption,
        lateReturnCount,
        hygieneTotal,
        hygienePassed,
        hygienePassRate,
        reportCount: periodReports.length,
      };
    });

    return {
      interval,
      startDate: startDateObj,
      endDate: endDateObj,
      buildingCount: targetBuildings.length,
      buildings: targetBuildings.map((b) => ({ id: b._id, name: b.name, code: b.code, gender: b.gender })),
      trend: trendData,
    };
  }

  static async getRiskWarnings(params) {
    const { buildingIds, gender } = params;

    const { targetBuildings, buildingObjectIds } = await this.validateBuildingIds(buildingIds, gender);

    if (targetBuildings.length === 0) {
      throw new AppError('未找到匹配的楼栋', 400);
    }

    const warnings = [];
    const thirtyDaysAgo = moment().subtract(30, 'days').toDate();
    const sevenDaysAgo = moment().subtract(7, 'days').toDate();
    const now = new Date();

    for (const building of targetBuildings) {
      const buildingId = building._id;
      const dormitories = await Dormitory.find({ buildingId });
      const dormitoryIds = dormitories.map((d) => d._id);

      const totalBeds = await Bed.countDocuments({ buildingId });
      const occupiedBeds = await Bed.countDocuments({ buildingId, status: 'occupied' });
      const occupancyRate = totalBeds > 0 ? Math.round(occupiedBeds / totalBeds * 10000) / 100 : 0;
      const vacancyRate = totalBeds > 0 ? Math.round((totalBeds - occupiedBeds) / totalBeds * 10000) / 100 : 0;

      if (vacancyRate >= 40) {
        warnings.push({
          level: 'high',
          type: 'high_vacancy',
          buildingId,
          buildingName: building.name,
          buildingCode: building.code,
          buildingGender: building.gender,
          reason: `空置率高达${vacancyRate}%`,
          metrics: { totalBeds, occupiedBeds, vacancyRate, occupancyRate },
        });
      }

      if (occupancyRate >= 95 && occupancyRate < 100) {
        warnings.push({
          level: 'medium',
          type: 'near_full',
          buildingId,
          buildingName: building.name,
          buildingCode: building.code,
          buildingGender: building.gender,
          reason: `入住率${occupancyRate}%，即将满员`,
          metrics: { totalBeds, occupiedBeds, vacancyRate, occupancyRate, availableBeds: totalBeds - occupiedBeds },
        });
      }

      const repairCount30d = await RepairOrder.countDocuments({
        buildingId,
        createdAt: { $gte: thirtyDaysAgo },
      });
      const repairPending = await RepairOrder.countDocuments({
        buildingId,
        status: { $in: ['pending', 'assigned', 'accepted'] },
      });

      if (repairCount30d >= 20) {
        const completed30d = await RepairOrder.countDocuments({
          buildingId,
          completedAt: { $gte: thirtyDaysAgo },
        });
        warnings.push({
          level: 'high',
          type: 'repair_hotspot',
          buildingId,
          buildingName: building.name,
          buildingCode: building.code,
          buildingGender: building.gender,
          reason: `近30天报修${repairCount30d}次，待处理${repairPending}单`,
          metrics: { repairTotal30d: repairCount30d, repairCompleted30d: completed30d, repairPending },
        });
      }

      const lateReturnCount30d = await LateReturn.countDocuments({
        buildingId,
        createdAt: { $gte: thirtyDaysAgo },
      });

      if (lateReturnCount30d >= 15) {
        const distinctStudents = await LateReturn.distinct('studentId', {
          buildingId,
          createdAt: { $gte: thirtyDaysAgo },
        });
        warnings.push({
          level: 'high',
          type: 'late_return_hotspot',
          buildingId,
          buildingName: building.name,
          buildingCode: building.code,
          buildingGender: building.gender,
          reason: `近30天晚归${lateReturnCount30d}次，涉及${distinctStudents.length}人`,
          metrics: { lateReturnCount: lateReturnCount30d, distinctStudentCount: distinctStudents.length },
        });
      }

      const failedHygieneDorms = await Dormitory.find({
        buildingId,
        consecutiveFailedInspections: { $gte: 2 },
      });

      if (failedHygieneDorms.length > 0) {
        warnings.push({
          level: 'high',
          type: 'hygiene_failure',
          buildingId,
          buildingName: building.name,
          buildingCode: building.code,
          buildingGender: building.gender,
          reason: `${failedHygieneDorms.length}间宿舍连续卫生不合格`,
          metrics: {
            failedDormCount: failedHygieneDorms.length,
            failedDorms: failedHygieneDorms.map((d) => ({
              dormitoryId: d._id,
              roomNumber: d.roomNumber,
              consecutiveFailures: d.consecutiveFailedInspections,
              hygieneScore: d.hygieneScore,
            })),
          },
        });
      }

      for (const dorm of dormitories) {
        if (dorm.consecutiveFailedInspections >= 2) {
          const existingDormWarning = warnings.find(
            (w) => w.type === 'hygiene_failure_dorm' && w.dormitoryId && w.dormitoryId.toString() === dorm._id.toString()
          );
          if (!existingDormWarning) {
            warnings.push({
              level: 'medium',
              type: 'hygiene_failure_dorm',
              buildingId,
              buildingName: building.name,
              buildingCode: building.code,
              dormitoryId: dorm._id,
              roomNumber: dorm.roomNumber,
              reason: `连续${dorm.consecutiveFailedInspections}次卫生不合格，卫生评分${dorm.hygieneScore}分`,
              metrics: {
                consecutiveFailures: dorm.consecutiveFailedInspections,
                hygieneScore: dorm.hygieneScore,
                selectionLocked: dorm.selectionLocked,
              },
            });
          }
        }
      }

      const overdueVisitors = await Visitor.countDocuments({
        buildingId,
        status: 'overdue',
        scheduledEndTime: { $gte: sevenDaysAgo },
      });

      if (overdueVisitors >= 3) {
        warnings.push({
          level: 'medium',
          type: 'visitor_overdue',
          buildingId,
          buildingName: building.name,
          buildingCode: building.code,
          buildingGender: building.gender,
          reason: `近7天访客超时${overdueVisitors}次`,
          metrics: { overdueVisitors7d: overdueVisitors },
        });
      }
    }

    warnings.sort((a, b) => {
      const levelOrder = { high: 0, medium: 1, low: 2 };
      return levelOrder[a.level] - levelOrder[b.level];
    });

    return {
      totalWarnings: warnings.length,
      highLevelCount: warnings.filter((w) => w.level === 'high').length,
      mediumLevelCount: warnings.filter((w) => w.level === 'medium').length,
      warnings,
      buildingCount: targetBuildings.length,
    };
  }
}

module.exports = ReportService;
