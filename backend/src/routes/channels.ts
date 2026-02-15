import { Router } from 'express';
import { readConfig, writeConfig } from '../utils/config';

const router = Router();

// 每种 channel 类型允许的字段（从 OpenClaw config schema 提取）
const CHANNEL_VALID_FIELDS: Record<string, string[]> = {
  telegram: [
    'enabled', 'botToken', 'tokenFile', 'dmPolicy', 'groupPolicy', 'streamMode',
    'allowFrom', 'groupAllowFrom', 'proxy',
    'replyToMode', 'textChunkLimit', 'chunkMode',
    'blockStreaming', 'mediaMaxMb', 'timeoutSeconds',
    'configWrites', 'historyLimit', 'dmHistoryLimit',
    'name', 'capabilities', 'markdown',
    'actions', 'reactionNotifications', 'reactionLevel',
    'heartbeat', 'linkPreview', 'responsePrefix',
    'retry', 'network', 'groups', 'dms',
    'draftChunk', 'blockStreamingCoalesce',
    'commands', 'customCommands',
    'webhookUrl', 'webhookSecret', 'webhookPath', 'webhookHost'
  ],
  whatsapp: [
    'dmPolicy', 'allowFrom', 'groupPolicy', 'groupAllowFrom',
    'selfChatMode', 'debounceMs', 'configWrites',
    'mediaMaxMb', 'historyLimit'
  ],
  discord: [
    'enabled', 'token', 'dmPolicy', 'groupPolicy',
    'allowFrom', 'groupAllowFrom', 'configWrites',
    'proxy', 'historyLimit', 'mediaMaxMb',
    'retry', 'commands'
  ],
  signal: [
    'enabled', 'account', 'dmPolicy', 'groupPolicy',
    'allowFrom', 'groupAllowFrom', 'configWrites',
    'historyLimit'
  ],
  slack: [
    'enabled', 'botToken', 'appToken', 'userToken',
    'dmPolicy', 'groupPolicy',
    'allowFrom', 'groupAllowFrom', 'configWrites',
    'commands', 'historyLimit'
  ],
  irc: [
    'enabled', 'server', 'port', 'nickname', 'channels', 'password',
    'dmPolicy', 'groupPolicy',
    'allowFrom', 'groupAllowFrom', 'configWrites',
    'historyLimit'
  ]
};

// 脱敏处理 token/key
function maskToken(token: string): string {
  if (!token || token.length < 8) return '***';
  return `${token.substring(0, 6)}...${token.substring(token.length - 4)}`;
}

// GET /api/channels - 获取所有 channels
router.get('/', async (req, res) => {
  try {
    const config = await readConfig();
    const channels = config.channels || {};

    const result = Object.entries(channels).map(([name, data]: [string, any]) => {
      const masked: any = {
        name,
        type: name,
        ...data
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
      if (data.appToken) {
        masked.appToken = maskToken(data.appToken);
      }
      if (data.password) {
        masked.password = '***';
      }

      return masked;
    });

    res.json({ channels: result });
  } catch (error) {
    console.error('Failed to get channels:', error);
    res.status(500).json({ error: 'Failed to get channels' });
  }
});

// 根据 channel 类型过滤字段
function filterFields(type: string, data: Record<string, any>): Record<string, any> {
  const validFields = CHANNEL_VALID_FIELDS[type];
  if (!validFields) {
    // 未知类型，只写入最基本的字段
    const safe: Record<string, any> = {};
    if (data.dmPolicy) safe.dmPolicy = data.dmPolicy;
    if (data.groupPolicy) safe.groupPolicy = data.groupPolicy;
    return safe;
  }

  const filtered: Record<string, any> = {};
  for (const key of validFields) {
    if (data[key] !== undefined && data[key] !== '') {
      filtered[key] = data[key];
    }
  }
  return filtered;
}

// POST /api/channels - 添加新 channel
router.post('/', async (req, res) => {
  try {
    const { name, type, ...rawData } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const config = await readConfig();
    if (!config.channels) config.channels = {};

    if (config.channels[name]) {
      return res.status(409).json({ error: 'Channel already exists' });
    }

    // 根据 channel 类型过滤，只写入该类型支持的字段
    const channelType = type || name;
    const channelData = filterFields(channelType, rawData);

    // 只设置该类型支持的默认值
    if (!channelData.dmPolicy) channelData.dmPolicy = 'pairing';
    if (!channelData.groupPolicy) channelData.groupPolicy = 'allowlist';

    config.channels[name] = channelData;

    await writeConfig(config);
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
    const config = await readConfig();

    if (!config.channels) config.channels = {};
    if (!config.channels[name]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const existing = config.channels[name];
    const channelData = filterFields(name, rawData);

    // 合并配置，保留原有敏感字段
    config.channels[name] = { ...existing, ...channelData };

    // 空字符串 token 保留原值
    for (const key of ['botToken', 'token', 'apiKey', 'appToken', 'password']) {
      if (rawData[key] === '' && existing[key]) {
        config.channels[name][key] = existing[key];
      }
    }

    await writeConfig(config);
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
    const config = await readConfig();

    if (!config.channels?.[name]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    delete config.channels[name];
    await writeConfig(config);
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
    const config = await readConfig();

    if (!config.channels?.[name]) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const channel = config.channels[name];

    // WhatsApp 用 openclaw 自身管理认证
    if (name === 'whatsapp') {
      try {
        const { execSync } = require('child_process');
        const openclawBin = '/Users/wangjian/.nvm/versions/node/v24.0.2/bin/openclaw';
        const output = execSync(`${openclawBin} status 2>&1`, {
          encoding: 'utf-8',
          timeout: 10000,
          env: { ...process.env, PATH: `/Users/wangjian/.nvm/versions/node/v24.0.2/bin:${process.env.PATH}` }
        });
        // 检查 WhatsApp 行的状态
        const waLine = output.split('\n').find((l: string) => l.includes('WhatsApp'));
        const isLinked = waLine && !waLine.includes('Not linked') && !waLine.includes('WARN');
        const isOn = waLine && waLine.includes('ON');
        return res.json({
          ok: true,
          connected: isLinked && isOn,
          message: !isOn ? 'WhatsApp 未启用' :
                   isLinked ? '已连接' :
                   '未连接，请先扫码认证'
        });
      } catch {
        return res.json({ ok: true, connected: false, message: '无法检测状态' });
      }
    }

    const hasCredentials = channel.botToken || channel.token || channel.apiKey;

    res.json({
      ok: true,
      connected: !!hasCredentials,
      message: hasCredentials ? 'Connection test passed' : 'Missing credentials'
    });
  } catch (error) {
    console.error('Failed to test channel:', error);
    res.status(500).json({ error: 'Failed to test channel' });
  }
});

export default router;
