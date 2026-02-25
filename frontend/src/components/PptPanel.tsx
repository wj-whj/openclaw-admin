import { useState } from 'react';
import { CloseOutlined, FileOutlined, DownloadOutlined } from '@ant-design/icons';

const getApiBase = () => {
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:7749`;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:7749';
};
const API_BASE = getApiBase();

interface PptPanelProps {
  onClose: () => void;
}

const STYLES = [
  { value: 'tech', label: '🔵 科技风', desc: '深色背景，蓝紫配色' },
  { value: 'business', label: '🟦 商务风', desc: '白色背景，深蓝配色' },
  { value: 'minimal', label: '⬜ 极简风', desc: '浅灰背景，黑白配色' },
];

export default function PptPanel({ onClose }: PptPanelProps) {
  const [topic, setTopic] = useState('');
  const [style, setStyle] = useState('tech');
  const [pages, setPages] = useState(8);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ name: string; path: string; size: number } | null>(null);
  const [error, setError] = useState('');

  const handleGenerate = async () => {
    if (!topic.trim() || loading) return;
    setLoading(true);
    setResult(null);
    setError('');
    try {
      const token = localStorage.getItem('auth_token') || 'wj12345';
      const res = await fetch(`${API_BASE}/api/chat/generate-ppt`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({ topic: topic.trim(), style, pages }),
      });
      const data = await res.json();
      if (data.success && data.file) {
        setResult(data.file);
      } else {
        setError(data.error || '生成失败');
      }
    } catch {
      setError('请求失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = () => {
    if (!result) return;
    const token = localStorage.getItem('auth_token') || 'wj12345';
    const url = `${API_BASE}/api/chat/file?path=${encodeURIComponent(result.path)}&token=${token}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = result.name;
    a.click();
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border-default)',
      borderRadius: 'var(--radius-md)',
      boxShadow: '0 -4px 16px rgba(0,0,0,0.15)',
      overflow: 'hidden',
      marginBottom: 8,
    }}>
      {/* 标题栏 */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '10px 14px',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'var(--bg-tertiary)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 15 }}>📑</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>PPT 生成</span>
        </div>
        <button onClick={onClose} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: 'var(--text-tertiary)', padding: 4, lineHeight: 1,
          borderRadius: 'var(--radius-sm)',
        }}>
          <CloseOutlined style={{ fontSize: 13 }} />
        </button>
      </div>

      <div style={{ padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* 主题输入 */}
        <div>
          <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>主题 / 大纲</div>
          <textarea
            value={topic}
            onChange={e => setTopic(e.target.value)}
            placeholder="例如：人工智能在医疗领域的应用与前景"
            rows={2}
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '8px 10px', resize: 'vertical',
              background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
              borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
              fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
            }}
          />
        </div>

        {/* 风格 + 页数 */}
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>风格</div>
            <div style={{ display: 'flex', gap: 6 }}>
              {STYLES.map(s => (
                <button key={s.value} onClick={() => setStyle(s.value)} title={s.desc} style={{
                  flex: 1, padding: '5px 4px', fontSize: 11, borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: style === s.value ? 'var(--figma-blue)' : 'var(--border-subtle)',
                  background: style === s.value ? 'rgba(13,141,227,0.1)' : 'var(--bg-primary)',
                  color: style === s.value ? 'var(--figma-blue)' : 'var(--text-secondary)',
                  cursor: 'pointer', transition: 'all 0.15s', textAlign: 'center',
                }}>
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-tertiary)', marginBottom: 4 }}>页数</div>
            <input
              type="number"
              value={pages}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                if (!isNaN(v)) setPages(Math.max(3, Math.min(30, v)));
              }}
              min={3} max={30}
              style={{
                width: 60, padding: '5px 8px', fontSize: 13, textAlign: 'center',
                background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
                outline: 'none', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* 生成按钮 */}
        <button onClick={handleGenerate} disabled={!topic.trim() || loading} style={{
          alignSelf: 'flex-start',
          padding: '7px 20px', fontSize: 13, fontWeight: 500,
          background: (!topic.trim() || loading) ? 'var(--bg-tertiary)' : 'var(--figma-blue)',
          color: (!topic.trim() || loading) ? 'var(--text-tertiary)' : '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          cursor: (!topic.trim() || loading) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}>
          {loading ? '生成中，请稍候...' : '生成 PPT'}
        </button>

        {/* 错误提示 */}
        {error && (
          <div style={{
            padding: '8px 12px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(242,72,34,0.08)', border: '1px solid rgba(242,72,34,0.2)',
            fontSize: 12, color: 'var(--figma-red)',
          }}>
            {error}
          </div>
        )}

        {/* 生成结果 */}
        {result && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10,
            padding: '10px 12px', borderRadius: 'var(--radius-sm)',
            background: 'rgba(27,196,125,0.08)', border: '1px solid rgba(27,196,125,0.2)',
          }}>
            <FileOutlined style={{ fontSize: 20, color: 'var(--figma-green)', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {result.name}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>{formatSize(result.size)}</div>
            </div>
            <button onClick={handleDownload} style={{
              display: 'flex', alignItems: 'center', gap: 5,
              padding: '6px 14px', fontSize: 12, fontWeight: 500,
              background: 'var(--figma-green)', color: '#fff',
              border: 'none', borderRadius: 'var(--radius-sm)', cursor: 'pointer',
              flexShrink: 0,
            }}>
              <DownloadOutlined />下载
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
