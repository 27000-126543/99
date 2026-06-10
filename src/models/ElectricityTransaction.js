const mongoose = require('mongoose');

const electricityTransactionSchema = new mongoose.Schema({
  accountId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ElectricityAccount',
    required: true,
  },
  dormitoryId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Dormitory',
    required: true,
  },
  type: {
    type: String,
    enum: ['recharge', 'consumption', 'refund', 'adjustment'],
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  balanceAfter: {
    type: Number,
    required: true,
  },
  operatorId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  paymentMethod: {
    type: String,
    enum: ['wechat', 'alipay', 'cash', 'card', 'system'],
  },
  transactionNo: String,
  description: String,
  kwh: Number,
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

electricityTransactionSchema.index({ accountId: 1, createdAt: -1 });

module.exports = mongoose.model('ElectricityTransaction', electricityTransactionSchema);
