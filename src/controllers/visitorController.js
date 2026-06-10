const VisitorService = require('../services/visitorService');

exports.createRequest = async (req, res, next) => {
  try {
    const result = await VisitorService.createVisitorRequest(req.user, req.body);

    if (result.success === false) {
      return res.status(400).json({
        success: false,
        message: result.message,
        availableSlots: result.availableSlots,
      });
    }

    res.status(201).json({
      success: true,
      autoSelectedTime: result.autoSelectedTime,
      autoSelectedDate: result.autoSelectedDate,
      data: result.data,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAvailableTimeSlots = async (req, res, next) => {
  try {
    const { buildingId, date, autoFindNext } = req.query;
    const queryDate = date ? new Date(date) : new Date();
    let slots = await VisitorService.getAvailableTimeSlots(buildingId, queryDate);

    if (autoFindNext === 'true' && slots.availableSlots.length === 0) {
      const nextAvailable = await VisitorService.getNextAvailableSlot(buildingId);
      if (nextAvailable) {
        return res.json({
          success: true,
          data: {
            ...nextAvailable.slotData,
            nextAvailableDate: nextAvailable.date,
            nextAvailableSlot: nextAvailable.slot,
          },
        });
      }
    }

    res.json({
      success: true,
      data: slots,
    });
  } catch (error) {
    next(error);
  }
};

exports.getCurrentCount = async (req, res, next) => {
  try {
    const { buildingId } = req.params;
    const count = await VisitorService.getCurrentVisitorCount(buildingId);

    res.json({
      success: true,
      data: { count },
    });
  } catch (error) {
    next(error);
  }
};

exports.approveVisitor = async (req, res, next) => {
  try {
    const visitor = await VisitorService.approveVisitor(req.user, req.params.id);

    res.json({
      success: true,
      data: visitor,
    });
  } catch (error) {
    next(error);
  }
};

exports.rejectVisitor = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const visitor = await VisitorService.rejectVisitor(req.user, req.params.id, reason);

    res.json({
      success: true,
      data: visitor,
    });
  } catch (error) {
    next(error);
  }
};

exports.checkIn = async (req, res, next) => {
  try {
    const { passCode } = req.body;
    const visitor = await VisitorService.checkInVisitor(passCode);

    res.json({
      success: true,
      data: visitor,
    });
  } catch (error) {
    next(error);
  }
};

exports.checkOut = async (req, res, next) => {
  try {
    const visitor = await VisitorService.checkOutVisitor(req.params.id);

    res.json({
      success: true,
      data: visitor,
    });
  } catch (error) {
    next(error);
  }
};

exports.getVisitorList = async (req, res, next) => {
  try {
    const { buildingId, status, date } = req.query;
    const visitors = await VisitorService.getVisitorList(buildingId, status, date);

    res.json({
      success: true,
      data: visitors,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyVisitors = async (req, res, next) => {
  try {
    const Visitor = require('../models/Visitor');
    const visitors = await Visitor.find({ hostStudentId: req.user._id })
      .sort({ createdAt: -1 })
      .populate('buildingId', 'name');

    res.json({
      success: true,
      data: visitors,
    });
  } catch (error) {
    next(error);
  }
};
