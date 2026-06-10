const ElectricityAccount = require('../models/ElectricityAccount');
const ElectricityTransaction = require('../models/ElectricityTransaction');
const Dormitory = require('../models/Dormitory');
const DormitoryAssignment = require('../models/DormitoryAssignment');
const NotificationService = require('./notificationService');
const { AppError } = require('../middleware/errorHandler');
const { v4: uuidv4 } = require('uuid');

class ElectricityService {
  static async getAccountByDormitory(dormitoryId) {
    return await ElectricityAccount.findOne({ dormitoryId });
  }

  static async createAccount(dormitoryId, buildingId, meterId) {
    return await ElectricityAccount.create({
      dormitoryId,
      buildingId,
      meterId,
      balance: 0,
      status: 'normal',
    });
  }

  static async recharge(dormitoryId, amount, operatorId = null, paymentMethod = 'wechat') {
    const account = await ElectricityAccount.findOne({ dormitoryId });

    if (!account) {
      throw new AppError('电费账户不存在', 404);
    }

    if (amount <= 0) {
      throw new AppError('充值金额必须大于0', 400);
    }

    const newBalance = account.balance + amount;
    const wasCutoff = account.status === 'cutoff';

    const updates = {
      balance: newBalance,
      totalRecharged: account.totalRecharged + amount,
      updatedAt: Date.now(),
    };

    if (wasCutoff && newBalance > 1) {
      updates.status = 'normal';
      updates.cutoffTriggered = false;
      updates.warningSent = false;
    } else if (newBalance < 10 && newBalance >= 1) {
      updates.status = 'warning';
    }

    await ElectricityAccount.findByIdAndUpdate(account._id, updates);

    await ElectricityTransaction.create({
      accountId: account._id,
      dormitoryId,
      type: 'recharge',
      amount,
      balanceAfter: newBalance,
      operatorId,
      paymentMethod,
      transactionNo: uuidv4(),
      description: `电费充值${amount}元`,
    });

    const students = await DormitoryAssignment.find({
      dormitoryId,
      status: 'confirmed',
    });

    for (const assignment of students) {
      await NotificationService.sendToStudent(
        assignment.studentId,
        'electricity_recharged',
        '电费充值成功',
        `您已成功充值${amount}元，当前余额${newBalance.toFixed(2)}元`,
        account._id,
        'ElectricityAccount'
      );
    }

    if (wasCutoff && newBalance > 1) {
      for (const assignment of students) {
        await NotificationService.sendToStudent(
          assignment.studentId,
          'electricity_restored',
          '供电已恢复',
          `电费余额已充足，供电已自动恢复`,
          account._id,
          'ElectricityAccount'
        );
      }
    }

    return await ElectricityAccount.findById(account._id);
  }

  static async consume(dormitoryId, kwh, rate = 0.6) {
    const account = await ElectricityAccount.findOne({ dormitoryId });

    if (!account) {
      throw new AppError('电费账户不存在', 404);
    }

    const amount = kwh * rate;
    const newBalance = Math.max(0, account.balance - amount);
    const warningThreshold = parseFloat(process.env.ELETRICITY_WARNING_THRESHOLD) || 10;
    const cutoffThreshold = parseFloat(process.env.ELETRICITY_CUTOFF_THRESHOLD) || 1;

    const updates = {
      balance: newBalance,
      totalConsumed: account.totalConsumed + amount,
      lastReading: account.lastReading + kwh,
      lastReadingDate: Date.now(),
      updatedAt: Date.now(),
    };

    if (newBalance < cutoffThreshold && !account.cutoffTriggered) {
      updates.status = 'cutoff';
      updates.cutoffTriggered = true;
    } else if (newBalance < warningThreshold && newBalance >= cutoffThreshold && !account.warningSent) {
      updates.status = 'warning';
      updates.warningSent = true;
    }

    await ElectricityAccount.findByIdAndUpdate(account._id, updates);

    await ElectricityTransaction.create({
      accountId: account._id,
      dormitoryId,
      type: 'consumption',
      amount: -amount,
      balanceAfter: newBalance,
      kwh,
      description: `用电消耗${kwh.toFixed(2)}度`,
    });

    const students = await DormitoryAssignment.find({
      dormitoryId,
      status: 'confirmed',
    });

    if (updates.status === 'warning' && !account.warningSent) {
      for (const assignment of students) {
        await NotificationService.sendToStudent(
          assignment.studentId,
          'electricity_warning',
          '电费余额预警',
          `当前电费余额${newBalance.toFixed(2)}元，已低于${warningThreshold}元，请及时充值`,
          account._id,
          'ElectricityAccount'
        );
      }
    }

    if (updates.status === 'cutoff' && !account.cutoffTriggered) {
      for (const assignment of students) {
        await NotificationService.sendToStudent(
          assignment.studentId,
          'electricity_cutoff',
          '供电已自动切断',
          `电费余额${newBalance.toFixed(2)}元已低于${cutoffThreshold}元，供电已自动切断，请及时充值恢复供电`,
          account._id,
          'ElectricityAccount'
        );
      }
    }

    return await ElectricityAccount.findById(account._id);
  }

  static async checkAndSendWarnings() {
    const warningThreshold = parseFloat(process.env.ELETRICITY_WARNING_THRESHOLD) || 10;
    const cutoffThreshold = parseFloat(process.env.ELETRICITY_CUTOFF_THRESHOLD) || 1;

    const warningAccounts = await ElectricityAccount.find({
      balance: { $lt: warningThreshold, $gte: cutoffThreshold },
      warningSent: false,
      status: { $ne: 'cutoff' },
    });

    const cutoffAccounts = await ElectricityAccount.find({
      balance: { $lt: cutoffThreshold },
      cutoffTriggered: false,
    });

    for (const account of warningAccounts) {
      const students = await DormitoryAssignment.find({
        dormitoryId: account.dormitoryId,
        status: 'confirmed',
      });

      for (const assignment of students) {
        await NotificationService.sendToStudent(
          assignment.studentId,
          'electricity_warning',
          '电费余额预警',
          `当前电费余额${account.balance.toFixed(2)}元，已低于${warningThreshold}元，请及时充值`,
          account._id,
          'ElectricityAccount'
        );
      }

      await ElectricityAccount.findByIdAndUpdate(account._id, {
        warningSent: true,
        status: 'warning',
      });
    }

    for (const account of cutoffAccounts) {
      const students = await DormitoryAssignment.find({
        dormitoryId: account.dormitoryId,
        status: 'confirmed',
      });

      for (const assignment of students) {
        await NotificationService.sendToStudent(
          assignment.studentId,
          'electricity_cutoff',
          '供电已自动切断',
          `电费余额${account.balance.toFixed(2)}元已低于${cutoffThreshold}元，供电已自动切断`,
          account._id,
          'ElectricityAccount'
        );
      }

      await ElectricityAccount.findByIdAndUpdate(account._id, {
        cutoffTriggered: true,
        status: 'cutoff',
      });
    }

    return { warned: warningAccounts.length, cutoff: cutoffAccounts.length };
  }

  static async getMyAccount(studentId) {
    const assignment = await DormitoryAssignment.findOne({
      studentId,
      status: 'confirmed',
    });

    if (!assignment) {
      throw new AppError('您当前没有入住记录', 404);
    }

    const account = await ElectricityAccount.findOne({
      dormitoryId: assignment.dormitoryId,
    }).populate('dormitoryId');

    return account;
  }

  static async getTransactionHistory(dormitoryId, limit = 30) {
    return await ElectricityTransaction.find({ dormitoryId })
      .sort({ createdAt: -1 })
      .limit(limit);
  }
}

module.exports = ElectricityService;
