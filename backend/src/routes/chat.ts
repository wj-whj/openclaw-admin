import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';

const router = Router();
const execAsync = promisify(exec);

// POST /api/chat - 发送消息给 OpenClaw
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 使用 openclaw CLI 发送消息到主会话
    const openclawPath = `${process.env.HOME}/.nvm/versions/node/v24.0.2/bin/openclaw`;
    const escapedMessage = message.replace(/'/g, "'\\''");
    
    // 使用 sessions send 发送到主会话
    const { stdout, stderr } = await execAsync(
      `${openclawPath} sessions send --session main --message '${escapedMessage}' --timeout 30`,
      { timeout: 35000 }
    );

    // 解析响应
    let reply = stdout.trim();
    if (stderr) {
      console.error('OpenClaw stderr:', stderr);
    }

    // 如果没有响应，返回默认消息
    if (!reply) {
      reply = '消息已发送，但未收到回复。';
    }

    res.json({ reply });
  } catch (error: any) {
    console.error('Chat error:', error);
    res.status(500).json({ 
      error: 'Failed to send message',
      details: error.message 
    });
  }
});

export default router;
