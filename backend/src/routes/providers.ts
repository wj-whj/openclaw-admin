import { readConfig, writeConfig } from '../utils/config';
import { Router } from 'express';
import fs from 'fs-extra';
import os from 'os';

const router = Router();
const CONFIG_PATH = `${os.homedir()}/.openclaw/openclaw.json`;

// GET /api/providers - 获取所有 providers
router.get('/', async (req, res) => {
  try {
    const config = await readConfig();
    const providers = config.models?.providers || {};
    const defaultModel = config.agents?.defaults?.model || {};

    const result = Object.entries(providers).map(([name, data]: [string, any]) => ({
      name,
      api: data.api || '',
      baseUrl: data.baseUrl || '',
      apiKey: data.apiKey ? `${data.apiKey.substring(0, 8)}...` : '',
      hasApiKey: !!data.apiKey,
      models: (data.models || []).map((m: any) => ({
        id: m.id,
        name: m.name || m.id,
        contextWindow: m.contextWindow || 0,
        maxTokens: m.maxTokens || 0,
        reasoning: m.reasoning || false
      }))
    }));

    // 构建每个 agent 的实际模型配置
    const agentsList = config.agents?.list || [];
    const agentModels = agentsList.map((agent: any) => ({
      id: agent.id,
      model: agent.model || defaultModel,
      workspace: agent.workspace || config.agents?.defaults?.workspace || ''
    }));

    res.json({ providers: result, defaultModel, agentModels });
  } catch (error) {
    console.error('Failed to get providers:', error);
    res.status(500).json({ error: 'Failed to get providers' });
  }
});

// PUT /api/providers/default-model - 设置默认模型（必须在 /:name 之前）
router.put('/default-model', async (req, res) => {
  try {
    const { primary, fallbacks } = req.body;
    console.log('[PUT /default-model] Request body:', req.body);
    const config = await readConfig();
    console.log('[PUT /default-model] Current config.agents.defaults.model:', config.agents?.defaults?.model);

    if (!config.agents) config.agents = {};
    if (!config.agents.defaults) config.agents.defaults = {};
    if (!config.agents.defaults.model) config.agents.defaults.model = {};

    if (primary !== undefined) config.agents.defaults.model.primary = primary;
    if (fallbacks !== undefined) config.agents.defaults.model.fallbacks = fallbacks;

    console.log('[PUT /default-model] New config.agents.defaults.model:', config.agents.defaults.model);
    await writeConfig(config);
    console.log('[PUT /default-model] Config written to', CONFIG_PATH);
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update default model:', error);
    res.status(500).json({ error: 'Failed to update default model' });
  }
});

// PUT /api/providers/:name - 更新 provider
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const { api, baseUrl, apiKey, models } = req.body;
    const config = await readConfig();

    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};

    const existing = config.models.providers[name] || {};

    config.models.providers[name] = {
      ...existing,
      ...(api !== undefined && { api }),
      ...(baseUrl !== undefined && { baseUrl }),
      ...(apiKey !== undefined && apiKey !== '' && { apiKey }),
      ...(models !== undefined && { models })
    };

    // 保留原有 apiKey 如果没有传新的
    if (apiKey === undefined && existing.apiKey) {
      config.models.providers[name].apiKey = existing.apiKey;
    }

    await writeConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update provider:', error);
    res.status(500).json({ error: 'Failed to update provider' });
  }
});

// POST /api/providers - 新增 provider
router.post('/', async (req, res) => {
  try {
    const { name, api, baseUrl, apiKey, models } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const config = await readConfig();
    if (!config.models) config.models = {};
    if (!config.models.providers) config.models.providers = {};

    if (config.models.providers[name]) {
      return res.status(409).json({ error: 'Provider already exists' });
    }

    config.models.providers[name] = {
      api: api || 'openai-completions',
      baseUrl: baseUrl || '',
      ...(apiKey && { apiKey }),
      models: models || []
    };

    await writeConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to create provider:', error);
    res.status(500).json({ error: 'Failed to create provider' });
  }
});

// DELETE /api/providers/:name - 删除 provider
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const config = await readConfig();

    if (!config.models?.providers?.[name]) {
      return res.status(404).json({ error: 'Provider not found' });
    }

    delete config.models.providers[name];
    await writeConfig(config);
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete provider:', error);
    res.status(500).json({ error: 'Failed to delete provider' });
  }
});

export default router;
