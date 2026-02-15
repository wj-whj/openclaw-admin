import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);
const OPENCLAW = path.join(os.homedir(), '.nvm/versions/node/v24.0.2/bin/openclaw');
const ENV = { ...process.env, PATH: `${os.homedir()}/.nvm/versions/node/v24.0.2/bin:${process.env.PATH}` };

// 管理中心对话的 session id（固定，保持上下文连续）
const ADMIN_SESSION_ID = 'admin-chat-session';

// POST /api/chat - 通过 openclaw agent 发送消息
router.post('/', async (req, res) => {
  try {
    const { message } = req.body;
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: 'Message is required' });
    }

    // 转义消息
    const escaped = message.replace(/'/g, "'\\''");

    // 使用 openclaw agent 发送消息并获取回复
    const { stdout, stderr } = await execAsync(
      `${OPENCLAW} agent --session-id ${ADMIN_SESSION_ID} --message '${escaped}' --json`,
      { timeout: 120000, env: ENV, maxBuffer: 2 * 1024 * 1024 }
    );

    // 解析 JSON 输出
    let reply = '';
    const lines = stdout.trim().split('\n');
    
    // 尝试将整个输出作为 JSON 解析
    try {
      const fullOutput = JSON.parse(stdout.trim());
      // openclaw agent --json 格式: { runId, status, result: { payloads: [{ text }] } }
      if (fullOutput.result?.payloads?.length > 0) {
        reply = fullOutput.result.payloads.map((p: any) => p.text).filter(Boolean).join('\n');
      } else if (fullOutput.reply) {
        reply = fullOutput.reply;
      } else if (fullOutput.text) {
        reply = fullOutput.text;
      }
    } catch {
      // 逐行解析
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const parsed = JSON.parse(line);
          if (parsed.result?.payloads?.length > 0) {
            reply = parsed.result.payloads.map((p: any) => p.text).filter(Boolean).join('\n');
            break;
          } else if (parsed.reply || parsed.text) {
            reply = parsed.reply || parsed.text;
            break;
          }
        } catch {
          if (!line.startsWith('🦞') && !line.startsWith('Session') && !line.startsWith('Agent')) {
            reply += line + '\n';
          }
        }
      }
    }

    if (!reply) {
      reply = stdout.trim() || '消息已发送，但未收到回复';
    }

    res.json({ reply: reply.trim() });
  } catch (error: any) {
    console.error('[Chat] Error:', error.message);
    
    if (error.killed || error.signal === 'SIGTERM') {
      return res.status(504).json({ error: 'AI 响应超时，请稍后重试' });
    }

    // 提取有用的错误信息
    const stderr = error.stderr || '';
    const details = stderr.includes('error:') 
      ? stderr.split('error:').pop()?.trim() 
      : error.message;

    res.status(500).json({ error: '发送消息失败', details });
  }
});

// GET /api/chat/status - 检查连接状态
router.get('/status', async (req, res) => {
  try {
    await execAsync(`${OPENCLAW} status 2>/dev/null | head -1`, { timeout: 5000, env: ENV });
    res.json({ connected: true, mode: 'agent-cli' });
  } catch {
    res.json({ connected: false, mode: 'agent-cli' });
  }
});

export default router;
