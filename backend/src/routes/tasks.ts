import { Router } from 'express';
import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs-extra';
import path from 'path';

const router = Router();
const execAsync = promisify(exec);
const OPENCLAW = path.join(os.homedir(), '.nvm/versions/node/v24.0.2/bin/openclaw');

// 执行 openclaw cron 命令
async function cronExec(args: string): Promise<string> {
  const { stdout } = await execAsync(`${OPENCLAW} cron ${args}`, {
    timeout: 15000,
    env: { ...process.env, PATH: `${path.dirname(OPENCLAW)}:${process.env.PATH}` }
  });
  return stdout.trim();
}

// GET /api/tasks - 获取所有定时任务
router.get('/', async (req, res) => {
  try {
    // 通过 CLI 获取真实 cron jobs
    let cronJobs: any[] = [];
    try {
      const output = await cronExec('list --json');
      const parsed = JSON.parse(output);
      cronJobs = (parsed.jobs || []).map((job: any) => ({
        id: job.id,
        type: 'cron',
        name: job.name || '未命名任务',
        schedule: job.schedule || {},
        payload: job.payload || {},
        enabled: job.enabled !== false,
        sessionTarget: job.sessionTarget || 'isolated',
        delivery: job.delivery || {},
        state: job.state || {},
        createdAt: job.createdAtMs || null,
        updatedAt: job.updatedAtMs || null
      }));
    } catch (e: any) {
      // "No cron jobs" 不是错误
      if (!e.message?.includes('No cron jobs')) {
        console.error('cron list error:', e.message);
      }
    }

    // 子代理任务
    const sessionsPath = path.join(os.homedir(), '.openclaw', 'agents', 'main', 'sessions', 'sessions.json');
    const subagentTasks: any[] = [];
    if (await fs.pathExists(sessionsPath)) {
      try {
        const sessions = await fs.readJSON(sessionsPath);
        for (const [key, meta] of Object.entries(sessions) as [string, any][]) {
          if (key.includes('subagent')) {
            subagentTasks.push({
              id: key, type: 'subagent',
              label: meta.label || key.split(':').pop()?.substring(0, 8),
              status: meta.abortedLastRun ? 'failed' : (Date.now() - (meta.updatedAt || 0) < 30 * 60 * 1000 ? 'running' : 'completed'),
              model: meta.model || 'unknown',
              updatedAt: meta.updatedAt || 0
            });
          }
        }
      } catch {}
    }

    res.json({ cronJobs, subagentTasks });
  } catch (error) {
    console.error('Failed to get tasks:', error);
    res.status(500).json({ error: 'Failed to get tasks' });
  }
});

// POST /api/tasks/cron - 创建定时任务（通过 openclaw cron add）
router.post('/cron', async (req, res) => {
  try {
    const { name, scheduleType, scheduleValue, message: taskMessage, sessionTarget } = req.body;
    if (!taskMessage) {
      return res.status(400).json({ error: 'message is required' });
    }

    // 构建 CLI 参数
    const args: string[] = ['add'];
    if (name) args.push('--name', JSON.stringify(name));

    // 调度类型
    if (scheduleType === 'every') {
      // scheduleValue = everyMs 的毫秒数，或者分钟数
      const minutes = scheduleValue.minutes || 30;
      args.push('--every', `${minutes}m`);
    } else if (scheduleType === 'daily') {
      // scheduleValue = { time: "09:00" }
      const [h, m] = (scheduleValue.time || '09:00').split(':');
      args.push('--cron', JSON.stringify(`${parseInt(m)} ${parseInt(h)} * * *`));
      args.push('--tz', 'Asia/Shanghai');
    } else if (scheduleType === 'weekly') {
      // scheduleValue = { time: "09:00", day: "1" }
      const [h, m] = (scheduleValue.time || '09:00').split(':');
      const day = scheduleValue.day || '1';
      args.push('--cron', JSON.stringify(`${parseInt(m)} ${parseInt(h)} * * ${day}`));
      args.push('--tz', 'Asia/Shanghai');
    } else if (scheduleType === 'once') {
      // scheduleValue = { at: "ISO string" }
      args.push('--at', JSON.stringify(scheduleValue.at));
    }

    // 会话类型
    const target = sessionTarget || 'isolated';
    args.push('--session', target);
    if (target === 'main') {
      args.push('--system-event', JSON.stringify(taskMessage));
    } else {
      args.push('--message', JSON.stringify(taskMessage));
    }

    const output = await cronExec(args.join(' '));
    let result;
    try { result = JSON.parse(output); } catch { result = { ok: true, raw: output }; }
    res.json({ ok: true, job: result });
  } catch (error: any) {
    console.error('Failed to create cron job:', error);
    res.status(500).json({ error: 'Failed to create cron job', details: error.stderr || error.message });
  }
});

// PUT /api/tasks/cron/:id - 更新定时任务
router.put('/cron/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { enabled, name, message: taskMessage } = req.body;

    if (typeof enabled === 'boolean') {
      await cronExec(enabled ? `enable ${id}` : `disable ${id}`);
    }

    // 如果有其他字段需要更新，用 edit
    const editArgs: string[] = [];
    if (name) editArgs.push('--name', JSON.stringify(name));
    if (taskMessage) editArgs.push('--message', JSON.stringify(taskMessage));

    if (editArgs.length > 0) {
      await cronExec(`edit ${id} ${editArgs.join(' ')}`);
    }

    res.json({ ok: true });
  } catch (error: any) {
    console.error('Failed to update cron job:', error);
    res.status(500).json({ error: 'Failed to update cron job', details: error.stderr || error.message });
  }
});

// DELETE /api/tasks/cron/:id - 删除定时任务
router.delete('/cron/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await cronExec(`rm ${id}`);
    res.json({ ok: true });
  } catch (error: any) {
    console.error('Failed to delete cron job:', error);
    res.status(500).json({ error: 'Failed to delete cron job', details: error.stderr || error.message });
  }
});

// POST /api/tasks/cron/:id/run - 手动执行任务
router.post('/cron/:id/run', async (req, res) => {
  try {
    const { id } = req.params;
    const output = await cronExec(`run ${id}`);
    res.json({ ok: true, result: output });
  } catch (error: any) {
    console.error('Failed to run cron job:', error);
    res.status(500).json({ error: 'Failed to run cron job', details: error.stderr || error.message });
  }
});

export default router;
