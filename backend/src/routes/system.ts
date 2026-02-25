import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);
const OPENCLAW = path.join(os.homedir(), '.nvm/versions/node/v24.0.2/bin/openclaw');
const ENV = { ...process.env, PATH: `${path.dirname(OPENCLAW)}:${process.env.PATH}` };

// POST /api/system/restart - 重启 Gateway
router.post('/restart', async (req, res) => {
  try {
    // 异步执行，不等待结果（重启后连接会断开）
    execAsync(`${OPENCLAW} gateway restart`, { env: ENV }).catch(() => {});
    res.json({ success: true, message: '重启命令已发送' });
  } catch (error: any) {
    res.status(500).json({ error: '重启失败', details: error.message });
  }
});

export default router;
