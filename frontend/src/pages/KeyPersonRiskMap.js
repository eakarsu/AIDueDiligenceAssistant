import React, { useEffect, useState } from 'react';

export default function KeyPersonRiskMap() {
  const [data, setData] = useState(null);
  useEffect(() => { fetch('/api/key-person-risk-map', { headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } }).then(r => r.json()).then(setData).catch(() => setData(null)); }, []);
  return <div><h1>Key Person Risk Map</h1><p>Map dependency, retention, and knowledge-transfer risks for diligence targets.</p><div className="stats-grid">{data && Object.entries(data.summary).map(([k,v]) => <div className="stat-card" key={k}><span>{k.replaceAll('_',' ')}</span><strong>{v}</strong></div>)}</div><div className="card">{(data?.people || []).map(p => <div key={p.name} style={{padding:12,borderBottom:'1px solid #e5e7eb'}}><strong>{p.name}</strong><div>{p.dependency} - {p.risk} - {p.action}</div></div>)}</div></div>;
}
