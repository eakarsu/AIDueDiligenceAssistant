import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const menuItems = [
  { path: '/', label: 'Dashboard', icon: '📊' },
  { path: '/companies', label: 'Companies', icon: '🏢' },
  { path: '/financials', label: 'Financial Analysis', icon: '💰' },
  { path: '/news', label: 'News Monitoring', icon: '📰' },
  { path: '/risks', label: 'Risk Assessment', icon: '⚠️' },
  { path: '/redflags', label: 'Red Flags', icon: '🚩' },
  { path: '/market', label: 'Market Analysis', icon: '📈' },
  { path: '/competitors', label: 'Competitive Intel', icon: '🎯' },
  { path: '/legal', label: 'Legal & Compliance', icon: '⚖️' },
  { path: '/management', label: 'Management', icon: '👥' },
  { path: '/deals', label: 'Deal Pipeline', icon: '🤝' },
  { divider: true, label: 'AI Features' },
  { path: '/risk-scorer', label: 'AI Risk Scorer', icon: '🎲', isAI: true },
  { path: '/synergy-calculator', label: 'AI Synergy Calculator', icon: '🔗', isAI: true },
  { path: '/valuation-modeler', label: 'AI Valuation Modeler', icon: '💎', isAI: true },
  { path: '/red-flag-detector', label: 'AI Red Flag Detector', icon: '🔴', isAI: true },
  { path: '/integration-planner', label: 'AI Integration Planner', icon: '🗺️', isAI: true },
  { path: '/watchlist', label: 'Watchlist Alerts', icon: '🔔', isAI: true },
  { path: '/ai-tools', label: 'AI Deal Tools', icon: '🧠', isAI: true },
  { path: '/custom-views', label: 'DD Views', icon: '📐' },
  { divider: true, label: 'Account' },
  { path: '/profile', label: 'My Profile', icon: '👤' },
  { path: '/settings', label: 'Settings', icon: '⚙️' },
];

const Layout = ({ children }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <aside className="sidebar" style={{ ...styles.sidebar, width: sidebarOpen ? '280px' : '70px' }}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🔍</span>
          {sidebarOpen && <span style={styles.logoText}>Due Diligence AI</span>}
        </div>

        <nav style={styles.nav}>
          {menuItems.map((item, index) => {
            if (item.divider) {
              return sidebarOpen ? (
                <div key={index} style={styles.divider}>
                  <span style={styles.dividerText}>{item.label}</span>
                </div>
              ) : (
                <div key={index} style={styles.dividerLine}></div>
              );
            }
            return (
              <button
                key={item.path}
                onClick={() => navigate(item.path)}
                style={{
                  ...styles.navItem,
                  ...(location.pathname === item.path ? styles.navItemActive : {}),
                  ...(item.isAI ? styles.navItemAI : {}),
                }}
              >
                <span style={styles.navIcon}>{item.icon}</span>
                {sidebarOpen && <span style={styles.navLabel}>{item.label}</span>}
                {sidebarOpen && item.isAI && <span style={styles.aiBadge}>AI</span>}
              </button>
            );
          })}
        </nav>

        <div style={styles.sidebarFooter}>
          <button onClick={() => setSidebarOpen(!sidebarOpen)} style={styles.toggleBtn}>
            {sidebarOpen ? '◀' : '▶'}
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="main-content" style={{ ...styles.main, marginLeft: sidebarOpen ? '280px' : '70px' }}>
        {/* Header */}
        <header style={styles.header}>
          <div style={styles.headerLeft}>
            <h1 style={styles.pageTitle}>
              {menuItems.find((item) => item.path === location.pathname)?.label || 'Dashboard'}
            </h1>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.userInfo}>
              <span style={styles.userName}>{user?.name || 'User'}</span>
              <span style={styles.userRole}>{user?.role || 'Analyst'}</span>
            </div>
            <button onClick={handleLogout} style={styles.logoutBtn}>
              Logout
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main style={styles.content}>{children}</main>
      </div>
    </div>
  );
};

const styles = {
  container: {
    display: 'flex',
    minHeight: '100vh',
  },
  sidebar: {
    position: 'fixed',
    top: 0,
    left: 0,
    height: '100vh',
    background: 'rgba(26, 26, 46, 0.95)',
    borderRight: '1px solid rgba(59, 130, 246, 0.2)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s ease',
    zIndex: 1000,
    backdropFilter: 'blur(10px)',
  },
  logo: {
    display: 'flex',
    alignItems: 'center',
    padding: '20px',
    gap: '12px',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
  },
  logoIcon: {
    fontSize: '28px',
  },
  logoText: {
    fontSize: '18px',
    fontWeight: '700',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
  },
  nav: {
    flex: 1,
    padding: '16px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    overflowY: 'auto',
  },
  navItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '12px 16px',
    background: 'transparent',
    border: 'none',
    borderRadius: '8px',
    color: '#a1a1aa',
    cursor: 'pointer',
    transition: 'all 0.2s ease',
    textAlign: 'left',
    fontSize: '14px',
  },
  navItemActive: {
    background: 'linear-gradient(90deg, rgba(59, 130, 246, 0.2), rgba(139, 92, 246, 0.2))',
    color: '#fff',
    borderLeft: '3px solid #3b82f6',
  },
  navItemAI: {
    borderLeft: '2px solid rgba(139, 92, 246, 0.5)',
  },
  navIcon: {
    fontSize: '18px',
    width: '24px',
    textAlign: 'center',
  },
  navLabel: {
    fontWeight: '500',
    flex: 1,
  },
  aiBadge: {
    fontSize: '10px',
    background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
    color: '#fff',
    padding: '2px 6px',
    borderRadius: '4px',
    fontWeight: '600',
  },
  divider: {
    padding: '16px 16px 8px 16px',
    marginTop: '8px',
  },
  dividerText: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#6366f1',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  dividerLine: {
    height: '1px',
    background: 'rgba(99, 102, 241, 0.3)',
    margin: '12px 16px',
  },
  sidebarFooter: {
    padding: '16px',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
  },
  toggleBtn: {
    width: '100%',
    padding: '8px',
    background: 'rgba(59, 130, 246, 0.1)',
    border: '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '6px',
    color: '#3b82f6',
    cursor: 'pointer',
    fontSize: '14px',
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    transition: 'margin-left 0.3s ease',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '16px 32px',
    background: 'rgba(26, 26, 46, 0.8)',
    borderBottom: '1px solid rgba(59, 130, 246, 0.2)',
    backdropFilter: 'blur(10px)',
    position: 'sticky',
    top: 0,
    zIndex: 100,
  },
  headerLeft: {},
  pageTitle: {
    fontSize: '24px',
    fontWeight: '600',
    color: '#fff',
  },
  headerRight: {
    display: 'flex',
    alignItems: 'center',
    gap: '16px',
  },
  userInfo: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-end',
  },
  userName: {
    color: '#fff',
    fontWeight: '500',
    fontSize: '14px',
  },
  userRole: {
    color: '#a1a1aa',
    fontSize: '12px',
    textTransform: 'capitalize',
  },
  logoutBtn: {
    padding: '8px 16px',
    background: 'rgba(239, 68, 68, 0.1)',
    border: '1px solid rgba(239, 68, 68, 0.3)',
    borderRadius: '6px',
    color: '#ef4444',
    cursor: 'pointer',
    fontSize: '14px',
    transition: 'all 0.2s ease',
  },
  content: {
    flex: 1,
    padding: '24px 32px',
    overflowY: 'auto',
  },
};

export default Layout;
