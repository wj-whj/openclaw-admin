import {
  DashboardOutlined,
  SettingOutlined,
  MessageOutlined,
} from '@ant-design/icons';

interface SidebarProps {
  currentPage: string;
  onPageChange: (page: string) => void;
}

export default function Sidebar({ currentPage, onPageChange }: SidebarProps) {
  const menuItems = [
    {
      key: 'monitor',
      icon: <DashboardOutlined />,
      label: '监控中心',
    },
    {
      key: 'manage',
      icon: <SettingOutlined />,
      label: '管理中心',
    },
    {
      key: 'chat',
      icon: <MessageOutlined />,
      label: '对话中心',
    },
  ];

  return (
    <div className="figma-sidebar">
      {/* Header */}
      <div className="figma-sidebar-header">
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 'var(--space-2)'
        }}>
          <div style={{
            width: 32,
            height: 32,
            background: 'linear-gradient(135deg, #a259ff 0%, #c77dff 100%)',
            borderRadius: 'var(--radius-md)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 16
          }}>
            🦞
          </div>
          <div>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--text-primary)'
            }}>
              OpenClaw
            </div>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <div className="figma-sidebar-nav">
        {menuItems.map(item => (
          <div
            key={item.key}
            className={`figma-sidebar-item ${currentPage === item.key ? 'active' : ''}`}
            onClick={() => onPageChange(item.key)}
          >
            <span className="figma-sidebar-item-icon">{item.icon}</span>
            <span>{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
