const HygieneService = require('../services/hygieneService');

exports.generateWeeklyTasks = async (req, res, next) => {
  try {
    const count = await HygieneService.generateWeeklyTasks();

    res.json({
      success: true,
      data: { generatedCount: count },
    });
  } catch (error) {
    next(error);
  }
};

exports.getPendingTasks = async (req, res, next) => {
  try {
    const { buildingId } = req.query;
    const tasks = await HygieneService.getPendingTasks(buildingId);

    res.json({
      success: true,
      data: tasks,
    });
  } catch (error) {
    next(error);
  }
};

exports.submitInspection = async (req, res, next) => {
  try {
    const { scores, photos, issues, remarks } = req.body;
    const task = await HygieneService.submitInspection(
      req.user._id,
      req.params.id,
      scores,
      photos,
      issues,
      remarks
    );

    res.json({
      success: true,
      data: task,
    });
  } catch (error) {
    next(error);
  }
};

exports.getInspectionHistory = async (req, res, next) => {
  try {
    const { dormitoryId, limit } = req.query;
    const history = await HygieneService.getInspectionHistory(
      dormitoryId,
      limit ? parseInt(limit) : 20
    );

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyDormitoryHygiene = async (req, res, next) => {
  try {
    const status = await HygieneService.getDormitoryHygieneStatus(req.user._id);

    res.json({
      success: true,
      data: status,
    });
  } catch (error) {
    next(error);
  }
};

exports.getBuildingInspections = async (req, res, next) => {
  try {
    const { buildingId, weekNumber } = req.query;
    const inspections = await HygieneService.getBuildingInspections(buildingId, weekNumber);

    res.json({
      success: true,
      data: inspections,
    });
  } catch (error) {
    next(error);
  }
};

exports.unlockDormitorySelection = async (req, res, next) => {
  try {
    const dormitory = await HygieneService.unlockDormitorySelection(req.params.id);

    res.json({
      success: true,
      data: dormitory,
    });
  } catch (error) {
    next(error);
  }
};
