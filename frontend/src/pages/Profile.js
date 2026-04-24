import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const Profile = () => {
  const { user, updateUser } = useAuth();
  const { addToast } = useToast();
  const [formData, setFormData] = useState({ name: '', email: '' });
  const [passwordData, setPasswordData] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [errors, setErrors] = useState({});
  const [pwErrors, setPwErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

  useEffect(() => {
    if (user) setFormData({ name: user.name || '', email: user.email || '' });
  }, [user]);

  const validateProfile = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Name is required';
    if (!formData.email.trim()) errs.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) errs.email = 'Invalid email';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validatePassword = () => {
    const errs = {};
    if (!passwordData.currentPassword) errs.currentPassword = 'Current password is required';
    if (!passwordData.newPassword) errs.newPassword = 'New password is required';
    else if (passwordData.newPassword.length < 6) errs.newPassword = 'Min 6 characters';
    if (passwordData.newPassword !== passwordData.confirmPassword) errs.confirmPassword = 'Passwords do not match';
    setPwErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleProfileUpdate = async (e) => {
    e.preventDefault();
    if (!validateProfile()) return;
    setLoading(true);
    try {
      const res = await axios.put(`${API_URL}/auth/profile`, formData);
      if (updateUser) updateUser(res.data.user);
      addToast('Profile updated successfully', 'success');
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to update profile', 'error');
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    if (!validatePassword()) return;
    setPwLoading(true);
    try {
      await axios.put(`${API_URL}/auth/change-password`, {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword,
      });
      addToast('Password changed successfully', 'success');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to change password', 'error');
    } finally {
      setPwLoading(false);
    }
  };

  const fieldStyle = (errKey, errObj) => ({
    width: '100%', padding: '12px 14px', fontSize: '14px', color: '#fff', outline: 'none',
    background: 'rgba(255,255,255,0.05)', borderRadius: '8px',
    border: errObj[errKey] ? '1px solid #ef4444' : '1px solid rgba(59,130,246,0.3)',
  });

  return (
    <div style={{ maxWidth: '700px' }}>
      <p style={{ color: '#a1a1aa', fontSize: '14px', marginBottom: '24px' }}>Manage your account information</p>

      {/* Profile Section */}
      <div style={sectionStyle}>
        <h3 style={sectionTitle}>Profile Information</h3>
        <form onSubmit={handleProfileUpdate}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Full Name</label>
            <input value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} style={fieldStyle('name', errors)} />
            {errors.name && <span style={errStyle}>{errors.name}</span>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Email</label>
            <input type="email" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} style={fieldStyle('email', errors)} />
            {errors.email && <span style={errStyle}>{errors.email}</span>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Role</label>
            <input value={user?.role || ''} disabled style={{ ...fieldStyle('', {}), opacity: 0.5, cursor: 'not-allowed' }} />
            <span style={{ color: '#71717a', fontSize: '12px', marginTop: '4px', display: 'block' }}>Role can only be changed by an admin</span>
          </div>
          <button type="submit" disabled={loading} style={btnStyle(loading)}>
            {loading ? 'Saving...' : 'Update Profile'}
          </button>
        </form>
      </div>

      {/* Change Password Section */}
      <div style={{ ...sectionStyle, marginTop: '24px' }}>
        <h3 style={sectionTitle}>Change Password</h3>
        <form onSubmit={handlePasswordChange}>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Current Password</label>
            <input type="password" value={passwordData.currentPassword} onChange={e => setPasswordData({ ...passwordData, currentPassword: e.target.value })} style={fieldStyle('currentPassword', pwErrors)} />
            {pwErrors.currentPassword && <span style={errStyle}>{pwErrors.currentPassword}</span>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>New Password</label>
            <input type="password" value={passwordData.newPassword} onChange={e => setPasswordData({ ...passwordData, newPassword: e.target.value })} style={fieldStyle('newPassword', pwErrors)} />
            {pwErrors.newPassword && <span style={errStyle}>{pwErrors.newPassword}</span>}
          </div>
          <div style={{ marginBottom: '16px' }}>
            <label style={labelStyle}>Confirm New Password</label>
            <input type="password" value={passwordData.confirmPassword} onChange={e => setPasswordData({ ...passwordData, confirmPassword: e.target.value })} style={fieldStyle('confirmPassword', pwErrors)} />
            {pwErrors.confirmPassword && <span style={errStyle}>{pwErrors.confirmPassword}</span>}
          </div>
          <button type="submit" disabled={pwLoading} style={btnStyle(pwLoading)}>
            {pwLoading ? 'Changing...' : 'Change Password'}
          </button>
        </form>
      </div>
    </div>
  );
};

const sectionStyle = {
  background: 'rgba(26,26,46,0.6)', borderRadius: '12px',
  border: '1px solid rgba(59,130,246,0.2)', padding: '24px',
};
const sectionTitle = { color: '#fff', fontSize: '18px', fontWeight: '600', marginBottom: '20px' };
const labelStyle = { display: 'block', color: '#a1a1aa', fontSize: '13px', fontWeight: '500', marginBottom: '6px' };
const errStyle = { color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' };
const btnStyle = (loading) => ({
  padding: '12px 24px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
  border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px',
  fontWeight: '500', cursor: 'pointer', opacity: loading ? 0.7 : 1,
});

export default Profile;
