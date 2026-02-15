import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import multer from 'multer';
import os from 'os';
import path from 'path';
import fs from 'fs-extra';

const router = Router();
const execAsync = promisify(exec);
const OPENCLAW = path.join(os.homedir(), '.nvm/versions/node/v24.0.2/bin/openclaw');
const ENV = { ...process.env, PATH: `${os.homedir()}/.nvm/versions/node/v24.0.2/bin:${process.env.PATH}` };

// 动态获取主会话 ID（和 TUI/Telegram/WhatsApp 共享）
async function getMainSessionId(): Promise<string> {
  const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
  try {
    const data = await fs.readJSON(sessionsPath);
    const main = data['agent:main:main'];
    if (main?.sessionId) return main.sessionId;
  } catch (err) {
    console.error('[Chat] Failed to read main session ID:', err);
  }
  // Fallback: 使用独立会话
  return 'admin-chat-session';
}

const UPLOAD_DIR = path.join(os.homedir(), '.openclaw', 'admin-uploads');
const OUTPUT_DIR = path.join(os.homedir(), '.openclaw', 'admin-outputs');

// 确保目录存在
fs.ensureDirSync(UPLOAD_DIR);
fs.ensureDirSync(OUTPUT_DIR);

// multer 配置
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const name = path.basename(file.originalname, ext);
    cb(null, `${name}-${Date.now()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 20 * 1024 * 1024 } // 20MB
});

// 从 AI 回复中提取文件路径
function extractFilePaths(text: string): string[] {
  const paths: string[] = [];
  // 匹配常见文件路径模式
  const patterns = [
    /(?:^|\s)(\/[\w./-]+\.(?:png|jpg|jpeg|gif|svg|pdf|csv|xlsx|json|txt|md|html|py|js|ts|zip|tar|gz))/gim,
    /(?:^|\s)(~\/[\w./-]+\.(?:png|jpg|jpeg|gif|svg|pdf|csv|xlsx|json|txt|md|html|py|js|ts|zip|tar|gz))/gim,
  ];
  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(text)) !== null) {
      let p = match[1].trim();
      if (p.startsWith('~/')) p = path.join(os.homedir(), p.slice(2));
      paths.push(p);
    }
  }
  return [...new Set(paths)];
}

// POST /api/chat - 发送消息（支持文件附件）
router.post('/', upload.array('files', 5), async (req: any, res) => {
  try {
    const { message } = req.body;
    const files = req.files as Express.Multer.File[] || [];

    if (!message && files.length === 0) {
      return res.status(400).json({ error: '请输入消息或上传文件' });
    }

    // 构建消息内容
    let fullMessage = message || '';
    const uploadedFiles: any[] = [];

    if (files.length > 0) {
      const fileDescs = files.map(f => {
        uploadedFiles.push({
          name: f.originalname,
          path: f.path,
          size: f.size,
          type: f.mimetype
        });
        return `[文件: ${f.originalname} (${f.mimetype}, ${(f.size / 1024).toFixed(1)}KB) 路径: ${f.path}]`;
      });
      fullMessage = fullMessage
        ? `${fullMessage}\n\n用户上传了以下文件：\n${fileDescs.join('\n')}\n请读取并处理这些文件。`
        : `用户上传了以下文件：\n${fileDescs.join('\n')}\n请读取并分析这些文件内容。`;
    }

    // 转义消息
    const escaped = fullMessage.replace(/'/g, "'\\''");

    // 使用主会话（和 TUI/Telegram/WhatsApp 共享同一会话上下文）
    const sessionId = await getMainSessionId();
    const { stdout } = await execAsync(
      `${OPENCLAW} agent --session-id ${sessionId} --message '${escaped}' --json`,
      { timeout: 120000, env: ENV, maxBuffer: 2 * 1024 * 1024 }
    );

    // 解析回复
    let reply = '';
    try {
      const fullOutput = JSON.parse(stdout.trim());
      if (fullOutput.result?.payloads?.length > 0) {
        reply = fullOutput.result.payloads.map((p: any) => p.text).filter(Boolean).join('\n');
      } else if (fullOutput.reply || fullOutput.text) {
        reply = fullOutput.reply || fullOutput.text;
      }
    } catch {
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        try {
          const parsed = JSON.parse(line);
          if (parsed.result?.payloads?.length > 0) {
            reply = parsed.result.payloads.map((p: any) => p.text).filter(Boolean).join('\n');
            break;
          }
        } catch {
          if (!line.startsWith('🦞')) reply += line + '\n';
        }
      }
    }

    if (!reply) reply = stdout.trim() || '消息已发送，但未收到回复';

    // 提取回复中的文件路径
    const outputFiles = extractFilePaths(reply);
    const validFiles: any[] = [];
    for (const fp of outputFiles) {
      if (await fs.pathExists(fp)) {
        const stat = await fs.stat(fp);
        if (stat.isFile() && stat.size < 50 * 1024 * 1024) {
          validFiles.push({
            name: path.basename(fp),
            path: fp,
            size: stat.size,
            type: getMimeType(fp)
          });
        }
      }
    }

    res.json({
      reply: reply.trim(),
      uploadedFiles: uploadedFiles.length > 0 ? uploadedFiles : undefined,
      outputFiles: validFiles.length > 0 ? validFiles : undefined
    });
  } catch (error: any) {
    console.error('[Chat] Error:', error.message);
    if (error.killed) return res.status(504).json({ error: 'AI 响应超时' });
    res.status(500).json({ error: '发送消息失败', details: error.message });
  }
});

// GET /api/chat/file - 下载/预览文件
router.get('/file', async (req, res) => {
  try {
    const filePath = req.query.path as string;
    if (!filePath) return res.status(400).json({ error: '缺少文件路径' });

    // 安全检查：只允许访问特定目录
    const resolved = path.resolve(filePath);
    const allowed = [
      UPLOAD_DIR, OUTPUT_DIR,
      path.join(os.homedir(), '.openclaw'),
      '/tmp'
    ];
    if (!allowed.some(dir => resolved.startsWith(dir))) {
      return res.status(403).json({ error: '无权访问此文件' });
    }

    if (!await fs.pathExists(resolved)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    const mime = getMimeType(resolved);
    const stat = await fs.stat(resolved);

    res.setHeader('Content-Type', mime);
    res.setHeader('Content-Length', stat.size);
    res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(path.basename(resolved))}"`);
    fs.createReadStream(resolved).pipe(res);
  } catch (error: any) {
    res.status(500).json({ error: '文件读取失败', details: error.message });
  }
});

// GET /api/chat/status
router.get('/status', async (req, res) => {
  try {
    await execAsync(`${OPENCLAW} status 2>/dev/null | head -1`, { timeout: 5000, env: ENV });
    res.json({ connected: true, mode: 'agent-cli' });
  } catch {
    res.json({ connected: false, mode: 'agent-cli' });
  }
});

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const map: Record<string, string> = {
    '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
    '.gif': 'image/gif', '.svg': 'image/svg+xml', '.webp': 'image/webp',
    '.pdf': 'application/pdf', '.json': 'application/json',
    '.csv': 'text/csv', '.txt': 'text/plain', '.md': 'text/markdown',
    '.html': 'text/html', '.xml': 'text/xml',
    '.js': 'text/javascript', '.ts': 'text/typescript',
    '.py': 'text/x-python', '.zip': 'application/zip',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  };
  return map[ext] || 'application/octet-stream';
}

export default router;

// GET /api/chat/history - 获取主会话最近的消息历史
router.get('/history', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const sessionId = await getMainSessionId();
    
    // 读取 session 文件
    const sessionPath = path.join(
      os.homedir(), '.openclaw', 'agents', 'main', 'sessions', `${sessionId}.jsonl`
    );

    if (!await fs.pathExists(sessionPath)) {
      return res.json({ messages: [] });
    }

    const content = await fs.readFile(sessionPath, 'utf-8');
    const lines = content.trim().split('\n').filter(l => l.trim());
    const messages: any[] = [];
    
    // 只取最后 limit 条
    const recentLines = lines.slice(-limit * 2); // *2 因为可能有 tool 消息
    
    for (const line of recentLines) {
      try {
        const entry = JSON.parse(line);
        const msg = entry.message || entry;
        if (msg.role === 'user' || msg.role === 'assistant') {
          let content = '';
          if (typeof msg.content === 'string') {
            content = msg.content;
          } else if (Array.isArray(msg.content)) {
            content = msg.content
              .filter((c: any) => c.type === 'text')
              .map((c: any) => c.text)
              .join('\n');
          }
          if (content.trim()) {
            messages.push({
              id: entry.id || `${entry.timestamp || Date.now()}`,
              role: msg.role,
              content,
              timestamp: new Date(entry.timestamp || Date.now()).getTime()
            });
          }
        }
      } catch {}
    }

    res.json({ messages: messages.slice(-limit) }); // 最新的在后面
  } catch (error: any) {
    console.error('[Chat] History error:', error.message);
    res.status(500).json({ error: '获取历史失败', details: error.message });
  }
});
