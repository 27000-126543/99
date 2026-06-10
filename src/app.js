require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const { errorHandler, AppError } = require('./middleware/errorHandler');
const routes = require('./routes');
const socketService = require('./socket/socketService');
const Scheduler = require('./scheduler');

const app = express();
const server = http.createServer(app);

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: '请求过于频繁，请稍后再试',
});

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(limiter);

app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: '智慧校园宿舍管理系统API运行正常',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  });
});

app.use('/api/v1', routes);

app.all('*', (req, res, next) => {
  next(new AppError(`找不到路由 ${req.originalUrl}`, 404));
});

app.use(errorHandler);

socketService.init(server);

const PORT = process.env.PORT || 3000;

const start = async () => {
  try {
    await connectDB();

    Scheduler.init();
    await Scheduler.runInitialTasks();

    server.listen(PORT, () => {
      console.log(`\n========================================`);
      console.log(`  智慧校园宿舍管理系统 API`);
      console.log(`========================================`);
      console.log(`  服务地址: http://localhost:${PORT}`);
      console.log(`  API路径:  http://localhost:${PORT}/api/v1`);
      console.log(`  健康检查: http://localhost:${PORT}/health`);
      console.log(`  环境:     ${process.env.NODE_ENV || 'development'}`);
      console.log(`========================================\n`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
};

start();
