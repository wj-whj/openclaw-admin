import { exec } from 'child_process';
import { promisify } from 'util';
import os from 'os';
import fs from 'fs-extra';
import { DashboardData } from '../types';

const execAsync = promisify(exec);

// 维护历史数据和 EMA 状态
const cpuHistory: number[] = [];
const memoryHistory: number[] = [];
const MAX_HISTORY = 30;
let cpuEMA: number | null = null; // 指数移动平均
let memoryEMA: number | null = null;

export async function getDashboardData(): Promise<DashboardData & { system: { cpu: number; memory: number; cpuHistory: number[]; memoryHistory: number[] } }> {
  const [gatewayStatus, sessions, systemInfo, usage, channels] = await Promise.all([
    getGatewayStatus(),
    getSessionsInfo(),
    getSystemInfo(),
    getUsageInfo(),
    getChannelsStatus()
  ]);

  // 更新历史
  cpuHistory.push(systemInfo.cpu);
  memoryHistory.push(systemInfo.memory);
  if (cpuHistory.length > MAX_HISTORY) cpuHistory.shift();
  if (memoryHistory.length > MAX_HISTORY) memoryHistory.shift();

  // 指数移动平均（EMA）平滑：alpha=0.15，更接近活动监视器的平滑效果
  // 活动监视器使用非常平滑的算法，对瞬时峰值不敏感
  const alpha = 0.15;
  if (cpuEMA === null) {
    cpuEMA = systemInfo.cpu;
  } else {
    cpuEMA = alpha * systemInfo.cpu + (1 - alpha) * cpuEMA;
  }
  if (memoryEMA === null) {
    memoryEMA = systemInfo.memory;
  } else {
    memoryEMA = alpha * systemInfo.memory + (1 - alpha) * memoryEMA;
  }

  const smoothCpu = Math.round(cpuEMA);
  const smoothMemory = Math.round(memoryEMA);

  return {
    gateway: gatewayStatus,
    sessions,
    usage,
    channels,
    system: {
      cpu: smoothCpu,
      memory: smoothMemory,
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
    // CPU: 用 top -l 1 单次采样（轻量，不会触发额外 CPU 消耗）
    let cpu = 0;
    try {
      const { stdout: topOutput } = await execAsync('top -l 1 -n 0', { timeout: 2000 });
      const userMatch = topOutput.match(/([\d.]+)%\s*user/);
      const sysMatch = topOutput.match(/([\d.]+)%\s*sys/);
      if (userMatch && sysMatch) {
        const rawCpu = parseFloat(userMatch[1]) + parseFloat(sysMatch[1]);
        // top 的采样比活动监视器高约 2-2.5 倍，应用缩放系数
        cpu = Math.round(rawCpu * 0.45);
      }
    } catch (err) {
      // fallback: 使用默认值
      cpu = 0;
    }

    // Memory: 用 vm_stat + sysctl 获取更准确的数据
    let memory = 0;
    try {
      const { stdout: vmStat } = await execAsync('vm_stat');
      const { stdout: memSize } = await execAsync('/usr/sbin/sysctl -n hw.memsize');
      
      const pageSize = 16384; // macOS arm64 page size
      const totalBytes = parseInt(memSize.trim());
      
      const freeMatch = vmStat.match(/Pages free:\s+([\d]+)/);
      const activeMatch = vmStat.match(/Pages active:\s+([\d]+)/);
      const inactiveMatch = vmStat.match(/Pages inactive:\s+([\d]+)/);
      const wiredMatch = vmStat.match(/Pages wired down:\s+([\d]+)/);
      const compressedMatch = vmStat.match(/Pages occupied by compressor:\s+([\d]+)/);
      
      if (freeMatch && activeMatch && wiredMatch) {
        const free = parseInt(freeMatch[1]);
        const active = parseInt(activeMatch[1]);
        const inactive = parseInt(inactiveMatch?.[1] || '0');
        const wired = parseInt(wiredMatch[1]);
        const compressed = parseInt(compressedMatch?.[1] || '0');
        
        // 已使用 = active + wired + compressed（与活动监视器一致）
        const usedPages = active + wired + compressed;
        const totalPages = totalBytes / pageSize;
        memory = Math.round((usedPages / totalPages) * 100);
      }
    } catch {
      // fallback to top
      const { stdout: topOutput } = await execAsync('top -l 1 -n 0');
      const physMatch = topOutput.match(/PhysMem:\s*([\d.]+)([MG])\s*used.*?([\d.]+)([MG])\s*unused/);
      if (physMatch) {
        const usedVal = parseFloat(physMatch[1]) * (physMatch[2] === 'G' ? 1024 : 1);
        const unusedVal = parseFloat(physMatch[3]) * (physMatch[4] === 'G' ? 1024 : 1);
        const totalMB = usedVal + unusedVal;
        memory = Math.round((usedVal / totalMB) * 100);
      }
    }

    return {
      cpu: Math.max(0, Math.min(cpu, 100)),
      memory: Math.max(0, Math.min(memory, 100))
    };
  } catch {
    return { cpu: 0, memory: 0 };
  }
}

async function getChannelsStatus() {
  try {
    const openclawPath = `${os.homedir()}/.nvm/versions/node/v24.0.2/bin/openclaw`;
    const { stdout } = await execAsync(`${openclawPath} status 2>&1`);
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
