const DormitoryService = require('../services/dormitoryService');

exports.autoAssign = async (req, res, next) => {
  try {
    const assignment = await DormitoryService.autoAssignDormitory(req.user);

    res.status(201).json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAvailableDormitories = async (req, res, next) => {
  try {
    const dormitories = await DormitoryService.getAvailableDormitories(req.user);

    res.json({
      success: true,
      data: dormitories,
    });
  } catch (error) {
    next(error);
  }
};

exports.selectBed = async (req, res, next) => {
  try {
    const { bedId } = req.body;
    const result = await DormitoryService.selectBed(req.user, bedId);

    if (result.success === false) {
      return res.status(400).json({
        success: false,
        message: result.message,
        recommendations: result.recommendations,
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyAssignment = async (req, res, next) => {
  try {
    const assignment = await DormitoryService.getMyAssignment(req.user._id);

    res.json({
      success: true,
      data: assignment,
    });
  } catch (error) {
    next(error);
  }
};

exports.getRecommendations = async (req, res, next) => {
  try {
    const recommendations = await DormitoryService.getRecommendations(req.user);

    res.json({
      success: true,
      data: recommendations,
    });
  } catch (error) {
    next(error);
  }
};

exports.getDormitoryList = async (req, res, next) => {
  try {
    const { buildingId, floor } = req.query;
    const Dormitory = require('../models/Dormitory');

    const query = {};
    if (buildingId) query.buildingId = buildingId;
    if (floor) query.floor = floor;

    const dormitories = await Dormitory.find(query)
      .populate('buildingId', 'name')
      .populate('beds');

    res.json({
      success: true,
      data: dormitories,
    });
  } catch (error) {
    next(error);
  }
};

exports.getBuildingList = async (req, res, next) => {
  try {
    const Building = require('../models/Building');
    const buildings = await Building.find({}).populate('managerId', 'realName phone');

    res.json({
      success: true,
      data: buildings,
    });
  } catch (error) {
    next(error);
  }
};

exports.createBuilding = async (req, res, next) => {
  try {
    const Building = require('../models/Building');
    const building = await Building.create(req.body);

    res.status(201).json({
      success: true,
      data: building,
    });
  } catch (error) {
    next(error);
  }
};

exports.createDormitory = async (req, res, next) => {
  try {
    const Dormitory = require('../models/Dormitory');
    const Bed = require('../models/Bed');

    const dormitory = await Dormitory.create(req.body);

    const beds = [];
    for (let i = 1; i <= dormitory.capacity; i++) {
      const bed = await Bed.create({
        dormitoryId: dormitory._id,
        buildingId: dormitory.buildingId,
        bedNumber: `${dormitory.roomNumber}-${i}`,
        status: 'available',
      });
      beds.push(bed._id);
    }

    dormitory.beds = beds;
    await dormitory.save();

    res.status(201).json({
      success: true,
      data: dormitory,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAssignmentHistory = async (req, res, next) => {
  try {
    const history = await DormitoryService.getAssignmentHistory(req.user._id);

    res.json({
      success: true,
      data: history,
    });
  } catch (error) {
    next(error);
  }
};

exports.createTransferRequest = async (req, res, next) => {
  try {
    const request = await DormitoryService.createTransferRequest(req.user, req.body);

    res.status(201).json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransferRequests = async (req, res, next) => {
  try {
    const { status } = req.query;
    const requests = await DormitoryService.getTransferRequests(
      req.user._id,
      req.user.role,
      status
    );

    res.json({
      success: true,
      data: requests,
    });
  } catch (error) {
    next(error);
  }
};

exports.approveTransferRequest = async (req, res, next) => {
  try {
    const request = await DormitoryService.reviewTransferRequest(
      req.user,
      req.params.id,
      'approve',
      req.body
    );

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectTransferRequest = async (req, res, next) => {
  try {
    const request = await DormitoryService.reviewTransferRequest(
      req.user,
      req.params.id,
      'reject',
      req.body
    );

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelTransferRequest = async (req, res, next) => {
  try {
    const request = await DormitoryService.cancelTransferRequest(req.user, req.params.id);

    res.json({
      success: true,
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

exports.checkOutDormitory = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const result = await DormitoryService.checkOutDormitory(req.user, reason);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};
