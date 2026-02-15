import { useState, useEffect, useRef } from 'react';
import { Row, Col } from 'antd';
import { getDashboardData, getSessions, getModels, getSkills, getLogs, getTasks } from '../services/api';
import { socket } from '../services/socket';

interface DashboardData {
  gateway: { status: string; uptime: string; pid: number | null };
  sessions: { total: number; active: number; subagents: number };
  usage: { tokensToday: number; requestsToday: number };
  system: { cpu: number; memory: number; cpuHistory?: number[]; memoryHistory?: number[] };
}

interface SessionItem {
  key: string;
  sessionId: string;
  chatType: string;
  channel: string;
  updatedAt: number;
  active: boolean;
  messageCount: number;
  tokenCount: number;
}

interface ModelProvider {
  name: string;
  baseUrl: string;
  api: string;
  models: { id: string; name: string; contextWindow: number; maxTokens: number; reasoning: boolean }[];
  totalTokens?: number;
  totalRequests?: number;
}

interface SkillItem {
  name: string;
  description: string;
  source: string;
  hasSkillMd: boolean;
}

interface LogItem {
  timestamp: string;
  level: string;
  source: string;
  message: string;
}

interface SubagentTask {
  id: string;
  label: string;
  status: string;
  model: string;
  updatedAt: number;
  sessionId: string;
}

export default function MonitorPage() {
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [sessions, setSessions] = useState<SessionItem[]>([]);
  const [models, setModels] = useState<ModelProvider[]>([]);
  const [skills, setSkills] = useState<SkillItem[]>([]);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [subagentTasks, setSubagentTasks] = useState<SubagentTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAllSkills, setShowAllSkills] = useState(false);
  const [skillSearch, setSkillSearch] = useState('');
  const [selectedSkill, setSelectedSkill] = useState<SkillItem | null>(null);
  const cpuHistoryRef = useRef<number[]>([]);
  const memHistoryRef = useRef<number[]>([]);

  useEffect(() => {
    loadAll();
    socket.emit('subscribe:dashboard');
    socket.on('dashboard:update', (newData: DashboardData) => {
      setDashboard(newData);
      // 维护本地历史
      cpuHistoryRef.current = [...cpuHistoryRef.current.slice(-9), newData.system.cpu];
      memHistoryRef.current = [...memHistoryRef.current.slice(-9), newData.system.memory];
    });

    // 每 30 秒刷新会话、模型、技能、日志
    const interval = setInterval(() => {
      loadSessions();
      loadLogs();
    }, 30000);

    return () => {
      socket.off('dashboard:update');
      clearInterval(interval);
    };
  }, []);

  const loadAll = async () => {
    try {
      const [dashRes, sessRes, modRes, skillRes, logRes, taskRes] = await Promise.all([
        getDashboardData(),
        getSessions(),
        getModels(),
        getSkills(),
        getLogs(),
        getTasks()
      ]);
      setDashboard(dashRes.data);
      setSessions(sessRes.data.sessions || []);
      setModels(modRes.data.providers || []);
      setSkills(skillRes.data.skills || []);
      setLogs(logRes.data.logs || []);
      setSubagentTasks(taskRes.data.subagentTasks || []);

      // 初始化历史
      if (dashRes.data.system) {
        cpuHistoryRef.current = dashRes.data.system.cpuHistory || [dashRes.data.system.cpu];
        memHistoryRef.current = dashRes.data.system.memoryHistory || [dashRes.data.system.memory];
      }
    } catch (error) {
      console.error('Failed to load data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSessions = async () => {
    try {
      const res = await getSessions();
      setSessions(res.data.sessions || []);
    } catch {}
  };

  const loadLogs = async () => {
    try {
      const res = await getLogs();
      setLogs(res.data.logs || []);
    } catch {}
  };

  if (loading || !dashboard) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', fontSize: 13, color: '#ffffff' }}>
        加载中...
      </div>
    );
  }

  // 环形进度图
    // 根据数值返回对应颜色：绿色(0-40) → 蓝色(40-60) → 橙色(60-80) → 红色(80-100)
  const getUsageColor = (value: number): string => {
    if (value < 40) return '#1bc47d';
    if (value < 60) return '#4e8ff0';
    if (value < 80) return '#f0a020';
    return '#e84855';
  };

  const CircularProgress = ({ value, size = 120 }: { value: number; size?: number }) => {
    const color = getUsageColor(value);
    const radius = (size - 20) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (value / 100) * circumference;
    return (
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--bg-tertiary)" strokeWidth="10" />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth="10"
          strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} />
        <text x={size / 2} y={size / 2} textAnchor="middle" dominantBaseline="middle"
          fill="#ffffff" fontSize="28" fontWeight="600"
          style={{ transform: 'rotate(90deg)', transformOrigin: 'center' }}>
          {value}%
        </text>
      </svg>
    );
  };

  // 迷你折线图
  const MiniChart = ({ data }: { data: number[] }) => {
    if (!data || data.length < 2) return null;
    const color = getUsageColor(data[data.length - 1]);
    const width = 100;
    const height = 40;
    const max = Math.max(...data, 1);
    const points = data.map((v, i) => `${(i / (data.length - 1)) * width},${height - (v / max) * height}`).join(' ');
    const gradientId = `g-${color.replace(/[^a-z0-9]/gi, '')}`;
    return (
      <svg width={width} height={height} style={{ display: 'block' }}>
        <defs>
          <linearGradient id={gradientId} x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={`0,${height} ${points} ${width},${height}`} fill={`url(#${gradientId})`} />
        <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  };

  const cpuHistory = cpuHistoryRef.current.length > 1 ? cpuHistoryRef.current : (dashboard.system.cpuHistory || [dashboard.system.cpu]);
  const memHistory = memHistoryRef.current.length > 1 ? memHistoryRef.current : (dashboard.system.memoryHistory || [dashboard.system.memory]);

  // 计算模型总使用量
  const totalModelTokens = models.reduce((sum, p) => sum + (p.totalTokens || 0), 0);

  return (
    <div className="content-container">
      {/* System Stats */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div className="figma-card figma-stat" style={{
            background: 'linear-gradient(135deg, rgba(27, 196, 125, 0.1) 0%, var(--bg-secondary) 100%)',
            borderColor: 'rgba(27, 196, 125, 0.3)'
          }}>
            <div className="figma-stat-label">网关状态</div>
            <div className="figma-stat-value" style={{ color: dashboard.gateway.status === 'running' ? 'var(--figma-green)' : 'var(--figma-red)' }}>
              {dashboard.gateway.status === 'running' ? '运行中' : '已停止'}
            </div>
            <div className="figma-stat-subtext">
              {dashboard.gateway.pid ? `PID ${dashboard.gateway.pid} · ${dashboard.gateway.uptime}` : '未运行'}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="figma-card figma-stat" style={{
            background: 'linear-gradient(135deg, rgba(24, 160, 251, 0.1) 0%, var(--bg-secondary) 100%)',
            borderColor: 'rgba(24, 160, 251, 0.3)'
          }}>
            <div className="figma-stat-label">会话总数</div>
            <div className="figma-stat-value" style={{ color: 'var(--figma-blue)' }}>{dashboard.sessions.total}</div>
            <div className="figma-stat-subtext">{dashboard.sessions.active} 个活跃</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="figma-card figma-stat" style={{
            background: 'linear-gradient(135deg, rgba(24, 160, 251, 0.1) 0%, var(--bg-secondary) 100%)',
            borderColor: 'rgba(24, 160, 251, 0.3)'
          }}>
            <div className="figma-stat-label">今日 TOKEN</div>
            <div className="figma-stat-value" style={{ color: 'var(--figma-blue)' }}>
              {dashboard.usage.tokensToday > 1000000
                ? (dashboard.usage.tokensToday / 1000000).toFixed(2) + 'M'
                : dashboard.usage.tokensToday > 1000
                  ? (dashboard.usage.tokensToday / 1000).toFixed(1) + 'K'
                  : dashboard.usage.tokensToday}
            </div>
            <div className="figma-stat-subtext">{dashboard.usage.requestsToday} 次请求</div>
          </div>
        </Col>
        <Col span={6}>
          <div className="figma-card figma-stat" style={{
            background: 'linear-gradient(135deg, rgba(255, 199, 0, 0.1) 0%, var(--bg-secondary) 100%)',
            borderColor: 'rgba(255, 199, 0, 0.3)'
          }}>
            <div className="figma-stat-label">子代理</div>
            <div className="figma-stat-value" style={{ color: 'var(--figma-yellow)' }}>{dashboard.sessions.subagents}</div>
            <div className="figma-stat-subtext">正在运行</div>
          </div>
        </Col>
      </Row>

      {/* System Resources + Sessions + Subagents */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        <Col span={6}>
          <div className="figma-panel">
            <div className="figma-panel-header">
              <div className="figma-panel-title">CPU 使用率</div>
              <span className={`figma-badge figma-badge-${dashboard.system.cpu >= 80 ? 'red' : dashboard.system.cpu >= 60 ? 'yellow' : 'green'}`}>
                {dashboard.system.cpu >= 80 ? '高负载' : dashboard.system.cpu >= 60 ? '较高' : '正常'}
              </span>
            </div>
            <div className="figma-panel-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress value={dashboard.system.cpu} size={100} />
              <div style={{ marginTop: 12, width: '100%' }}>
                <div style={{ fontSize: 11, color: '#cccccc', marginBottom: 4 }}>趋势</div>
                <MiniChart data={cpuHistory} />
              </div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="figma-panel">
            <div className="figma-panel-header">
              <div className="figma-panel-title">内存使用率</div>
              <span className={`figma-badge figma-badge-${dashboard.system.memory >= 80 ? 'red' : dashboard.system.memory >= 60 ? 'yellow' : 'green'}`}>
                {dashboard.system.memory >= 80 ? '高占用' : dashboard.system.memory >= 60 ? '较高' : '正常'}
              </span>
            </div>
            <div className="figma-panel-body" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <CircularProgress value={dashboard.system.memory} size={100} />
              <div style={{ marginTop: 12, width: '100%' }}>
                <div style={{ fontSize: 11, color: '#cccccc', marginBottom: 4 }}>趋势</div>
                <MiniChart data={memHistory} />
              </div>
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="figma-panel">
            <div className="figma-panel-header">
              <div className="figma-panel-title">会话列表</div>
              <span className="figma-badge figma-badge-blue">{sessions.length} 个</span>
            </div>
            <div className="figma-panel-body" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {sessions.length === 0 ? (
                <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>暂无会话</div>
              ) : sessions.map((session, index) => (
                <div key={index} style={{
                  padding: 'var(--space-2)',
                  marginBottom: 'var(--space-2)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {session.active && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                      background: 'var(--figma-green)', animation: 'pulse 2s ease-in-out infinite'
                    }} />
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', paddingLeft: session.active ? 8 : 0 }}>
                      {session.key.replace('agent:main:', '')}
                    </span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 4 }}>
                    <span className="figma-badge figma-badge-blue">{session.channel || 'unknown'}</span>
                    <span className={`figma-badge figma-badge-${session.active ? 'green' : 'gray'}`}>
                      {session.active ? '活跃' : '空闲'}
                    </span>
                  </div>
                  <div style={{ fontSize: 11, color: '#cccccc', display: 'flex', gap: 'var(--space-3)' }}>
                    <span>消息: {session.messageCount}</span>
                    <span>Token: {session.tokenCount > 1000 ? (session.tokenCount / 1000).toFixed(1) + 'K' : session.tokenCount}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>
        <Col span={6}>
          <div className="figma-panel">
            <div className="figma-panel-header">
              <div className="figma-panel-title">子代理任务</div>
              <span className="figma-badge figma-badge-yellow">{subagentTasks.length} 个</span>
            </div>
            <div className="figma-panel-body" style={{ maxHeight: 260, overflowY: 'auto' }}>
              {subagentTasks.length === 0 ? (
                <div style={{ fontSize: 12, color: '#999', textAlign: 'center', padding: 20 }}>暂无子代理</div>
              ) : subagentTasks.map((task, index) => (
                <div key={index} style={{
                  padding: 'var(--space-2)',
                  marginBottom: 'var(--space-2)',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)',
                  position: 'relative',
                  overflow: 'hidden'
                }}>
                  {task.status === 'running' && (
                    <div style={{
                      position: 'absolute', left: 0, top: 0, bottom: 0, width: 3,
                      background: 'var(--figma-green)', animation: 'pulse 2s ease-in-out infinite'
                    }} />
                  )}
                  <div style={{ marginBottom: 4, paddingLeft: task.status === 'running' ? 8 : 0 }}>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#ffffff' }}>{task.label}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 'var(--space-2)', marginBottom: 4 }}>
                    <span className={`figma-badge figma-badge-${task.status === 'running' ? 'green' : task.status === 'failed' ? 'red' : 'gray'}`}>
                      {task.status === 'running' ? '运行中' : task.status === 'failed' ? '失败' : '已完成'}
                    </span>
                    <span className="figma-badge figma-badge-blue">{task.model}</span>
                  </div>
                  <div style={{ fontSize: 11, color: '#cccccc' }}>
                    {task.updatedAt ? new Date(task.updatedAt).toLocaleString('zh-CN', { hour12: false }) : ''}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Col>
      </Row>

      {/* Models */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {models.length === 0 ? (
          <Col span={24}>
            <div className="figma-card" style={{ padding: 20, textAlign: 'center', color: '#999' }}>暂无模型配置</div>
          </Col>
        ) : models.map((provider, index) => (
          <Col span={Math.max(6, Math.floor(24 / models.length))} key={index}>
            <div className="figma-panel">
              <div className="figma-panel-header">
                <div className="figma-panel-title">{provider.name}</div>
                <span className="figma-badge figma-badge-blue">{provider.models?.length || 0} 模型</span>
              </div>
              <div className="figma-panel-body">
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{ fontSize: 11, color: '#cccccc', marginBottom: 4 }}>Token 使用</div>
                  <div style={{ fontSize: 24, fontWeight: 600, color: 'var(--figma-blue)' }}>
                    {(provider.totalTokens || 0) > 1000000
                      ? ((provider.totalTokens || 0) / 1000000).toFixed(2) + 'M'
                      : (provider.totalTokens || 0) > 1000
                        ? ((provider.totalTokens || 0) / 1000).toFixed(1) + 'K'
                        : provider.totalTokens || 0}
                  </div>
                </div>
                {/* 柱状图 */}
                <div style={{ marginBottom: 'var(--space-3)' }}>
                  <div style={{
                    height: 60, background: 'var(--bg-tertiary)', borderRadius: 'var(--radius-sm)',
                    position: 'relative', overflow: 'hidden'
                  }}>
                    <div style={{
                      position: 'absolute', bottom: 0, left: 0, right: 0,
                      height: `${totalModelTokens > 0 ? ((provider.totalTokens || 0) / totalModelTokens) * 100 : 0}%`,
                      background: 'linear-gradient(180deg, var(--figma-blue) 0%, rgba(24, 160, 251, 0.5) 100%)',
                      transition: 'height 0.5s ease', borderRadius: 'var(--radius-sm)'
                    }} />
                  </div>
                </div>
                <div style={{ fontSize: 11, color: '#cccccc' }}>
                  <div>请求: {provider.totalRequests || 0}</div>
                  {provider.models?.map((m, i) => (
                    <div key={i} style={{ marginTop: 4, color: '#999' }}>· {m.name || m.id}</div>
                  ))}
                </div>
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Skills */}
      <div className="figma-panel" style={{ marginBottom: 16 }}>
        <div className="figma-panel-header">
          <div className="figma-panel-title">技能列表</div>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <span className="figma-badge figma-badge-blue">{skills.filter(s => s.source === 'system').length} 系统</span>
            <span className="figma-badge figma-badge-green">{skills.filter(s => s.source === 'custom').length} 自定义</span>
            {skills.length > 8 && (
              <button onClick={() => setShowAllSkills(!showAllSkills)} style={{
                background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                color: 'var(--figma-blue)', fontSize: 11, padding: '2px 8px', cursor: 'pointer'
              }}>
                {showAllSkills ? '收起' : `展开全部 (${skills.length})`}
              </button>
            )}
          </div>
        </div>
        <div className="figma-panel-body">
          {showAllSkills && (
            <div style={{ marginBottom: 'var(--space-3)' }}>
              <input
                type="text"
                placeholder="搜索技能..."
                value={skillSearch}
                onChange={(e) => setSkillSearch(e.target.value)}
                style={{
                  width: '100%', padding: '6px 12px', background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                  color: '#ffffff', fontSize: 12, outline: 'none', boxSizing: 'border-box'
                }}
              />
            </div>
          )}
          <Row gutter={[8, 8]}>
            {(showAllSkills
              ? skills.filter(s => !skillSearch || s.name.includes(skillSearch) || s.description.toLowerCase().includes(skillSearch.toLowerCase()))
              : skills.slice(0, 8)
            ).map((skill, index) => (
              <Col span={showAllSkills ? 4 : 3} key={index}>
                <div
                  className="figma-card"
                  style={{ padding: 'var(--space-3)', cursor: 'pointer', transition: 'all 0.2s' }}
                  onClick={() => setSelectedSkill(selectedSkill?.name === skill.name ? null : skill)}
                  onMouseEnter={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--figma-blue)'; }}
                  onMouseLeave={(e) => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border-subtle)'; }}
                >
                  <div style={{ fontSize: 12, fontWeight: 600, color: '#ffffff', marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {skill.name}
                  </div>
                  <span className={`figma-badge figma-badge-${skill.source === 'system' ? 'blue' : 'green'}`}>
                    {skill.source === 'system' ? '系统' : '自定义'}
                  </span>
                </div>
              </Col>
            ))}
            {!showAllSkills && skills.length > 8 && (
              <Col span={3}>
                <div
                  className="figma-card"
                  style={{ padding: 'var(--space-3)', textAlign: 'center', cursor: 'pointer' }}
                  onClick={() => setShowAllSkills(true)}
                >
                  <div style={{ fontSize: 20, fontWeight: 600, color: 'var(--figma-blue)' }}>+{skills.length - 8}</div>
                  <div style={{ fontSize: 11, color: '#cccccc' }}>点击展开</div>
                </div>
              </Col>
            )}
          </Row>
          {selectedSkill && (
            <div style={{
              marginTop: 'var(--space-3)', padding: 'var(--space-3)',
              background: 'var(--bg-tertiary)', border: '1px solid var(--figma-blue)',
              borderRadius: 'var(--radius-sm)', animation: 'slideIn 0.2s ease'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#ffffff' }}>{selectedSkill.name}</span>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <span className={`figma-badge figma-badge-${selectedSkill.source === 'system' ? 'blue' : 'green'}`}>
                    {selectedSkill.source === 'system' ? '系统' : '自定义'}
                  </span>
                  <span className={`figma-badge figma-badge-${selectedSkill.hasSkillMd ? 'green' : 'gray'}`}>
                    {selectedSkill.hasSkillMd ? 'SKILL.md ✓' : '无文档'}
                  </span>
                </div>
              </div>
              <div style={{ fontSize: 12, color: '#cccccc', lineHeight: 1.6 }}>
                {selectedSkill.description || '暂无描述'}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Logs */}
      <div className="figma-panel">
        <div className="figma-panel-header">
          <div className="figma-panel-title">系统日志</div>
          <span className="figma-badge figma-badge-green">最近 {logs.length} 条</span>
        </div>
        <div style={{
          padding: 'var(--space-3)', background: 'var(--bg-secondary)',
          maxHeight: '300px', overflowY: 'auto', fontFamily: 'monospace', fontSize: 12
        }}>
          {logs.length === 0 ? (
            <div style={{ textAlign: 'center', color: '#999', padding: 20 }}>暂无日志</div>
          ) : logs.map((log, index) => {
            const time = log.timestamp ? new Date(log.timestamp).toLocaleTimeString('zh-CN', { hour12: false }) : '';
            return (
              <div key={index} style={{
                padding: 'var(--space-2)', marginBottom: 2,
                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', display: 'flex', gap: 'var(--space-3)',
                animation: index === 0 ? 'slideIn 0.3s ease' : 'none'
              }}>
                <span style={{ color: '#cccccc', minWidth: 60 }}>{time}</span>
                <span style={{
                  color: log.level === 'warn' || log.level === 'warning' ? 'var(--figma-yellow)' : log.level === 'error' ? 'var(--figma-red)' : '#cccccc',
                  minWidth: 50, fontSize: 11, fontWeight: 500
                }}>
                  {(log.level || 'info').toUpperCase()}
                </span>
                <span className="figma-badge figma-badge-gray" style={{ minWidth: 60 }}>{log.source || 'system'}</span>
                <span style={{ color: '#ffffff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {log.message}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
