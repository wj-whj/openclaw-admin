import { useState, useEffect } from 'react';
import { Row, Col } from 'antd';
import { api } from '../services/api';

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

interface TeamData {
  agents: AgentStatus[];
  timestamp: number;
}

export default function TeamPage() {
  const [teamData, setTeamData] = useState<TeamData | null>(null);
  const [loading, setLoading] = useState(true);

  const loadTeamData = async () => {
    try {
      const response = await api.get('/team');
      setTeamData(response.data);
    } catch (error) {
      console.error('Failed to load team data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTeamData();
    const interval = setInterval(loadTeamData, 10000);
    return () => clearInterval(interval);
  }, []);

  if (loading || !teamData) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '400px', fontSize: 13, color: 'var(--text-primary)' }}>
        加载中...
      </div>
    );
  }

  const formatTokens = (tokens: number): string => {
    if (tokens > 1000000) return (tokens / 1000000).toFixed(2) + 'M';
    if (tokens > 1000) return (tokens / 1000).toFixed(1) + 'K';
    return tokens.toString();
  };

  const formatTime = (timestamp: number): string => {
    if (!timestamp) return '未知';
    const date = new Date(timestamp);
    const now = Date.now();
    const diff = now - timestamp;
    
    if (diff < 60000) return '刚刚';
    if (diff < 3600000) return Math.floor(diff / 60000) + ' 分钟前';
    if (diff < 86400000) return Math.floor(diff / 3600000) + ' 小时前';
    return date.toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
  };

  // 合并所有 agent 的最近会话
  const allRecentSessions = teamData.agents.flatMap(agent =>
    agent.recentSessions.map(session => ({
      ...session,
      agentId: agent.id,
      agentName: agent.name,
      agentEmoji: agent.emoji
    }))
  ).sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10);

  return (
    <div className="content-container">
      {/* Agent Cards */}
      <Row gutter={[16, 16]} style={{ marginBottom: 24 }}>
        {teamData.agents.map(agent => (
          <Col span={8} key={agent.id}>
            <div 
              className="figma-card" 
              style={{
                padding: 'var(--space-4)',
                background: agent.online 
                  ? 'linear-gradient(135deg, rgba(27, 196, 125, 0.1) 0%, rgba(27, 196, 125, 0.02) 100%)'
                  : 'var(--bg-card)',
                border: agent.online 
                  ? '1px solid rgba(27, 196, 125, 0.4)'
                  : '1px solid var(--border-subtle)',
                boxShadow: agent.online 
                  ? '0 0 20px rgba(27, 196, 125, 0.15)'
                  : 'none',
                transition: 'all 0.3s ease'
              }}
            >
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ fontSize: 32 }}>{agent.emoji}</div>
                  <div>
                    <div style={{ fontSize: 18, fontWeight: 700, color: 'var(--text-primary)', marginBottom: 4 }}>
                      {agent.name}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {agent.model}
                    </div>
                  </div>
                </div>
                <div style={{
                  width: 12,
                  height: 12,
                  borderRadius: '50%',
                  background: agent.online ? 'var(--figma-green)' : 'var(--text-tertiary)',
                  boxShadow: agent.online ? '0 0 8px var(--figma-green)' : 'none',
                  transition: 'all 0.3s ease'
                }} />
              </div>

              {/* Status */}
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', marginBottom: 6 }}>
                  {agent.online ? '当前任务' : '最后任务'}
                </div>
                <div style={{ 
                  fontSize: 13, 
                  color: 'var(--text-primary)', 
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}>
                  {agent.currentTask}
                </div>
              </div>

              {/* Stats */}
              <div style={{ 
                display: 'grid', 
                gridTemplateColumns: '1fr 1fr 1fr', 
                gap: 12,
                paddingTop: 16,
                borderTop: '1px solid var(--border-subtle)'
              }}>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>会话</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--figma-blue)' }}>
                    {agent.sessionCount}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>Token</div>
                  <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--figma-purple)' }}>
                    {formatTokens(agent.totalTokens)}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 10, color: 'var(--text-secondary)', marginBottom: 4 }}>最后活跃</div>
                  <div style={{ fontSize: 11, fontWeight: 500, color: 'var(--text-tertiary)' }}>
                    {formatTime(agent.lastActive)}
                  </div>
                </div>
              </div>

              {/* Workspace */}
              <div style={{ 
                marginTop: 12,
                fontSize: 10,
                color: 'var(--text-tertiary)',
                fontFamily: 'monospace',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap'
              }}>
                📁 {agent.workspace}
              </div>
            </div>
          </Col>
        ))}
      </Row>

      {/* Recent Sessions */}
      <div className="figma-panel">
        <div className="figma-panel-header">
          <div className="figma-panel-title">最近任务</div>
          <span className="figma-badge figma-badge-blue">{allRecentSessions.length} 条</span>
        </div>
        <div className="figma-panel-body" style={{ padding: 'var(--space-3)' }}>
          {allRecentSessions.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: 40 }}>
              暂无任务记录
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {allRecentSessions.map((session, index) => (
                <div
                  key={index}
                  style={{
                    padding: 'var(--space-3)',
                    background: session.status === 'active' 
                      ? 'rgba(27, 196, 125, 0.08)' 
                      : 'var(--bg-tertiary)',
                    border: `1px solid ${session.status === 'active' 
                      ? 'rgba(27, 196, 125, 0.3)' 
                      : 'var(--border-subtle)'}`,
                    borderRadius: 'var(--radius-sm)',
                    transition: 'all 0.2s ease',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 16
                  }}
                >
                  {/* Agent Info */}
                  <div style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: 8,
                    minWidth: 120
                  }}>
                    <span style={{ fontSize: 20 }}>{session.agentEmoji}</span>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>
                      {session.agentName}
                    </span>
                  </div>

                  {/* Task Label */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ 
                      fontSize: 13, 
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {session.label}
                    </div>
                  </div>

                  {/* Stats */}
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>
                      🔤 {formatTokens(session.tokenCount)}
                    </div>
                    <span className={`figma-badge figma-badge-${session.status === 'active' ? 'green' : 'gray'}`}>
                      {session.status === 'active' ? '活跃' : '完成'}
                    </span>
                    <div style={{ 
                      fontSize: 11, 
                      color: 'var(--text-tertiary)',
                      minWidth: 100,
                      textAlign: 'right'
                    }}>
                      {formatTime(session.updatedAt)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
