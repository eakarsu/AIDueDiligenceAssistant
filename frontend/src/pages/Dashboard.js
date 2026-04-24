import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';

const dashboardCards = [
  { title: 'Companies', path: '/companies', icon: '🏢', color: '#3b82f6', desc: 'Track target companies', statKey: 'totalCompanies' },
  { title: 'Financial Analysis', path: '/financials', icon: '💰', color: '#10b981', desc: 'Review financial metrics', statKey: 'financials' },
  { title: 'News Monitoring', path: '/news', icon: '📰', color: '#f59e0b', desc: 'Track market news', statKey: 'news' },
  { title: 'Risk Assessment', path: '/risks', icon: '⚠️', color: '#ef4444', desc: 'Evaluate deal risks', statKey: 'openRisks' },
  { title: 'Red Flags', path: '/redflags', icon: '🚩', color: '#dc2626', desc: 'Identify warning signs', statKey: 'activeRedFlags' },
  { title: 'Market Analysis', path: '/market', icon: '📈', color: '#8b5cf6', desc: 'Market positioning', statKey: 'marketAnalysis' },
  { title: 'Competitive Intel', path: '/competitors', icon: '🎯', color: '#06b6d4', desc: 'Competitor analysis', statKey: 'competitors' },
  { title: 'Legal & Compliance', path: '/legal', icon: '⚖️', color: '#6366f1', desc: 'Legal review status', statKey: 'legalIssues' },
  { title: 'Management', path: '/management', icon: '👥', color: '#ec4899', desc: 'Leadership assessment', statKey: 'executives' },
  { title: 'Deal Pipeline', path: '/deals', icon: '🤝', color: '#14b8a6', desc: 'Track active deals', statKey: 'activeDeals' },
];

const aiFeatureCards = [
  { title: 'AI Risk Scorer', path: '/risk-scorer', icon: '🎲', color: '#f43f5e', desc: 'Quantify deal risks automatically', gradient: 'linear-gradient(135deg, #f43f5e, #ec4899)', statKey: 'riskScores' },
  { title: 'AI Synergy Calculator', path: '/synergy-calculator', icon: '🔗', color: '#8b5cf6', desc: 'Estimate merger synergies', gradient: 'linear-gradient(135deg, #8b5cf6, #6366f1)', statKey: 'synergyCalculations' },
  { title: 'AI Valuation Modeler', path: '/valuation-modeler', icon: '💎', color: '#0ea5e9', desc: 'Multiple valuation methods', gradient: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', statKey: 'valuationModels' },
  { title: 'AI Red Flag Detector', path: '/red-flag-detector', icon: '🔴', color: '#ef4444', desc: 'Identify deal breakers', gradient: 'linear-gradient(135deg, #ef4444, #dc2626)', statKey: 'redFlagDetections' },
  { title: 'AI Integration Planner', path: '/integration-planner', icon: '🗺️', color: '#10b981', desc: 'Post-merger roadmap', gradient: 'linear-gradient(135deg, #10b981, #059669)', statKey: 'integrationPlans' },
];

const Dashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState({
    totalCompanies: 0, activeDeals: 0, openRisks: 0, activeRedFlags: 0,
    riskScores: 0, synergyCalculations: 0, valuationModels: 0,
    redFlagDetections: 0, integrationPlans: 0,
    financials: 0, news: 0, marketAnalysis: 0, competitors: 0,
    legalIssues: 0, executives: 0,
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/dashboard/stats`);
        setStats(response.data);
      } catch (error) {
        console.error('Error fetching stats:', error);
      }
    };
    fetchStats();
  }, []);

  return (
    <div style={styles.container}>
      {/* Stats Row */}
      <div style={styles.statsRow}>
        <div style={styles.statCard} onClick={() => navigate('/companies')}>
          <div style={styles.statIcon}>🏢</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{stats.totalCompanies}</span>
            <span style={styles.statLabel}>Total Companies</span>
          </div>
        </div>
        <div style={styles.statCard} onClick={() => navigate('/deals')}>
          <div style={styles.statIcon}>🤝</div>
          <div style={styles.statInfo}>
            <span style={styles.statValue}>{stats.activeDeals}</span>
            <span style={styles.statLabel}>Active Deals</span>
          </div>
        </div>
        <div style={styles.statCard} onClick={() => navigate('/risks')}>
          <div style={{ ...styles.statIcon, background: 'rgba(239, 68, 68, 0.2)' }}>⚠️</div>
          <div style={styles.statInfo}>
            <span style={{ ...styles.statValue, color: '#ef4444' }}>{stats.openRisks}</span>
            <span style={styles.statLabel}>Open Risks</span>
          </div>
        </div>
        <div style={styles.statCard} onClick={() => navigate('/redflags')}>
          <div style={{ ...styles.statIcon, background: 'rgba(220, 38, 38, 0.2)' }}>🚩</div>
          <div style={styles.statInfo}>
            <span style={{ ...styles.statValue, color: '#dc2626' }}>{stats.activeRedFlags}</span>
            <span style={styles.statLabel}>Active Red Flags</span>
          </div>
        </div>
      </div>

      {/* AI Features Section */}
      <div style={styles.aiSection}>
        <div style={styles.aiSectionHeader}>
          <h2 style={styles.sectionTitle}>AI-Powered Features</h2>
          <span style={styles.aiBadge}>NEW</span>
        </div>
        <p style={styles.aiSubtitle}>Advanced AI analysis powered by Claude for intelligent due diligence</p>
        <div style={styles.aiCardGrid}>
          {aiFeatureCards.map((card) => (
            <div
              key={card.path}
              style={styles.aiCard}
              onClick={() => navigate(card.path)}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-6px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 20px 40px rgba(139, 92, 246, 0.3)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.2)';
              }}
            >
              <div style={{ ...styles.aiCardIcon, background: card.gradient }}>
                {card.icon}
              </div>
              <div style={styles.aiCardContent}>
                <h3 style={styles.aiCardTitle}>{card.title}</h3>
                <p style={styles.aiCardDesc}>{card.desc}</p>
              </div>
              <div style={styles.aiCardCount}>{stats[card.statKey] || 0}</div>
              <div style={styles.aiCardArrow}>→</div>
            </div>
          ))}
        </div>
      </div>

      {/* AI Stats Row */}
      <div style={styles.aiStatsRow}>
        {aiFeatureCards.map(card => (
          <div key={card.path} style={styles.aiStatCard} onClick={() => navigate(card.path)}>
            <span style={styles.aiStatIcon}>{card.icon}</span>
            <span style={styles.aiStatValue}>{stats[card.statKey] || 0}</span>
            <span style={styles.aiStatLabel}>{card.title.replace('AI ', '')}</span>
          </div>
        ))}
      </div>

      {/* Feature Cards */}
      <h2 style={styles.sectionTitle}>Due Diligence Modules</h2>
      <div style={styles.cardGrid}>
        {dashboardCards.map((card) => (
          <div
            key={card.path}
            style={styles.card}
            onClick={() => navigate(card.path)}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)';
              e.currentTarget.style.borderColor = card.color;
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.2)';
            }}
          >
            <div style={{ ...styles.cardIcon, background: `${card.color}20` }}>
              {card.icon}
            </div>
            <div style={styles.cardContent}>
              <h3 style={styles.cardTitle}>{card.title}</h3>
              <p style={styles.cardDesc}>{card.desc}</p>
            </div>
            {stats[card.statKey] !== undefined && (
              <div style={styles.cardCount}>{stats[card.statKey]}</div>
            )}
            <div style={styles.cardArrow}>→</div>
          </div>
        ))}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '8px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '32px' },
  statCard: {
    display: 'flex', alignItems: 'center', gap: '16px', padding: '20px',
    background: 'rgba(26, 26, 46, 0.6)', borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer',
    transition: 'all 0.2s ease',
  },
  statIcon: { width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(59, 130, 246, 0.2)', borderRadius: '12px', fontSize: '24px' },
  statInfo: { display: 'flex', flexDirection: 'column' },
  statValue: { fontSize: '28px', fontWeight: '700', color: '#fff' },
  statLabel: { fontSize: '13px', color: '#a1a1aa' },
  aiSection: { marginBottom: '32px', padding: '24px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))', borderRadius: '16px', border: '1px solid rgba(139, 92, 246, 0.3)' },
  aiSectionHeader: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' },
  aiBadge: { fontSize: '11px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)', color: '#fff', padding: '4px 10px', borderRadius: '12px', fontWeight: '600' },
  aiSubtitle: { color: '#a1a1aa', fontSize: '14px', marginBottom: '20px' },
  aiCardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  aiCard: { display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(26, 26, 46, 0.8)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.3)', cursor: 'pointer', transition: 'all 0.3s ease', boxShadow: '0 8px 24px rgba(0, 0, 0, 0.2)' },
  aiCardIcon: { width: '54px', height: '54px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontSize: '26px', flexShrink: 0 },
  aiCardContent: { flex: 1 },
  aiCardTitle: { fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '4px' },
  aiCardDesc: { fontSize: '13px', color: '#a1a1aa' },
  aiCardCount: { fontSize: '20px', fontWeight: '700', color: '#8b5cf6', padding: '4px 10px', background: 'rgba(139,92,246,0.1)', borderRadius: '8px' },
  aiCardArrow: { fontSize: '20px', color: '#8b5cf6' },
  aiStatsRow: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '32px' },
  aiStatCard: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.2)', cursor: 'pointer', transition: 'all 0.2s ease' },
  aiStatIcon: { fontSize: '24px', marginBottom: '8px' },
  aiStatValue: { fontSize: '24px', fontWeight: '700', color: '#8b5cf6' },
  aiStatLabel: { fontSize: '11px', color: '#a1a1aa', textAlign: 'center' },
  sectionTitle: { fontSize: '20px', fontWeight: '600', color: '#fff', marginBottom: '20px' },
  cardGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '16px' },
  card: { display: 'flex', alignItems: 'center', gap: '16px', padding: '20px', background: 'rgba(26, 26, 46, 0.6)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', cursor: 'pointer', transition: 'all 0.2s ease' },
  cardIcon: { width: '50px', height: '50px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', fontSize: '24px', flexShrink: 0 },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: '16px', fontWeight: '600', color: '#fff', marginBottom: '4px' },
  cardDesc: { fontSize: '13px', color: '#a1a1aa' },
  cardCount: { fontSize: '18px', fontWeight: '700', color: '#3b82f6', padding: '4px 10px', background: 'rgba(59,130,246,0.1)', borderRadius: '8px' },
  cardArrow: { fontSize: '20px', color: '#3b82f6' },
};

export default Dashboard;
