import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import MonitorPage from './components/MonitorPage';
import ManagePage from './components/ManagePage';
import ChatPage from './components/ChatPage';
import TeamPage from './components/TeamPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('monitor');
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    return (localStorage.getItem('theme') as 'dark' | 'light') || 'dark';
  });

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token === 'wj12345') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (theme === 'light') {
      document.documentElement.dataset.theme = 'light';
    } else {
      delete document.documentElement.dataset.theme;
    }
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  const handleLogin = (token: string) => {
    setIsAuthenticated(true);
  };

  const handleLogout = () => {
    localStorage.removeItem('auth_token');
    setIsAuthenticated(false);
  };

  const renderPage = () => {
    switch (currentPage) {
      case 'monitor':
        return <MonitorPage />;
      case 'team':
        return <TeamPage />;
      case 'manage':
        return <ManagePage />;
      case 'chat':
        return <ChatPage />;
      default:
        return <MonitorPage />;
    }
  };

  const pageTitle = {
    monitor: '监控中心',
    team: '团队状态',
    manage: '管理中心',
    chat: '对话中心'
  }[currentPage];

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: 'var(--bg-primary)',
        fontSize: 12,
        color: 'var(--text-secondary)'
      }}>
        加载中...
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Login onLogin={handleLogin} />;
  }

  return (
    <div style={{ 
      display: 'flex',
      width: '100vw',
      height: '100vh',
      background: 'var(--bg-primary)',
      overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
        theme={theme}
        onToggleTheme={toggleTheme}
      />

      {/* Main Content */}
      <div style={{ 
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        width: 'calc(100vw - 240px)'
      }}>
        {/* Toolbar */}
        <div className="figma-toolbar">
          <div className="figma-toolbar-title">
            {pageTitle}
          </div>
          
          <div className="figma-toolbar-actions">
            <Button
              icon={<LogoutOutlined />}
              onClick={handleLogout}
              className="figma-btn figma-btn-ghost"
            >
              退出
            </Button>
          </div>
        </div>

        {/* Page Content */}
        <div style={{
          flex: 1,
          overflow: currentPage === 'chat' ? 'hidden' : 'auto',
          padding: currentPage === 'chat' ? 0 : 'var(--space-4)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div className="fade-in-up" style={currentPage === 'chat' ? { height: '100%', display: 'flex', flexDirection: 'column' } : undefined}>
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
