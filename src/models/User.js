const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
    select: false,
  },
  realName: {
    type: String,
    required: true,
  },
  role: {
    type: String,
    enum: ['student', 'dorm_manager', 'counselor', 'maintenance', 'security', 'admin'],
    required: true,
  },
  phone: String,
  email: String,
  avatar: String,
  status: {
    type: String,
    enum: ['active', 'inactive', 'suspended'],
    default: 'active',
  },
  studentInfo: {
    studentId: String,
    major: String,
    grade: String,
    gender: { type: String, enum: ['male', 'female'] },
    sleepPreference: { type: String, enum: ['early', 'normal', 'late'] },
    class: String,
    counselorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  maintenanceInfo: {
    skills: [String],
    currentLoad: { type: Number, default: 0 },
    rating: { type: Number, default: 5 },
  },
  dormManagerInfo: {
    buildingIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Building' }],
  },
  counselorInfo: {
    department: String,
    studentIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

userSchema.methods.generateAuthToken = function () {
  return jwt.sign(
    { id: this._id, role: this.role, username: this.username },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '7d' }
  );
};

module.exports = mongoose.model('User', userSchema);
