const ReportService = require('../services/reportService');

exports.generateDailyReport = async (req, res, next) => {
  try {
    const { date } = req.query;
    const report = await ReportService.generateDailyReport(date ? new Date(date) : new Date());

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

exports.generateBuildingReport = async (req, res, next) => {
  try {
    const { buildingId, date } = req.query;
    const report = await ReportService.generateBuildingDailyReport(
      buildingId,
      date ? new Date(date) : new Date()
    );

    res.json({
      success: true,
      data: report,
    });
  } catch (error) {
    next(error);
  }
};

exports.getReports = async (req, res, next) => {
  try {
    const reports = await ReportService.getReports(req.query);

    res.json({
      success: true,
      data: reports,
    });
  } catch (error) {
    next(error);
  }
};

exports.exportReport = async (req, res, next) => {
  try {
    const { buildingId, startDate, endDate } = req.query;
    const workbook = await ReportService.exportToExcel(buildingId, startDate, endDate);

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename=operation_report_${Date.now()}.xlsx`
    );

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    next(error);
  }
};

exports.getDashboardData = async (req, res, next) => {
  try {
    const { buildingId } = req.query;
    const data = await ReportService.getDashboardData(buildingId);

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};
