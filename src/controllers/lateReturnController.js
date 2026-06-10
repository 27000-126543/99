const LateReturnService = require('../services/lateReturnService');

exports.recordAccess = async (req, res, next) => {
  try {
    const { studentId, buildingId, doorType } = req.body;
    const record = await LateReturnService.recordAccess(studentId, buildingId, doorType);

    res.status(201).json({
      success: true,
      data: record,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyLateReturns = async (req, res, next) => {
  try {
    const records = await LateReturnService.getMyLateReturns(req.user._id);
    const monthlyCount = await LateReturnService.getMonthlyCount(req.user._id);

    res.json({
      success: true,
      data: {
        records,
        monthlyCount,
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getCounselorLateReturns = async (req, res, next) => {
  try {
    const records = await LateReturnService.getCounselorLateReturns(req.user._id);

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};

exports.getInterviewTasks = async (req, res, next) => {
  try {
    const tasks = await LateReturnService.getInterviewTasks(req.user._id, req.user.role);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

exports.completeInterview = async (req, res, next) => {
  try {
    const { outcome, notes } = req.body;
    const task = await LateReturnService.completeInterview(req.params.id, outcome, notes);

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

exports.scheduleInterview = async (req, res, next) => {
  try {
    const InterviewTask = require('../models/InterviewTask');
    const { scheduledTime, description } = req.body;

    const task = await InterviewTask.findByIdAndUpdate(
      req.params.id,
      {
        scheduledTime,
        description,
        status: 'scheduled',
      },
      { new: true }
    );

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAccessRecords = async (req, res, next) => {
  try {
    const AccessRecord = require('../models/AccessRecord');
    const { studentId, buildingId, startDate, endDate, limit = 50 } = req.query;

    const query = {};
    if (studentId) query.studentId = studentId;
    if (buildingId) query.buildingId = buildingId;
    if (startDate && endDate) {
      query.accessTime = {
        $gte: new Date(startDate),
        $lte: new Date(endDate),
      };
    }

    const records = await AccessRecord.find(query)
      .sort({ accessTime: -1 })
      .limit(parseInt(limit))
      .populate('studentId', 'realName studentId')
      .populate('buildingId', 'name');

    res.json({
      success: true,
      data: records,
    });
  } catch (error) {
    next(error);
  }
};
