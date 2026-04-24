import React from 'react';
import { useAuth } from '../context/AuthContext';

const Settings = () => {
  const { user } = useAuth();

  return (
    <div style={{ maxWidth: '700px' }}>
      <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '24px' }}>Account settings and preferences</p>

      {/* Account Info */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Account Information</h3>
        <div style={infoGrid}>
          <div style={infoItem}><span style={infoLabel}>Name</span><span style={infoValue}>{user?.name || '-'}</span></div>
          <div style={infoItem}><span style={infoLabel}>Email</span><span style={infoValue}>{user?.email || '-'}</span></div>
          <div style={infoItem}><span style={infoLabel}>Role</span><span style={infoValue}>{user?.role || '-'}</span></div>
          <div style={infoItem}><span style={infoLabel}>User ID</span><span style={infoValue}>{user?.id || '-'}</span></div>
        </div>
      </div>

      {/* Permissions */}
      <div style={{ ...sectionStyle, marginTop: '24px' }}>
        <h3 style={sectionTitle}>Role Permissions</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {[
            { perm: 'View Data', roles: ['admin', 'analyst', 'partner'] },
            { perm: 'Create Records', roles: ['admin', 'analyst'] },
            { perm: 'Edit Records', roles: ['admin', 'analyst'] },
            { perm: 'Delete Records', roles: ['admin'] },
            { perm: 'AI Analysis', roles: ['admin', 'analyst', 'partner'] },
            { perm: 'Export Data', roles: ['admin', 'analyst'] },
            { perm: 'Manage Users', roles: ['admin'] },
            { perm: 'Bulk Operations', roles: ['admin'] },
          ].map(p => (
            <div key={p.perm} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 16px', background: 'rgba(255,255,255,0.03)', borderRadius: '8px',
            }}>
              <span style={{ color: '#e4e4e7', fontSize: '14px' }}>{p.perm}</span>
              <span style={{
                padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
                background: p.roles.includes(user?.role) ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.2)',
                color: p.roles.includes(user?.role) ? '#10b981' : '#ef4444',
              }}>{p.roles.includes(user?.role) ? 'Allowed' : 'Denied'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Session */}
      <div style={{ ...sectionStyle, marginTop: '24px' }}>
        <h3 style={sectionTitle}>Session Information</h3>
        <div style={infoGrid}>
          <div style={infoItem}>
            <span style={infoLabel}>Token Status</span>
            <span style={{ ...infoValue, color: '#10b981' }}>Active</span>
          </div>
          <div style={infoItem}>
            <span style={infoLabel}>Session Duration</span>
            <span style={infoValue}>24 hours</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const sectionStyle = { background: 'rgba(26,26,46,0.6)', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)', padding: '24px' };
const sectionTitle = { color: '#fff', fontSize: '18px', fontWeight: '600', marginBottom: '20px' };
const infoGrid = { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' };
const infoItem = { display: 'flex', flexDirection: 'column', gap: '4px' };
const infoLabel = { color: '#a1a1aa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' };
const infoValue = { color: '#fff', fontSize: '16px', fontWeight: '500' };

export default Settings;
