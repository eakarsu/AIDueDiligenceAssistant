import React, { useState } from 'react';
import { API_URL } from '../../context/AuthContext';

// NON-VIZ #1 - Executive Summary PDF download
const ExecSummaryPdf = () => {
  const [status, setStatus] = useState('');
  const [busy, setBusy] = useState(false);

  const download = async () => {
    setBusy(true);
    setStatus('');
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_URL}/custom-views/exec-summary-pdf`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!r.ok) {
        const err = await r.text();
        throw new Error(err || `HTTP ${r.status}`);
      }
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      const ctype = r.headers.get('content-type') || '';
      a.download = ctype.includes('pdf') ? 'dd-exec-summary.pdf' : 'dd-exec-summary.txt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setStatus(`Downloaded (${ctype.includes('pdf') ? 'PDF' : 'text fallback'})`);
    } catch (e) {
      setStatus(`Error: ${e.message}`);
    }
    setBusy(false);
  };

  return (
    <div data-testid="exec-summary-pdf" style={{ background: 'rgba(26,26,46,0.6)', borderRadius: 12, padding: 20, border: '1px solid rgba(59,130,246,0.2)' }}>
      <h3 style={{ color: '#fff', margin: 0, marginBottom: 8 }}>DD Executive Summary PDF</h3>
      <p style={{ color: '#a1a1aa', fontSize: 13, marginTop: 0 }}>
        Generates a downloadable PDF executive summary covering portfolio snapshot,
        workstream risk profile, and checklist progress. Falls back to plain text if pdfkit is unavailable.
      </p>
      <button
        onClick={download}
        disabled={busy}
        style={{
          padding: '10px 18px',
          background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
          border: 'none',
          borderRadius: 6,
          color: '#fff',
          fontWeight: 600,
          cursor: busy ? 'wait' : 'pointer',
        }}
      >
        {busy ? 'Generating...' : 'Download Executive Summary'}
      </button>
      {status && <div style={{ marginTop: 10, color: status.startsWith('Error') ? '#ef4444' : '#10b981', fontSize: 12 }}>{status}</div>}
    </div>
  );
};

export default ExecSummaryPdf;
