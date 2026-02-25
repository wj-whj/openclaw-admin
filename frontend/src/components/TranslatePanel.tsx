import { useState, useRef, useEffect } from 'react';
import { CloseOutlined, CopyOutlined, CheckOutlined, GlobalOutlined, EnterOutlined } from '@ant-design/icons';

const getApiBase = () => {
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:7749`;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:7749';
};
const API_BASE = getApiBase();

interface TranslatePanelProps {
  onClose: () => void;
  onInsert: (text: string) => void;
}

const LANGS = [
  { value: 'auto', label: '自动检测' },
  { value: 'zh', label: '中文' },
  { value: 'en', label: '英文' },
  { value: 'ja', label: '日文' },
];

export default function TranslatePanel({ onClose, onInsert }: TranslatePanelProps) {
  const [mode, setMode] = useState<'quick' | 'detail'>('quick');
  const [targetLang, setTargetLang] = useState('auto');
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    textareaRef.current?.focus();
  }, []);

  const handleTranslate = async () => {
    if (!inputText.trim() || loading) return;
    setLoading(true);
    setResult('');
    try {
      const token = localStorage.getItem('auth_token') || 'wj12345';
      const res = await fetch(`${API_BASE}/api/chat/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ text: inputText.trim(), mode, targetLang }),
      });
      const data = await res.json();
      setResult(data.translated || data.error || '翻译失败');
    } catch {
      setResult('翻译请求失败，请检查网络');
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result) return;
    navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      handleTranslate();
    }
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
          <GlobalOutlined style={{ color: 'var(--figma-blue)', fontSize: 14 }} />
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>翻译</span>
          {/* Tab 切换 */}
          <div style={{ display: 'flex', gap: 2, marginLeft: 8 }}>
            {(['quick', 'detail'] as const).map(m => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: '2px 10px', fontSize: 12, borderRadius: 'var(--radius-sm)',
                border: 'none', cursor: 'pointer', transition: 'all 0.15s',
                background: mode === m ? 'var(--figma-blue)' : 'transparent',
                color: mode === m ? '#fff' : 'var(--text-tertiary)',
                fontWeight: mode === m ? 600 : 400,
              }}>
                {m === 'quick' ? '快速翻译' : '详细释义'}
              </button>
            ))}
          </div>
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
        {/* 语言选择 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-tertiary)', flexShrink: 0 }}>目标语言</span>
          <select value={targetLang} onChange={e => setTargetLang(e.target.value)} style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
            fontSize: 12, padding: '3px 8px', cursor: 'pointer', outline: 'none',
          }}>
            {LANGS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
          </select>
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', marginLeft: 'auto' }}>
            Ctrl+Enter 翻译
          </span>
        </div>

        {/* 输入区域 */}
        <textarea
          ref={textareaRef}
          value={inputText}
          onChange={e => setInputText(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="输入要翻译的文本..."
          rows={3}
          style={{
            width: '100%', boxSizing: 'border-box',
            padding: '8px 10px', resize: 'vertical',
            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
            fontSize: 13, fontFamily: 'inherit', lineHeight: 1.5, outline: 'none',
          }}
        />

        {/* 翻译按钮 */}
        <button onClick={handleTranslate} disabled={!inputText.trim() || loading} style={{
          alignSelf: 'flex-start',
          padding: '6px 18px', fontSize: 13, fontWeight: 500,
          background: (!inputText.trim() || loading) ? 'var(--bg-tertiary)' : 'var(--figma-blue)',
          color: (!inputText.trim() || loading) ? 'var(--text-tertiary)' : '#fff',
          border: 'none', borderRadius: 'var(--radius-sm)',
          cursor: (!inputText.trim() || loading) ? 'not-allowed' : 'pointer',
          transition: 'all 0.2s',
        }}>
          {loading ? '翻译中...' : '翻译'}
        </button>

        {/* 翻译结果 */}
        {result && (
          <div style={{
            background: 'var(--bg-primary)', border: '1px solid var(--border-subtle)',
            borderRadius: 'var(--radius-sm)', padding: '10px 12px',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
              <pre style={{
                margin: 0, flex: 1, fontSize: 13, color: 'var(--text-primary)',
                whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontFamily: 'inherit', lineHeight: 1.6,
              }}>{result}</pre>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                <button onClick={handleCopy} title="复制" style={{
                  background: 'none', border: '1px solid var(--border-subtle)',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: copied ? 'var(--figma-green)' : 'var(--text-tertiary)',
                  padding: '4px 8px', fontSize: 12, transition: 'all 0.2s',
                }}>
                  {copied ? <CheckOutlined /> : <CopyOutlined />}
                </button>
                <button onClick={() => onInsert(result)} title="插入到输入框" style={{
                  background: 'var(--figma-blue)', border: 'none',
                  borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                  color: '#fff', padding: '4px 10px', fontSize: 12,
                  display: 'flex', alignItems: 'center', gap: 4,
                }}>
                  <EnterOutlined style={{ fontSize: 11 }} />插入
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
