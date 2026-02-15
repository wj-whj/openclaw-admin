import { useState, useEffect, useCallback } from 'react';
import { Button, Input, Switch, Row, Col, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined, ClockCircleOutlined, MessageOutlined, EyeOutlined, SearchOutlined, LeftOutlined } from '@ant-design/icons';
import { getProviders, createProvider, updateProvider, deleteProvider, setDefaultModel, getTasks, createCronJob, updateCronJob, deleteCronJob, getSessions, getSessionMessages, deleteSession, getChannels, createChannel, updateChannel, deleteChannel, testChannel } from '../services/api';

interface ProviderModel {
  id: string;
  name: string;
  contextWindow: number;
  maxTokens: number;
  reasoning: boolean;
}

interface Provider {
  name: string;
  api: string;
  baseUrl: string;
  apiKey: string;
  hasApiKey: boolean;
  models: ProviderModel[];
}

interface CronJob {
  id: string;
  type: 'cron';
  name: string;
  schedule: any;
  payload: any;
  enabled: boolean;
  sessionTarget: string;
  lastRun: string | null;
  lastStatus: string | null;
}

interface SessionInfo {
  key: string;
  sessionId: string;
  kind: string;
  chatType: string;
  channel: string;
  channels: string[];
  label: string;
  updatedAt: number;
  compactionCount: number;
  active: boolean;
  messageCount: number;
  tokenCount: number;
  fileSize: number;
  firstMessageAt: string | null;
  lastMessageAt: string | null;
}

interface ChatMessage {
  id: string;
  role: string;
  text: string;
  fullLength: number;
  timestamp: string;
  usage: any;
  model: string | null;
  channel: string;
}

export default function ManagePage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [defaultModel, setDefaultModelState] = useState<any>({});
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [viewingSession, setViewingSession] = useState<SessionInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatTotal, setChatTotal] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOffset, setChatOffset] = useState(0);
  const [msgChannelFilter, setMsgChannelFilter] = useState<string>('');
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', api: 'openai-completions', baseUrl: '', apiKey: '' });
  const [showAddCron, setShowAddCron] = useState(false);
  const [newCron, setNewCron] = useState({ name: '', expr: '', message: '', sessionTarget: 'isolated' });
  const [loading, setLoading] = useState(true);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [provRes, taskRes, sessRes] = await Promise.all([getProviders(), getTasks(), getSessions()]);
      setProviders(provRes.data.providers || []);
      setDefaultModelState(provRes.data.defaultModel || {});
      setCronJobs(taskRes.data.cronJobs || []);
      setSessions(sessRes.data.sessions || []);
    } catch (error) {
      console.error('Failed to load manage data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditProvider = (provider: Provider) => {
    setEditingProvider(provider.name);
    setEditForm({ 
      api: provider.api, 
      baseUrl: provider.baseUrl, 
      apiKey: '',
      models: JSON.parse(JSON.stringify(provider.models)) // 深拷贝模型列表
    });
  };

  const handleSaveProvider = async (name: string) => {
    try {
      await updateProvider(name, editForm);
      message.success('Provider 已更新');
      setEditingProvider(null);
      setEditingModelIndex(null);
      loadAll();
    } catch { message.error('更新失败'); }
  };

  const handleAddModel = () => {
    const newModel: ProviderModel = {
      id: '',
      name: '',
      contextWindow: 128000,
      maxTokens: 4096,
      reasoning: false
    };
    setEditForm({
      ...editForm,
      models: [...(editForm.models || []), newModel]
    });
    setEditingModelIndex((editForm.models || []).length);
  };

  const handleDeleteModel = (index: number) => {
    const models = [...(editForm.models || [])];
    models.splice(index, 1);
    setEditForm({ ...editForm, models });
    if (editingModelIndex === index) setEditingModelIndex(null);
  };

  const handleUpdateModel = (index: number, field: keyof ProviderModel, value: any) => {
    const models = [...(editForm.models || [])];
    models[index] = { ...models[index], [field]: value };
    setEditForm({ ...editForm, models });
  };

  const handleDeleteProvider = async (name: string) => {
    if (!confirm(`确定删除 ${name}？`)) return;
    try {
      await deleteProvider(name);
      message.success('已删除');
      loadAll();
    } catch { message.error('删除失败'); }
  };

  const handleAddProvider = async () => {
    if (!newProvider.name || !newProvider.baseUrl) {
      message.warning('名称和 Base URL 必填');
      return;
    }
    try {
      await createProvider(newProvider);
      message.success('Provider 已添加');
      setShowAddProvider(false);
      setNewProvider({ name: '', api: 'openai-completions', baseUrl: '', apiKey: '' });
      loadAll();
    } catch (e: any) {
      message.error(e.response?.data?.error || '添加失败');
    }
  };

  const handleSetDefault = async (modelId: string) => {
    try {
      await setDefaultModel({ primary: modelId });
      message.success(`默认模型已切换为 ${modelId}（自动生效）`);
      loadAll();
    } catch { message.error('更新失败'); }
  };

  const handleAddCron = async () => {
    if (!newCron.name || !newCron.expr || !newCron.message) {
      message.warning('请填写完整');
      return;
    }
    try {
      await createCronJob({
        name: newCron.name,
        schedule: { kind: 'cron', expr: newCron.expr },
        payload: { kind: 'agentTurn', message: newCron.message },
        sessionTarget: newCron.sessionTarget,
        enabled: true
      });
      message.success('定时任务已添加');
      setShowAddCron(false);
      setNewCron({ name: '', expr: '', message: '', sessionTarget: 'isolated' });
      loadAll();
    } catch { message.error('添加失败'); }
  };

  const handleToggleCron = async (job: CronJob) => {
    try {
      await updateCronJob(job.id, { enabled: !job.enabled });
      loadAll();
    } catch { message.error('更新失败'); }
  };

  const handleDeleteCron = async (id: string) => {
    if (!confirm('确定删除此任务？')) return;
    try {
      await deleteCronJob(id);
      message.success('已删除');
      loadAll();
    } catch { message.error('删除失败'); }
  };

  const handleViewSession = async (session: SessionInfo) => {
    setViewingSession(session);
    setChatLoading(true);
    setChatOffset(0);
    setMsgChannelFilter('');
    try {
      const res = await getSessionMessages(session.sessionId, { limit: 50, offset: 0 });
      setChatMessages(res.data.messages || []);
      setChatTotal(res.data.total || 0);
    } catch {
      message.error('加载消息失败');
    } finally {
      setChatLoading(false);
    }
  };

  const handleLoadMoreMessages = async () => {
    if (!viewingSession) return;
    const newOffset = chatOffset + 50;
    setChatLoading(true);
    try {
      const res = await getSessionMessages(viewingSession.sessionId, { limit: 50, offset: newOffset, filter: 'chat', ...(msgChannelFilter ? { channel: msgChannelFilter } : {}) } as any);
      setChatMessages(prev => [...prev, ...(res.data.messages || [])]);
      setChatOffset(newOffset);
    } catch {
      message.error('加载更多失败');
    } finally {
      setChatLoading(false);
    }
  };

  const handleMsgChannelFilter = async (channel: string) => {
    if (!viewingSession) return;
    setMsgChannelFilter(channel);
    setChatLoading(true);
    setChatOffset(0);
    try {
      const res = await getSessionMessages(viewingSession.sessionId, { limit: 50, offset: 0, ...(channel ? { channel } : {}) } as any);
      setChatMessages(res.data.messages || []);
      setChatTotal(res.data.total || 0);
    } catch {
      message.error('加载消息失败');
    } finally {
      setChatLoading(false);
    }
  };

  const handleDeleteSession = async (session: SessionInfo) => {
    if (session.key === 'agent:main:main') {
      message.warning('不能删除主会话');
      return;
    }
    if (!confirm(`确定删除会话 "${session.label || session.key}"？此操作不可恢复。`)) return;
    try {
      await deleteSession(session.key);
      message.success('会话已删除');
      if (viewingSession?.key === session.key) {
        setViewingSession(null);
        setChatMessages([]);
      }
      loadAll();
    } catch (e: any) {
      message.error(e.response?.data?.error || '删除失败');
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatTime = (ts: string | number | null) => {
    if (!ts) return '-';
    return new Date(ts).toLocaleString('zh-CN', { hour12: false });
  };

  const formatRelative = (ts: number) => {
    if (!ts) return '-';
    const diff = Date.now() - ts;
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return Math.floor(diff / 86400000) + ' 天前';
  };

  // 过滤会话
  const channels = [...new Set(sessions.flatMap(s => s.channels || [s.channel]))];
  const filteredSessions = sessions.filter(s => {
    if (channelFilter !== 'all') {
      const sessionChannels = s.channels || [s.channel];
      if (!sessionChannels.includes(channelFilter)) return false;
    }
    if (sessionSearch) {
      const q = sessionSearch.toLowerCase();
      return s.key.toLowerCase().includes(q) || s.label.toLowerCase().includes(q) || (s.channels || []).join(',').toLowerCase().includes(q);
    }
    return true;
  });

  if (loading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: 400, color: '#fff' }}>加载中...</div>;
  }

  // 构建所有可用模型列表
  const allModels = providers.flatMap(p => p.models.map(m => ({ provider: p.name, model: m.id, label: `${p.name}/${m.name || m.id}` })));

  return (
    <div className="content-container">
      {/* 会话管理 */}
      <div className="figma-panel" style={{ marginBottom: 16 }}>
        <div className="figma-panel-header">
          <div className="figma-panel-title"><MessageOutlined style={{ marginRight: 6 }} />会话管理</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="figma-badge figma-badge-blue">{sessions.length} 个</span>
            <span className="figma-badge figma-badge-green">{sessions.filter(s => s.active).length} 活跃</span>
          </div>
        </div>
        <div className="figma-panel-body">
          {/* 搜索和筛选 */}
          <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
            <Input size="small" prefix={<SearchOutlined style={{ color: '#666' }} />}
              placeholder="搜索会话..." value={sessionSearch}
              onChange={e => setSessionSearch(e.target.value)}
              style={{ flex: 1, background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
            <select value={channelFilter} onChange={e => setChannelFilter(e.target.value)}
              style={{ padding: '2px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
              <option value="all">全部渠道</option>
              {channels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
            </select>
          </div>

          <Row gutter={[12, 0]}>
            {/* 会话列表 */}
            <Col span={viewingSession ? 10 : 24}>
              <div style={{ maxHeight: 400, overflowY: 'auto' }}>
                {filteredSessions.length === 0 ? (
                  <div style={{ textAlign: 'center', color: '#999', padding: 30, fontSize: 12 }}>暂无会话</div>
                ) : filteredSessions.map((session) => (
                  <div key={session.key} className="figma-card" style={{
                    padding: 'var(--space-2) var(--space-3)', marginBottom: 6, cursor: 'pointer',
                    border: viewingSession?.key === session.key ? '1px solid var(--figma-blue)' : '1px solid var(--border-subtle)',
                    position: 'relative', overflow: 'hidden'
                  }} onClick={() => handleViewSession(session)}>
                    {session.active && (
                      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: 3, background: 'var(--figma-green)', animation: 'pulse 2s ease-in-out infinite' }} />
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingLeft: session.active ? 8 : 0 }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                          <span style={{ fontSize: 13, fontWeight: 600, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {session.label || session.key.replace('agent:main:', '')}
                          </span>
                          {session.key === 'agent:main:main' && (
                            <span className="figma-badge figma-badge-yellow" style={{ fontSize: 9 }}>主</span>
                          )}
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 4, flexWrap: 'wrap' }}>
                          {(session.channels || [session.channel]).map(ch => (
                            <span key={ch} className={`figma-badge figma-badge-${ch === 'telegram' ? 'blue' : ch === 'webchat' ? 'green' : ch === 'discord' ? 'yellow' : 'gray'}`}>{ch}</span>
                          ))}
                          <span className={`figma-badge figma-badge-${session.active ? 'green' : 'gray'}`}>
                            {session.active ? '活跃' : '空闲'}
                          </span>
                          {session.kind !== 'main' && <span className="figma-badge figma-badge-yellow">{session.kind}</span>}
                        </div>
                        <div style={{ fontSize: 11, color: '#999', display: 'flex', gap: 'var(--space-3)' }}>
                          <span>消息 {session.messageCount}</span>
                          <span>Token {session.tokenCount > 1000 ? (session.tokenCount / 1000).toFixed(1) + 'K' : session.tokenCount}</span>
                          <span>{formatFileSize(session.fileSize)}</span>
                          <span>{formatRelative(session.updatedAt)}</span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 4, marginLeft: 8 }}>
                        <button onClick={(e) => { e.stopPropagation(); handleViewSession(session); }}
                          style={{ background: 'none', border: 'none', color: 'var(--figma-blue)', cursor: 'pointer', padding: 4 }}>
                          <EyeOutlined style={{ fontSize: 14 }} />
                        </button>
                        {session.key !== 'agent:main:main' && (
                          <button onClick={(e) => { e.stopPropagation(); handleDeleteSession(session); }}
                            style={{ background: 'none', border: 'none', color: 'var(--figma-red)', cursor: 'pointer', padding: 4 }}>
                            <DeleteOutlined style={{ fontSize: 14 }} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Col>

            {/* 消息回放面板 */}
            {viewingSession && (
              <Col span={14}>
                <div style={{ background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)', height: 400, display: 'flex', flexDirection: 'column' }}>
                  {/* 头部 */}
                  <div style={{ padding: 'var(--space-2) var(--space-3)', borderBottom: '1px solid var(--border-subtle)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <button onClick={() => { setViewingSession(null); setChatMessages([]); }}
                        style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer', padding: 0 }}>
                        <LeftOutlined style={{ fontSize: 12 }} />
                      </button>
                      <span style={{ fontSize: 13, fontWeight: 600, color: '#fff' }}>
                        {viewingSession.label || viewingSession.key.replace('agent:main:', '')}
                      </span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      {(viewingSession.channels || []).length > 1 && (
                        <>
                          <button onClick={() => handleMsgChannelFilter('')}
                            style={{ background: !msgChannelFilter ? 'var(--figma-blue)' : 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}>
                            全部
                          </button>
                          {(viewingSession.channels || []).map(ch => (
                            <button key={ch} onClick={() => handleMsgChannelFilter(ch)}
                              style={{ background: msgChannelFilter === ch ? 'var(--figma-blue)' : 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer' }}>
                              {ch}
                            </button>
                          ))}
                        </>
                      )}
                      <span style={{ fontSize: 11, color: '#999' }}>{chatTotal} 条</span>
                    </div>
                  </div>
                  {/* 消息列表 */}
                  <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-2) var(--space-3)' }}>
                    {chatLoading && chatMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#999', padding: 40, fontSize: 12 }}>加载中...</div>
                    ) : chatMessages.length === 0 ? (
                      <div style={{ textAlign: 'center', color: '#999', padding: 40, fontSize: 12 }}>暂无消息</div>
                    ) : (
                      <>
                        {chatMessages.map((msg, i) => (
                          <div key={msg.id || i} style={{
                            marginBottom: 'var(--space-2)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: msg.role === 'user' ? 'flex-end' : 'flex-start'
                          }}>
                            <div style={{
                              maxWidth: '85%',
                              padding: '8px 12px',
                              borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                              background: msg.role === 'user' ? 'var(--figma-blue)' : 'var(--bg-primary)',
                              border: msg.role === 'user' ? 'none' : '1px solid var(--border-subtle)',
                              fontSize: 12, color: '#fff', lineHeight: 1.5,
                              whiteSpace: 'pre-wrap', wordBreak: 'break-word'
                            }}>
                              {msg.text || '(空消息)'}
                              {msg.fullLength > 2000 && (
                                <div style={{ fontSize: 10, color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#666', marginTop: 4 }}>
                                  ... 已截断 ({msg.fullLength} 字符)
                                </div>
                              )}
                            </div>
                            <div style={{ fontSize: 10, color: '#666', marginTop: 2, padding: '0 4px' }}>
                              {msg.role === 'user' ? '👤' : '🤖'} {formatTime(msg.timestamp)}
                              {msg.channel && msg.channel !== 'unknown' && (
                                <span style={{ marginLeft: 6, color: msg.channel === 'telegram' ? '#2AABEE' : msg.channel === 'webchat' ? '#4CAF50' : '#999' }}>
                                  via {msg.channel}
                                </span>
                              )}
                              {msg.usage?.totalTokens ? ` · ${msg.usage.totalTokens} tokens` : ''}
                            </div>
                          </div>
                        ))}
                        {chatMessages.length < chatTotal && (
                          <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
                            <button onClick={handleLoadMoreMessages} disabled={chatLoading}
                              style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--figma-blue)', padding: '4px 16px', cursor: 'pointer', fontSize: 11 }}>
                              {chatLoading ? '加载中...' : `加载更多 (${chatMessages.length}/${chatTotal})`}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </Col>
            )}
          </Row>
        </div>
      </div>

      {/* Providers 配置 */}
      <div className="figma-panel" style={{ marginBottom: 16 }}>
        <div className="figma-panel-header">
          <div className="figma-panel-title">Providers 配置</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="figma-badge figma-badge-blue">{providers.length} 个</span>
            <button onClick={() => setShowAddProvider(!showAddProvider)} style={{
              background: 'none', border: '1px solid var(--figma-blue)', borderRadius: 'var(--radius-sm)',
              color: 'var(--figma-blue)', fontSize: 11, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
            }}>
              <PlusOutlined style={{ fontSize: 10 }} /> 添加
            </button>
          </div>
        </div>
        <div className="figma-panel-body">
          {/* 添加新 Provider 表单 */}
          {showAddProvider && (
            <div style={{
              padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
              background: 'var(--bg-tertiary)', border: '1px solid var(--figma-blue)',
              borderRadius: 'var(--radius-sm)', animation: 'slideIn 0.2s ease'
            }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#fff', marginBottom: 12 }}>添加新 Provider</div>
              <Row gutter={[12, 8]}>
                <Col span={6}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>名称</div>
                  <Input size="small" placeholder="my-provider" value={newProvider.name}
                    onChange={e => setNewProvider({ ...newProvider, name: e.target.value })}
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                </Col>
                <Col span={6}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>API 类型</div>
                  <select value={newProvider.api} onChange={e => setNewProvider({ ...newProvider, api: e.target.value })}
                    style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                    <option value="openai-completions">OpenAI Completions</option>
                    <option value="openai-responses">OpenAI Responses</option>
                    <option value="anthropic-messages">Anthropic Messages</option>
                  </select>
                </Col>
                <Col span={6}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Base URL</div>
                  <Input size="small" placeholder="https://api.example.com/v1" value={newProvider.baseUrl}
                    onChange={e => setNewProvider({ ...newProvider, baseUrl: e.target.value })}
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                </Col>
                <Col span={6}>
                  <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>API Key</div>
                  <Input.Password size="small" placeholder="sk-..." value={newProvider.apiKey}
                    onChange={e => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                    style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                </Col>
              </Row>
              <div style={{ marginTop: 12, display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button onClick={() => setShowAddProvider(false)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#ccc', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>取消</button>
                <button onClick={handleAddProvider} style={{ background: 'var(--figma-blue)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>确认添加</button>
              </div>
            </div>
          )}

          {/* 默认模型 */}
          <div style={{ marginBottom: 'var(--space-3)', padding: 'var(--space-2)', background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)', display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: 12, color: '#ccc', minWidth: 70 }}>默认模型:</span>
            <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--figma-blue)' }}>{defaultModel.primary || '未设置'}</span>
            {defaultModel.fallbacks?.length > 0 && (
              <span style={{ fontSize: 11, color: '#999' }}>fallback: {defaultModel.fallbacks.join(', ')}</span>
            )}
          </div>

          {/* Provider 列表 */}
          <Row gutter={[12, 12]}>
            {providers.map((provider) => (
              <Col span={8} key={provider.name}>
                <div className="figma-card" style={{ padding: 'var(--space-3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                    <span style={{ fontSize: 14, fontWeight: 600, color: '#fff' }}>{provider.name}</span>
                    <div style={{ display: 'flex', gap: 4 }}>
                      <button onClick={() => handleEditProvider(provider)} style={{ background: 'none', border: 'none', color: 'var(--figma-blue)', cursor: 'pointer', padding: 2 }}>
                        <EditOutlined style={{ fontSize: 13 }} />
                      </button>
                      <button onClick={() => handleDeleteProvider(provider.name)} style={{ background: 'none', border: 'none', color: 'var(--figma-red)', cursor: 'pointer', padding: 2 }}>
                        <DeleteOutlined style={{ fontSize: 13 }} />
                      </button>
                    </div>
                  </div>

                  {editingProvider === provider.name ? (
                    <div style={{ fontSize: 12 }}>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>API 类型</div>
                        <select value={editForm.api} onChange={e => setEditForm({ ...editForm, api: e.target.value })}
                          style={{ width: '100%', padding: '3px 6px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 11 }}>
                          <option value="openai-completions">OpenAI Completions</option>
                          <option value="openai-responses">OpenAI Responses</option>
                          <option value="anthropic-messages">Anthropic Messages</option>
                        </select>
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>Base URL</div>
                        <Input size="small" value={editForm.baseUrl} onChange={e => setEditForm({ ...editForm, baseUrl: e.target.value })}
                          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>API Key (留空保持不变)</div>
                        <Input.Password size="small" value={editForm.apiKey} onChange={e => setEditForm({ ...editForm, apiKey: e.target.value })}
                          placeholder="留空保持原值"
                          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                      </div>

                      {/* 模型列表编辑 */}
                      <div style={{ marginBottom: 8, borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <span style={{ color: '#ccc', fontSize: 11 }}>模型配置</span>
                          <button onClick={handleAddModel} style={{
                            background: 'none', border: '1px solid var(--figma-blue)', borderRadius: 'var(--radius-sm)',
                            color: 'var(--figma-blue)', fontSize: 10, padding: '1px 6px', cursor: 'pointer'
                          }}>
                            <PlusOutlined style={{ fontSize: 9 }} /> 添加
                          </button>
                        </div>
                        {(editForm.models || []).map((model, idx) => (
                          <div key={idx} style={{
                            marginBottom: 6, padding: 6, background: 'var(--bg-primary)',
                            border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)'
                          }}>
                            {editingModelIndex === idx ? (
                              <div style={{ fontSize: 11 }}>
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ color: '#999', fontSize: 10, marginBottom: 2 }}>模型 ID *</div>
                                  <Input size="small" placeholder="gpt-4o" value={model.id}
                                    onChange={e => handleUpdateModel(idx, 'id', e.target.value)}
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 10 }} />
                                </div>
                                <div style={{ marginBottom: 4 }}>
                                  <div style={{ color: '#999', fontSize: 10, marginBottom: 2 }}>显示名称</div>
                                  <Input size="small" placeholder="GPT-4o" value={model.name}
                                    onChange={e => handleUpdateModel(idx, 'name', e.target.value)}
                                    style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 10 }} />
                                </div>
                                <Row gutter={4}>
                                  <Col span={12}>
                                    <div style={{ color: '#999', fontSize: 10, marginBottom: 2 }}>上下文窗口</div>
                                    <Input size="small" type="number" value={model.contextWindow}
                                      onChange={e => handleUpdateModel(idx, 'contextWindow', parseInt(e.target.value) || 0)}
                                      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 10 }} />
                                  </Col>
                                  <Col span={12}>
                                    <div style={{ color: '#999', fontSize: 10, marginBottom: 2 }}>最大输出</div>
                                    <Input size="small" type="number" value={model.maxTokens}
                                      onChange={e => handleUpdateModel(idx, 'maxTokens', parseInt(e.target.value) || 0)}
                                      style={{ background: 'var(--bg-secondary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 10 }} />
                                  </Col>
                                </Row>
                                <div style={{ marginTop: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                  <Switch size="small" checked={model.reasoning}
                                    onChange={checked => handleUpdateModel(idx, 'reasoning', checked)} />
                                  <span style={{ fontSize: 10, color: '#999' }}>支持推理</span>
                                </div>
                                <div style={{ marginTop: 6, display: 'flex', gap: 4 }}>
                                  <button onClick={() => setEditingModelIndex(null)}
                                    style={{ flex: 1, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#ccc', padding: '2px 0', cursor: 'pointer', fontSize: 10 }}>
                                    完成
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <div style={{ flex: 1 }}>
                                  <div style={{ fontSize: 11, color: '#fff', marginBottom: 2 }}>{model.name || model.id || '(未命名)'}</div>
                                  <div style={{ fontSize: 9, color: '#666' }}>
                                    {model.id} · {model.contextWindow}ctx · {model.maxTokens}out
                                    {model.reasoning && <span style={{ marginLeft: 4, color: 'var(--figma-blue)' }}>推理</span>}
                                  </div>
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                  <button onClick={() => setEditingModelIndex(idx)}
                                    style={{ background: 'none', border: 'none', color: 'var(--figma-blue)', cursor: 'pointer', padding: 2 }}>
                                    <EditOutlined style={{ fontSize: 11 }} />
                                  </button>
                                  <button onClick={() => handleDeleteModel(idx)}
                                    style={{ background: 'none', border: 'none', color: 'var(--figma-red)', cursor: 'pointer', padding: 2 }}>
                                    <DeleteOutlined style={{ fontSize: 11 }} />
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>

                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => { setEditingProvider(null); setEditingModelIndex(null); }} style={{ flex: 1, background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#ccc', padding: '3px 0', cursor: 'pointer', fontSize: 11 }}>取消</button>
                        <button onClick={() => handleSaveProvider(provider.name)} style={{ flex: 1, background: 'var(--figma-blue)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '3px 0', cursor: 'pointer', fontSize: 11 }}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <>
                      <div style={{ marginBottom: 8 }}>
                        <span className="figma-badge figma-badge-blue" style={{ marginRight: 4 }}>{provider.api}</span>
                        <span className={`figma-badge figma-badge-${provider.hasApiKey ? 'green' : 'red'}`}>
                          {provider.hasApiKey ? 'Key ✓' : 'No Key'}
                        </span>
                      </div>
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 8, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {provider.baseUrl}
                      </div>
                      <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: 8 }}>
                        <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>模型 ({provider.models.length})</div>
                        {provider.models.map((m, i) => (
                          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '3px 0' }}>
                            <span style={{ fontSize: 12, color: '#fff' }}>{m.name || m.id}</span>
                            <button
                              onClick={() => handleSetDefault(`${provider.name}/${m.id}`)}
                              style={{
                                background: defaultModel.primary === `${provider.name}/${m.id}` ? 'var(--figma-blue)' : 'none',
                                border: `1px solid ${defaultModel.primary === `${provider.name}/${m.id}` ? 'var(--figma-blue)' : 'var(--border-subtle)'}`,
                                borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 10, padding: '1px 6px', cursor: 'pointer'
                              }}
                            >
                              {defaultModel.primary === `${provider.name}/${m.id}` ? '默认 ✓' : '设为默认'}
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              </Col>
            ))}
          </Row>
        </div>
      </div>

      {/* 任务管理 */}
      <div className="figma-panel">
        <div className="figma-panel-header">
          <div className="figma-panel-title"><ClockCircleOutlined style={{ marginRight: 6 }} />定时任务</div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                <span className="figma-badge figma-badge-blue">{cronJobs.length} 个</span>
                <button onClick={() => setShowAddCron(!showAddCron)} style={{
                  background: 'none', border: '1px solid var(--figma-blue)', borderRadius: 'var(--radius-sm)',
                  color: 'var(--figma-blue)', fontSize: 11, padding: '2px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4
                }}>
                  <PlusOutlined style={{ fontSize: 10 }} /> 添加
                </button>
              </div>
            </div>
            <div className="figma-panel-body">
              {showAddCron && (
                <div style={{
                  padding: 'var(--space-3)', marginBottom: 'var(--space-3)',
                  background: 'var(--bg-tertiary)', border: '1px solid var(--figma-blue)',
                  borderRadius: 'var(--radius-sm)', animation: 'slideIn 0.2s ease'
                }}>
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 8 }}>新建定时任务</div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>任务名称</div>
                    <Input size="small" placeholder="每日邮件检查" value={newCron.name}
                      onChange={e => setNewCron({ ...newCron, name: e.target.value })}
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>Cron 表达式</div>
                    <Input size="small" placeholder="0 9 * * *（每天 9 点）" value={newCron.expr}
                      onChange={e => setNewCron({ ...newCron, expr: e.target.value })}
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>执行指令</div>
                    <Input.TextArea rows={2} placeholder="检查未读邮件并汇报" value={newCron.message}
                      onChange={e => setNewCron({ ...newCron, message: e.target.value })}
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 12 }} />
                  </div>
                  <div style={{ marginBottom: 8 }}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>运行环境</div>
                    <select value={newCron.sessionTarget} onChange={e => setNewCron({ ...newCron, sessionTarget: e.target.value })}
                      style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                      <option value="isolated">隔离会话 (推荐)</option>
                      <option value="main">主会话</option>
                    </select>
                  </div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                    <button onClick={() => setShowAddCron(false)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#ccc', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>取消</button>
                    <button onClick={handleAddCron} style={{ background: 'var(--figma-blue)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>创建</button>
                  </div>
                </div>
              )}

              {cronJobs.length === 0 && !showAddCron ? (
                <div style={{ textAlign: 'center', color: '#999', padding: 30, fontSize: 12 }}>
                  暂无定时任务，点击"添加"创建
                </div>
              ) : cronJobs.map((job) => (
                <div key={job.id} className="figma-card" style={{ padding: 'var(--space-3)', marginBottom: 8 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Switch size="small" checked={job.enabled} onChange={() => handleToggleCron(job)} />
                      <span style={{ fontSize: 13, fontWeight: 600, color: job.enabled ? '#fff' : '#666' }}>{job.name}</span>
                    </div>
                    <button onClick={() => handleDeleteCron(job.id)} style={{ background: 'none', border: 'none', color: 'var(--figma-red)', cursor: 'pointer', padding: 2 }}>
                      <DeleteOutlined style={{ fontSize: 12 }} />
                    </button>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 4 }}>
                    <span className="figma-badge figma-badge-blue">{job.schedule?.expr || job.schedule?.kind || '?'}</span>
                    <span className={`figma-badge figma-badge-${job.sessionTarget === 'main' ? 'yellow' : 'green'}`}>
                      {job.sessionTarget === 'main' ? '主会话' : '隔离'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#999', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {job.payload?.message || job.payload?.text || '(无指令)'}
                  </div>
                  {job.lastRun && (
                    <div style={{ fontSize: 10, color: '#666', marginTop: 4 }}>
                      上次运行: {new Date(job.lastRun).toLocaleString('zh-CN')} · {job.lastStatus || '?'}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
    </div>
  );
}
