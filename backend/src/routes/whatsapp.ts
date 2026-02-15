import express from 'express';
import { spawn } from 'child_process';
import sharp from 'sharp';

const router = express.Router();

let authProcess: any = null;
let qrCodeImageUrl: string | null = null;
let authStatus: 'idle' | 'waiting' | 'success' | 'failed' | 'timeout' = 'idle';

// 将 Unicode 方块字符二维码解析为像素矩阵
function parseBlockQR(text: string): number[][] {
  const lines = text.split('\n').filter(l => l.includes('█') || l.includes('▄') || l.includes('▀'));
  if (lines.length === 0) return [];

  const matrix: number[][] = [];
  for (const line of lines) {
    const topRow: number[] = [];
    const bottomRow: number[] = [];
    for (const ch of line) {
      switch (ch) {
        case '█': topRow.push(1); bottomRow.push(1); break;
        case '▀': topRow.push(1); bottomRow.push(0); break;
        case '▄': topRow.push(0); bottomRow.push(1); break;
        case ' ': topRow.push(0); bottomRow.push(0); break;
        default: topRow.push(0); bottomRow.push(0); break;
      }
    }
    matrix.push(topRow);
    matrix.push(bottomRow);
  }
  return matrix;
}

// 将像素矩阵生成 PNG 图片
async function matrixToPng(matrix: number[][], scale: number = 6): Promise<string> {
  const height = matrix.length;
  const width = matrix.reduce((max, row) => Math.max(max, row.length), 0);
  
  const margin = 4;
  const imgW = (width + margin * 2) * scale;
  const imgH = (height + margin * 2) * scale;
  
  const pixels = Buffer.alloc(imgW * imgH * 4, 255);
  
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < (matrix[y]?.length || 0); x++) {
      if (matrix[y][x] === 1) {
        for (let sy = 0; sy < scale; sy++) {
          for (let sx = 0; sx < scale; sx++) {
            const px = (x + margin) * scale + sx;
            const py = (y + margin) * scale + sy;
            const idx = (py * imgW + px) * 4;
            pixels[idx] = 0;
            pixels[idx + 1] = 0;
            pixels[idx + 2] = 0;
            pixels[idx + 3] = 255;
          }
        }
      }
    }
  }
  
  const png = await sharp(pixels, { raw: { width: imgW, height: imgH, channels: 4 } })
    .png()
    .toBuffer();
  
  return `data:image/png;base64,${png.toString('base64')}`;
}

// 启动 OpenClaw WhatsApp 认证（使用 openclaw channels login）
router.post('/auth/start', async (req, res) => {
  try {
    if (authProcess) {
      authProcess.kill();
      authProcess = null;
    }

    authStatus = 'waiting';
    qrCodeImageUrl = null;

    let allOutput = '';
    let qrGenerated = false;

    // 清除旧的认证数据，确保重新扫码
    const { execSync } = require('child_process');
    try {
      execSync('rm -rf ~/.openclaw/credentials/whatsapp/default', { encoding: 'utf-8' });
    } catch {}

    // 使用 openclaw channels login，这样认证数据存到 OpenClaw 的 credentials 目录
    const openclawBin = '/Users/wangjian/.nvm/versions/node/v24.0.2/bin/openclaw';
    authProcess = spawn(openclawBin, ['channels', 'login', '--channel', 'whatsapp'], {
      env: { ...process.env, PATH: `/Users/wangjian/.nvm/versions/node/v24.0.2/bin:${process.env.PATH}` }
    });

    const handleOutput = async (data: Buffer) => {
      const text = data.toString();
      allOutput += text;

      if (text.includes('Connected!') || text.includes('successfully linked') || text.includes('logged in!')) {
        authStatus = 'success';
        if (authProcess) { authProcess.kill(); authProcess = null; }
        return;
      }

      if (text.includes('timed out') || text.includes('timeout')) {
        authStatus = 'timeout';
        if (authProcess) { authProcess.kill(); authProcess = null; }
        return;
      }

      if (!qrGenerated && (text.includes('█') || text.includes('▄') || text.includes('▀'))) {
        const matrix = parseBlockQR(allOutput);
        if (matrix.length > 20) {
          try {
            qrCodeImageUrl = await matrixToPng(matrix);
            qrGenerated = true;
            console.log('QR code image generated from openclaw channels login output');
          } catch (err) {
            console.error('Failed to generate QR image:', err);
          }
        }
      }
    };

    authProcess.stdout.on('data', handleOutput);
    authProcess.stderr.on('data', handleOutput);

    authProcess.on('close', (code: number) => {
      if (authStatus === 'waiting') {
        authStatus = code === 0 ? 'success' : 'failed';
      }
      authProcess = null;
    });

    // 等待二维码生成
    await new Promise(resolve => setTimeout(resolve, 5000));

    res.json({
      status: authStatus,
      qrCode: qrCodeImageUrl,
      message: qrCodeImageUrl ? '请扫描二维码' :
               authStatus === 'success' ? '认证成功！' :
               '正在生成二维码...'
    });
  } catch (error: any) {
    console.error('WhatsApp auth error:', error);
    authStatus = 'failed';
    res.status(500).json({ error: error.message });
  }
});

// 获取认证状态
router.get('/auth/status', (req, res) => {
  res.json({
    status: authStatus,
    qrCode: qrCodeImageUrl,
    authenticated: authStatus === 'success',
    message: authStatus === 'waiting' ? (qrCodeImageUrl ? '请扫描二维码' : '正在生成...') :
             authStatus === 'success' ? '认证成功！' :
             authStatus === 'timeout' ? '二维码已超时' :
             authStatus === 'failed' ? '认证失败' :
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
  qrCodeImageUrl = null;
  res.json({ status: 'cancelled' });
});

export default router;
