import { Router } from 'express';
import { promises as fs } from 'fs';
import path from 'path';
import os from 'os';

const router = Router();

interface AgentStatus {
  id: string;
  name: string;
  emoji: string;
  model: string;
  workspace: string;
  online: boolean;
  lastActive: number;
  currentTask: string;
  totalTokens: number;
  sessionCount: number;
  recentSessions: {
    label: string;
    updatedAt: number;
    tokenCount: number;
    status: string;
  }[];
}

const AGENTS = [
  {
    id: 'main',
    name: 'Boss',
    emoji: '📋',
    workspace: '~/.openclaw/workspace',
    sessionsPath: '~/.openclaw/agents/main/sessions'
  },
  {
    id: 'dev',
    name: 'Dev',
    emoji: '💻',
    workspace: '~/.openclaw/workspace-dev',
    sessionsPath: '~/.openclaw/agents/dev/sessions'
  },
  {
    id: 'ops',
    name: 'Ops',
    emoji: '🔧',
    workspace: '~/.openclaw/workspace-ops',
    sessionsPath: '~/.openclaw/agents/ops/sessions'
  }
];

function expandPath(p: string): string {
  if (p.startsWith('~/')) {
    return path.join(os.homedir(), p.slice(2));
  }
  return p;
}

async function readSessionsJson(sessionsPath: string): Promise<any> {
  try {
    const fullPath = path.join(expandPath(sessionsPath), 'sessions.json');
    const content = await fs.readFile(fullPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    return {};
  }
}

async function calculateTokensFromJsonl(jsonlPath: string): Promise<number> {
  try {
    const content = await fs.readFile(jsonlPath, 'utf-8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    let totalTokens = 0;
    
    for (const line of lines) {
      try {
        const entry = JSON.parse(line);
        if (entry.message?.usage?.totalTokens) {
          totalTokens += entry.message.usage.totalTokens;
        }
      } catch (e) {
        // Skip invalid lines
      }
    }
    
    return totalTokens;
  } catch (error) {
    return 0;
  }
}

async function getAgentStatus(agentConfig: typeof AGENTS[0]): Promise<AgentStatus> {
  const sessionsData = await readSessionsJson(agentConfig.sessionsPath);
  const sessions = Object.values(sessionsData) as any[];
  
  // Sort by updatedAt
  sessions.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  
  const now = Date.now();
  const fiveMinutesAgo = now - 5 * 60 * 1000;
  
  let totalTokens = 0;
  const recentSessions = [];
  
  for (const session of sessions.slice(0, 5)) {
    const sessionId = session.sessionId || '';
    const jsonlPath = path.join(expandPath(agentConfig.sessionsPath), `${sessionId}.jsonl`);
    const tokenCount = await calculateTokensFromJsonl(jsonlPath);
    totalTokens += tokenCount;
    
    const isActive = (session.updatedAt || 0) > fiveMinutesAgo;
    
    recentSessions.push({
      label: session.label || 'Unnamed Session',
      updatedAt: session.updatedAt || 0,
      tokenCount,
      status: isActive ? 'active' : 'completed'
    });
  }
  
  // Calculate total tokens for all sessions
  for (const session of sessions.slice(5)) {
    const sessionId = session.sessionId || '';
    const jsonlPath = path.join(expandPath(agentConfig.sessionsPath), `${sessionId}.jsonl`);
    const tokenCount = await calculateTokensFromJsonl(jsonlPath);
    totalTokens += tokenCount;
  }
  
  const latestSession = sessions[0];
  const online = latestSession && (latestSession.updatedAt || 0) > fiveMinutesAgo;
  
  return {
    id: agentConfig.id,
    name: agentConfig.name,
    emoji: agentConfig.emoji,
    model: latestSession?.model || 'unknown',
    workspace: agentConfig.workspace,
    online,
    lastActive: latestSession?.updatedAt || 0,
    currentTask: latestSession?.label || 'No active task',
    totalTokens,
    sessionCount: sessions.length,
    recentSessions
  };
}

router.get('/', async (req, res) => {
  try {
    const statuses = await Promise.all(
      AGENTS.map(agent => getAgentStatus(agent))
    );
    
    res.json({
      agents: statuses,
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Team status error:', error);
    res.status(500).json({ error: 'Failed to get team status' });
  }
});

export default router;
