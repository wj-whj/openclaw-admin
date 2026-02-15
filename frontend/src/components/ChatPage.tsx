import { useState, useRef, useEffect } from 'react';
import { PaperClipOutlined, SendOutlined, DeleteOutlined, FileOutlined, DownloadOutlined, PictureOutlined } from '@ant-design/icons';

// 动态 API 地址，和 api.ts 保持一致
const getApiBase = () => {
  const hostname = window.location.hostname;
  if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
    return `http://${hostname}:7749`;
  }
  return import.meta.env.VITE_API_URL || 'http://localhost:7749';
};
const API_BASE = getApiBase();

interface ChatFile {
  name: string;
  path: string;
  size: number;
  type: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
  files?: ChatFile[];
  outputFiles?: ChatFile[];
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [lastSync, setLastSync] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => { scrollToBottom(); }, [messages, loading]);

  // 定期同步会话历史（每 5 秒）
  useEffect(() => {
    const syncHistory = async () => {
      try {
        const token = localStorage.getItem('auth_token') || 'wj12345';
        const resp = await fetch(`${API_BASE}/api/chat/history?limit=50`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!resp.ok) return;
        const data = await resp.json();
        if (data.messages && Array.isArray(data.messages)) {
          setMessages(data.messages);
          setLastSync(Date.now());
        }
      } catch (err) {
        console.error('Sync history failed:', err);
      }
    };

    syncHistory(); // 初始加载
    const interval = setInterval(syncHistory, 5000); // 每 5 秒同步
    return () => clearInterval(interval);
  }, []);

  const handleSend = async () => {
    if ((!input.trim() && pendingFiles.length === 0) || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now(),
      files: pendingFiles.map(f => ({ name: f.name, path: '', size: f.size, type: f.type }))
    };

    setMessages(prev => [...prev, userMessage]);
    const currentInput = input.trim();
    const currentFiles = [...pendingFiles];
    setInput('');
    setPendingFiles([]);
    setLoading(true);

    try {
      const formData = new FormData();
      if (currentInput) formData.append('message', currentInput);
      currentFiles.forEach(f => formData.append('files', f));

      const token = localStorage.getItem('auth_token') || 'wj12345';
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 120000); // 2分钟超时
      
      const resp = await fetch(`${API_BASE}/api/chat`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.error || '请求失败');

      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply || '未收到回复',
        timestamp: Date.now(),
        outputFiles: data.outputFiles
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error: any) {
      const errMsg = error.name === 'AbortError' 
        ? '请求超时，AI 处理时间较长，请稍后重试'
        : error.message === 'Failed to fetch'
          ? '网络连接失败，请检查后端服务是否运行'
          : (error.message || '发送失败');
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `❌ ${errMsg}`,
        timestamp: Date.now()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setPendingFiles(prev => [...prev, ...files]);
    e.target.value = '';
  };

  const removePendingFile = (index: number) => {
    setPendingFiles(prev => prev.filter((_, i) => i !== index));
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const isImage = (type: string) => type.startsWith('image/');

  const getFileUrl = (filePath: string) => {
    const token = localStorage.getItem('auth_token') || 'wj12345';
    return `${API_BASE}/api/chat/file?path=${encodeURIComponent(filePath)}&token=${token}`;
  };

  const clearChat = () => { setMessages([]); setPendingFiles([]); };

  // 渲染文件附件
  const renderFiles = (files: ChatFile[], isOutput = false) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 6 }}>
      {files.map((f, i) => (
        <div key={i} style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 'var(--radius-sm)',
          background: isOutput ? 'rgba(27, 196, 125, 0.15)' : 'rgba(78, 143, 240, 0.15)',
          border: `1px solid ${isOutput ? 'rgba(27, 196, 125, 0.3)' : 'rgba(78, 143, 240, 0.3)'}`,
          fontSize: 11, color: '#ccc', maxWidth: 280
        }}>
          {isImage(f.type) ? <PictureOutlined style={{ color: '#4e8ff0' }} /> : <FileOutlined style={{ color: '#999' }} />}
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{f.name}</span>
          <span style={{ color: '#666', flexShrink: 0 }}>{formatSize(f.size)}</span>
          {isOutput && f.path && (
            <a href={getFileUrl(f.path)} target="_blank" rel="noreferrer"
              style={{ color: 'var(--figma-blue)', flexShrink: 0 }}>
              <DownloadOutlined />
            </a>
          )}
        </div>
      ))}
    </div>
  );

  // 渲染图片预览
  const renderImagePreview = (files: ChatFile[]) => {
    const images = files.filter(f => isImage(f.type) && f.path);
    if (images.length === 0) return null;
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
        {images.map((f, i) => (
          <a key={i} href={getFileUrl(f.path)} target="_blank" rel="noreferrer">
            <img src={getFileUrl(f.path)} alt={f.name}
              style={{ maxWidth: 300, maxHeight: 200, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </a>
        ))}
      </div>
    );
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="figma-panel" style={{ marginBottom: 16 }}>
        <div className="figma-panel-header" style={{
          background: 'linear-gradient(135deg, rgba(78, 143, 240, 0.12) 0%, rgba(78, 143, 240, 0.04) 100%)',
          borderBottom: '1px solid rgba(78, 143, 240, 0.2)'
        }}>
          <div className="figma-panel-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: 16 }}>💬</span>
            对话中心
            <span style={{
              width: 8, height: 8, borderRadius: '50%',
              background: '#1bc47d', display: 'inline-block',
              boxShadow: '0 0 6px rgba(27, 196, 125, 0.5)'
            }} />
            {lastSync > 0 && (
              <span style={{ fontSize: 10, color: '#666', marginLeft: 4 }}>
                已同步 {Math.floor((Date.now() - lastSync) / 1000)}s 前
              </span>
            )}
          </div>
          <button className="figma-button figma-button-secondary" onClick={clearChat}
            style={{ fontSize: 12, padding: '4px 12px' }}>清空对话</button>
        </div>
      </div>

      <div className="figma-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        {/* 消息区域 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: 'var(--space-4)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
          {messages.length === 0 ? (
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
              <span style={{ fontSize: 48 }}>🦞</span>
              <div style={{ color: '#999', fontSize: 14 }}>开始与 OpenClaw 对话</div>
              <div style={{ color: '#666', fontSize: 12 }}>支持文字、图片、文档等多种格式输入输出</div>
            </div>
          ) : (
            messages.map(msg => (
              <div key={msg.id} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '75%', padding: 'var(--space-3)',
                  borderRadius: msg.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: msg.role === 'user' ? 'var(--figma-blue)' : 'var(--bg-tertiary)',
                  color: msg.role === 'user' ? '#ffffff' : '#e5e5e5',
                  border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none'
                }}>
                  {msg.content && (
                    <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                      {msg.content}
                    </div>
                  )}
                  {msg.files && msg.files.length > 0 && renderFiles(msg.files)}
                  {msg.outputFiles && msg.outputFiles.length > 0 && (
                    <>
                      {renderFiles(msg.outputFiles, true)}
                      {renderImagePreview(msg.outputFiles)}
                    </>
                  )}
                  <div style={{
                    fontSize: 10, marginTop: 6,
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.6)' : '#666'
                  }}>
                    {msg.role === 'user' ? '👤' : '🤖'} {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                  </div>
                </div>
              </div>
            ))
          )}
          {loading && (
            <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
              <div style={{
                padding: 'var(--space-3)', borderRadius: 'var(--radius-md)',
                background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)',
                display: 'flex', alignItems: 'center', gap: 6
              }}>
                <span style={{ fontSize: 12, color: '#999' }}>🤖 思考中</span>
                <span style={{ display: 'inline-flex', gap: 3 }}>
                  {[0, 1, 2].map(i => (
                    <span key={i} style={{
                      width: 6, height: 6, borderRadius: '50%', background: 'var(--figma-blue)',
                      animation: `pulse 1.4s ease-in-out ${i * 0.2}s infinite`
                    }} />
                  ))}
                </span>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* 待上传文件预览 */}
        {pendingFiles.length > 0 && (
          <div style={{
            padding: '8px var(--space-4)', borderTop: '1px solid var(--border-subtle)',
            background: 'var(--bg-primary)', display: 'flex', flexWrap: 'wrap', gap: 6
          }}>
            {pendingFiles.map((f, i) => (
              <div key={i} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '3px 8px', borderRadius: 'var(--radius-sm)',
                background: 'rgba(78, 143, 240, 0.1)', border: '1px solid rgba(78, 143, 240, 0.2)',
                fontSize: 11, color: '#ccc'
              }}>
                <FileOutlined style={{ fontSize: 12, color: '#4e8ff0' }} />
                <span style={{ maxWidth: 150, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
                <span style={{ color: '#666' }}>{formatSize(f.size)}</span>
                <button onClick={() => removePendingFile(i)}
                  style={{ background: 'none', border: 'none', color: '#999', cursor: 'pointer', padding: 0, lineHeight: 1 }}>
                  <DeleteOutlined style={{ fontSize: 10 }} />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* 输入区域 */}
        <div style={{ padding: 'var(--space-3) var(--space-4)', borderTop: '1px solid var(--border-subtle)', background: 'var(--bg-secondary)' }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'flex-end' }}>
            <input type="file" ref={fileInputRef} multiple onChange={handleFileSelect}
              accept="image/*,.pdf,.csv,.xlsx,.json,.txt,.md,.html,.py,.js,.ts,.zip,.docx"
              style={{ display: 'none' }} />
            <button onClick={() => fileInputRef.current?.click()} disabled={loading}
              style={{
                background: 'none', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                color: pendingFiles.length > 0 ? 'var(--figma-blue)' : '#999', cursor: 'pointer',
                padding: '8px 10px', transition: 'all 0.2s', flexShrink: 0
              }}
              title="上传文件">
              <PaperClipOutlined style={{ fontSize: 16 }} />
            </button>
            <textarea
              value={input} onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              disabled={loading}
              style={{
                flex: 1, padding: '8px 12px', background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)',
                color: '#ffffff', fontSize: 13, fontFamily: 'inherit',
                resize: 'none', minHeight: 44, maxHeight: 200, lineHeight: 1.5,
                outline: 'none'
              }}
            />
            <button onClick={handleSend}
              disabled={(!input.trim() && pendingFiles.length === 0) || loading}
              style={{
                background: loading ? 'var(--bg-tertiary)' : 'var(--figma-blue)',
                border: 'none', borderRadius: 'var(--radius-sm)',
                color: '#fff', cursor: loading ? 'not-allowed' : 'pointer',
                padding: '8px 16px', fontSize: 13, fontWeight: 500,
                transition: 'all 0.2s', flexShrink: 0, minWidth: 70
              }}>
              {loading ? '...' : <><SendOutlined style={{ marginRight: 4 }} />发送</>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
