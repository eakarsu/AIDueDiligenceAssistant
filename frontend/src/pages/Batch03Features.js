// === Batch 03 Gaps & Frontend Mounts ===
// Auto-generated frontend page (lean v0). Wires Custom Feature Suggestions
// and Gap endpoints (AI counterparts + non-AI features) to backend routes.
import React, { useState } from 'react';

const API_BASE = (typeof process !== 'undefined' && process.env && process.env.REACT_APP_API_URL) || 'http://localhost:4000/api';

const FEATURES = [
  { kind: 'cfs', slug: 'cf-multi-round-comparison', label: 'Multi-round comparison', desc: 'Diff financials across rounds, flag ARR decline/churn', endpoint: '/cf-multi-round-comparison' },
  { kind: 'cfs', slug: 'cf-agentic-diligence-agent', label: 'Agentic diligence agent', desc: 'Scheduled deep-dives on portfolio companies, anomaly flagging', endpoint: '/cf-agentic-diligence-agent' },
  { kind: 'cfs', slug: 'cf-founder-call-analysis', label: 'Founder-call analysis', desc: 'Transcribe pitch calls, extract claims vs. data', endpoint: '/cf-founder-call-analysis' },
  { kind: 'cfs', slug: 'cf-cap-table-modelling', label: 'Cap-table modelling', desc: 'Parse cap tables, simulate dilution scenarios', endpoint: '/cf-cap-table-modelling' },
  { kind: 'cfs', slug: 'cf-auto-generated-checklists', label: 'Auto-generated checklists', desc: 'Industry/stage-aware diligence checklists', endpoint: '/cf-auto-generated-checklists' },
  { kind: 'cfs', slug: 'cf-sec-filings-agent', label: 'SEC filings agent', desc: 'Pull and summarise filings by risk category', endpoint: '/cf-sec-filings-agent' },
  { kind: 'gap-ai', slug: 'gap-ai-no-transcription-extraction-from-founder-call-recordings', label: 'No transcription/extraction from founder-call recordings', desc: 'No transcription/extraction from founder-call recordings', endpoint: '/gap-no-transcription-extraction-from-founder-call-recordings' },
  { kind: 'gap-ai', slug: 'gap-ai-no-automated-cap-table-dilution-modeling', label: 'No automated cap-table dilution modeling', desc: 'No automated cap-table dilution modeling', endpoint: '/gap-no-automated-cap-table-dilution-modeling' },
  { kind: 'gap-ai', slug: 'gap-ai-no-sec-edgar-filing-analyser', label: 'No SEC/EDGAR filing analyser', desc: 'No SEC/EDGAR filing analyser', endpoint: '/gap-no-sec-edgar-filing-analyser' },
  { kind: 'gap-non', slug: 'gap-non-no-file-upload-module-no-pdf-data-room-ingest', label: 'No file upload module (no PDF data-room ingest)', desc: 'No file upload module (no PDF data-room ingest)', endpoint: '/gap-no-file-upload-module-no-pdf-data-room-ingest' },
  { kind: 'gap-non', slug: 'gap-non-no-webhooks-data-room-provider-callbacks', label: 'No webhooks (data-room provider callbacks)', desc: 'No webhooks (data-room provider callbacks)', endpoint: '/gap-no-webhooks-data-room-provider-callbacks' },
  { kind: 'gap-non', slug: 'gap-non-limited-search-no-full-text-across-documents', label: 'Limited search (no full-text across documents)', desc: 'Limited search (no full-text across documents)', endpoint: '/gap-limited-search-no-full-text-across-documents' },
  { kind: 'gap-non', slug: 'gap-non-no-deal-room-collaboration-comments', label: 'No deal-room collaboration / comments', desc: 'No deal-room collaboration / comments', endpoint: '/gap-no-deal-room-collaboration-comments' },
  { kind: 'gap-non', slug: 'gap-non-no-external-data-vendor-capiq-crunchbase-sync', label: 'No external data-vendor (CapIQ/Crunchbase) sync', desc: 'No external data-vendor (CapIQ/Crunchbase) sync', endpoint: '/gap-no-external-data-vendor-capiq-crunchbase-sync' },
];

function authHeaders() {
  const t = (typeof window !== 'undefined') ? localStorage.getItem('token') : null;
  return { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function Batch03Features() {
  const [active, setActive] = useState(FEATURES[0]?.slug);
  const [input, setInput] = useState('');
  const [results, setResults] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const current = FEATURES.find(f => f.slug === active) || FEATURES[0];

  async function run() {
    if (!current) return;
    setLoading(true); setError(null);
    try {
      let parsed;
      try { parsed = input ? JSON.parse(input) : {}; } catch { parsed = { input }; }
      const r = await fetch(`${API_BASE}${current.endpoint}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(parsed)
      });
      let body; try { body = await r.json(); } catch { body = { raw: await r.text() }; }
      if (!r.ok) setError(body.error || `HTTP ${r.status}`);
      setResults(prev => ({ ...prev, [current.slug]: body }));
    } catch (e) {
      setError(String(e.message || e));
    } finally { setLoading(false); }
  }

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, sans-serif' }}>
      <h2 style={{ marginTop: 0 }}>Batch 03 Features <small style={{ color: '#64748b', fontWeight: 400 }}>(AIDueDiligenceAssistant)</small></h2>
      <p style={{ color: '#475569', maxWidth: 720 }}>
        Audit-driven AI counterparts, non-AI feature gaps, and custom feature suggestions.
        Backend endpoints prefixed <code>/api/cf-*</code> (custom features) and <code>/api/gap-*</code> (gap fills).
      </p>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '12px 0' }}>
        {FEATURES.map(f => (
          <button key={f.slug} onClick={() => setActive(f.slug)}
            style={{ padding: '6px 10px', borderRadius: 4, border: '1px solid #cbd5e1',
                     background: active === f.slug ? '#1e40af' : '#f8fafc',
                     color: active === f.slug ? 'white' : '#0f172a', cursor: 'pointer', fontSize: 12 }}>
            <span style={{ opacity: 0.7, marginRight: 4 }}>[{f.kind}]</span>{f.label}
          </button>
        ))}
      </div>
      {current && (
        <div style={{ marginTop: 16, padding: 16, background: '#f8fafc', borderRadius: 6, border: '1px solid #e2e8f0' }}>
          <div style={{ marginBottom: 8 }}>
            <strong>{current.label}</strong>
            <div style={{ color: '#475569', fontSize: 13 }}>{current.desc}</div>
            <div style={{ color: '#64748b', fontSize: 11, marginTop: 4 }}>POST <code>{current.endpoint}</code></div>
          </div>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder='Optional JSON input (e.g. {"query":"..."})'
            style={{ width: '100%', minHeight: 80, padding: 8, fontFamily: 'monospace', fontSize: 12, border: '1px solid #cbd5e1', borderRadius: 4 }} />
          <div style={{ marginTop: 8 }}>
            <button onClick={run} disabled={loading}
              style={{ padding: '8px 16px', background: '#1e40af', color: 'white', border: 'none', borderRadius: 4, cursor: 'pointer', opacity: loading ? 0.6 : 1 }}>
              {loading ? 'Running…' : 'Run'}
            </button>
          </div>
          {error && (<div style={{ marginTop: 12, padding: 10, background: '#fee2e2', color: '#991b1b', borderRadius: 4, fontSize: 13 }}>{error}</div>)}
          {results[current.slug] && (
            <pre style={{ marginTop: 12, padding: 10, background: '#0b1020', color: '#cbd5e1', borderRadius: 4, overflow: 'auto', maxHeight: 360, fontSize: 12 }}>
              {typeof results[current.slug] === 'string' ? results[current.slug] : JSON.stringify(results[current.slug], null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}
