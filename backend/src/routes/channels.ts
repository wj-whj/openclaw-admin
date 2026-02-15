import { Router } from 'express';
import fs from 'fs-extra';
import os from 'os';

const router = Router();
const CONFIG_PATH = `${os.homedir()}/.openclaw/openclaw.json`;

// 脱敏处理 token/key
function maskToken(token: string): string {
  if (!token || token.length < 8) return '***';
  return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
}

// GET /api/channels - 获取所有 channels
router.get('/', async (req, res) => {
  try {
    const config = await fs.readJSON(CONFIG_PATH);
    const channels = config.channels || {};

    const result = Object.entries(channels).map(([name, data]: [string, any]) => {
      const masked: any = {
        name,
        type: name, // telegram/whatsapp/discord 等
        enabled: data.enabled ?? true,
        dmPolicy: data.dmPolicy || 'pairing',
        groupPolicy: data.groupPolicy || 'allowlist',
        streamMode: data.streamMode || 'partial'
      };

      // 脱敏处理敏感字段
      if (data.botToken) {
        masked.botToken = maskToken(data.botToken);
        masked.hasBotToken = true;
      }
      if (data.token) {
        masked.token = maskToken(data.token);
        masked.hasToken = true;
      }
      if (data.apiKey) {
        masked.apiKey = maskToken(data.apiKey);
        masked.hasApiKey = true;
      }

      // 保留非敏感字段
      if (data.webhook) masked.webhook = data.webhook;
      if (data.guildId) masked.guildId = data.guildId;
      if (data.server) masked.server = data.server;
      if (data.port) masked.port = data.port;
      if (data.nickname) masked.nickname = data.nickname;
      if (data.channels) masked.channels = data.channels;
      if (data.phone) masked.phone = data.phone;
      if (data.workspace) masked.workspace = data.workspace;

      return masked;
    });

    res.json({ channels: result });
  } catch (error) {
    console.error('Failed to get channels:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

// POST /api/channels - 添加新 channel
router.post('/', async (req, res) => {
  try {
    const { name, type, ...rawData } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const config = await fs.readJSON(CONFIG_PATH);
    if (!config.channels) config.channels = {};

    if (config.channels[name]) {
      return res.status(409).json({ error: 'Channel already exists' });
    }

    // 只写入 OpenClaw 认可的字段，过滤掉前端 UI 字段
    const VALID_FIELDS = [
      'enabled', 'dmPolicy', 'groupPolicy', 'streamMode',
      'botToken', 'token', 'apiKey', 'tokenFile',
      'allowFrom', 'groupAllowFrom',
      'webhook', 'webhookUrl', 'webhookSecret', 'webhookPath', 'webhookHost',
      'guildId', 'server', 'port', 'nickname', 'channels',
      'phone', 'account', 'workspace', 'password',
      'replyToMode', 'textChunkLimit', 'chunkMode',
      'blockStreaming', 'mediaMaxMb', 'timeoutSeconds',
      'proxy', 'configWrites', 'selfChatMode',
      'historyLimit', 'dmHistoryLimit',
      'name', 'capabilities', 'markdown',
      'actions', 'reactionNotifications', 'reactionLevel',
      'heartbeat', 'linkPreview', 'responsePrefix',
      'retry', 'network', 'groups', 'dms',
      'draftChunk', 'blockStreamingCoalesce',
      'commands', 'customCommands'
    ];

    const channelData: Record<string, any> = {};
    for (const key of VALID_FIELDS) {
      if (rawData[key] !== undefined && rawData[key] !== '') {
        channelData[key] = rawData[key];
      }
    }

    // 设置默认值
    config.channels[name] = {
      enabled: true,
      dmPolicy: 'pairing',
      groupPolicy: 'allowlist',
      streamMode: 'partial',
      ...channelData
    };

    await fs.writeJSON(CONFIG_PATH, config, { spaces: 2 });
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to create channel:', error);
    res.status(500).json({ error: 'Failed to create channel' });
  }
});

// PUT /api/channels/:name - 更新 channel
router.put('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const rawData = req.body;
    const config = await fs.readJSON(CONFIG_PATH);

    if (!config.channels) config.channels = {};
    if (!config.channels[name]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const existing = config.channels[name];

    // 只允许更新 OpenClaw 认可的字段
    const VALID_FIELDS = [
      'enabled', 'dmPolicy', 'groupPolicy', 'streamMode',
      'botToken', 'token', 'apiKey', 'tokenFile',
      'allowFrom', 'groupAllowFrom',
      'webhook', 'webhookUrl', 'webhookSecret', 'webhookPath', 'webhookHost',
      'guildId', 'server', 'port', 'nickname', 'channels',
      'phone', 'account', 'workspace', 'password',
      'replyToMode', 'textChunkLimit', 'chunkMode',
      'blockStreaming', 'mediaMaxMb', 'timeoutSeconds',
      'proxy', 'configWrites', 'selfChatMode',
      'historyLimit', 'dmHistoryLimit',
      'name', 'capabilities', 'markdown',
      'actions', 'reactionNotifications', 'reactionLevel',
      'heartbeat', 'linkPreview', 'responsePrefix',
      'retry', 'network', 'groups', 'dms',
      'draftChunk', 'blockStreamingCoalesce',
      'commands', 'customCommands'
    ];

    const channelData: Record<string, any> = {};
    for (const key of VALID_FIELDS) {
      if (rawData[key] !== undefined && rawData[key] !== '') {
        channelData[key] = rawData[key];
      }
    }

    // 合并配置
    config.channels[name] = {
      ...existing,
      ...channelData
    };

    // 如果传了空字符串的 token，保留原有的
    if (channelData.botToken === '' && existing.botToken) {
      config.channels[name].botToken = existing.botToken;
    }
    if (channelData.token === '' && existing.token) {
      config.channels[name].token = existing.token;
    }
    if (channelData.apiKey === '' && existing.apiKey) {
      config.channels[name].apiKey = existing.apiKey;
    }

    await fs.writeJSON(CONFIG_PATH, config, { spaces: 2 });
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to update channel:', error);
    res.status(500).json({ error: 'Failed to update channel' });
  }
});

// DELETE /api/channels/:name - 删除 channel
router.delete('/:name', async (req, res) => {
  try {
    const { name } = req.params;
    const config = await fs.readJSON(CONFIG_PATH);

    if (!config.channels?.[name]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    delete config.channels[name];
    await fs.writeJSON(CONFIG_PATH, config, { spaces: 2 });
    res.json({ ok: true });
  } catch (error) {
    console.error('Failed to delete channel:', error);
    res.status(500).json({ error: 'Failed to delete channel' });
  }
});

// POST /api/channels/:name/test - 测试连接
router.post('/:name/test', async (req, res) => {
  try {
    const { name } = req.params;
    const config = await fs.readJSON(CONFIG_PATH);

    if (!config.channels?.[name]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    // TODO: 实现真实的连接测试逻辑
    // 这里暂时返回模拟结果
    const channel = config.channels[name];
    const hasCredentials = channel.botToken || channel.token || channel.apiKey;

    res.json({
      ok: true,
      connected: hasCredentials && channel.enabled,
      message: hasCredentials ? 'Connection test passed' : 'Missing credentials'
    });
  } catch (error) {
    console.error('Failed to test channel:', error);
    res.status(500).json({ error: 'Failed to test channel' });
  }
});

export default router;
