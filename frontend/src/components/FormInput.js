import React from 'react';

export const FormInput = ({ label, type = 'text', value, onChange, placeholder, required = false, options = [], error = '' }) => {
  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    background: 'rgba(255, 255, 255, 0.05)',
    border: error ? '1px solid #ef4444' : '1px solid rgba(59, 130, 246, 0.3)',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={{ display: 'block', color: '#a1a1aa', fontSize: '13px', fontWeight: '500', marginBottom: '6px' }}>
        {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
      </label>
      {type === 'select' ? (
        <select value={value} onChange={onChange} style={inputStyle} required={required}>
          <option value="">Select...</option>
          {options.map((opt) => (
            <option key={opt.value || opt} value={opt.value || opt}>
              {opt.label || opt}
            </option>
          ))}
        </select>
      ) : type === 'textarea' ? (
        <textarea
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={{ ...inputStyle, minHeight: '100px', resize: 'vertical' }}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          style={inputStyle}
          required={required}
        />
      )}
      {error && <span style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px', display: 'block' }}>{error}</span>}
    </div>
  );
};

export const FormRow = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
    {children}
  </div>
);

export const FormButtons = ({ onCancel, onSubmit, submitLabel = 'Save', loading = false }) => (
  <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' }}>
    <button
      type="button"
      onClick={onCancel}
      style={{
        padding: '12px 24px',
        background: 'transparent',
        border: '1px solid rgba(107, 114, 128, 0.5)',
        borderRadius: '8px',
        color: '#9ca3af',
        fontSize: '14px',
        fontWeight: '500',
        cursor: 'pointer',
      }}
    >
      Cancel
    </button>
    <button
      type="submit"
      onClick={onSubmit}
      disabled={loading}
      style={{
        padding: '12px 24px',
        background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
        border: 'none',
        borderRadius: '8px',
        color: '#fff',
        fontSize: '14px',
        fontWeight: '500',
        cursor: loading ? 'not-allowed' : 'pointer',
        opacity: loading ? 0.7 : 1,
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
      }}
    >
      {loading && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
      {loading ? 'Saving...' : submitLabel}
    </button>
  </div>
);
