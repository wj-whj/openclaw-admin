import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs-extra';
import { DashboardData } from '../types';

const execAsync = promisify(exec);

// ========== 缓存层 ==========
// 后台定时采样，API 直接返回缓存值，避免每次请求都跑 top/openclaw status
const cache = {
  cpu: 0,
  memory: 0,
  cpuHistory: [] as number[],
  memoryHistory: [] as number[],
  channels: [] as any[],
  lastCpuSample: 0,
  lastChannelsSample: 0,
};
const MAX_HISTORY = 30;

// CPU: 后台每 5 秒采样一次，用 os.cpus() 差值计算（零开销，不启动子进程）
let prevCpuTimes: { idle: number; total: number } | null = null;

function sampleCpuFromOs(): number {
  const cpus = os.cpus();
  let idle = 0, total = 0;
  for (const cpu of cpus) {
    idle += cpu.times.idle;
    total += cpu.times.user + cpu.times.nice + cpu.times.sys + cpu.times.idle + cpu.times.irq;
  }

  if (prevCpuTimes === null) {
    prevCpuTimes = { idle, total };
    return 0;
  }

  const idleDiff = idle - prevCpuTimes.idle;
  const totalDiff = total - prevCpuTimes.total;
  prevCpuTimes = { idle, total };

  if (totalDiff === 0) return 0;
  return Math.round((1 - idleDiff / totalDiff) * 100);
}

// 内存：用 vm_stat（准确匹配活动监视器）
async function sampleMemory(): Promise<number> {
  try {
    const { stdout: vmStat } = await execAsync('vm_stat', { timeout: 2000 });
    const { stdout: memSize } = await execAsync('/usr/sbin/sysctl -n hw.memsize', { timeout: 2000 });

    const pageSize = 16384;
    const totalBytes = parseInt(memSize.trim());
    const activeMatch = vmStat.match(/Pages active:\s+([\d]+)/);
    const wiredMatch = vmStat.match(/Pages wired down:\s+([\d]+)/);
    const compressedMatch = vmStat.match(/Pages occupied by compressor:\s+([\d]+)/);

    if (activeMatch && wiredMatch) {
      const active = parseInt(activeMatch[1]);
      const wired = parseInt(wiredMatch[1]);
      const compressed = parseInt(compressedMatch?.[1] || '0');
      const usedPages = active + wired + compressed;
      const totalPages = totalBytes / pageSize;
      return Math.round((usedPages / totalPages) * 100);
    }
  } catch {}
  return 0;
}

// 后台采样循环
function startBackgroundSampling() {
  // 初始化第一次 CPU 基准
  sampleCpuFromOs();

  // 每 3 秒采样 CPU 和内存
  setInterval(async () => {
    const cpu = sampleCpuFromOs();
    const memory = await sampleMemory();

    cache.cpu = cpu;
    cache.memory = memory;
    cache.cpuHistory.push(cpu);
    cache.memoryHistory.push(memory);
    if (cache.cpuHistory.length > MAX_HISTORY) cache.cpuHistory.shift();
    if (cache.memoryHistory.length > MAX_HISTORY) cache.memoryHistory.shift();
  }, 3000);

  // 每 30 秒采样 channels 状态（重操作，不要频繁调用）
  const refreshChannels = async () => {
    cache.channels = await fetchChannelsStatus();
    cache.lastChannelsSample = Date.now();
  };
  refreshChannels();
  setInterval(refreshChannels, 30000);
}

// 启动后台采样
startBackgroundSampling();

// ========== 公开 API ==========

export async function getDashboardData(): Promise<DashboardData & { system: { cpu: number; memory: number; cpuHistory: number[]; memoryHistory: number[] } }> {
  // 并行获取非缓存数据
  const [gatewayStatus, sessions, usage] = await Promise.all([
    getGatewayStatus(),
    getSessionsInfo(),
    getUsageInfo(),
  ]);

  return {
    gateway: gatewayStatus,
    sessions,
    usage,
    channels: cache.channels,
    system: {
      cpu: cache.cpu,
      memory: cache.memory,
      cpuHistory: [...cache.cpuHistory],
      memoryHistory: [...cache.memoryHistory],
    }
  };
}

async function getGatewayStatus() {
  try {
    const { stdout } = await execAsync('/bin/ps -ax -o pid,etime,command');
    const lines = stdout.split('\n').filter((l: string) => {
      const trimmed = l.trim();
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
    const agentsDir = `${os.homedir()}/.openclaw/agents`;
    const now = Date.now();
    const activeThreshold = 30 * 60 * 1000;
    let total = 0;
    let activeCount = 0;
    let subagentCount = 0;

    if (!await fs.pathExists(agentsDir)) {
      return { total: 0, active: 0, subagents: 0 };
    }

    const agents = await fs.readdir(agentsDir);
    for (const agent of agents) {
      const sessionsDir = `${agentsDir}/${agent}/sessions`;
      if (!await fs.pathExists(sessionsDir)) continue;

      const sessionsJsonPath = `${sessionsDir}/sessions.json`;
      const sessionsData = await fs.pathExists(sessionsJsonPath) ? await fs.readJSON(sessionsJsonPath) : {};
      const knownIds = new Set(Object.values(sessionsData).map((m: any) => m.sessionId));

      total += Object.keys(sessionsData).length;
      for (const [, meta] of Object.entries(sessionsData) as [string, any][]) {
        if (meta.updatedAt && (now - meta.updatedAt < activeThreshold)) activeCount++;
      }

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
    const agentsDir = `${os.homedir()}/.openclaw/agents`;
    if (!await fs.pathExists(agentsDir)) {
      return { tokensToday: 0, requestsToday: 0, modelStats: [] };
    }

    let tokensToday = 0;
    let requestsToday = 0;
    const modelTokens: Record<string, number> = {};

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTimestamp = today.getTime();

    const agents = await fs.readdir(agentsDir);
    for (const agent of agents) {
      const sessionsDir = `${agentsDir}/${agent}/sessions`;
      if (!await fs.pathExists(sessionsDir)) continue;

      const files = await fs.readdir(sessionsDir);
      const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

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
                const tokens = entry.message.usage.totalTokens;
                const model = entry.message?.model || 'unknown';
                tokensToday += tokens;
                requestsToday++;
                modelTokens[model] = (modelTokens[model] || 0) + tokens;
              }
            } catch {}
          }
        } catch {}
      }
    }

    const modelStats = Object.entries(modelTokens)
      .map(([model, tokens]) => ({ model, tokens }))
      .sort((a, b) => b.tokens - a.tokens);

    return { tokensToday, requestsToday, modelStats };
  } catch {
    return { tokensToday: 0, requestsToday: 0, modelStats: [] };
  }
}

async function fetchChannelsStatus() {
  try {
    const openclawPath = `${os.homedir()}/.nvm/versions/node/v24.0.2/bin/openclaw`;
    const { stdout } = await execAsync(`${openclawPath} status 2>&1`, { timeout: 10000 });
    const lines = stdout.split('\n');
    const channelsIdx = lines.findIndex(l => l.trim().startsWith('Channels'));
    if (channelsIdx === -1) return [];

    const channels = [];
    for (let i = channelsIdx + 3; i < lines.length; i++) {
      const line = lines[i];
      if (line.includes('└─') || line.trim() === '') break;
      if (!line.includes('│')) continue;
      const parts = line.split('│').map(s => s.trim()).filter(Boolean);
      if (parts.length >= 4 && parts[0] !== 'Channel') {
        channels.push({
          name: parts[0],
          enabled: parts[1] === 'ON',
          state: parts[2],
          detail: parts[3]
        });
      }
    }
    return channels;
  } catch {
    return [];
  }
}

