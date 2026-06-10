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

exports.getBuildingComparison = async (req, res, next) => {
  try {
    const { buildingIds, startDate, endDate } = req.query;
    let buildingIdsArray = buildingIds;
    if (buildingIds && typeof buildingIds === 'string') {
      buildingIdsArray = buildingIds.split(',').map((id) => id.trim());
    }

    const data = await ReportService.getBuildingComparison({
      buildingIds: buildingIdsArray,
      startDate,
      endDate,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTrendAnalysis = async (req, res, next) => {
  try {
    const { buildingIds, startDate, endDate, interval, gender } = req.query;
    let buildingIdsArray = buildingIds;
    if (buildingIds && typeof buildingIds === 'string') {
      buildingIdsArray = buildingIds.split(',').map((id) => id.trim());
    }

    const data = await ReportService.getTrendAnalysis({
      buildingIds: buildingIdsArray,
      startDate,
      endDate,
      interval,
      gender,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.getRiskWarnings = async (req, res, next) => {
  try {
    const { buildingIds, gender } = req.query;
    let buildingIdsArray = buildingIds;
    if (buildingIds && typeof buildingIds === 'string') {
      buildingIdsArray = buildingIds.split(',').map((id) => id.trim());
    }

    const data = await ReportService.getRiskWarnings({
      buildingIds: buildingIdsArray,
      gender,
    });

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    next(error);
  }
};

exports.exportReport = async (req, res, next) => {
  try {
    const { buildingId, buildingIds, startDate, endDate, format } = req.query;
    let buildingIdsArray = buildingIds;
    if (buildingIds && typeof buildingIds === 'string') {
      buildingIdsArray = buildingIds.split(',').map((id) => id.trim());
    }

    const workbook = await ReportService.exportToExcel({
      buildingId,
      buildingIds: buildingIdsArray,
      startDate,
      endDate,
      format,
    });

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
