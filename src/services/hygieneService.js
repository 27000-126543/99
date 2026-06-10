const HygieneInspection = require('../models/HygieneInspection');
const Dormitory = require('../models/Dormitory');
const Building = require('../models/Building');
const DormitoryAssignment = require('../models/DormitoryAssignment');
const NotificationService = require('./notificationService');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

class HygieneService {
  static generateTaskNo() {
    const date = moment().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `HG${date}${random}`;
  }

  static async generateWeeklyTasks() {
    const weekNumber = moment().isoWeek();
    const academicYear = moment().format('YYYY');
    const semester = moment().month() < 6 ? 'spring' : 'autumn';
    const scheduledDate = moment().startOf('week').add(2, 'days').toDate();

    const dormitories = await Dormitory.find({ occupiedCount: { $gt: 0 } });

    const tasks = [];
    for (const dorm of dormitories) {
      const existingTask = await HygieneInspection.findOne({
        dormitoryId: dorm._id,
        weekNumber,
        academicYear,
        semester,
      });

      if (!existingTask) {
        const task = await HygieneInspection.create({
          taskNo: this.generateTaskNo(),
          weekNumber,
          academicYear,
          semester,
          buildingId: dorm.buildingId,
          dormitoryId: dorm._id,
          scheduledDate,
          status: 'scheduled',
        });
        tasks.push(task);
      }
    }

    return tasks.length;
  }

  static async getPendingTasks(buildingId) {
    let query = { status: 'scheduled' };
    if (buildingId) {
      query.buildingId = buildingId;
    }

    return await HygieneInspection.find(query)
      .sort({ scheduledDate: 1 })
      .populate('dormitoryId', 'roomNumber occupiedCount')
      .populate('buildingId', 'name');
  }

  static async submitInspection(inspectorId, taskId, scores, photos, issues, remarks) {
    const task = await HygieneInspection.findById(taskId);

    if (!task) {
      throw new AppError('检查任务不存在', 404);
    }

    if (task.status !== 'scheduled' && task.status !== 'in_progress') {
      throw new AppError('任务状态不允许提交', 400);
    }

    const overall = scores.overall
      ? scores.overall
      : Math.round((scores.cleanliness + scores.tidiness + scores.safety) / 3);

    const isPassed = overall >= 60;

    await HygieneInspection.findByIdAndUpdate(taskId, {
      inspectorId,
      inspectionDate: Date.now(),
      status: 'completed',
      scores: {
        cleanliness: scores.cleanliness,
        tidiness: scores.tidiness,
        safety: scores.safety,
        overall,
      },
      isPassed,
      photos: photos || [],
      issues: issues || [],
      remarks,
    });

    const dormitory = await Dormitory.findById(task.dormitoryId);
    if (dormitory) {
      let consecutiveFailed = isPassed ? 0 : dormitory.consecutiveFailedInspections + 1;
      let selectionLocked = dormitory.selectionLocked;

      if (consecutiveFailed >= 2) {
        selectionLocked = true;
      }

      const newHygieneScore = Math.round((dormitory.hygieneScore + overall) / 2);
      const newComprehensiveScore = Math.round((dormitory.comprehensiveScore * 0.7 + overall * 0.3));

      await Dormitory.findByIdAndUpdate(task.dormitoryId, {
        hygieneScore: newHygieneScore,
        comprehensiveScore: newComprehensiveScore,
        consecutiveFailedInspections: consecutiveFailed,
        selectionLocked,
      });

      const students = await DormitoryAssignment.find({
        dormitoryId: task.dormitoryId,
        status: 'confirmed',
      });

      for (const assignment of students) {
        await NotificationService.sendToStudent(
          assignment.studentId,
          'hygiene_inspection',
          isPassed ? '卫生检查已通过' : '卫生检查未通过',
          `本次卫生检查得分：${overall}分${isPassed ? '' : '，请及时整改'}`,
          task._id,
          'HygieneInspection'
        );

        if (selectionLocked && !dormitory.selectionLocked) {
          await NotificationService.sendToStudent(
            assignment.studentId,
            'hygiene_failed',
            '下学期选宿资格已锁定',
            `您所在宿舍连续两次卫生检查不及格，下学期选宿资格已被锁定`,
            task._id,
            'HygieneInspection'
          );
        }
      }
    }

    return await HygieneInspection.findById(taskId);
  }

  static async getInspectionHistory(dormitoryId, limit = 20) {
    let query = {};
    if (dormitoryId) {
      query.dormitoryId = dormitoryId;
    }

    return await HygieneInspection.find(query)
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate('dormitoryId', 'roomNumber')
      .populate('buildingId', 'name')
      .populate('inspectorId', 'realName');
  }

  static async getDormitoryHygieneStatus(studentId) {
    const assignment = await DormitoryAssignment.findOne({
      studentId,
      status: 'confirmed',
    });

    if (!assignment) {
      throw new AppError('您当前没有入住记录', 404);
    }

    const dormitory = await Dormitory.findById(assignment.dormitoryId);
    const history = await this.getInspectionHistory(assignment.dormitoryId, 10);

    return {
      dormitory,
      history,
      consecutiveFailed: dormitory.consecutiveFailedInspections,
      selectionLocked: dormitory.selectionLocked,
    };
  }

  static async unlockDormitorySelection(dormitoryId) {
    const dormitory = await Dormitory.findById(dormitoryId);

    if (!dormitory) {
      throw new AppError('宿舍不存在', 404);
    }

    await Dormitory.findByIdAndUpdate(dormitoryId, {
      selectionLocked: false,
      consecutiveFailedInspections: 0,
    });

    const students = await DormitoryAssignment.find({
      dormitoryId,
      status: 'confirmed',
    });

    for (const assignment of students) {
      await NotificationService.sendToStudent(
        assignment.studentId,
        'hygiene_failed',
        '选宿资格已解锁',
        `您所在宿舍的选宿资格已解除锁定`,
        dormitoryId,
        'Dormitory'
      );
    }

    return await Dormitory.findById(dormitoryId);
  }

  static async getBuildingInspections(buildingId, weekNumber) {
    let query = { buildingId };
    if (weekNumber) {
      query.weekNumber = weekNumber;
    }

    return await HygieneInspection.find(query)
      .sort({ scheduledDate: -1 })
      .populate('dormitoryId', 'roomNumber')
      .populate('inspectorId', 'realName');
  }
}

module.exports = HygieneService;
