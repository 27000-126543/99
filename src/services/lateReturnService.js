const AccessRecord = require('../models/AccessRecord');
const LateReturn = require('../models/LateReturn');
const InterviewTask = require('../models/InterviewTask');
const DormitoryAssignment = require('../models/DormitoryAssignment');
const NotificationService = require('./notificationService');
const { AppError } = require('../middleware/errorHandler');
const moment = require('moment');

class LateReturnService {
  static async recordAccess(studentId, buildingId, doorType) {
    const accessTime = new Date();

    const record = await AccessRecord.create({
      studentId,
      buildingId,
      doorType,
      accessTime,
    });

    const lateThresholdHour = parseInt(process.env.LATE_RETURN_THRESHOLD_HOUR) || 23;
    const hour = accessTime.getHours();
    const isLateReturn = doorType === 'entry' && hour >= lateThresholdHour;

    if (isLateReturn) {
      await AccessRecord.findByIdAndUpdate(record._id, { isLateReturn: true });
      await this.processLateReturn(studentId, buildingId, record._id, accessTime);
    }

    return record;
  }

  static async processLateReturn(studentId, buildingId, accessRecordId, accessTime) {
    const lateThresholdHour = parseInt(process.env.LATE_RETURN_THRESHOLD_HOUR) || 23;
    const lateThreshold = moment(accessTime).hour(lateThresholdHour).minute(0).second(0).toDate();
    const lateMinutes = Math.round((accessTime - lateThreshold) / 60000);

    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    const countInMonth = await LateReturn.countDocuments({
      studentId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    }) + 1;

    const notifyCount = parseInt(process.env.LATE_RETURN_NOTIFY_COUNT) || 3;
    const interviewCount = parseInt(process.env.LATE_RETURN_INTERVIEW_COUNT) || 5;

    const lateReturn = await LateReturn.create({
      studentId,
      accessRecordId,
      buildingId,
      returnTime: accessTime,
      lateMinutes,
      countInMonth,
      status: 'recorded',
    });

    const assignment = await DormitoryAssignment.findOne({
      studentId,
      status: 'confirmed',
    }).populate('studentId');

    if (assignment && assignment.studentId && assignment.studentId.studentInfo) {
      const counselorId = assignment.studentId.studentInfo.counselorId;

      if (countInMonth >= notifyCount && !lateReturn.counselorNotified && counselorId) {
        await LateReturn.findByIdAndUpdate(lateReturn._id, {
          counselorNotified: true,
          status: 'notified',
        });

        await NotificationService.sendToCounselor(
          counselorId,
          'late_return',
          '学生晚归违纪通知',
          `${assignment.studentId.realName}本月已晚归${countInMonth}次，请关注`,
          lateReturn._id,
          'LateReturn'
        );
      }

      if (countInMonth >= interviewCount && !lateReturn.interviewTriggered && counselorId) {
        await LateReturn.findByIdAndUpdate(lateReturn._id, {
          interviewTriggered: true,
        });

        await InterviewTask.create({
          studentId,
          counselorId,
          triggerType: 'late_return',
          lateReturnCount: countInMonth,
          description: `本月晚归累计${countInMonth}次，需要约谈`,
          status: 'pending',
        });

        await NotificationService.sendToCounselor(
          counselorId,
          'interview_scheduled',
          '约谈任务已生成',
          `${assignment.studentId.realName}本月晚归累计${countInMonth}次，请安排约谈`,
          lateReturn._id,
          'InterviewTask'
        );
      }
    }

    await NotificationService.sendToStudent(
      studentId,
      'late_return',
      '晚归记录提醒',
      `您于${moment(accessTime).format('HH:mm')}返回宿舍，已被记录为晚归（晚归${lateMinutes}分钟），本月累计${countInMonth}次`,
      lateReturn._id,
      'LateReturn'
    );

    return lateReturn;
  }

  static async getMyLateReturns(studentId) {
    return await LateReturn.find({ studentId })
      .sort({ createdAt: -1 })
      .populate('buildingId', 'name');
  }

  static async getMonthlyCount(studentId) {
    const startOfMonth = moment().startOf('month').toDate();
    const endOfMonth = moment().endOf('month').toDate();

    return await LateReturn.countDocuments({
      studentId,
      createdAt: { $gte: startOfMonth, $lte: endOfMonth },
    });
  }

  static async getCounselorLateReturns(counselorId) {
    const students = await DormitoryAssignment.aggregate([
      {
        $lookup: {
          from: 'users',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      {
        $match: {
          'student.studentInfo.counselorId': counselorId,
          status: 'confirmed',
        },
      },
      {
        $project: { studentId: 1 },
      },
    ]);

    const studentIds = students.map((s) => s.studentId);

    return await LateReturn.find({
      studentId: { $in: studentIds },
    })
      .sort({ createdAt: -1 })
      .populate('studentId', 'realName studentId studentInfo')
      .populate('buildingId', 'name');
  }

  static async getInterviewTasks(userId, role) {
    let query = {};

    if (role === 'counselor') {
      query.counselorId = userId;
    } else if (role === 'student') {
      query.studentId = userId;
    }

    return await InterviewTask.find(query)
      .sort({ createdAt: -1 })
      .populate('studentId', 'realName phone studentId')
      .populate('counselorId', 'realName phone');
  }

  static async completeInterview(taskId, outcome, notes) {
    const task = await InterviewTask.findById(taskId);

    if (!task) {
      throw new AppError('约谈任务不存在', 404);
    }

    await InterviewTask.findByIdAndUpdate(taskId, {
      status: 'completed',
      completedAt: Date.now(),
      outcome,
      notes,
    });

    await NotificationService.sendToStudent(
      task.studentId,
      'interview_scheduled',
      '约谈已完成',
      `您的约谈任务已完成，结果：${outcome || '已记录'}`,
      task._id,
      'InterviewTask'
    );

    return await InterviewTask.findById(taskId);
  }
}

module.exports = LateReturnService;
