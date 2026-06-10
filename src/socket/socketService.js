const http = require('http');
const socketIo = require('socket.io');
const jwt = require('jsonwebtoken');
const Notification = require('../models/Notification');
const NotificationService = require('../services/notificationService');

class SocketService {
  constructor() {
    this.io = null;
    this.userSockets = new Map();
  }

  init(server) {
    this.io = socketIo(server, {
      cors: {
        origin: '*',
        methods: ['GET', 'POST'],
      },
    });

    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('认证失败'));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        socket.userId = decoded.id;
        socket.userRole = decoded.role;
        next();
      } catch (error) {
        next(new Error('认证失败'));
      }
    });

    this.io.on('connection', (socket) => {
      console.log(`User connected: ${socket.userId} (${socket.userRole})`);
      this.userSockets.set(socket.userId, socket.id);

      socket.join(`user:${socket.userId}`);
      socket.join(`role:${socket.userRole}`);

      socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.userId}`);
        this.userSockets.delete(socket.userId);
      });
    });

    this.setupNotificationWatcher();

    return this.io;
  }

  setupNotificationWatcher() {
    setInterval(async () => {
      const unreadNotifications = await Notification.find({
        isPushed: false,
        createdAt: { $gte: new Date(Date.now() - 60000) },
      });

      for (const notification of unreadNotifications) {
        this.pushNotification(notification);
        await Notification.findByIdAndUpdate(notification._id, { isPushed: true });
      }
    }, 5000);
  }

  pushNotification(notification) {
    if (!this.io) return;

    this.io.to(`user:${notification.recipientId}`).emit('notification', {
      id: notification._id,
      type: notification.type,
      title: notification.title,
      content: notification.content,
      relatedId: notification.relatedId,
      relatedModel: notification.relatedModel,
      createdAt: notification.createdAt,
    });
  }

  emitToUser(userId, event, data) {
    if (!this.io) return;
    this.io.to(`user:${userId}`).emit(event, data);
  }

  emitToRole(role, event, data) {
    if (!this.io) return;
    this.io.to(`role:${role}`).emit(event, data);
  }

  emitToAll(event, data) {
    if (!this.io) return;
    this.io.emit(event, data);
  }

  async notifyUser(userId, type, title, content, relatedId, relatedModel) {
    const notification = await NotificationService.sendToStudent(
      userId,
      type,
      title,
      content,
      relatedId,
      relatedModel
    );
    this.pushNotification(notification);
    return notification;
  }
}

module.exports = new SocketService();
