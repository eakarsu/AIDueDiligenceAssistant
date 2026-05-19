import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../context/AuthContext';

// VIZ #1 - SVG radar + bar chart, no external deps
const WorkstreamRiskRadar = () => {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    axios.get(`${API_URL}/custom-views/workstream-risks`)
      .then(r => setData(r.data))
      .catch(e => setErr(e.response?.data?.error || 'Failed to load'));
  }, []);

  if (err) return <div style={{ color: '#ef4444' }}>{err}</div>;
  if (!data) return <div style={{ color: '#a1a1aa' }}>Loading risk data...</div>;

  const ws = data.workstreams || [];
  const cx = 160, cy = 160, R = 120;
  const n = ws.length || 1;
  const points = ws.map((w, i) => {
    const angle = (Math.PI * 2 * i) / n - Math.PI / 2;
    const r = (w.risk_score / 100) * R;
    return [cx + Math.cos(angle) * r, cy + Math.sin(angle) * r];
  });
  const polygonPts = points.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');
  const axisLines = ws.map((w, i) => {
    const a = (Math.PI * 2 * i) / n - Math.PI / 2;
    return { x2: cx + Math.cos(a) * R, y2: cy + Math.sin(a) * R, label: w.workstream, lx: cx + Math.cos(a) * (R + 18), ly: cy + Math.sin(a) * (R + 18) };
  });
  const rings = [0.25, 0.5, 0.75, 1.0];

  const color = (s) => s === 'high' ? '#ef4444' : s === 'medium' ? '#f59e0b' : '#10b981';

  return (
    <div data-testid="workstream-risk-radar" style={{ background: 'rgba(26,26,46,0.6)', borderRadius: 12, padding: 20, border: '1px solid rgba(59,130,246,0.2)' }}>
      <h3 style={{ color: '#fff', margin: 0, marginBottom: 12 }}>Workstream Risk Radar</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, alignItems: 'flex-start' }}>
        <svg width="340" height="340" viewBox="0 0 320 320">
          {rings.map((rr, i) => (
            <circle key={i} cx={cx} cy={cy} r={R * rr} fill="none" stroke="rgba(99,102,241,0.25)" />
          ))}
          {axisLines.map((a, i) => (
            <g key={i}>
              <line x1={cx} y1={cy} x2={a.x2} y2={a.y2} stroke="rgba(99,102,241,0.3)" />
              <text x={a.lx} y={a.ly} fill="#a1a1aa" fontSize="11" textAnchor="middle" dominantBaseline="middle">{a.label}</text>
            </g>
          ))}
          <polygon points={polygonPts} fill="rgba(139,92,246,0.35)" stroke="#8b5cf6" strokeWidth="2" />
          {points.map((p, i) => (
            <circle key={i} cx={p[0]} cy={p[1]} r="4" fill={color(ws[i].severity)} />
          ))}
        </svg>
        <div style={{ flex: 1, minWidth: 240 }}>
          <h4 style={{ color: '#fff', fontSize: 13, marginBottom: 8 }}>Risk Score by Workstream</h4>
          {ws.map((w) => (
            <div key={w.workstream} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#e5e7eb' }}>
                <span>{w.workstream}</span>
                <span style={{ color: color(w.severity) }}>{w.risk_score}/100</span>
              </div>
              <div style={{ background: 'rgba(99,102,241,0.15)', height: 8, borderRadius: 4, overflow: 'hidden', marginTop: 4 }}>
                <div style={{ width: `${w.risk_score}%`, height: '100%', background: color(w.severity) }} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default WorkstreamRiskRadar;
