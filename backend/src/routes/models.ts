import { readConfig, writeConfig } from '../utils/config';
import { Router } from 'express';
import fs from 'fs-extra';
import os from 'os';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
const router = Router();

// GET /api/models - 读取模型配置
router.get('/', async (req, res) => {
  try {
    const configPath = path.join(os.homedir(), '.openclaw', 'openclaw.json');
    if (!await fs.pathExists(configPath)) {
      return res.json({ providers: [], agents: {} });
    }

    const config = await readConfig();
    const providerEntries = Object.entries(config.models?.providers || {});

    // 统计每个 provider 的 token 使用量，同时按 agent 分别统计
    const usageByProvider: Record<string, { tokens: number; requests: number }> = {};
    const usageByAgent: Record<string, { tokens: number; requests: number }> = {};

    const agentsDir = path.join(os.homedir(), '.openclaw', 'agents');
    if (await fs.pathExists(agentsDir)) {
      const agents = await fs.readdir(agentsDir);
      for (const agent of agents) {
        const sessionsDir = path.join(agentsDir, agent, 'sessions');
        if (!await fs.pathExists(sessionsDir)) continue;

        const files = await fs.readdir(sessionsDir);
        const jsonlFiles = files.filter(f => f.endsWith('.jsonl'));

        for (const file of jsonlFiles) {
          try {
            const content = await fs.readFile(path.join(sessionsDir, file), 'utf-8');
            const lines = content.trim().split('\n').filter((l: string) => l.length > 0);
            for (const line of lines) {
              try {
                const entry = JSON.parse(line);
                const provider = entry.message?.provider;
                const tokens = entry.message?.usage?.totalTokens;
                if (provider && tokens) {
                  // 按 provider 汇总
                  if (!usageByProvider[provider]) {
                    usageByProvider[provider] = { tokens: 0, requests: 0 };
                  }
                  usageByProvider[provider].tokens += tokens;
                  usageByProvider[provider].requests++;
                  // 按 agent 汇总
                  if (!usageByAgent[agent]) {
                    usageByAgent[agent] = { tokens: 0, requests: 0 };
                  }
                  usageByAgent[agent].tokens += tokens;
                  usageByAgent[agent].requests++;
                }
              } catch {}
            }
          } catch {}
        }
      }
    }

    const configuredProviderNames = new Set(providerEntries.map(([name]) => name));

    const providers = providerEntries.map(([name, data]: [string, any]) => ({
      name,
      baseUrl: data.baseUrl || '',
      api: data.api || '',
      models: (data.models || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.contextWindow || 0,
        maxTokens: m.maxTokens || 0,
        reasoning: m.reasoning || false,
        cost: m.cost || null
      })),
      totalTokens: usageByProvider[name]?.tokens || 0,
      totalRequests: usageByProvider[name]?.requests || 0
    }));

    // 已删除的 provider（历史数据中存在但配置里已不存在）
    const unknownProviders: Record<string, { tokens: number; requests: number }> = {};
    for (const [provider, usage] of Object.entries(usageByProvider)) {
      if (!configuredProviderNames.has(provider)) {
        unknownProviders[provider] = usage;
      }
    }

    // 读取 agent 模型配置
    const agents: Record<string, any> = {};
    if (config.agents) {
      const agentList = Array.isArray(config.agents.list) ? config.agents.list : [];
      for (const agentConfig of agentList) {
        const cfg = agentConfig as any;
        const name = cfg.id || cfg.name || 'unknown';
        // model 可能是字符串或 {primary, fallbacks} 对象
        let modelStr = '';
        let fallbacks: string[] = [];
        if (typeof cfg.model === 'string') {
          modelStr = cfg.model;
        } else if (cfg.model && typeof cfg.model === 'object') {
          modelStr = cfg.model.primary || '';
          fallbacks = cfg.model.fallbacks || [];
        }
        if (!modelStr) {
          const defaultModel = config.models?.default;
          modelStr = typeof defaultModel === 'string' ? defaultModel : (defaultModel?.primary || '');
        }
        agents[name] = {
          model: modelStr,
          fallbackModels: fallbacks.length > 0 ? fallbacks : (cfg.fallbackModels || []),
          enabled: cfg.enabled !== false
        };
      }
    }

    res.json({ providers, agents, usageByAgent, unknownProviders });
  } catch (error) {
    console.error('Failed to get models:', error);
    res.status(500).json({ error: 'Failed to get models' });
  }
});

// PUT /api/models - 更新模型配置并重启 gateway
router.put('/', async (req, res) => {
  try {
    const { agents } = req.body;
    if (!agents) {
      return res.status(400).json({ error: 'Missing agents config' });
    }

    const config = await readConfig();
    
    // 更新 agent 模型配置（agents.list 是数组）
    if (!config.agents) config.agents = {};
    if (!Array.isArray(config.agents.list)) config.agents.list = [];
    for (const [agentName, agentData] of Object.entries(agents)) {
      const data = agentData as any;
      const existing = config.agents.list.find((a: any) => (a.id || a.name) === agentName);
      if (existing) {
        // model 存为 {primary, fallbacks} 格式
        existing.model = {
          primary: data.model || '',
          fallbacks: data.fallbackModels || []
        };
      }
    }

    await writeConfig(config);

    // 重启 gateway
    try {
      await execAsync('openclaw gateway restart');
      res.json({ success: true, message: 'Config updated and gateway restarting' });
    } catch (error) {
      console.error('Failed to restart gateway:', error);
      res.json({ success: true, message: 'Config updated but failed to restart gateway', warning: true });
    }
  } catch (error) {
    console.error('Failed to update models:', error);
    res.status(500).json({ error: 'Failed to update models' });
  }
});

// POST /api/models/test - 测试 provider 连通性
router.post('/test', async (req, res) => {
  try {
    const { provider } = req.body;
    if (!provider) {
      return res.status(400).json({ error: 'Missing provider name' });
    }

    const config = await readConfig();
    const providerConfig = config.models?.providers?.[provider];
    
    if (!providerConfig) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    // 简单测试：检查 baseUrl 是否可访问
    const baseUrl = providerConfig.baseUrl;
    if (!baseUrl) {
      return res.json({ success: false, message: 'No baseUrl configured' });
    }

    try {
      const response = await fetch(baseUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      res.json({ success: response.ok, status: response.status });
    } catch (error: any) {
      res.json({ success: false, message: error.message });
    }
  } catch (error) {
    console.error('Failed to test provider:', error);
    res.status(500).json({ error: 'Failed to test provider' });
  }
});

export default router;
