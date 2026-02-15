import { useState, useEffect } from 'react';
import { Input, Switch, Row, Col, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, ApiOutlined, CheckCircleOutlined, CloseCircleOutlined } from '@ant-design/icons';
import { getChannels, createChannel, updateChannel, deleteChannel, testChannel } from '../services/api';

interface Channel {
  name: string;
  type: string;
  enabled: boolean;
  dmPolicy: string;
  groupPolicy: string;
  streamMode: string;
  botToken?: string;
  hasBotToken?: boolean;
  token?: string;
  hasToken?: boolean;
  apiKey?: string;
  hasApiKey?: boolean;
  webhook?: string;
  guildId?: string;
  server?: string;
  port?: number;
  nickname?: string;
  channels?: string[];
  phone?: string;
  workspace?: string;
}

const CHANNEL_TYPES = [
  { value: 'telegram', label: 'Telegram', icon: '📱', color: '#2AABEE' },
  { value: 'whatsapp', label: 'WhatsApp', icon: '💬', color: '#25D366' },
  { value: 'discord', label: 'Discord', icon: '🎮', color: '#5865F2' },
  { value: 'signal', label: 'Signal', icon: '🔒', color: '#3A76F0' },
  { value: 'slack', label: 'Slack', icon: '💼', color: '#4A154B' },
  { value: 'irc', label: 'IRC', icon: '💻', color: '#999' }
];

export default function ChannelsPage() {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [newChannel, setNewChannel] = useState({
    name: '',
    type: 'telegram',
    enabled: true,
    dmPolicy: 'pairing',
    groupPolicy: 'allowlist',
    streamMode: 'partial',
    botToken: ''
  });
  const [testingChannel, setTestingChannel] = useState<string | null>(null);

  useEffect(() => {
    loadChannels();
  }, []);

  const loadChannels = async () => {
    try {
      const res = await getChannels();
      setChannels(res.data.channels || []);
    } catch (error) {
      console.error('Failed to load channels:', error);
      message.error('加载失败');
    } finally {
      setLoading(false);
    }
  };

  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel.name);
    setEditForm({
      enabled: channel.enabled,
      dmPolicy: channel.dmPolicy,
      groupPolicy: channel.groupPolicy,
      streamMode: channel.streamMode,
      botToken: '',
      token: '',
      apiKey: '',
      webhook: channel.webhook || '',
      guildId: channel.guildId || '',
      server: channel.server || '',
      port: channel.port || 6667,
      nickname: channel.nickname || '',
      channels: channel.channels?.join(', ') || '',
      phone: channel.phone || '',
      workspace: channel.workspace || ''
    });
  };

  const handleSaveChannel = async (name: string) => {
    try {
      const data = { ...editForm };
      // 转换 channels 字符串为数组
      if (data.channels && typeof data.channels === 'string') {
        data.channels = data.channels.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      await updateChannel(name, data);
      message.success('Channel 已更新');
      setEditingChannel(null);
      loadChannels();
    } catch {
      message.error('更新失败');
    }
  };

  const handleDeleteChannel = async (name: string) => {
    if (!confirm(`确定删除 ${name}？`)) return;
    try {
      await deleteChannel(name);
      message.success('已删除');
      loadChannels();
    } catch {
      message.error('删除失败');
    }
  };

  const handleAddChannel = async () => {
    if (!newChannel.name) {
      message.warning('名称必填');
      return;
    }
    try {
      await createChannel(newChannel);
      message.success('Channel 已添加');
      setShowAddChannel(false);
      setNewChannel({
        name: '',
        type: 'telegram',
        enabled: true,
        dmPolicy: 'pairing',
        groupPolicy: 'allowlist',
        streamMode: 'partial',
        botToken: ''
      });
      loadChannels();
    } catch (e: any) {
      message.error(e.response?.data?.error || '添加失败');
    }
  };

  const handleTestConnection = async (name: string) => {
    setTestingChannel(name);
    try {
      const res = await testChannel(name);
      if (res.data.connected) {
        message.success('连接测试成功');
      } else {
        message.warning(res.data.message || '连接失败');
      }
    } catch {
      message.error('测试失败');
    } finally {
      setTestingChannel(null);
    }
  };

  const getChannelTypeInfo = (type: string) => {
    return CHANNEL_TYPES.find(t => t.value === type) || { value: type, label: type, icon: '📡', color: '#999' };
  };

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: '#fff' }}>加载中...</div>;
  }

  return (
    <div className="content-container">
      <div className="figma-panel">
        <div className="figma-panel-header">
          <div className="figma-panel-title">
            <ApiOutlined style={{ marginRight: 6 }} />
            Channel 配置
          </div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="figma-badge figma-badge-blue">{channels.length} 个</span>
            <span className="figma-badge figma-badge-green">{channels.filter(c => c.enabled).length} 启用</span>
            <button onClick={() => setShowAddChannel(!showAddChannel)} style={{
              background: 'none', border: '1px solid var(--figma-blue)', borderRadius: 'var(--radius-sm)',
              color: 'var(--figma-blue)', fontSize: 11, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }}>
              <PlusOutlined style={{ fontSize: 10 }} /> 添加
            </button>
          </div>
        </div>

        <div className="figma-panel-body">
          {/* 添加新 Channel 表单 */}
          {showAddChannel && (
            <div style={{
              padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
              background: 'var(--bg-tertiary)', border: '1px solid var(--figma-blue)',
              borderRadius: 'var(--radius-sm)', animation: 'slideIn 0.2s ease'
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>添加新 Channel</div>
              <Row gutter={[12, 8]}>
                <Col span={6}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>名称 *</div>
                  <Input size="small" placeholder="telegram" value={newChannel.name}
                    onChange={e => setNewChannel({ ...newChannel, name: e.target.value })}
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                </Col>
                <Col span={6}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>类型</div>
                  <select value={newChannel.type} onChange={e => setNewChannel({ ...newChannel, type: e.target.value })}
                    style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                    {CHANNEL_TYPES.map(t => (
                      <option key={t.value} value={t.value}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </Col>
                <Col span={12}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Bot Token / API Key</div>
                  <Input.Password size="small" placeholder="输入 token..." value={newChannel.botToken}
                    onChange={e => setNewChannel({ ...newChannel, botToken: e.target.value })}
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                </Col>
              </Row>
              <Row gutter={[12, 8]} style={{ marginTop: 8 }}>
                <Col span={8}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>DM 策略</div>
                  <select value={newChannel.dmPolicy} onChange={e => setNewChannel({ ...newChannel, dmPolicy: e.target.value })}
                    style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                    <option value="pairing">Pairing</option>
                    <option value="allowlist">Allowlist</option>
                    <option value="open">Open</option>
                  </select>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>群组策略</div>
                  <select value={newChannel.groupPolicy} onChange={e => setNewChannel({ ...newChannel, groupPolicy: e.target.value })}
                    style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                    <option value="allowlist">Allowlist</option>
                    <option value="open">Open</option>
                    <option value="deny">Deny</option>
                  </select>
                </Col>
                <Col span={8}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>流式模式</div>
                  <select value={newChannel.streamMode} onChange={e => setNewChannel({ ...newChannel, streamMode: e.target.value })}
                    style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                    <option value="partial">Partial</option>
                    <option value="full">Full</option>
                    <option value="none">None</option>
                  </select>
                </Col>
              </Row>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddChannel(false)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#ccc', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>取消</button>
                <button onClick={handleAddChannel} style={{ background: 'var(--figma-blue)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>确认添加</button>
              </div>
            </div>
          )}

          {/* Channel 列表 */}
          {channels.length === 0 && !showAddChannel ? (
            <div style={{ textAlign: 'center', color: '#999', padding: 40, fontSize: 12 }}>
              暂无 Channel 配置，点击"添加"创建
            </div>
          ) : (
            <Row gutter={[12, 12]}>
              {channels.map((channel) => {
                const typeInfo = getChannelTypeInfo(channel.type);
                return (
                  <Col span={8} key={channel.name}>
                    <div className="figma-card" style={{ padding: 'var(--space-3)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontSize: 20 }}>{typeInfo.icon}</span>
                          <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{channel.name}</span>
                        </div>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button onClick={() => handleEditChannel(channel)} style={{ background: 'none', border: 'none', color: 'var(--figma-blue)', cursor: 'pointer', padding: 2 }}>
                            <EditOutlined style={{ fontSize: 13 }} />
                          </button>
                          <button onClick={() => handleDeleteChannel(channel.name)} style={{ background: 'none', border: 'none', color: 'var(--figma-red)', cursor: 'pointer', padding: 2 }}>
                            <DeleteOutlined style={{ fontSize: 13 }} />
                          </button>
                        </div>
                      </div>

                      {editingChannel === channel.name ? (
                        <div style={{ fontSize: 12 }}>
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                              <Switch size="small" checked={editForm.enabled}
                                onChange={checked => setEditForm({ ...editForm, enabled: checked })} />
                              <span style={{ fontSize: 11, color: '#ccc' }}>启用</span>
                            </div>
                          </div>

                          {/* Token/Key 输入 */}
                          <div style={{ marginBottom: 6 }}>
                            <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>
                              {channel.type === 'telegram' || channel.type === 'discord' ? 'Bot Token' : 'API Key'} (留空保持不变)
                            </div>
                            <Input.Password size="small"
                              value={editForm.botToken || editForm.token || editForm.apiKey || ''}
                              onChange={e => {
                                const val = e.target.value;
                                if (channel.type === 'telegram' || channel.type === 'discord') {
                                  setEditForm({ ...editForm, botToken: val });
                                } else {
                                  setEditForm({ ...editForm, token: val, apiKey: val });
                                }
                              }}
                              placeholder="留空保持原值"
                              style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                          </div>

                          {/* 策略配置 */}
                          <Row gutter={4} style={{ marginBottom: 6 }}>
                            <Col span={12}>
                              <div style={{ color: '#ccc', marginBottom: 2, fontSize: 10 }}>DM 策略</div>
                              <select value={editForm.dmPolicy} onChange={e => setEditForm({ ...editForm, dmPolicy: e.target.value })}
                                style={{ width: '100%', padding: '2px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 11 }}>
                                <option value="pairing">Pairing</option>
                                <option value="allowlist">Allowlist</option>
                                <option value="open">Open</option>
                              </select>
                            </Col>
                            <Col span={12}>
                              <div style={{ color: '#ccc', marginBottom: 2, fontSize: 10 }}>群组策略</div>
                              <select value={editForm.groupPolicy} onChange={e => setEditForm({ ...editForm, groupPolicy: e.target.value })}
                                style={{ width: '100%', padding: '2px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 11 }}>
                                <option value="allowlist">Allowlist</option>
                                <option value="open">Open</option>
                                <option value="deny">Deny</option>
                              </select>
                            </Col>
                          </Row>

                          {/* 流式模式 */}
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>流式模式</div>
                            <select value={editForm.streamMode} onChange={e => setEditForm({ ...editForm, streamMode: e.target.value })}
                              style={{ width: '100%', padding: '3px 6px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 11 }}>
                              <option value="partial">Partial</option>
                              <option value="full">Full</option>
                              <option value="none">None</option>
                            </select>
                          </div>

                          <div style={{ display: 'flex', gap: 6 }}>
                            <button onClick={() => setEditingChannel(null)} style={{ flex: 1, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#ccc', padding: '3px 0', cursor: 'pointer', fontSize: 11 }}>取消</button>
                            <button onClick={() => handleSaveChannel(channel.name)} style={{ flex: 1, background: 'var(--figma-blue)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '3px 0', cursor: 'pointer', fontSize: 11 }}>保存</button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div style={{ marginBottom: 8 }}>
                            <span className="figma-badge figma-badge-blue" style={{ marginRight: 4 }}>{typeInfo.label}</span>
                            <span className={`figma-badge figma-badge-${channel.enabled ? 'green' : 'gray'}`}>
                              {channel.enabled ? '启用' : '禁用'}
                            </span>
                            {(channel.hasBotToken || channel.hasToken || channel.hasApiKey) && (
                              <span className="figma-badge figma-badge-green" style={{ marginLeft: 4 }}>
                                <CheckCircleOutlined style={{ fontSize: 10, marginRight: 2 }} />
                                已配置
                              </span>
                            )}
                          </div>

                          <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
                            <div>DM: {channel.dmPolicy} · 群组: {channel.groupPolicy}</div>
                            <div>流式: {channel.streamMode}</div>
                            {channel.webhook && <div>Webhook: {channel.webhook}</div>}
                            {channel.guildId && <div>Guild: {channel.guildId}</div>}
                          </div>

                          <button
                            onClick={() => handleTestConnection(channel.name)}
                            disabled={testingChannel === channel.name}
                            style={{
                              width: '100%',
                              background: 'none',
                              border: '1px solid var(--border-subtle)',
                              borderRadius: 'var(--radius-sm)',
                              color: 'var(--figma-blue)',
                              padding: '4px 0',
                              cursor: 'pointer',
                              fontSize: 11
                            }}
                          >
                            {testingChannel === channel.name ? '测试中...' : '测试连接'}
                          </button>
                        </>
                      )}
                    </div>
                  </Col>
                );
              })}
            </Row>
          )}
        </div>
      </div>
    </div>
  );
}
