import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs-extra';
import { DashboardData } from '../types';

const execAsync = promisify(exec);

// 维护历史数据
const cpuHistory: number[] = [];
const memoryHistory: number[] = [];
const MAX_HISTORY = 20;

export async function getDashboardData(): Promise<DashboardData & { system: { cpu: number; memory: number; cpuHistory: number[]; memoryHistory: number[] } }> {
  const [gatewayStatus, sessions, systemInfo, usage] = await Promise.all([
    getGatewayStatus(),
    getSessionsInfo(),
    getSystemInfo(),
    getUsageInfo()
  ]);

  // 更新历史
  cpuHistory.push(systemInfo.cpu);
  memoryHistory.push(systemInfo.memory);
  if (cpuHistory.length > MAX_HISTORY) cpuHistory.shift();
  if (memoryHistory.length > MAX_HISTORY) memoryHistory.shift();

  return {
    gateway: gatewayStatus,
    sessions,
    usage,
    system: {
      ...systemInfo,
      cpuHistory: [...cpuHistory],
      memoryHistory: [...memoryHistory]
    }
  };
}

async function getGatewayStatus() {
  try {
    const { stdout } = await execAsync('/bin/ps -ax -o pid,etime,command');
    const lines = stdout.split('\n').filter((l: string) => {
      const trimmed = l.trim();
      // 精确匹配 openclaw-gateway 进程，排除 grep 和 ps 自身
      return trimmed.includes('openclaw-gateway') && !trimmed.includes('grep') && !trimmed.includes('/bin/ps');
    });

    if (lines.length > 0) {
      const parts = lines[0].trim().split(/\s+/);
      const pid = parseInt(parts[0]);
      const uptime = parts[1] || '0';
      return { status: 'running' as const, uptime, pid };
    }

    return { status: 'stopped' as const, uptime: '0', pid: null };
  } catch {
    return { status: 'stopped' as const, uptime: '0', pid: null };
  }
}

async function getSessionsInfo() {
  try {
    const sessionsDir = `${os.homedir()}/.openclaw/agents/main/sessions`;
    const sessionsJsonPath = `${sessionsDir}/sessions.json`;
    const sessionsData = await fs.pathExists(sessionsJsonPath) ? await fs.readJSON(sessionsJsonPath) : {};
    const knownIds = new Set(Object.values(sessionsData).map((m: any) => m.sessionId));

    const now = Date.now();
    const activeThreshold = 30 * 60 * 1000;
    let total = Object.keys(sessionsData).length;
    let activeCount = 0;
    let subagentCount = 0;

    // sessions.json 中的会话
    for (const [key, meta] of Object.entries(sessionsData) as [string, any][]) {
      if (meta.updatedAt && (now - meta.updatedAt < activeThreshold)) activeCount++;
    }

    // 扫描孤立 jsonl（子代理等）
    if (await fs.pathExists(sessionsDir)) {
      const files = await fs.readdir(sessionsDir);
      for (const file of files) {
        if (!file.endsWith('.jsonl') || file.includes('.deleted') || file.includes('.lock')) continue;
        const sid = file.replace('.jsonl', '');
        if (knownIds.has(sid)) continue;
        total++;
        subagentCount++;
      }
    }

    return { total, active: activeCount, subagents: subagentCount };
  } catch {
    return { total: 0, active: 0, subagents: 0 };
  }
}

async function getUsageInfo() {
  try {
    const sessionsDir = `${os.homedir()}/.openclaw/agents/main/sessions`;
    if (!await fs.pathExists(sessionsDir)) {
      return { tokensToday: 0, requestsToday: 0 };
    }

    const files = await fs.readdir(sessionsDir);
    const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

    let tokensToday = 0;
    let requestsToday = 0;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    for (const file of jsonlFiles) {
      try {
        const content = await fs.readFile(`${sessionsDir}/${file}`, 'utf-8');
        const lines = content.trim().split('\n').filter(l => l.length > 0);

        for (const line of lines) {
          try {
            const entry = JSON.parse(line);
            const timestamp = new Date(entry.timestamp).getTime();
            if (timestamp < todayTimestamp) continue;

            if (entry.message?.usage?.totalTokens) {
              tokensToday += entry.message.usage.totalTokens;
              requestsToday++;
            }
          } catch {}
        }
      } catch {}
    }

    return { tokensToday, requestsToday };
  } catch {
    return { tokensToday: 0, requestsToday: 0 };
  }
}

async function getSystemInfo() {
  try {
    // 用 top -l 1 一次性获取 CPU 和内存
    const { stdout: topOutput } = await execAsync('top -l 1 -n 0');

    // CPU: 格式 "CPU usage: 25.11% user, 13.48% sys, 61.39% idle"
    const idleMatch = topOutput.match(/([\d.]+)%\s*idle/);
    const cpu = idleMatch ? Math.round(100 - parseFloat(idleMatch[1])) : 0;

    // Memory: 格式 "PhysMem: 15G used (2678M wired, 2437M compressor), 582M unused."
    let memory = 0;
    const physMatch = topOutput.match(/PhysMem:\s*([\d.]+)([MG])\s*used.*?([\d.]+)([MG])\s*unused/);
    if (physMatch) {
      const usedVal = parseFloat(physMatch[1]) * (physMatch[2] === 'G' ? 1024 : 1);
      const unusedVal = parseFloat(physMatch[3]) * (physMatch[4] === 'G' ? 1024 : 1);
      const totalMB = usedVal + unusedVal;
      memory = Math.round((usedVal / totalMB) * 100);
    }

    return {
      cpu: Math.max(0, Math.min(cpu, 100)),
      memory: Math.max(0, Math.min(memory, 100))
    };
  } catch {
    return { cpu: 0, memory: 0 };
  }
}
