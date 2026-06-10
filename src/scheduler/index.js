const cron = require('node-cron');
const RepairService = require('../services/repairService');
const ElectricityService = require('../services/electricityService');
const VisitorService = require('../services/visitorService');
const ReportService = require('../services/reportService');
const HygieneService = require('../services/hygieneService');
const Building = require('../models/Building');
const moment = require('moment');

class Scheduler {
  static init() {
    console.log('Initializing scheduled tasks...');

    cron.schedule('*/5 * * * *', async () => {
      try {
        const count = await RepairService.checkAndEscalateOrders();
        if (count > 0) {
          console.log(`[${moment().format()}] Escalated ${count} repair orders`);
        }
      } catch (error) {
        console.error('Repair escalation error:', error);
      }
    });

    cron.schedule('*/10 * * * *', async () => {
      try {
        const result = await ElectricityService.checkAndSendWarnings();
        if (result.warned > 0 || result.cutoff > 0) {
          console.log(`[${moment().format()}] Electricity: ${result.warned} warnings, ${result.cutoff} cutoffs`);
        }
      } catch (error) {
        console.error('Electricity warning error:', error);
      }
    });

    cron.schedule('*/15 * * * *', async () => {
      try {
        const count = await VisitorService.checkOverdueVisitors();
        if (count > 0) {
          console.log(`[${moment().format()}] Found ${count} overdue visitors`);
        }
      } catch (error) {
        console.error('Visitor overdue check error:', error);
      }
    });

    cron.schedule('0 0 * * *', async () => {
      try {
        console.log(`[${moment().format()}] Generating daily report...`);
        const report = await ReportService.generateDailyReport();
        console.log(`Daily report generated: ${report._id}`);

        const buildings = await Building.find({});
        for (const building of buildings) {
          await ReportService.generateBuildingDailyReport(building._id);
        }
        console.log(`Generated reports for ${buildings.length} buildings`);
      } catch (error) {
        console.error('Daily report generation error:', error);
      }
    });

    cron.schedule('0 2 * * 1', async () => {
      try {
        console.log(`[${moment().format()}] Generating weekly hygiene tasks...`);
        const count = await HygieneService.generateWeeklyTasks();
        console.log(`Generated ${count} hygiene inspection tasks`);
      } catch (error) {
        console.error('Hygiene task generation error:', error);
      }
    });

    console.log('Scheduled tasks initialized successfully');
  }

  static async runInitialTasks() {
    try {
      const todayStart = moment().startOf('day').toDate();
      const OperationReport = require('../models/OperationReport');
      const existingReport = await OperationReport.findOne({
        reportDate: todayStart,
        reportType: 'daily',
      });

      if (!existingReport) {
        console.log('Generating initial daily report...');
        await ReportService.generateDailyReport();
      }
    } catch (error) {
      console.error('Initial task error:', error);
    }
  }
}

module.exports = Scheduler;
