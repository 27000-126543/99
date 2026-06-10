const ElectricityService = require('../services/electricityService');

exports.getMyAccount = async (req, res, next) => {
  try {
    const account = await ElectricityService.getMyAccount(req.user._id);

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

exports.getAccountByDormitory = async (req, res, next) => {
  try {
    const account = await ElectricityService.getAccountByDormitory(req.params.dormitoryId);

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

exports.recharge = async (req, res, next) => {
  try {
    const { dormitoryId, amount, paymentMethod } = req.body;
    const account = await ElectricityService.recharge(
      dormitoryId,
      amount,
      req.user._id,
      paymentMethod
    );

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

exports.rechargeMyDormitory = async (req, res, next) => {
  try {
    const DormitoryAssignment = require('../models/DormitoryAssignment');
    const assignment = await DormitoryAssignment.findOne({
      studentId: req.user._id,
      status: 'confirmed',
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: '您当前没有入住记录' });
    }

    const { amount, paymentMethod } = req.body;
    const account = await ElectricityService.recharge(
      assignment.dormitoryId,
      amount,
      req.user._id,
      paymentMethod
    );

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

exports.consume = async (req, res, next) => {
  try {
    const { dormitoryId, kwh, rate } = req.body;
    const account = await ElectricityService.consume(dormitoryId, kwh, rate);

    res.json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};

exports.getTransactionHistory = async (req, res, next) => {
  try {
    const { dormitoryId } = req.params;
    const { limit } = req.query;
    const transactions = await ElectricityService.getTransactionHistory(
      dormitoryId,
      limit ? parseInt(limit) : 30
    );

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

exports.getMyTransactionHistory = async (req, res, next) => {
  try {
    const DormitoryAssignment = require('../models/DormitoryAssignment');
    const assignment = await DormitoryAssignment.findOne({
      studentId: req.user._id,
      status: 'confirmed',
    });

    if (!assignment) {
      return res.status(404).json({ success: false, message: '您当前没有入住记录' });
    }

    const transactions = await ElectricityService.getTransactionHistory(assignment.dormitoryId);

    res.json({
      success: true,
      data: transactions,
    });
  } catch (error) {
    next(error);
  }
};

exports.createAccount = async (req, res, next) => {
  try {
    const { dormitoryId, buildingId, meterId } = req.body;
    const account = await ElectricityService.createAccount(dormitoryId, buildingId, meterId);

    res.status(201).json({
      success: true,
      data: account,
    });
  } catch (error) {
    next(error);
  }
};
