import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { useToast } from '../components/Toast';

/**
 * AI Tools page — surfaces the four endpoints exposed by routes/aiNew.js
 *   POST /api/ai/deal-score          { company_id }
 *   POST /api/ai/comparison-matrix   { company_ids: number[] (2..5) }
 *   POST /api/ai/red-flag-ranking    { company_id }
 *   POST /api/ai/deal-timeline       { company_id, deal_type, deal_size_usd }
 *
 * Each tool is a tab. Auth uses the AuthContext-installed axios default
 * Authorization header (set in AuthContext on mount). 503 (no API key) is
 * shown as an explicit "AI not configured" notice.
 */

const TOOLS = [
  { key: 'deal-score', label: 'Deal Score', icon: '🎯', description: 'Compute an acquisition score (0-100) for one company.' },
  { key: 'comparison-matrix', label: 'Comparison Matrix', icon: '📊', description: 'Side-by-side comparison of 2-5 companies.' },
  { key: 'red-flag-ranking', label: 'Red Flag Ranking', icon: '🔴', description: 'Rank a company\'s red flags by deal-blocking severity.' },
  { key: 'deal-timeline', label: 'Deal Timeline', icon: '🗓️', description: 'Generate an integration milestone timeline.' },
  { key: 'management-team-analysis', label: 'Management Team', icon: '👔', description: 'Analyze executive bench, track record, retention risk.' },
  { key: 'cultural-fit-assessment', label: 'Cultural Fit', icon: '🤝', description: 'Compare acquirer + target culture; recommend integration style.' },
  // Apply pass 5 backlog (cap=10 across all passes; pass2=4, pass4=2, +4 here)
  { key: 'analyze-target-company', label: 'Target Analysis', icon: '🎯', description: 'Holistic SWOT-style assessment of an acquisition target.' },
  { key: 'valuation-summary', label: 'Valuation', icon: '💰', description: 'Indicative valuation range and key assumptions.' },
  { key: 'diligence-checklist', label: 'Diligence Checklist', icon: '✅', description: 'Generate a workstream-by-workstream checklist.' },
  { key: 'cap-table-analysis', label: 'Cap Table', icon: '📐', description: 'Dilution scenarios and red flags from a cap table.' },
];

const AITools = () => {
  const { addToast } = useToast();

  const [active, setActive] = useState('deal-score');
  const [companies, setCompanies] = useState([]);
  const [loadingCompanies, setLoadingCompanies] = useState(true);

  // Per-tool form state
  const [companyId, setCompanyId] = useState('');
  const [comparisonIds, setComparisonIds] = useState([]); // for comparison-matrix
  const [dealType, setDealType] = useState('Acquisition');
  const [dealSizeUsd, setDealSizeUsd] = useState('');
  const [acquirerCulture, setAcquirerCulture] = useState('');
  const [targetCulture, setTargetCulture] = useState('');
  const [dealContext, setDealContext] = useState('');

  const [running, setRunning] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [aiUnavailable, setAiUnavailable] = useState(false);
  const [missingEnv, setMissingEnv] = useState(null);

  // Apply pass 5 form state
  const [capRoundsJson, setCapRoundsJson] = useState('[\n  {"round":"Seed","amount":1000000,"price_per_share":0.5}\n]');
  const [capShareholdersJson, setCapShareholdersJson] = useState('[\n  {"name":"Founder A","shares":4000000}\n]');
  const [proposedOffer, setProposedOffer] = useState('');
  const [focusAreas, setFocusAreas] = useState('');
  const [valDealContext, setValDealContext] = useState('');

  useEffect(() => {
    const fetchCompanies = async () => {
      try {
        const res = await axios.get(`${API_URL}/companies`);
        setCompanies(res.data || []);
      } catch (err) {
        addToast('Failed to load companies', 'error');
      } finally {
        setLoadingCompanies(false);
      }
    };
    fetchCompanies();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const switchTool = (key) => {
    setActive(key);
    setResult(null);
    setError(null);
    setAiUnavailable(false);
  };

  const toggleComparisonId = (id) => {
    setComparisonIds((prev) => {
      if (prev.includes(id)) return prev.filter((x) => x !== id);
      if (prev.length >= 5) {
        addToast('Maximum 5 companies for comparison matrix', 'warning');
        return prev;
      }
      return [...prev, id];
    });
  };

  const buildPayload = () => {
    if (active === 'comparison-matrix') {
      return { company_ids: comparisonIds };
    }
    if (active === 'deal-timeline') {
      const payload = { company_id: Number(companyId) };
      if (dealType) payload.deal_type = dealType;
      if (dealSizeUsd) payload.deal_size_usd = Number(dealSizeUsd);
      return payload;
    }
    if (active === 'cultural-fit-assessment') {
      const payload = { acquirer_culture: acquirerCulture, target_culture: targetCulture };
      if (dealContext) payload.deal_context = dealContext;
      return payload;
    }
    if (active === 'cap-table-analysis') {
      let rounds = [];
      let shareholders = [];
      try { rounds = JSON.parse(capRoundsJson || '[]'); } catch (_) { /* validated below */ }
      try { shareholders = JSON.parse(capShareholdersJson || '[]'); } catch (_) { /* validated below */ }
      return { company_id: Number(companyId), rounds, shareholders, proposed_offer: proposedOffer || undefined };
    }
    if (active === 'diligence-checklist') {
      return { company_id: Number(companyId), focus_areas: focusAreas || undefined };
    }
    if (active === 'valuation-summary') {
      return { company_id: Number(companyId), deal_context: valDealContext || undefined };
    }
    return { company_id: Number(companyId) };
  };

  const validate = () => {
    if (active === 'comparison-matrix') {
      if (comparisonIds.length < 2) return 'Select at least 2 companies to compare.';
      if (comparisonIds.length > 5) return 'Select at most 5 companies.';
      return null;
    }
    if (active === 'cultural-fit-assessment') {
      if (!acquirerCulture.trim()) return 'Acquirer culture description is required.';
      if (!targetCulture.trim()) return 'Target culture description is required.';
      return null;
    }
    if (active === 'cap-table-analysis') {
      if (!companyId) return 'Select a company.';
      try { JSON.parse(capRoundsJson || '[]'); } catch (e) { return 'Rounds JSON is invalid.'; }
      try { JSON.parse(capShareholdersJson || '[]'); } catch (e) { return 'Shareholders JSON is invalid.'; }
      return null;
    }
    if (!companyId) return 'Select a company.';
    return null;
  };

  const handleRun = async () => {
    setError(null);
    setAiUnavailable(false);
    setResult(null);

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setRunning(true);
    try {
      const payload = buildPayload();
      const res = await axios.post(`${API_URL}/ai/${active}`, payload);
      setResult(res.data);
    } catch (err) {
      const status = err.response?.status;
      if (status === 503) {
        setAiUnavailable(true);
        setMissingEnv(err.response?.data?.missing || null);
      } else {
        setError(err.response?.data?.error || err.message || 'Request failed');
      }
    } finally {
      setRunning(false);
    }
  };

  const renderForm = () => {
    if (active === 'cultural-fit-assessment') {
      return (
        <div>
          <label style={styles.label}>Acquirer culture (free text):</label>
          <textarea
            style={{ ...styles.input, minHeight: '90px', fontFamily: 'inherit' }}
            placeholder="Describe the acquirer's culture: values, leadership style, decision-making, performance norms, etc."
            value={acquirerCulture}
            onChange={(e) => setAcquirerCulture(e.target.value)}
          />
          <div style={{ marginTop: '12px' }}>
            <label style={styles.label}>Target culture (free text):</label>
            <textarea
              style={{ ...styles.input, minHeight: '90px', fontFamily: 'inherit' }}
              placeholder="Describe the target's culture: values, leadership style, decision-making, performance norms, etc."
              value={targetCulture}
              onChange={(e) => setTargetCulture(e.target.value)}
            />
          </div>
          <div style={{ marginTop: '12px' }}>
            <label style={styles.label}>Deal context (optional):</label>
            <textarea
              style={{ ...styles.input, minHeight: '60px', fontFamily: 'inherit' }}
              placeholder="Optional: deal type, integration goals, key timing constraints"
              value={dealContext}
              onChange={(e) => setDealContext(e.target.value)}
            />
          </div>
        </div>
      );
    }
    if (active === 'comparison-matrix') {
      return (
        <div>
          <label style={styles.label}>Select 2-5 companies:</label>
          <div style={styles.companyGrid}>
            {companies.map((c) => (
              <label key={c.id} style={{
                ...styles.companyChip,
                ...(comparisonIds.includes(c.id) ? styles.companyChipActive : {}),
              }}>
                <input
                  type="checkbox"
                  checked={comparisonIds.includes(c.id)}
                  onChange={() => toggleComparisonId(c.id)}
                  style={{ marginRight: '8px' }}
                />
                {c.name}
              </label>
            ))}
          </div>
          <p style={styles.helperText}>{comparisonIds.length} selected</p>
        </div>
      );
    }

    return (
      <div>
        <label style={styles.label}>Company:</label>
        <select
          style={styles.select}
          value={companyId}
          onChange={(e) => setCompanyId(e.target.value)}
        >
          <option value="">— Select a company —</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>{c.name}</option>
          ))}
        </select>

        {active === 'valuation-summary' && (
          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Deal context (optional):</label>
            <textarea style={{ ...styles.input, minHeight: '60px', fontFamily: 'inherit' }} value={valDealContext} onChange={(e) => setValDealContext(e.target.value)} placeholder="Optional: deal type, strategic rationale, buyer profile" />
          </div>
        )}

        {active === 'diligence-checklist' && (
          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Focus areas (optional):</label>
            <input style={styles.input} value={focusAreas} onChange={(e) => setFocusAreas(e.target.value)} placeholder="e.g. financial, tech, regulatory" />
          </div>
        )}

        {active === 'cap-table-analysis' && (
          <div style={{ marginTop: '16px' }}>
            <label style={styles.label}>Rounds (JSON array):</label>
            <textarea style={{ ...styles.input, minHeight: '90px', fontFamily: 'monospace' }} value={capRoundsJson} onChange={(e) => setCapRoundsJson(e.target.value)} />
            <label style={{ ...styles.label, marginTop: '12px' }}>Shareholders (JSON array):</label>
            <textarea style={{ ...styles.input, minHeight: '90px', fontFamily: 'monospace' }} value={capShareholdersJson} onChange={(e) => setCapShareholdersJson(e.target.value)} />
            <label style={{ ...styles.label, marginTop: '12px' }}>Proposed offer (free text, optional):</label>
            <input style={styles.input} value={proposedOffer} onChange={(e) => setProposedOffer(e.target.value)} placeholder="e.g. $50M cash + $10M earnout" />
          </div>
        )}

        {active === 'deal-timeline' && (
          <div style={{ marginTop: '16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={styles.label}>Deal Type:</label>
              <select style={styles.select} value={dealType} onChange={(e) => setDealType(e.target.value)}>
                <option>Acquisition</option>
                <option>Merger</option>
                <option>Investment</option>
                <option>Asset Purchase</option>
              </select>
            </div>
            <div>
              <label style={styles.label}>Deal Size (USD):</label>
              <input
                style={styles.input}
                type="number"
                placeholder="e.g., 50000000"
                value={dealSizeUsd}
                onChange={(e) => setDealSizeUsd(e.target.value)}
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderResult = () => {
    if (aiUnavailable) {
      return (
        <div style={styles.warningBox}>
          <strong>AI not configured.</strong> The server returned 503 — set
          {' '}<code>{missingEnv || 'OPENROUTER_API_KEY'}</code> in the backend environment to enable AI tools.
        </div>
      );
    }
    if (error) {
      return <div style={styles.errorBox}>{error}</div>;
    }
    if (!result) return null;
    return (
      <div style={styles.resultBox}>
        <h4 style={styles.resultTitle}>Result {result.cached && <span style={styles.cachedBadge}>cached</span>}</h4>
        <pre style={styles.resultJson}>{JSON.stringify(result, null, 2)}</pre>
      </div>
    );
  };

  const activeTool = TOOLS.find((t) => t.key === active);

  return (
    <div style={styles.container}>
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>AI Deal Tools</h2>
          <p style={styles.subtitle}>Direct access to the four backend AI endpoints (deal-score, comparison-matrix, red-flag-ranking, deal-timeline).</p>
        </div>
      </div>

      <div style={styles.tabs}>
        {TOOLS.map((t) => (
          <button
            key={t.key}
            style={{ ...styles.tab, ...(active === t.key ? styles.tabActive : {}) }}
            onClick={() => switchTool(t.key)}
          >
            <span style={{ marginRight: '8px' }}>{t.icon}</span>{t.label}
          </button>
        ))}
      </div>

      <div style={styles.toolCard}>
        <p style={styles.toolDescription}>{activeTool?.description}</p>

        {loadingCompanies && active !== 'cultural-fit-assessment' ? (
          <div style={styles.loading}>Loading companies...</div>
        ) : companies.length === 0 && active !== 'cultural-fit-assessment' ? (
          <div style={styles.warningBox}>
            No companies found. Add at least one company on the Companies page first.
          </div>
        ) : (
          <>
            {renderForm()}
            <div style={{ marginTop: '20px' }}>
              <button
                style={{ ...styles.runButton, ...(running ? styles.runButtonDisabled : {}) }}
                onClick={handleRun}
                disabled={running}
              >
                {running ? 'Running...' : `Run ${activeTool?.label}`}
              </button>
            </div>
          </>
        )}

        {renderResult()}
      </div>
    </div>
  );
};

const styles = {
  container: { padding: '24px', maxWidth: '1200px' },
  header: { marginBottom: '24px' },
  title: { color: '#fff', fontSize: '24px', margin: 0 },
  subtitle: { color: '#a1a1aa', fontSize: '14px', margin: '4px 0 0 0' },
  tabs: { display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' },
  tab: {
    background: 'rgba(255,255,255,0.04)',
    color: '#d4d4d8',
    border: '1px solid rgba(255,255,255,0.08)',
    padding: '10px 18px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 500,
  },
  tabActive: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    borderColor: 'transparent',
  },
  toolCard: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '14px',
    padding: '24px',
  },
  toolDescription: { color: '#a1a1aa', fontSize: '14px', marginBottom: '20px' },
  label: { display: 'block', color: '#d4d4d8', fontSize: '13px', marginBottom: '6px', fontWeight: 500 },
  select: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.3)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: '14px',
  },
  input: {
    width: '100%',
    padding: '10px 12px',
    borderRadius: '8px',
    background: 'rgba(0,0,0,0.3)',
    color: '#fff',
    border: '1px solid rgba(255,255,255,0.1)',
    fontSize: '14px',
    boxSizing: 'border-box',
  },
  companyGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
    gap: '8px',
    maxHeight: '260px',
    overflowY: 'auto',
    padding: '4px',
  },
  companyChip: {
    display: 'flex',
    alignItems: 'center',
    background: 'rgba(0,0,0,0.25)',
    color: '#d4d4d8',
    padding: '10px 12px',
    borderRadius: '8px',
    border: '1px solid rgba(255,255,255,0.08)',
    cursor: 'pointer',
    fontSize: '13px',
  },
  companyChipActive: {
    background: 'rgba(99,102,241,0.2)',
    borderColor: '#6366f1',
    color: '#fff',
  },
  helperText: { color: '#71717a', fontSize: '12px', marginTop: '8px' },
  runButton: {
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    padding: '12px 28px',
    borderRadius: '10px',
    cursor: 'pointer',
    fontSize: '14px',
    fontWeight: 600,
  },
  runButtonDisabled: { opacity: 0.6, cursor: 'not-allowed' },
  loading: { color: '#a1a1aa', fontSize: '14px', padding: '20px 0' },
  warningBox: {
    background: 'rgba(234,179,8,0.1)',
    border: '1px solid rgba(234,179,8,0.3)',
    color: '#fde68a',
    padding: '14px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    marginTop: '16px',
  },
  errorBox: {
    background: 'rgba(239,68,68,0.1)',
    border: '1px solid rgba(239,68,68,0.3)',
    color: '#fca5a5',
    padding: '14px 16px',
    borderRadius: '10px',
    fontSize: '13px',
    marginTop: '16px',
  },
  resultBox: {
    marginTop: '20px',
    background: 'rgba(0,0,0,0.3)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: '10px',
    padding: '16px',
  },
  resultTitle: { color: '#fff', fontSize: '14px', margin: '0 0 12px 0' },
  cachedBadge: {
    background: 'rgba(34,197,94,0.15)',
    color: '#86efac',
    fontSize: '11px',
    padding: '2px 8px',
    borderRadius: '6px',
    marginLeft: '8px',
    fontWeight: 500,
  },
  resultJson: {
    color: '#d4d4d8',
    fontSize: '12px',
    fontFamily: 'monospace',
    background: 'rgba(0,0,0,0.4)',
    padding: '12px',
    borderRadius: '8px',
    overflow: 'auto',
    maxHeight: '600px',
    margin: 0,
  },
};

export default AITools;
