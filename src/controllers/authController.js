const User = require('../models/User');
const Notification = require('../models/Notification');
const NotificationService = require('../services/notificationService');

exports.register = async (req, res, next) => {
  try {
    const { username, password, realName, role, phone, email, studentInfo } = req.body;

    const existingUser = await User.findOne({ username });
    if (existingUser) {
      return res.status(400).json({ success: false, message: '用户名已存在' });
    }

    const user = await User.create({
      username,
      password,
      realName,
      role,
      phone,
      email,
      studentInfo: role === 'student' ? studentInfo : undefined,
    });

    user.password = undefined;
    const token = user.generateAuthToken();

    res.status(201).json({
      success: true,
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

exports.login = async (req, res, next) => {
  try {
    const { username, password } = req.body;

    const user = await User.findOne({ username }).select('+password');
    if (!user) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: '用户名或密码错误' });
    }

    if (user.status !== 'active') {
      return res.status(403).json({ success: false, message: '账户已被禁用' });
    }

    user.password = undefined;
    const token = user.generateAuthToken();

    res.json({
      success: true,
      data: { user, token },
    });
  } catch (error) {
    next(error);
  }
};

exports.getMe = async (req, res, next) => {
  try {
    res.json({
      success: true,
      data: req.user,
    });
  } catch (error) {
    next(error);
  }
};

exports.updateProfile = async (req, res, next) => {
  try {
    const { realName, phone, email, studentInfo } = req.body;

    const updates = { realName, phone, email };
    if (req.user.role === 'student' && studentInfo) {
      updates['studentInfo.sleepPreference'] = studentInfo.sleepPreference;
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, {
      new: true,
      runValidators: true,
    });

    res.json({
      success: true,
      data: user,
    });
  } catch (error) {
    next(error);
  }
};

exports.changePassword = async (req, res, next) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(oldPassword);

    if (!isMatch) {
      return res.status(400).json({ success: false, message: '原密码错误' });
    }

    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: '密码修改成功',
    });
  } catch (error) {
    next(error);
  }
};

exports.getNotifications = async (req, res, next) => {
  try {
    const { page = 1, limit = 20, isRead, type, category, startDate, endDate } = req.query;
    const skip = (page - 1) * limit;

    const query = { recipientId: req.user._id };
    if (isRead !== undefined) {
      query.isRead = isRead === 'true';
    }

    if (type) {
      query.type = type;
    } else if (category) {
      const categoryTypeMap = {
        repair: ['repair_created', 'repair_assigned', 'repair_completed', 'repair_escalated'],
        electricity: ['electricity_warning', 'electricity_recharged', 'electricity_cutoff', 'electricity_restored'],
        visitor: ['visitor_pending', 'visitor_approved', 'visitor_denied', 'visitor_overdue'],
        late_return: ['late_return', 'late_return_violation', 'late_return_interview', 'interview_scheduled'],
        hygiene: ['hygiene_inspection', 'hygiene_failed', 'hygiene_warning'],
        dorm: ['dorm_assignment', 'dorm_change'],
        system: ['system', 'report_ready'],
      };
      const types = categoryTypeMap[category];
      if (types) {
        query.type = { $in: types };
      }
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) {
        query.createdAt.$gte = new Date(startDate);
      }
      if (endDate) {
        query.createdAt.$lte = new Date(endDate);
      }
    }

    const notifications = await Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Notification.countDocuments(query);
    const unreadCount = await NotificationService.getUnreadCount(req.user._id);
    const unreadStats = await NotificationService.getUnreadStats(req.user._id);

    res.json({
      success: true,
      data: {
        notifications,
        total,
        unreadCount,
        unreadStats,
        page: parseInt(page),
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

exports.getUnreadStats = async (req, res, next) => {
  try {
    const unreadStats = await NotificationService.getUnreadStats(req.user._id);

    res.json({
      success: true,
      data: unreadStats,
    });
  } catch (error) {
    next(error);
  }
};

exports.markNotificationRead = async (req, res, next) => {
  try {
    const { id } = req.params;
    const notification = await NotificationService.markAsRead(id, req.user._id);

    if (!notification) {
      return res.status(404).json({
        success: false,
        message: '通知不存在',
      });
    }

    res.json({
      success: true,
      data: notification,
    });
  } catch (error) {
    if (error.message === '无权操作此通知') {
      return res.status(403).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

exports.markAllNotificationsRead = async (req, res, next) => {
  try {
    await NotificationService.markAllAsRead(req.user._id);

    res.json({
      success: true,
      message: '已全部标记为已读',
    });
  } catch (error) {
    next(error);
  }
};

exports.markCategoryAsRead = async (req, res, next) => {
  try {
    const { category } = req.body;
    if (!category) {
      return res.status(400).json({
        success: false,
        message: '请提供通知大类 category',
      });
    }

    const result = await NotificationService.markCategoryAsRead(req.user._id, category);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.message.startsWith('不支持的通知大类')) {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

exports.markTypesAsRead = async (req, res, next) => {
  try {
    const { types } = req.body;
    if (!types || !Array.isArray(types)) {
      return res.status(400).json({
        success: false,
        message: '请提供通知类型列表 types',
      });
    }

    const result = await NotificationService.markTypesAsRead(req.user._id, types);

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    if (error.message === '请提供要标记已读的通知类型列表') {
      return res.status(400).json({
        success: false,
        message: error.message,
      });
    }
    next(error);
  }
};

exports.getUsersByRole = async (req, res, next) => {
  try {
    const { role } = req.params;
    const users = await User.find({ role }).select('-password');

    res.json({
      success: true,
      data: users,
    });
  } catch (error) {
    next(error);
  }
};
