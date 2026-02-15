import express from 'express';
import { Client, LocalAuth } from 'whatsapp-web.js';
import QRCode from 'qrcode';

const router = express.Router();

let client: any = null;
let qrCodeImageUrl: string | null = null;
let authStatus: 'idle' | 'waiting' | 'success' | 'failed' | 'timeout' = 'idle';

// 启动 WhatsApp 认证
router.post('/auth/start', async (req, res) => {
  try {
    // 如果已有客户端在运行，先清理
    if (client) {
      await client.destroy();
      client = null;
    }

    authStatus = 'waiting';
    qrCodeImageUrl = null;

    // 创建 WhatsApp 客户端
    client = new Client({
      authStrategy: new LocalAuth({
        dataPath: '/tmp/whatsapp-session'
      }),
      puppeteer: {
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      }
    });

    // 监听二维码事件
    client.on('qr', async (qr: string) => {
      console.log('QR code received:', qr.substring(0, 50) + '...');
      try {
        // 生成二维码图片
        qrCodeImageUrl = await QRCode.toDataURL(qr, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        authStatus = 'waiting';
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
    });

    // 监听认证成功
    client.on('ready', () => {
      console.log('WhatsApp client is ready!');
      authStatus = 'success';
      qrCodeImageUrl = null;
    });

    // 监听认证失败
    client.on('auth_failure', () => {
      console.log('Authentication failed');
      authStatus = 'failed';
    });

    // 监听断开连接
    client.on('disconnected', () => {
      console.log('Client disconnected');
      if (authStatus === 'waiting') {
        authStatus = 'timeout';
      }
    });

    // 初始化客户端
    await client.initialize();

    // 等待二维码生成
    await new Promise((resolve) => setTimeout(resolve, 5000));

    res.json({
      status: authStatus,
      qrCode: qrCodeImageUrl,
      message: qrCodeImageUrl ? '请扫描二维码' : '正在生成二维码...'
    });

  } catch (error: any) {
    console.error('WhatsApp auth error:', error);
    authStatus = 'failed';
    res.status(500).json({ error: error.message });
  }
});

// 获取认证状态（轮询用）
router.get('/auth/status', (req, res) => {
  const isReady = client && client.info;
  
  res.json({
    status: authStatus,
    qrCode: qrCodeImageUrl,
    authenticated: isReady,
    message: authStatus === 'waiting' ? (qrCodeImageUrl ? '请扫描二维码' : '正在生成...') :
             authStatus === 'success' ? '认证成功！' :
             authStatus === 'timeout' ? '二维码已超时' :
             authStatus === 'failed' ? '认证失败' :
             '未开始'
  });
});

// 取消认证
router.post('/auth/cancel', async (req, res) => {
  if (client) {
    try {
      await client.destroy();
    } catch (error) {
      console.error('Failed to destroy client:', error);
    }
    client = null;
  }
  authStatus = 'idle';
  qrCodeImageUrl = null;
  res.json({ status: 'cancelled' });
});

export default router;
