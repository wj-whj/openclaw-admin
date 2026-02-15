import express from 'express';
import { exec, spawn } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = express.Router();

// 打开终端窗口显示二维码
router.post('/auth/open-qr', async (req, res) => {
  try {
    // 使用 osascript 打开新的终端窗口并运行 wacli auth
    const script = `
      tell application "Terminal"
        activate
        do script "echo '=== WhatsApp 扫码连接 ===' && echo '请用手机 WhatsApp 扫描下方二维码' && echo '' && wacli auth"
      end tell
    `;
    
    exec(`osascript -e '${script}'`, (error) => {
      if (error) {
        console.error('Failed to open terminal:', error);
      }
    });

    res.json({
      status: 'success',
      message: '已打开扫码窗口，请在新窗口中扫描二维码'
    });
  } catch (error: any) {
    console.error('WhatsApp auth error:', error);
    res.status(500).json({ error: error.message });
  }
});

// 检查 wacli 是否已认证
router.get('/auth/status', async (req, res) => {
  try {
    const { stdout } = await execAsync('wacli doctor 2>&1');
    const isAuthenticated = stdout.includes('authenticated') || stdout.includes('✓') || stdout.includes('OK');
    
    res.json({
      authenticated: isAuthenticated,
      message: isAuthenticated ? 'WhatsApp 已连接' : '未连接'
    });
  } catch (error) {
    res.json({
      authenticated: false,
      message: '未连接或 wacli 未安装'
    });
  }
});

// 获取最近的聊天列表（测试连接）
router.get('/chats', async (req, res) => {
  try {
    const { stdout } = await execAsync('wacli chats --json --limit 10');
    const chats = JSON.parse(stdout);
    res.json({ chats });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
