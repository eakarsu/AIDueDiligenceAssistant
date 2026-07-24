import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetMode, setResetMode] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetMsg, setResetMsg] = useState('');
  const { login, requestPasswordReset } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const result = await login(email, password);
    if (result.success) {
      navigate('/');
    } else {
      setError(result.error);
    }
    setLoading(false);
  };

  const handleResetRequest = async (e) => {
    e.preventDefault();
    setLoading(true);
    const result = await requestPasswordReset(resetEmail);
    if (result.success) {
      setResetMsg(result.message || 'If that email exists, a reset link has been sent.');
    } else {
      setResetMsg(result.error);
    }
    setLoading(false);
  };

  return (
    <div style={styles.container}>
      <div style={styles.loginCard}>
        <div style={styles.header}>
          <div style={styles.logoContainer}>
            <span style={styles.logoIcon}>🔍</span>
            <h1 style={styles.title}>AI Due Diligence</h1>
          </div>
          <p style={styles.subtitle}>M&A Analysis Platform</p>
        </div>

        {resetMode ? (
          <form onSubmit={handleResetRequest} style={styles.form}>
            <h3 style={{ color: '#fff', fontSize: '18px', textAlign: 'center', marginBottom: '8px' }}>Reset Password</h3>
            <p style={{ color: '#a1a1aa', fontSize: '13px', textAlign: 'center', marginBottom: '16px' }}>Enter your email to receive a reset link</p>
            {resetMsg && <div style={{ ...styles.error, background: 'rgba(59,130,246,0.1)', borderColor: 'rgba(59,130,246,0.3)', color: '#3b82f6' }}>{resetMsg}</div>}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} style={styles.input} placeholder="Enter your email" required />
            </div>
            <button
              type="button"
              onClick={() => { setEmail(process.env.REACT_APP_DEMO_EMAIL || ''); setPassword(process.env.REACT_APP_DEMO_PASSWORD || ''); }}
              disabled={!process.env.REACT_APP_DEMO_EMAIL || !process.env.REACT_APP_DEMO_PASSWORD}
              aria-label="Auto Fill Demo Credentials"
              style={{ width: '100%', marginBottom: '12px', padding: '10px 14px', borderRadius: '8px', border: '1px solid currentColor', background: 'transparent', cursor: 'pointer' }}
            >
              Auto Fill Demo Credentials
            </button>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Link'}
            </button>
            <button type="button" onClick={() => { setResetMode(false); setResetMsg(''); }} style={{ ...styles.demoBtn, marginTop: '0' }}>
              Back to Login
            </button>
          </form>
        ) : (
          <form onSubmit={handleSubmit} style={styles.form}>
            {error && <div style={styles.error}>{error}</div>}
            <div style={styles.inputGroup}>
              <label style={styles.label}>Email</label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} style={styles.input} placeholder="Enter your email" required />
            </div>
            <div style={styles.inputGroup}>
              <label style={styles.label}>Password</label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} style={styles.input} placeholder="Enter your password" required />
            </div>
            <div style={{ textAlign: 'right' }}>
              <span onClick={() => setResetMode(true)} style={{ color: '#3b82f6', fontSize: '13px', cursor: 'pointer' }}>Forgot Password?</span>
            </div>
            <button type="submit" style={styles.submitBtn} disabled={loading}>
              {loading ? (
                <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                  <span style={{ display: 'inline-block', width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                  Signing in...
                </span>
              ) : 'Sign In'}
            </button>
          </form>
        )}

        <div style={styles.footer}>
          <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '12px' }}>
            Don't have an account? <span onClick={() => navigate('/register')} style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: '600' }}>Sign Up</span>
          </p>
          <p style={styles.footerText}>Authorized evidence review with matter isolation and professional sign-off</p>
        </div>
      </div>

      <div style={styles.features}>
        <h2 style={styles.featuresTitle}>Platform Features</h2>
        <div style={styles.featureGrid}>
          {[
            { icon: '📊', label: 'Financial Analysis' }, { icon: '📰', label: 'News Monitoring' },
            { icon: '⚠️', label: 'Risk Assessment' }, { icon: '🚩', label: 'Red Flag Detection' },
            { icon: '🤖', label: 'AI-Powered Insights' }, { icon: '🤝', label: 'Deal Pipeline' },
          ].map(f => (
            <div key={f.label} style={styles.featureItem}>
              <span style={styles.featureIcon}>{f.icon}</span>
              <span>{f.label}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const styles = {
  container: { minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px', gap: '60px' },
  loginCard: { background: 'rgba(26, 26, 46, 0.9)', borderRadius: '16px', padding: '40px', width: '100%', maxWidth: '420px', border: '1px solid rgba(59, 130, 246, 0.3)', boxShadow: '0 20px 60px rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(10px)' },
  header: { textAlign: 'center', marginBottom: '32px' },
  logoContainer: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '12px', marginBottom: '8px' },
  logoIcon: { fontSize: '40px' },
  title: { fontSize: '28px', fontWeight: '700', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' },
  subtitle: { color: '#a1a1aa', fontSize: '14px' },
  form: { display: 'flex', flexDirection: 'column', gap: '20px' },
  error: { background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '14px', textAlign: 'center' },
  inputGroup: { display: 'flex', flexDirection: 'column', gap: '8px' },
  label: { color: '#a1a1aa', fontSize: '14px', fontWeight: '500' },
  input: { padding: '14px 16px', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#fff', fontSize: '16px', outline: 'none' },
  submitBtn: { padding: '14px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '16px', fontWeight: '600', cursor: 'pointer', marginTop: '8px' },
  demoBtn: { padding: '14px', background: 'transparent', border: '2px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#3b82f6', fontSize: '16px', fontWeight: '600', cursor: 'pointer' },
  footer: { marginTop: '24px', textAlign: 'center' },
  footerText: { color: '#71717a', fontSize: '12px' },
  features: { maxWidth: '400px' },
  featuresTitle: { color: '#fff', fontSize: '24px', fontWeight: '600', marginBottom: '24px' },
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' },
  featureItem: { display: 'flex', alignItems: 'center', gap: '12px', padding: '16px', background: 'rgba(26, 26, 46, 0.6)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)', color: '#e4e4e7', fontSize: '14px' },
  featureIcon: { fontSize: '24px' },
};

export default Login;
