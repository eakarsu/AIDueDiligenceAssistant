import React from 'react';

const ConfirmDialog = ({ isOpen, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onConfirm, onCancel, variant = 'danger' }) => {
  if (!isOpen) return null;

  const variants = {
    danger: { bg: 'linear-gradient(90deg, #ef4444, #dc2626)', color: '#fff' },
    warning: { bg: 'linear-gradient(90deg, #f59e0b, #d97706)', color: '#fff' },
    info: { bg: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', color: '#fff' },
  };
  const v = variants[variant] || variants.danger;

  return (
    <div style={{
      position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
      background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center',
      alignItems: 'center', zIndex: 3000, padding: '20px',
    }} onClick={onCancel}>
      <div style={{
        background: 'rgba(26, 26, 46, 0.98)', borderRadius: '16px',
        border: '1px solid rgba(59, 130, 246, 0.3)', padding: '28px',
        maxWidth: '440px', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)',
      }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          <span style={{
            width: '40px', height: '40px', borderRadius: '10px', display: 'flex',
            alignItems: 'center', justifyContent: 'center', fontSize: '20px',
            background: variant === 'danger' ? 'rgba(239,68,68,0.2)' : 'rgba(59,130,246,0.2)',
          }}>
            {variant === 'danger' ? '!' : '?'}
          </span>
          <h3 style={{ color: '#fff', fontSize: '18px', fontWeight: '600' }}>{title}</h3>
        </div>
        <p style={{ color: '#a1a1aa', fontSize: '14px', lineHeight: '1.6', marginBottom: '24px' }}>{message}</p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button onClick={onCancel} style={{
            padding: '10px 20px', background: 'transparent',
            border: '1px solid rgba(107,114,128,0.5)', borderRadius: '8px',
            color: '#9ca3af', fontSize: '14px', cursor: 'pointer',
          }}>{cancelLabel}</button>
          <button onClick={onConfirm} style={{
            padding: '10px 20px', background: v.bg, border: 'none',
            borderRadius: '8px', color: v.color, fontSize: '14px',
            fontWeight: '600', cursor: 'pointer',
          }}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
