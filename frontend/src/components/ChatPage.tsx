import { useState, useRef, useEffect } from 'react';
import { sendChatMessage } from '../services/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
      timestamp: Date.now()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      const response = await sendChatMessage(input.trim());
      const assistantMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.reply,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: '抱歉，发送消息失败。请检查后端连接。',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const clearChat = () => {
    setMessages([]);
  };

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div className="figma-panel" style={{ marginBottom: 16 }}>
        <div className="figma-panel-header">
          <div className="figma-panel-title">对话中心</div>
          <button className="figma-button figma-button-secondary" onClick={clearChat}>
            清空对话
          </button>
        </div>
      </div>

      <div className="figma-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 }}>
        <div style={{
          flex: 1,
          overflowY: 'auto',
          padding: 'var(--space-4)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--space-3)'
        }}>
          {messages.length === 0 ? (
            <div style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#999',
              fontSize: 14
            }}>
              开始与 OpenClaw 对话...
            </div>
          ) : (
            messages.map(msg => (
              <div
                key={msg.id}
                style={{
                  display: 'flex',
                  justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                }}
              >
                <div
                  style={{
                    maxWidth: '70%',
                    padding: 'var(--space-3)',
                    borderRadius: 'var(--radius-md)',
                    background: msg.role === 'user' ? 'var(--figma-blue)' : 'var(--bg-tertiary)',
                    color: msg.role === 'user' ? '#ffffff' : '#e5e5e5',
                    border: msg.role === 'assistant' ? '1px solid var(--border-subtle)' : 'none'
                  }}
                >
                  <div style={{ fontSize: 13, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>
                    {msg.content}
                  </div>
                  <div style={{
                    fontSize: 11,
                    color: msg.role === 'user' ? 'rgba(255,255,255,0.7)' : '#999',
                    marginTop: 'var(--space-2)'
                  }}>
                    {new Date(msg.timestamp).toLocaleTimeString('zh-CN', { hour12: false })}
                  </div>
                </div>
              </div>
            ))
          )}
          <div ref={messagesEndRef} />
        </div>

        <div style={{
          padding: 'var(--space-4)',
          borderTop: '1px solid var(--border-subtle)',
          background: 'var(--bg-secondary)'
        }}>
          <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="输入消息... (Enter 发送, Shift+Enter 换行)"
              disabled={loading}
              style={{
                flex: 1,
                padding: 'var(--space-3)',
                background: 'var(--bg-primary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-sm)',
                color: '#ffffff',
                fontSize: 13,
                fontFamily: 'inherit',
                resize: 'none',
                minHeight: 60,
                maxHeight: 200
              }}
            />
            <button
              className="figma-button figma-button-primary"
              onClick={handleSend}
              disabled={!input.trim() || loading}
              style={{ alignSelf: 'flex-end', minWidth: 80 }}
            >
              {loading ? '发送中...' : '发送'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
