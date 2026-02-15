import express from 'express';
import { spawn } from 'child_process';

const router = express.Router();

// 存储当前的认证会话
let authProcess: any = null;
let qrCodeText: string | null = null;
let authStatus: 'idle' | 'waiting' | 'success' | 'failed' | 'timeout' = 'idle';

// 启动 WhatsApp 认证并捕获二维码
router.post('/auth/start', async (req, res) => {
  try {
    // 如果已有进程在运行，先清理
    if (authProcess) {
      authProcess.kill();
      authProcess = null;
    }

    authStatus = 'waiting';
    qrCodeText = null;

    // 启动 wacli auth
    authProcess = spawn('wacli', ['auth'], {
      env: { ...process.env }
    });

    let fullOutput = '';
    let qrStarted = false;
    let qrLines: string[] = [];
    let captureQR = false;

    authProcess.stdout.on('data', (data: Buffer) => {
      const text = data.toString();
      fullOutput += text;

      // 检测二维码开始标记
      if (text.includes('Scan this QR code')) {
        qrStarted = true;
        captureQR = true;
        qrLines = [];
      }

      // 捕获二维码行
      if (captureQR) {
        const lines = text.split('\n');
        for (const line of lines) {
          // 检测二维码结束（空行或分隔线）
          if (line.trim() === '' || line.match(/^[▀=]+$/)) {
            if (qrLines.length > 10) {
              captureQR = false;
              qrCodeText = qrLines.join('\n');
            }
          } else if (line.includes('█') || line.includes('▄') || line.includes('▀')) {
            qrLines.push(line);
          }
        }
      }

      // 检测认证成功
      if (text.includes('Authenticated') || text.includes('successfully')) {
        authStatus = 'success';
        qrCodeText = null;
        if (authProcess) {
          authProcess.kill();
          authProcess = null;
        }
      }

      // 检测超时
      if (text.includes('timed out')) {
        authStatus = 'timeout';
        if (authProcess) {
          authProcess.kill();
          authProcess = null;
        }
      }
    });

    authProcess.stderr.on('data', (data: Buffer) => {
      const err = data.toString();
      console.error('wacli stderr:', err);
      if (err.includes('error') || err.includes('failed')) {
        authStatus = 'failed';
      }
    });

    authProcess.on('close', (code: number) => {
      if (code !== 0 && authStatus !== 'success') {
        authStatus = code === 1 && fullOutput.includes('timed out') ? 'timeout' : 'failed';
      }
      authProcess = null;
    });

    // 等待二维码生成
    await new Promise((resolve) => setTimeout(resolve, 3000));

    res.json({
      status: authStatus,
      qrCode: qrCodeText,
      message: qrCodeText ? '请用手机扫描二维码' : '正在生成二维码...'
    });

  } catch (error: any) {
    console.error('WhatsApp auth error:', error);
    authStatus = 'failed';
    res.status(500).json({ error: error.message });
  }
});

// 获取二维码状态（轮询用）
router.get('/auth/status', (req, res) => {
  res.json({
    status: authStatus,
    qrCode: qrCodeText,
    message: authStatus === 'waiting' ? (qrCodeText ? '请扫描二维码' : '正在生成...') :
             authStatus === 'success' ? '认证成功！' :
             authStatus === 'timeout' ? '二维码已超时，请重新生成' :
             authStatus === 'failed' ? '认证失败，请重试' :
             '未开始'
  });
});

// 取消认证
router.post('/auth/cancel', (req, res) => {
  if (authProcess) {
    authProcess.kill();
    authProcess = null;
  }
  authStatus = 'idle';
  qrCodeText = null;
  res.json({ status: 'cancelled' });
});

export default router;
