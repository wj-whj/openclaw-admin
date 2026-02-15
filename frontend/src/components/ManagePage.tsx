import { useState, useEffect, useCallback, useRef } from 'react';
import { Button, Input, Switch, Row, Col, message } from 'antd';
import { PlusOutlined, DeleteOutlined, EditOutlined, SaveOutlined, ClockCircleOutlined, MessageOutlined, EyeOutlined, SearchOutlined, LeftOutlined, ApiOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { getProviders, createProvider, updateProvider, deleteProvider, setDefaultModel, getTasks, createCronJob, updateCronJob, deleteCronJob, getSessions, getSessionMessages, deleteSession, getChannels, createChannel, updateChannel, deleteChannel, testChannel, startWhatsAppAuth, getWhatsAppAuthStatus, cancelWhatsAppAuth } from '../services/api';

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

export default function ManagePage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [defaultModel, setDefaultModelState] = useState<any>({});
  const [cronJobs, setCronJobs] = useState<CronJob[]>([]);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [sessionSearch, setSessionSearch] = useState('');
  const [channelFilter, setChannelFilter] = useState<string>('all');
  const [viewingSession, setViewingSession] = useState<SessionInfo | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const [chatTotal, setChatTotal] = useState(0);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatOffset, setChatOffset] = useState(0);
  const [msgChannelFilter, setMsgChannelFilter] = useState<string>('');
  const [editingProvider, setEditingProvider] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [showAddProvider, setShowAddProvider] = useState(false);
  const [newProvider, setNewProvider] = useState({ name: '', api: 'openai-completions', baseUrl: '', apiKey: '' });
  const [showAddCron, setShowAddCron] = useState(false);
  const [newCron, setNewCron] = useState({ name: '', scheduleType: 'every', intervalMinutes: '30', dailyTime: '09:00', weekDay: '1', weekTime: '09:00', message: '', sessionTarget: 'isolated', deliveryChannel: 'auto' });
  const [editingCronId, setEditingCronId] = useState<string | null>(null);
  const [editCron, setEditCron] = useState({ name: '', scheduleType: 'every', intervalMinutes: '30', dailyTime: '09:00', weekDay: '1', weekTime: '09:00', message: '', sessionTarget: 'isolated', deliveryChannel: 'auto' });
  const [loading, setLoading] = useState(true);
  const [editingModelIndex, setEditingModelIndex] = useState<number | null>(null);
  
  // Channel 状态
  const [channels, setChannels] = useState<Channel[]>([]);
  const [editingChannel, setEditingChannel] = useState<string | null>(null);
  const [channelEditForm, setChannelEditForm] = useState<any>({});
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
  
  // WhatsApp QR 状态
  const [showWhatsAppQR, setShowWhatsAppQR] = useState(false);
  const [whatsappQRCode, setWhatsappQRCode] = useState<string | null>(null);
  const [whatsappAuthStatus, setWhatsappAuthStatus] = useState<string>('idle');

  useEffect(() => {
    loadAll();
  }, []);

  const loadAll = async () => {
    try {
      const [provRes, taskRes, sessRes, chanRes] = await Promise.all([
        getProviders(), 
        getTasks(), 
        getSessions(),
        getChannels()
      ]);
      setProviders(provRes.data.providers || []);
      setDefaultModelState(provRes.data.defaultModel || {});
      setCronJobs(taskRes.data.cronJobs || []);
      setSessions(sessRes.data.sessions || []);
      setChannels(chanRes.data.channels || []);
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
    if (!newCron.name || !newCron.message) {
      message.warning('任务名称和任务描述必填');
      return;
    }
    // 构建后端需要的 scheduleValue
    let scheduleValue: any = {};
    if (newCron.scheduleType === 'every') {
      scheduleValue = { minutes: parseInt(newCron.intervalMinutes) };
    } else if (newCron.scheduleType === 'daily') {
      scheduleValue = { time: newCron.dailyTime };
    } else if (newCron.scheduleType === 'weekly') {
      scheduleValue = { time: newCron.weekTime, day: newCron.weekDay };
    }
    try {
      await createCronJob({
        name: newCron.name,
        scheduleType: newCron.scheduleType,
        scheduleValue,
        message: newCron.message,
        sessionTarget: newCron.sessionTarget,
        deliveryChannel: newCron.deliveryChannel
      });
      message.success('定时任务已添加');
      setShowAddCron(false);
      setNewCron({ name: '', scheduleType: 'every', intervalMinutes: '30', dailyTime: '09:00', weekDay: '1', weekTime: '09:00', message: '', sessionTarget: 'isolated', deliveryChannel: 'auto' });
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

  const handleStartEditCron = (job: CronJob) => {
    const s = job.schedule;
    let scheduleType = 'every', intervalMinutes = '30', dailyTime = '09:00', weekDay = '1', weekTime = '09:00';
    if (s?.kind === 'every' && s.everyMs) {
      scheduleType = 'every';
      intervalMinutes = String(s.everyMs / 60000);
    } else if (s?.kind === 'cron' && s.expr) {
      const parts = s.expr.split(' ');
      if (parts.length >= 5) {
        const time = `${parts[1].padStart(2, '0')}:${parts[0].padStart(2, '0')}`;
        if (parts[4] !== '*') {
          scheduleType = 'weekly';
          weekDay = parts[4];
          weekTime = time;
        } else {
          scheduleType = 'daily';
          dailyTime = time;
        }
      }
    }
    setEditCron({
      name: job.name || '',
      scheduleType, intervalMinutes, dailyTime, weekDay, weekTime,
      message: job.payload?.message || job.payload?.text || '',
      sessionTarget: job.sessionTarget || 'isolated',
      deliveryChannel: (job as any).delivery?.channel || 'auto'
    });
    setEditingCronId(job.id);
  };

  const handleSaveEditCron = async () => {
    if (!editingCronId || !editCron.name || !editCron.message) {
      message.warning('任务名称和描述必填');
      return;
    }
    // 先删除旧任务，再创建新任务（openclaw cron edit 功能有限）
    try {
      await deleteCronJob(editingCronId);
      let scheduleValue: any = {};
      if (editCron.scheduleType === 'every') {
        scheduleValue = { minutes: parseInt(editCron.intervalMinutes) };
      } else if (editCron.scheduleType === 'daily') {
        scheduleValue = { time: editCron.dailyTime };
      } else if (editCron.scheduleType === 'weekly') {
        scheduleValue = { time: editCron.weekTime, day: editCron.weekDay };
      }
      await createCronJob({
        name: editCron.name,
        scheduleType: editCron.scheduleType,
        scheduleValue,
        message: editCron.message,
        sessionTarget: editCron.sessionTarget,
        deliveryChannel: editCron.deliveryChannel
      });
      message.success('任务已更新');
      setEditingCronId(null);
      loadAll();
    } catch { message.error('更新失败'); }
  };

  // Channel 处理函数
  const handleEditChannel = (channel: Channel) => {
    setEditingChannel(channel.name);
    setChannelEditForm({
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
      const data = { ...channelEditForm };
      if (data.channels && typeof data.channels === 'string') {
        data.channels = data.channels.split(',').map((s: string) => s.trim()).filter(Boolean);
      }
      await updateChannel(name, data);
      message.success('Channel 已更新');
      setEditingChannel(null);
      loadAll();
    } catch { message.error('更新失败'); }
  };

  const handleDeleteChannel = async (name: string) => {
    if (!confirm(`确定删除 ${name}？`)) return;
    try {
      await deleteChannel(name);
      message.success('已删除');
      loadAll();
    } catch { message.error('删除失败'); }
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
      loadAll();
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
    } catch { message.error('测试失败'); }
    finally { setTestingChannel(null); }
  };

  const getChannelTypeInfo = (type: string) => {
    return CHANNEL_TYPES.find(t => t.value === type) || { value: type, label: type, icon: '📡', color: '#999' };
  };

  // WhatsApp 认证处理
  const handleStartWhatsAppAuth = async () => {
    try {
      setShowWhatsAppQR(true);
      setWhatsappAuthStatus('waiting');
      setWhatsappQRCode(null);
      
      const res = await startWhatsAppAuth();
      setWhatsappQRCode(res.data.qrCode);
      setWhatsappAuthStatus(res.data.status);
      
      if (res.data.fallback) {
        message.info('已打开终端窗口，请在终端中扫描二维码');
      }
      
      // 开始轮询状态
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await getWhatsAppAuthStatus();
          if (statusRes.data.qrCode && !whatsappQRCode) {
            setWhatsappQRCode(statusRes.data.qrCode);
          }
          setWhatsappAuthStatus(statusRes.data.status);
          
          if (statusRes.data.authenticated || statusRes.data.status === 'success') {
            clearInterval(pollInterval);
            message.success('WhatsApp 认证成功！');
            setShowWhatsAppQR(false);
          } else if (statusRes.data.status === 'timeout' || statusRes.data.status === 'failed') {
            clearInterval(pollInterval);
            message.error(statusRes.data.message);
          }
        } catch (error) {
          clearInterval(pollInterval);
        }
      }, 2000);
      
      // 60秒后停止轮询
      setTimeout(() => clearInterval(pollInterval), 60000);
      
    } catch (error) {
      message.error('启动认证失败');
      setShowWhatsAppQR(false);
    }
  };

  const handleCancelWhatsAppAuth = async () => {
    try {
      await cancelWhatsAppAuth();
      setShowWhatsAppQR(false);
      setWhatsappQRCode(null);
      setWhatsappAuthStatus('idle');
    } catch (error) {
      message.error('取消失败');
    }
  };

  const handleViewSession = async (session: SessionInfo) => {
    setViewingSession(session);
    setChatLoading(true);
    setChatOffset(0);
    setMsgChannelFilter('');
    try {
      const res = await getSessionMessages(session.sessionId, { limit: 50, offset: 0 });
      // 后端返回的是从新到旧，前端反转让最新消息在底部
      setChatMessages((res.data.messages || []).reverse());
      setChatTotal(res.data.total || 0);
      setTimeout(() => chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
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
      // 后端返回从新到旧，反转后插入到列表开头（更早的消息）
      const olderMessages = (res.data.messages || []).reverse();
      setChatMessages(prev => [...olderMessages, ...prev]);
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
      setChatMessages((res.data.messages || []).reverse());
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
  const sessionChannels = [...new Set(sessions.flatMap(s => s.channels || [s.channel]))];
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
      <div className="figma-panel" style={{ marginBottom: 24 }}>
        <div className="figma-panel-header" style={{ 
          background: 'linear-gradient(135deg, rgba(240, 160, 32, 0.12) 0%, rgba(240, 160, 32, 0.04) 100%)',
          borderBottom: '1px solid rgba(240, 160, 32, 0.2)'
        }}>
          <div className="figma-panel-title">
            <MessageOutlined style={{ marginRight: 8, color: '#f0a020' }} />
            会话管理
          </div>
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
              {sessionChannels.map(ch => <option key={ch} value={ch}>{ch}</option>)}
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
                        {/* 加载更多按钮在顶部 */}
                        {chatMessages.length < chatTotal && (
                          <div style={{ textAlign: 'center', padding: 'var(--space-2)' }}>
                            <button onClick={handleLoadMoreMessages} disabled={chatLoading}
                              style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: 'var(--figma-blue)', padding: '4px 16px', cursor: 'pointer', fontSize: 11 }}>
                              {chatLoading ? '加载中...' : `加载更早消息 (${chatMessages.length}/${chatTotal})`}
                            </button>
                          </div>
                        )}
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
                        <div ref={chatEndRef} />
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
      <div className="figma-panel" style={{ marginBottom: 24 }}>
        <div className="figma-panel-header" style={{ 
          background: 'linear-gradient(135deg, rgba(167, 139, 250, 0.12) 0%, rgba(167, 139, 250, 0.04) 100%)',
          borderBottom: '1px solid rgba(167, 139, 250, 0.2)'
        }}>
          <div className="figma-panel-title">
            <ApiOutlined style={{ marginRight: 8, color: '#a78bfa' }} />
            Providers 配置
          </div>
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
                      <div style={{ fontSize: 11, color: '#999', marginBottom: 8 }}>
                        {provider.models.length} 个模型 · {provider.hasApiKey ? 'Key 已配置' : '未配置 Key'}
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
      <div className="figma-panel" style={{ marginBottom: 24 }}>
        <div className="figma-panel-header" style={{ 
          background: 'linear-gradient(135deg, rgba(78, 143, 240, 0.12) 0%, rgba(78, 143, 240, 0.04) 100%)',
          borderBottom: '1px solid rgba(78, 143, 240, 0.2)'
        }}>
          <div className="figma-panel-title">
            <ClockCircleOutlined style={{ marginRight: 8, color: '#4e8ff0' }} />
            定时任务
          </div>
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
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>执行频率</div>
                    <select value={newCron.scheduleType} onChange={e => setNewCron({ ...newCron, scheduleType: e.target.value })}
                      style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12, marginBottom: 6 }}>
                      <option value="every">每隔一段时间</option>
                      <option value="daily">每天定时</option>
                      <option value="weekly">每周定时</option>
                    </select>
                    {newCron.scheduleType === 'every' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#ccc' }}>每隔</span>
                        <select value={newCron.intervalMinutes} onChange={e => setNewCron({ ...newCron, intervalMinutes: e.target.value })}
                          style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                          <option value="5">5 分钟</option>
                          <option value="10">10 分钟</option>
                          <option value="15">15 分钟</option>
                          <option value="30">30 分钟</option>
                          <option value="60">1 小时</option>
                          <option value="120">2 小时</option>
                          <option value="360">6 小时</option>
                          <option value="720">12 小时</option>
                          <option value="1440">24 小时</option>
                        </select>
                        <span style={{ fontSize: 11, color: '#ccc' }}>执行一次</span>
                      </div>
                    )}
                    {newCron.scheduleType === 'daily' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span style={{ fontSize: 11, color: '#ccc' }}>每天</span>
                        <input type="time" value={newCron.dailyTime} onChange={e => setNewCron({ ...newCron, dailyTime: e.target.value })}
                          style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }} />
                        <span style={{ fontSize: 11, color: '#ccc' }}>执行</span>
                      </div>
                    )}
                    {newCron.scheduleType === 'weekly' && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 11, color: '#ccc' }}>每周</span>
                        <select value={newCron.weekDay} onChange={e => setNewCron({ ...newCron, weekDay: e.target.value })}
                          style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                          <option value="1">一</option>
                          <option value="2">二</option>
                          <option value="3">三</option>
                          <option value="4">四</option>
                          <option value="5">五</option>
                          <option value="6">六</option>
                          <option value="0">日</option>
                        </select>
                        <input type="time" value={newCron.weekTime} onChange={e => setNewCron({ ...newCron, weekTime: e.target.value })}
                          style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }} />
                        <span style={{ fontSize: 11, color: '#ccc' }}>执行</span>
                      </div>
                    )}
                  </div>
                  <div style={{ marginBottom: 6 }}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>任务描述（告诉 AI 做什么）</div>
                    <Input.TextArea rows={2} placeholder="检查未读邮件，如果有重要邮件就通知我" value={newCron.message}
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
                  {newCron.sessionTarget === 'isolated' && (
                    <div style={{ marginBottom: 8 }}>
                      <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>结果发送到</div>
                      <select value={newCron.deliveryChannel} onChange={e => setNewCron({ ...newCron, deliveryChannel: e.target.value })}
                        style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                        <option value="auto">自动（最近使用的渠道）</option>
                        <option value="telegram">Telegram</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="discord">Discord</option>
                        <option value="webchat">Web Chat</option>
                      </select>
                    </div>
                  )}
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
                  {editingCronId === job.id ? (
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#fff', marginBottom: 8 }}>编辑任务</div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>任务名称</div>
                        <Input size="small" value={editCron.name} onChange={e => setEditCron({ ...editCron, name: e.target.value })}
                          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>执行频率</div>
                        <select value={editCron.scheduleType} onChange={e => setEditCron({ ...editCron, scheduleType: e.target.value })}
                          style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12, marginBottom: 6 }}>
                          <option value="every">每隔一段时间</option>
                          <option value="daily">每天定时</option>
                          <option value="weekly">每周定时</option>
                        </select>
                        {editCron.scheduleType === 'every' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#ccc' }}>每隔</span>
                            <select value={editCron.intervalMinutes} onChange={e => setEditCron({ ...editCron, intervalMinutes: e.target.value })}
                              style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                              <option value="5">5 分钟</option><option value="10">10 分钟</option><option value="15">15 分钟</option>
                              <option value="30">30 分钟</option><option value="60">1 小时</option><option value="120">2 小时</option>
                              <option value="360">6 小时</option><option value="720">12 小时</option><option value="1440">24 小时</option>
                            </select>
                            <span style={{ fontSize: 11, color: '#ccc' }}>执行一次</span>
                          </div>
                        )}
                        {editCron.scheduleType === 'daily' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ fontSize: 11, color: '#ccc' }}>每天</span>
                            <input type="time" value={editCron.dailyTime} onChange={e => setEditCron({ ...editCron, dailyTime: e.target.value })}
                              style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }} />
                            <span style={{ fontSize: 11, color: '#ccc' }}>执行</span>
                          </div>
                        )}
                        {editCron.scheduleType === 'weekly' && (
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontSize: 11, color: '#ccc' }}>每周</span>
                            <select value={editCron.weekDay} onChange={e => setEditCron({ ...editCron, weekDay: e.target.value })}
                              style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                              <option value="1">一</option><option value="2">二</option><option value="3">三</option>
                              <option value="4">四</option><option value="5">五</option><option value="6">六</option><option value="0">日</option>
                            </select>
                            <input type="time" value={editCron.weekTime} onChange={e => setEditCron({ ...editCron, weekTime: e.target.value })}
                              style={{ padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }} />
                            <span style={{ fontSize: 11, color: '#ccc' }}>执行</span>
                          </div>
                        )}
                      </div>
                      <div style={{ marginBottom: 6 }}>
                        <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>任务描述（告诉 AI 做什么）</div>
                        <Input.TextArea rows={2} value={editCron.message} onChange={e => setEditCron({ ...editCron, message: e.target.value })}
                          style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 12 }} />
                      </div>
                      <div style={{ marginBottom: 8 }}>
                        <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>运行环境</div>
                        <select value={editCron.sessionTarget} onChange={e => setEditCron({ ...editCron, sessionTarget: e.target.value })}
                          style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                          <option value="isolated">隔离会话 (推荐)</option>
                          <option value="main">主会话</option>
                        </select>
                      </div>
                      {editCron.sessionTarget === 'isolated' && (
                        <div style={{ marginBottom: 8 }}>
                          <div style={{ fontSize: 11, color: '#ccc', marginBottom: 2 }}>结果发送到</div>
                          <select value={editCron.deliveryChannel} onChange={e => setEditCron({ ...editCron, deliveryChannel: e.target.value })}
                            style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 12 }}>
                            <option value="auto">自动（最近使用的渠道）</option>
                            <option value="telegram">Telegram</option>
                            <option value="whatsapp">WhatsApp</option>
                            <option value="discord">Discord</option>
                            <option value="webchat">Web Chat</option>
                          </select>
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        <button onClick={() => setEditingCronId(null)} style={{ background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#ccc', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>取消</button>
                        <button onClick={handleSaveEditCron} style={{ background: 'var(--figma-blue)', border: 'none', borderRadius: 'var(--radius-sm)', color: '#fff', padding: '4px 12px', cursor: 'pointer', fontSize: 12 }}>保存</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Switch size="small" checked={job.enabled} onChange={() => handleToggleCron(job)} />
                        <span style={{ fontSize: 13, fontWeight: 600, color: job.enabled ? '#fff' : '#666' }}>{job.name}</span>
                        <span className="figma-badge figma-badge-blue" style={{ fontSize: 10 }}>{(() => {
                          const s = job.schedule;
                          if (!s) return '?';
                          if (s.kind === 'every' && s.everyMs) {
                            const mins = s.everyMs / 60000;
                            if (mins < 60) return `每 ${mins} 分钟`;
                            return `每 ${mins / 60} 小时`;
                          }
                          if (s.kind === 'cron' && s.expr) {
                            const parts = s.expr.split(' ');
                            if (parts.length >= 5) {
                              const m = parts[0], h = parts[1], dow = parts[4];
                              const time = `${h.padStart(2, '0')}:${m.padStart(2, '0')}`;
                              if (dow !== '*') {
                                const days: Record<string, string> = { '0': '日', '1': '一', '2': '二', '3': '三', '4': '四', '5': '五', '6': '六' };
                                return `每周${days[dow] || dow} ${time}`;
                              }
                              return `每天 ${time}`;
                            }
                          }
                          return s.expr || s.kind || '?';
                        })()}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => handleStartEditCron(job)} style={{ background: 'none', border: 'none', color: 'var(--figma-blue)', cursor: 'pointer', padding: 2 }}>
                          <EditOutlined style={{ fontSize: 12 }} />
                        </button>
                        <button onClick={() => handleDeleteCron(job.id)} style={{ background: 'none', border: 'none', color: 'var(--figma-red)', cursor: 'pointer', padding: 2 }}>
                          <DeleteOutlined style={{ fontSize: 12 }} />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

      {/* Channel 配置 */}
      <div className="figma-panel" style={{ marginBottom: 24 }}>
        <div className="figma-panel-header" style={{ 
          background: 'linear-gradient(135deg, rgba(27, 196, 125, 0.12) 0%, rgba(27, 196, 125, 0.04) 100%)',
          borderBottom: '1px solid rgba(27, 196, 125, 0.2)'
        }}>
          <div className="figma-panel-title">
            <ApiOutlined style={{ marginRight: 8, color: '#1bc47d' }} />
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
                
                {/* 根据类型显示不同的配置字段 */}
                {(newChannel.type === 'telegram' || newChannel.type === 'discord') && (
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Bot Token *</div>
                    <Input.Password size="small" placeholder="输入 Bot Token..." value={newChannel.botToken}
                      onChange={e => setNewChannel({ ...newChannel, botToken: e.target.value })}
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </Col>
                )}
                
                {newChannel.type === 'whatsapp' && (
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>配置方式</div>
                    <button
                      onClick={handleStartWhatsAppAuth}
                      style={{
                        width: '100%',
                        background: 'var(--figma-green)',
                        border: 'none',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fff',
                        padding: '8px 12px',
                        cursor: 'pointer',
                        fontSize: 12,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: 6
                      }}
                    >
                      📱 生成扫码二维码
                    </button>
                    <div style={{ fontSize: 10, color: '#999', marginTop: 6, textAlign: 'center' }}>
                      使用 wacli 扫码连接（无需 Token）
                    </div>
                  </Col>
                )}
                
                {newChannel.type === 'signal' && (
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Phone Number *</div>
                    <Input size="small" placeholder="+1234567890" value={newChannel.botToken}
                      onChange={e => setNewChannel({ ...newChannel, botToken: e.target.value })}
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </Col>
                )}
                
                {newChannel.type === 'slack' && (
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Bot Token *</div>
                    <Input.Password size="small" placeholder="xoxb-..." value={newChannel.botToken}
                      onChange={e => setNewChannel({ ...newChannel, botToken: e.target.value })}
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </Col>
                )}
                
                {newChannel.type === 'irc' && (
                  <>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Server *</div>
                      <Input size="small" placeholder="irc.libera.chat" value={newChannel.botToken}
                        onChange={e => setNewChannel({ ...newChannel, botToken: e.target.value })}
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                    </Col>
                    <Col span={6}>
                      <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Port</div>
                      <Input size="small" type="number" placeholder="6667" defaultValue="6667"
                        style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                    </Col>
                  </>
                )}
              </Row>
              
              {/* IRC 额外字段 */}
              {newChannel.type === 'irc' && (
                <Row gutter={[12, 8]} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Nickname *</div>
                    <Input size="small" placeholder="openclaw-bot"
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Channels (逗号分隔)</div>
                    <Input size="small" placeholder="#general, #dev"
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </Col>
                </Row>
              )}
              
              {/* Discord 额外字段 */}
              {newChannel.type === 'discord' && (
                <Row gutter={[12, 8]} style={{ marginTop: 8 }}>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Guild ID (可选)</div>
                    <Input size="small" placeholder="123456789012345678"
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </Col>
                  <Col span={12}>
                    <div style={{ fontSize: 11, color: '#ccc', marginBottom: 4 }}>Webhook URL (可选)</div>
                    <Input size="small" placeholder="https://discord.com/api/webhooks/..."
                      style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff' }} />
                  </Col>
                </Row>
              )}
              
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
                              <Switch size="small" checked={channelEditForm.enabled}
                                onChange={checked => setChannelEditForm({ ...channelEditForm, enabled: checked })} />
                              <span style={{ fontSize: 11, color: '#ccc' }}>启用</span>
                            </div>
                          </div>

                          <div style={{ marginBottom: 6 }}>
                            <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>
                              {channel.type === 'telegram' && 'Bot Token (留空保持不变)'}
                              {channel.type === 'discord' && 'Bot Token (留空保持不变)'}
                              {channel.type === 'whatsapp' && 'API Token / 使用 wacli 扫码 (留空保持不变)'}
                              {channel.type === 'signal' && 'Phone Number (留空保持不变)'}
                              {channel.type === 'slack' && 'Bot Token (留空保持不变)'}
                              {channel.type === 'irc' && 'Server 地址 (留空保持不变)'}
                            </div>
                            {channel.type === 'whatsapp' ? (
                              <div>
                                <button
                                  onClick={async () => {
                                    try {
                                      await openWhatsAppQR();
                                      message.success('已打开扫码窗口，请在新窗口中扫描二维码');
                                    } catch {
                                      message.error('打开失败');
                                    }
                                  }}
                                  style={{
                                    width: '100%',
                                    background: 'var(--figma-green)',
                                    border: 'none',
                                    borderRadius: 'var(--radius-sm)',
                                    color: '#fff',
                                    padding: '6px 10px',
                                    cursor: 'pointer',
                                    fontSize: 11,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: 4
                                  }}
                                >
                                  📱 打开扫码窗口
                                </button>
                                <div style={{ fontSize: 9, color: '#999', marginTop: 4, textAlign: 'center' }}>
                                  使用 wacli 扫码连接（无需 Token）
                                </div>
                              </div>
                            ) : (
                              <Input.Password size="small"
                                value={channelEditForm.botToken || channelEditForm.token || channelEditForm.apiKey || ''}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (channel.type === 'telegram' || channel.type === 'discord') {
                                    setChannelEditForm({ ...channelEditForm, botToken: val });
                                  } else {
                                    setChannelEditForm({ ...channelEditForm, token: val, apiKey: val });
                                  }
                                }}
                                placeholder="留空保持原值"
                                style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                            )}
                          </div>
                          
                          {/* IRC 特殊字段 */}
                          {channel.type === 'irc' && (
                            <>
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>Nickname</div>
                                <Input size="small" value={channelEditForm.nickname || ''}
                                  onChange={e => setChannelEditForm({ ...channelEditForm, nickname: e.target.value })}
                                  placeholder="openclaw-bot"
                                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                              </div>
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>Channels (逗号分隔)</div>
                                <Input size="small" value={channelEditForm.channels || ''}
                                  onChange={e => setChannelEditForm({ ...channelEditForm, channels: e.target.value })}
                                  placeholder="#general, #dev"
                                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                              </div>
                            </>
                          )}
                          
                          {/* Discord 特殊字段 */}
                          {channel.type === 'discord' && (
                            <>
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>Guild ID (可选)</div>
                                <Input size="small" value={channelEditForm.guildId || ''}
                                  onChange={e => setChannelEditForm({ ...channelEditForm, guildId: e.target.value })}
                                  placeholder="123456789012345678"
                                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                              </div>
                              <div style={{ marginBottom: 6 }}>
                                <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>Webhook URL (可选)</div>
                                <Input size="small" value={channelEditForm.webhook || ''}
                                  onChange={e => setChannelEditForm({ ...channelEditForm, webhook: e.target.value })}
                                  placeholder="https://discord.com/api/webhooks/..."
                                  style={{ background: 'var(--bg-primary)', borderColor: 'var(--border-subtle)', color: '#fff', fontSize: 11 }} />
                              </div>
                            </>
                          )}

                          <Row gutter={4} style={{ marginBottom: 6 }}>
                            <Col span={12}>
                              <div style={{ color: '#ccc', marginBottom: 2, fontSize: 10 }}>DM 策略</div>
                              <select value={channelEditForm.dmPolicy} onChange={e => setChannelEditForm({ ...channelEditForm, dmPolicy: e.target.value })}
                                style={{ width: '100%', padding: '2px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 11 }}>
                                <option value="pairing">Pairing</option>
                                <option value="allowlist">Allowlist</option>
                                <option value="open">Open</option>
                              </select>
                            </Col>
                            <Col span={12}>
                              <div style={{ color: '#ccc', marginBottom: 2, fontSize: 10 }}>群组策略</div>
                              <select value={channelEditForm.groupPolicy} onChange={e => setChannelEditForm({ ...channelEditForm, groupPolicy: e.target.value })}
                                style={{ width: '100%', padding: '2px 4px', background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', color: '#fff', fontSize: 11 }}>
                                <option value="allowlist">Allowlist</option>
                                <option value="open">Open</option>
                                <option value="deny">Deny</option>
                              </select>
                            </Col>
                          </Row>

                          <div style={{ marginBottom: 8 }}>
                            <div style={{ color: '#ccc', marginBottom: 2, fontSize: 11 }}>流式模式</div>
                            <select value={channelEditForm.streamMode} onChange={e => setChannelEditForm({ ...channelEditForm, streamMode: e.target.value })}
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

      {/* WhatsApp 二维码弹窗 */}
      {showWhatsAppQR && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: 'rgba(0,0,0,0.8)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}>
          <div style={{
            background: 'var(--bg-secondary)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--space-4)',
            maxWidth: 500,
            width: '90%',
            border: '1px solid var(--border-subtle)'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#fff', fontSize: 16 }}>📱 WhatsApp 扫码连接</h3>
              <button onClick={handleCancelWhatsAppAuth} style={{
                background: 'none',
                border: 'none',
                color: '#999',
                cursor: 'pointer',
                fontSize: 24
              }}>×</button>
            </div>

            <div style={{
              background: whatsappQRCode ? '#fff' : 'var(--bg-tertiary)',
              padding: whatsappQRCode ? 20 : 30,
              borderRadius: 8,
              marginBottom: 20,
              textAlign: 'center',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 300
            }}>
              {whatsappAuthStatus === 'waiting' && !whatsappQRCode && (
                <div>
                  <div style={{ fontSize: 48, marginBottom: 16 }}>💻</div>
                  <div style={{ fontSize: 15, color: '#fff', marginBottom: 12 }}>
                    正在生成二维码...
                  </div>
                  <div style={{ fontSize: 12, color: '#666' }}>
                    如果长时间未显示，请查看终端窗口
                  </div>
                </div>
              )}
              
              {whatsappQRCode && (
                <img src={whatsappQRCode} alt="WhatsApp QR Code" style={{
                  maxWidth: '100%',
                  height: 'auto',
                  display: 'block'
                }} />
              )}
              
              {whatsappAuthStatus === 'success' && (
                <div>
                  <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--figma-green)' }}>✓</div>
                  <div style={{ fontSize: 15, color: 'var(--figma-green)' }}>
                    认证成功！
                  </div>
                </div>
              )}
              
              {whatsappAuthStatus === 'failed' && (
                <div>
                  <div style={{ fontSize: 48, marginBottom: 16, color: 'var(--figma-red)' }}>✗</div>
                  <div style={{ fontSize: 15, color: 'var(--figma-red)' }}>
                    认证失败，请重试
                  </div>
                </div>
              )}
            </div>

            <div style={{ fontSize: 12, color: '#666', lineHeight: 1.8, textAlign: 'center' }}>
              {whatsappQRCode ? (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 600, color: '#999' }}>扫码步骤：</div>
                  1. 打开手机 WhatsApp<br/>
                  2. 进入"设置" → "关联设备"<br/>
                  3. 扫描上方二维码
                </>
              ) : (
                <>
                  <div style={{ marginBottom: 8, fontWeight: 600, color: '#999' }}>提示：</div>
                  如果二维码未显示，请在 Mac 上<br/>
                  找到新打开的终端窗口并扫描
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
