import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { Server } from 'socket.io';
import statusRouter from './routes/status';
import sessionsRouter from './routes/sessions';
import modelsRouter from './routes/models';
import skillsRouter from './routes/skills';
import logsRouter from './routes/logs';
import providersRouter from './routes/providers';
import tasksRouter from './routes/tasks';
import channelsRouter from './routes/channels';
import whatsappRouter from './routes/whatsapp';
import chatRouter from './routes/chat';
import teamRouter from './routes/team';
import systemRouter from './routes/system';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: '*', // 允许所有来源（生产环境应该限制）
    credentials: true
  }
});

const PORT = process.env.PORT || 7749;
const HOST = process.env.HOST || '0.0.0.0'; // 监听所有网络接口

// Middleware
app.use(cors({
  origin: '*', // 允许所有来源
  credentials: true
}));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple auth middleware
const AUTH_TOKEN = process.env.ADMIN_TOKEN || 'wj12345';
app.use((req, res, next) => {
  // Skip auth for health check
  if (req.path === '/health') return next();
  
  // 支持 query param token（用于文件下载）
  const token = req.headers.authorization?.replace('Bearer ', '') || req.query.token as string;
  if (token !== AUTH_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// Routes
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/status', statusRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/models', modelsRouter);
app.use('/api/skills', skillsRouter);
app.use('/api/logs', logsRouter);
app.use('/api/providers', providersRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/channels', channelsRouter);
app.use('/api/whatsapp', whatsappRouter);
app.use('/api/chat', chatRouter);
app.use('/api/team', teamRouter);
app.use('/api/system', systemRouter);

// WebSocket
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Dashboard real-time updates
  socket.on('subscribe:dashboard', () => {
    const interval = setInterval(async () => {
      try {
        const dashboardData = await getDashboardData();
        socket.emit('dashboard:update', dashboardData);
      } catch (error) {
        console.error('Dashboard update error:', error);
      }
    }, 5000);
    
    socket.on('disconnect', () => {
      clearInterval(interval);
    });
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Import dashboard data function
import { getDashboardData } from './services/system';

// Start server
httpServer.listen(PORT, HOST, () => {
  console.log(`🦞 OpenClaw Admin Backend running on:`);
  console.log(`   - Local:   http://localhost:${PORT}`);
  console.log(`   - Network: http://10.168.1.155:${PORT}`);
  console.log(`🔑 Auth token: ${AUTH_TOKEN}`);
});

export { io };
