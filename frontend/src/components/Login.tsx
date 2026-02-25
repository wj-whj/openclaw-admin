import { useState } from 'react';
import { Form, Input, Button, message } from 'antd';
import { LockOutlined } from '@ant-design/icons';

interface LoginProps {
  onLogin: (token: string) => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [loading, setLoading] = useState(false);

  const handleLogin = async (values: { password: string }) => {
    setLoading(true);
    
    if (values.password === 'wj12345') {
      message.success('登录成功');
      localStorage.setItem('auth_token', 'wj12345');
      setTimeout(() => onLogin('wj12345'), 500);
    } else {
      message.error('密码错误');
    }
    
    setLoading(false);
  };

  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      minHeight: '100vh',
      background: 'var(--bg-primary)',
      padding: '20px'
    }}>
      <div className="figma-card fade-in-up glow-purple" style={{ 
        width: '100%',
        maxWidth: 380,
        padding: 'var(--space-8)'
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{
            width: 64,
            height: 64,
            margin: '0 auto var(--space-4)',
            background: 'linear-gradient(135deg, #a259ff 0%, #c77dff 100%)',
            borderRadius: 'var(--radius-xl)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 32,
            boxShadow: '0 8px 32px rgba(162, 89, 255, 0.4)'
          }}>
            🦞
          </div>
          <h1 style={{ 
            fontSize: 24,
            fontWeight: 600,
            margin: '0 0 var(--space-2) 0',
            color: 'var(--text-primary)',
            background: 'linear-gradient(135deg, #a259ff 0%, #c77dff 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}>
            OpenClaw Admin
          </h1>
          <p style={{ 
            fontSize: 13,
            color: 'var(--text-secondary)',
            margin: 0
          }}>
            登录以继续管理
          </p>
        </div>

        {/* Login Form */}
        <Form
          name="login"
          onFinish={handleLogin}
          autoComplete="off"
          layout="vertical"
        >
          <Form.Item
            label={<span style={{ fontSize: 12, fontWeight: 500, color: 'var(--text-secondary)' }}>密码</span>}
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined style={{ color: 'var(--text-tertiary)', fontSize: 14 }} />}
              placeholder="输入密码"
              autoFocus
              className="figma-input"
              style={{ height: 40 }}
            />
          </Form.Item>

          <Form.Item style={{ marginBottom: 0, marginTop: 'var(--space-6)' }}>
            <Button 
              type="primary" 
              htmlType="submit" 
              loading={loading}
              block
              className="figma-btn figma-btn-primary"
              style={{ height: 40, fontSize: 13 }}
            >
              {loading ? '登录中...' : '登录'}
            </Button>
          </Form.Item>
        </Form>

        {/* Hint */}
        <div style={{
          marginTop: 'var(--space-6)',
          padding: 'var(--space-3)',
          background: 'var(--bg-secondary)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 'var(--radius-md)',
          textAlign: 'center'
        }}>
          <p style={{ 
            fontSize: 11,
            color: 'var(--text-tertiary)',
            margin: 0
          }}>
            默认密码: <span style={{ color: 'var(--figma-purple)' }}>wj12345</span>
          </p>
        </div>
      </div>
    </div>
  );
}
