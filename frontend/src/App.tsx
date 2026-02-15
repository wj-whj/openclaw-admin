import { useState, useEffect } from 'react';
import { Button } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import Login from './components/Login';
import Sidebar from './components/Sidebar';
import MonitorPage from './components/MonitorPage';
import ManagePage from './components/ManagePage';
import ChannelsPage from './components/ChannelsPage';

function App() {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState('monitor');

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token === 'wj12345') {
      setIsAuthenticated(true);
    }
    setLoading(false);
  }, []);

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
      case 'manage':
        return <ManagePage />;
      case 'channels':
        return <ChannelsPage />;
      default:
        return <MonitorPage />;
    }
  };

  const pageTitle = {
    monitor: '监控中心',
    manage: '管理中心',
    channels: 'Channel 配置'
  }[currentPage];

  if (loading) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh',
        background: '#0d0d0d',
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
      background: '#0d0d0d',
      overflow: 'hidden'
    }}>
      {/* Sidebar */}
      <Sidebar 
        currentPage={currentPage} 
        onPageChange={setCurrentPage}
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
          overflow: 'auto',
          padding: 'var(--space-4)',
          width: '100%',
          boxSizing: 'border-box'
        }}>
          <div className="fade-in-up">
            {renderPage()}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
