import express from 'express';
import { spawn } from 'child_process';
import QRCode from 'qrcode';

const router = express.Router();

let authProcess: any = null;
let qrCodeImageUrl: string | null = null;
let authStatus: 'idle' | 'waiting' | 'success' | 'failed' | 'timeout' = 'idle';

// 启动 WhatsApp 认证并生成二维码图片
router.post('/auth/start', async (req, res) => {
  try {
    // 如果已有进程在运行，先清理
    if (authProcess) {
      authProcess.kill();
      authProcess = null;
    }

    authStatus = 'waiting';
    qrCodeImageUrl = null;

    // 启动 wacli auth，尝试捕获配对码
    authProcess = spawn('wacli', ['auth'], {
      env: { ...process.env }
    });

    let fullOutput = '';
    let stderrOutput = '';
    let qrCodeData: string | null = null;

    authProcess.stdout.on('data', (data: Buffer) => {
      fullOutput += data.toString();
    });

    authProcess.stderr.on('data', (data: Buffer) => {
      const text = data.toString();
      stderrOutput += text;
      
      // 尝试从输出中提取二维码数据
      // WhatsApp 二维码格式通常是: ref@jid,key,advSecret
      // 或者是一个长字符串
      const lines = text.split('\n');
      for (const line of lines) {
        // 查找包含 @ 符号的长字符串（可能是配对码）
        if (line.includes('@') && line.length > 50 && !line.includes('█')) {
          const match = line.match(/([0-9A-Za-z+/=@,]+)/);
          if (match && match[1].length > 50) {
            qrCodeData = match[1];
            break;
          }
        }
      }

      // 检测认证成功
      if (text.includes('Authenticated') || text.includes('successfully')) {
        authStatus = 'success';
        qrCodeImageUrl = null;
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

    authProcess.on('close', (code: number) => {
      if (code !== 0 && authStatus !== 'success') {
        authStatus = code === 1 && stderrOutput.includes('timed out') ? 'timeout' : 'failed';
      }
      authProcess = null;
    });

    // 等待二维码数据
    await new Promise((resolve) => setTimeout(resolve, 3000));

    // 如果找到了配对码，生成二维码图片
    if (qrCodeData) {
      try {
        qrCodeImageUrl = await QRCode.toDataURL(qrCodeData, {
          width: 400,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
      } catch (error) {
        console.error('Failed to generate QR code:', error);
      }
    }

    // 如果没有找到配对码，使用备用方案：打开终端
    if (!qrCodeImageUrl) {
      const { exec } = require('child_process');
      const script = `
        tell application "Terminal"
          activate
          do script "clear && echo '═══════════════════════════════════════' && echo '   WhatsApp 扫码连接' && echo '═══════════════════════════════════════' && echo '' && wacli auth"
        end tell
      `;
      exec(`osascript -e '${script}'`);
    }

    res.json({
      status: authStatus,
      qrCode: qrCodeImageUrl,
      fallback: !qrCodeImageUrl,
      message: qrCodeImageUrl ? '请扫描二维码' : '已打开终端窗口，请在终端中扫描'
    });

  } catch (error: any) {
    console.error('WhatsApp auth error:', error);
    authStatus = 'failed';
    res.status(500).json({ error: error.message });
  }
});

// 获取认证状态（轮询用）
router.get('/auth/status', async (req, res) => {
  try {
    const { execSync } = require('child_process');
    const output = execSync('wacli doctor 2>&1', { encoding: 'utf-8' });
    const isAuthenticated = output.includes('authenticated') || output.includes('✓') || output.includes('OK');
    
    if (isAuthenticated) {
      authStatus = 'success';
    }

    res.json({
      status: authStatus,
      qrCode: qrCodeImageUrl,
      authenticated: isAuthenticated,
      message: authStatus === 'waiting' ? '等待扫码' :
               authStatus === 'success' ? '认证成功！' :
               authStatus === 'timeout' ? '二维码已超时' :
               authStatus === 'failed' ? '认证失败' :
               '未开始'
    });
  } catch (error) {
    res.json({
      status: authStatus,
      qrCode: qrCodeImageUrl,
      authenticated: false,
      message: '检查状态失败'
    });
  }
});

// 取消认证
router.post('/auth/cancel', (req, res) => {
  if (authProcess) {
    authProcess.kill();
    authProcess = null;
  }
  authStatus = 'idle';
  qrCodeImageUrl = null;
  res.json({ status: 'cancelled' });
});

export default router;
