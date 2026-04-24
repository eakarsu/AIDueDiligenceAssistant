import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';

const Register = () => {
  const [formData, setFormData] = useState({ name: '', email: '', password: '', confirmPassword: '', role: 'analyst' });
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    else if (formData.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email format';
    if (!formData.password) errs.password = 'Password is required';
    else if (formData.password.length < 6) errs.password = 'Password must be at least 6 characters';
    else if (!/(?=.*[A-Z])/.test(formData.password)) errs.password = 'Must include uppercase letter';
    else if (!/(?=.*[0-9])/.test(formData.password)) errs.password = 'Must include a number';
    if (formData.password !== formData.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setLoading(true);
    try {
      await axios.post(`${API_URL}/auth/register`, {
        name: formData.name, email: formData.email,
        password: formData.password, role: formData.role,
      });
      setSuccess('Registration successful! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (error) {
      setErrors({ form: error.response?.data?.error || 'Registration failed' });
    } finally {
      setLoading(false);
    }
  };

  const fieldStyle = (field) => ({
    padding: '14px 16px', width: '100%', fontSize: '16px', color: '#fff', outline: 'none',
    background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
    border: errors[field] ? '1px solid #ef4444' : '1px solid rgba(59,130,246,0.3)',
  });

  return (
    <div style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '20px' }}>
      <div style={{
        background: 'rgba(26,26,46,0.9)', borderRadius: '16px', padding: '40px',
        width: '100%', maxWidth: '480px', border: '1px solid rgba(59,130,246,0.3)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
      }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <h1 style={{
            fontSize: '28px', fontWeight: '700',
            background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Create Account</h1>
          <p style={{ color: '#a1a1aa', fontSize: '14px', marginTop: '8px' }}>Join the M&A Analysis Platform</p>
        </div>

        {errors.form && <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', color: '#ef4444', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>{errors.form}</div>}
        {success && <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981', padding: '12px', borderRadius: '8px', fontSize: '14px', marginBottom: '20px', textAlign: 'center' }}>{success}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Full Name <span style={{ color: '#ef4444' }}>*</span></label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={fieldStyle('name')} placeholder="Enter your full name" />
            {errors.name && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.name}</span>}
          </div>
          <div>
            <label style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Email <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={fieldStyle('email')} placeholder="Enter your email" />
            {errors.email && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.email}</span>}
          </div>
          <div>
            <label style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Role</label>
            <select value={formData.role} onChange={e => setFormData({ ...formData, role: e.target.value })} style={{ ...fieldStyle('role'), cursor: 'pointer' }}>
              <option value="analyst">Analyst</option>
              <option value="partner">Partner</option>
            </select>
          </div>
          <div>
            <label style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Password <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="password" value={formData.password} onChange={e => setFormData({ ...formData, password: e.target.value })} style={fieldStyle('password')} placeholder="Min 6 chars, 1 uppercase, 1 number" />
            {errors.password && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.password}</span>}
          </div>
          <div>
            <label style={{ color: '#a1a1aa', fontSize: '14px', fontWeight: '500', display: 'block', marginBottom: '6px' }}>Confirm Password <span style={{ color: '#ef4444' }}>*</span></label>
            <input type="password" value={formData.confirmPassword} onChange={e => setFormData({ ...formData, confirmPassword: e.target.value })} style={fieldStyle('confirmPassword')} placeholder="Re-enter your password" />
            {errors.confirmPassword && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{errors.confirmPassword}</span>}
          </div>
          <button type="submit" disabled={loading} style={{
            padding: '14px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
            border: 'none', borderRadius: '8px', color: '#fff', fontSize: '16px',
            fontWeight: '600', cursor: 'pointer', opacity: loading ? 0.7 : 1, marginTop: '8px',
          }}>{loading ? 'Creating Account...' : 'Create Account'}</button>
        </form>
        <p style={{ textAlign: 'center', marginTop: '20px', color: '#71717a', fontSize: '14px' }}>
          Already have an account? <span onClick={() => navigate('/login')} style={{ color: '#3b82f6', cursor: 'pointer', fontWeight: '500' }}>Sign In</span>
        </p>
      </div>
    </div>
  );
};

export default Register;
