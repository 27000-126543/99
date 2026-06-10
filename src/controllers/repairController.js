const RepairService = require('../services/repairService');

exports.createOrder = async (req, res, next) => {
  try {
    const order = await RepairService.createRepairOrder(req.user, req.body);

    res.status(201).json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyOrders = async (req, res, next) => {
  try {
    const { status } = req.query;
    const orders = await RepairService.getMyOrders(
      req.user._id,
      req.user.role,
      status
    );

    res.json({
      success: true,
      data: orders,
    });
  } catch (error) {
    next(error);
  }
};

exports.getOrderById = async (req, res, next) => {
  try {
    const RepairOrder = require('../models/RepairOrder');
    const order = await RepairOrder.findById(req.params.id)
      .populate('studentId', 'realName phone')
      .populate('assignedWorkerId', 'realName phone')
      .populate('dormitoryId', 'roomNumber')
      .populate('buildingId', 'name');

    if (!order) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

exports.acceptOrder = async (req, res, next) => {
  try {
    const order = await RepairService.acceptOrder(req.user, req.params.id);

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

exports.startOrder = async (req, res, next) => {
  try {
    const RepairOrder = require('../models/RepairOrder');
    const order = await RepairOrder.findByIdAndUpdate(
      req.params.id,
      { status: 'in_progress' },
      { new: true }
    );

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

exports.completeOrder = async (req, res, next) => {
  try {
    const order = await RepairService.completeOrder(req.user, req.params.id, req.body);

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

exports.rateOrder = async (req, res, next) => {
  try {
    const { rating, feedback } = req.body;
    const order = await RepairService.rateOrder(
      req.user,
      req.params.id,
      rating,
      feedback
    );

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};

exports.cancelOrder = async (req, res, next) => {
  try {
    const RepairOrder = require('../models/RepairOrder');
    const order = await RepairOrder.findById(req.params.id);

    if (!order) {
      return res.status(404).json({ success: false, message: '工单不存在' });
    }

    if (order.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: '无权取消此工单' });
    }

    if (!['pending', 'assigned'].includes(order.status)) {
      return res.status(400).json({ success: false, message: '工单状态不允许取消' });
    }

    order.status = 'cancelled';
    await order.save();

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    next(error);
  }
};
