import React, { useState, useEffect, useCallback, createContext, useContext } from 'react';

const ToastContext = createContext(null);

export const useToast = () => useContext(ToastContext);

const Toast = ({ message, type = 'success', onClose }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.5)', text: '#10b981', icon: 'V' },
    error: { bg: 'rgba(239, 68, 68, 0.15)', border: 'rgba(239, 68, 68, 0.5)', text: '#ef4444', icon: '!' },
    warning: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.5)', text: '#f59e0b', icon: '!' },
    info: { bg: 'rgba(59, 130, 246, 0.15)', border: 'rgba(59, 130, 246, 0.5)', text: '#3b82f6', icon: 'i' },
  };
  const c = colors[type] || colors.info;

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '12px',
      padding: '14px 20px', background: c.bg, border: `1px solid ${c.border}`,
      borderRadius: '10px', color: c.text, fontSize: '14px', fontWeight: '500',
      boxShadow: '0 8px 24px rgba(0,0,0,0.3)', minWidth: '300px', maxWidth: '480px',
      animation: 'slideIn 0.3s ease',
    }}>
      <span style={{
        width: '24px', height: '24px', borderRadius: '50%', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: c.border,
        color: '#fff', fontSize: '12px', fontWeight: '700', flexShrink: 0,
      }}>{c.icon}</span>
      <span style={{ flex: 1, color: '#e4e4e7' }}>{message}</span>
      <button onClick={onClose} style={{
        background: 'none', border: 'none', color: '#71717a', cursor: 'pointer',
        fontSize: '16px', padding: '2px',
      }}>x</button>
    </div>
  );
};

export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message, type = 'success') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ addToast }}>
      {children}
      <div style={{
        position: 'fixed', top: '20px', right: '20px', zIndex: 9999,
        display: 'flex', flexDirection: 'column', gap: '8px',
      }}>
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
};
