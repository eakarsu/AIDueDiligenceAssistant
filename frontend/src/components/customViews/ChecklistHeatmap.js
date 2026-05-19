import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../context/AuthContext';

// VIZ #2 - checklist completion heatmap (category x deal)
const ChecklistHeatmap = () => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/custom-views/checklist-heatmap`)
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || 'Failed to load'));
  }, []);

  if (err) return <div style={{ color: '#ef4444' }}>{err}</div>;
  if (!data) return <div style={{ color: '#a1a1aa' }}>Loading heatmap...</div>;

  const cellColor = (v) => {
    // 0 -> red, 50 -> amber, 100 -> green
    if (v >= 80) return 'rgba(16,185,129,0.85)';
    if (v >= 60) return 'rgba(132,204,22,0.8)';
    if (v >= 40) return 'rgba(245,158,11,0.85)';
    if (v >= 20) return 'rgba(249,115,22,0.85)';
    return 'rgba(239,68,68,0.85)';
  };

  return (
    <div data-testid="checklist-heatmap" style={{ background: 'rgba(26,26,46,0.6)', borderRadius: 12, padding: 20, border: '1px solid rgba(59,130,246,0.2)' }}>
      <h3 style={{ color: '#fff', margin: 0, marginBottom: 12 }}>Checklist Completion Heatmap</h3>
      <p style={{ color: '#a1a1aa', fontSize: 12, marginTop: 0 }}>Category x Deal -&gt; % complete</p>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', minWidth: 480 }}>
          <thead>
            <tr>
              <th style={{ color: '#a1a1aa', textAlign: 'left', padding: '6px 10px', fontSize: 12 }}>Deal \ Category</th>
              {data.categories.map(c => (
                <th key={c} style={{ color: '#a1a1aa', padding: '6px 10px', fontSize: 12, textAlign: 'center' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.matrix.map((row, ri) => (
              <tr key={ri}>
                <td style={{ color: '#e5e7eb', padding: '6px 10px', fontSize: 12, fontWeight: 600 }}>{row.deal}</td>
                {data.categories.map(c => (
                  <td key={c} style={{ padding: 4, textAlign: 'center' }}>
                    <div style={{
                      background: cellColor(row[c] || 0),
                      color: '#fff',
                      borderRadius: 6,
                      padding: '10px 8px',
                      fontWeight: 600,
                      fontSize: 12,
                      minWidth: 56,
                    }}>{row[c] || 0}%</div>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12, display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: 11, color: '#a1a1aa' }}>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(239,68,68,0.85)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />0-19%</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(245,158,11,0.85)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />40-59%</span>
        <span><span style={{ display: 'inline-block', width: 12, height: 12, background: 'rgba(16,185,129,0.85)', borderRadius: 2, marginRight: 4, verticalAlign: 'middle' }} />80%+</span>
      </div>
    </div>
  );
};

export default ChecklistHeatmap;
