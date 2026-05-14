import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL } from '../context/AuthContext';
import { useToast } from '../components/Toast';

const Watchlist = () => {
  const { addToast } = useToast() || {};
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [companies, setCompanies] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ company_id: '', name: '', severity_threshold: 'medium', notify_email: true });
  const [selected, setSelected] = useState(null);
  const [alerts, setAlerts] = useState([]);
  const [alertsPage, setAlertsPage] = useState(1);
  const [alertsTotalPages, setAlertsTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try {
      const r = await axios.get(`${API_URL}/watchlist?page=${p}&limit=10`);
      setItems(r.data.data || []);
      setPage(r.data.pagination?.page || 1);
      setTotalPages(r.data.pagination?.totalPages || 1);
    } catch (e) {
      addToast && addToast('Failed to load watchlist', 'error');
    }
    setLoading(false);
  }, [addToast]);

  const loadCompanies = useCallback(async () => {
    try {
      const r = await axios.get(`${API_URL}/companies?limit=100`);
      setCompanies(r.data.data || []);
    } catch {}
  }, []);

  useEffect(() => { load(1); loadCompanies(); }, [load, loadCompanies]);

  const submitAdd = async (e) => {
    e.preventDefault();
    if (!form.company_id) return addToast && addToast('Pick a company', 'error');
    if (!form.name) return addToast && addToast('Name required', 'error');
    try {
      await axios.post(`${API_URL}/watchlist`, form);
      addToast && addToast('Added to watchlist', 'success');
      setShowAdd(false);
      setForm({ company_id: '', name: '', severity_threshold: 'medium', notify_email: true });
      load(1);
    } catch (e) {
      addToast && addToast(e.response?.data?.error || 'Add failed', 'error');
    }
  };

  const remove = async (id) => {
    if (!window.confirm('Remove this watchlist entry?')) return;
    try {
      await axios.delete(`${API_URL}/watchlist/${id}`);
      load(page);
    } catch {}
  };

  const scan = async (id) => {
    try {
      const r = await axios.post(`${API_URL}/watchlist/${id}/scan`);
      addToast && addToast(`Scan complete: ${r.data.created} new alerts`, 'success');
      if (selected === id) loadAlerts(id, 1);
      load(page);
    } catch (e) {
      addToast && addToast(e.response?.data?.error || 'Scan failed', 'error');
    }
  };

  const loadAlerts = async (id, p = 1) => {
    setSelected(id);
    try {
      const r = await axios.get(`${API_URL}/watchlist/${id}/alerts?page=${p}&limit=10`);
      setAlerts(r.data.data || []);
      setAlertsPage(r.data.pagination?.page || 1);
      setAlertsTotalPages(r.data.pagination?.totalPages || 1);
    } catch {}
  };

  const ack = async (alertId) => {
    try {
      await axios.patch(`${API_URL}/watchlist/alerts/${alertId}/ack`);
      loadAlerts(selected, alertsPage);
      load(page);
    } catch {}
  };

  return (
    <div style={{ padding: 24, color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>Watchlist Alerts</h1>
        <button onClick={() => setShowAdd(true)} style={btnPrimary}>+ Add to Watchlist</button>
      </div>

      <div style={card}>
        <h3 style={{ marginBottom: 12 }}>Tracked Companies</h3>
        {loading && <p style={{ color: '#a1a1aa' }}>Loading...</p>}
        {!loading && items.length === 0 && <p style={{ color: '#a1a1aa' }}>No watchlist entries yet.</p>}
        <table style={tbl}>
          <thead>
            <tr>
              <th style={th}>Name</th>
              <th style={th}>Company</th>
              <th style={th}>Industry</th>
              <th style={th}>Threshold</th>
              <th style={th}>Unread</th>
              <th style={th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {items.map(it => (
              <tr key={it.id}>
                <td style={td}>{it.name}</td>
                <td style={td}>{it.company_name}</td>
                <td style={td}>{it.industry}</td>
                <td style={td}>{it.severity_threshold}</td>
                <td style={td}>
                  <span style={{
                    padding: '2px 8px', borderRadius: 12,
                    background: Number(it.unread_count) > 0 ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                    color: Number(it.unread_count) > 0 ? '#ef4444' : '#22c55e'
                  }}>{it.unread_count}</span>
                </td>
                <td style={td}>
                  <button style={btnSecondary} onClick={() => loadAlerts(it.id, 1)}>View</button>{' '}
                  <button style={btnSecondary} onClick={() => scan(it.id)}>Scan</button>{' '}
                  <button style={btnDanger} onClick={() => remove(it.id)}>Remove</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
            <button style={btnSecondary} disabled={page <= 1} onClick={() => load(page - 1)}>Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button style={btnSecondary} disabled={page >= totalPages} onClick={() => load(page + 1)}>Next</button>
          </div>
        )}
      </div>

      {selected && (
        <div style={{ ...card, marginTop: 16 }}>
          <h3>Alerts for Watchlist #{selected}</h3>
          {alerts.length === 0 && <p style={{ color: '#a1a1aa' }}>No alerts. Click "Scan" to look for new issues.</p>}
          {alerts.map(a => (
            <div key={a.id} style={{
              padding: 12, marginBottom: 8, borderRadius: 8,
              background: a.acknowledged ? 'rgba(31,41,55,0.5)' : 'rgba(239,68,68,0.1)',
              border: `1px solid ${a.acknowledged ? '#374151' : 'rgba(239,68,68,0.3)'}`
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <strong>{a.title}</strong>
                <span style={{ fontSize: 12, color: '#a1a1aa' }}>
                  {a.alert_type} | {a.severity} | {new Date(a.created_at).toLocaleString()}
                </span>
              </div>
              {a.details && <p style={{ marginTop: 6, fontSize: 14 }}>{a.details}</p>}
              {!a.acknowledged && (
                <button style={{ ...btnSecondary, marginTop: 8 }} onClick={() => ack(a.id)}>Acknowledge</button>
              )}
            </div>
          ))}
          {alertsTotalPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 12 }}>
              <button style={btnSecondary} disabled={alertsPage <= 1} onClick={() => loadAlerts(selected, alertsPage - 1)}>Prev</button>
              <span>Page {alertsPage} / {alertsTotalPages}</span>
              <button style={btnSecondary} disabled={alertsPage >= alertsTotalPages} onClick={() => loadAlerts(selected, alertsPage + 1)}>Next</button>
            </div>
          )}
        </div>
      )}

      {showAdd && (
        <div style={modalBackdrop} onClick={() => setShowAdd(false)}>
          <form style={modal} onClick={e => e.stopPropagation()} onSubmit={submitAdd}>
            <h3>Add Company to Watchlist</h3>
            <div style={fg}>
              <label>Company</label>
              <select style={input} value={form.company_id} onChange={e => setForm({ ...form, company_id: e.target.value })}>
                <option value="">-- Select --</option>
                {companies.map(c => <option key={c.id} value={c.id}>{c.name} ({c.industry})</option>)}
              </select>
            </div>
            <div style={fg}>
              <label>Watchlist Name</label>
              <input style={input} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Q2 Targets" />
            </div>
            <div style={fg}>
              <label>Severity Threshold</label>
              <select style={input} value={form.severity_threshold} onChange={e => setForm({ ...form, severity_threshold: e.target.value })}>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
            <div style={fg}>
              <label>
                <input type="checkbox" checked={form.notify_email} onChange={e => setForm({ ...form, notify_email: e.target.checked })} /> Email notifications
              </label>
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button type="button" style={btnSecondary} onClick={() => setShowAdd(false)}>Cancel</button>
              <button type="submit" style={btnPrimary}>Add</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const card = { background: 'rgba(31,41,55,0.5)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 12, padding: 16 };
const tbl = { width: '100%', borderCollapse: 'collapse', color: '#e5e7eb' };
const th = { textAlign: 'left', padding: '8px 12px', borderBottom: '1px solid rgba(255,255,255,0.08)', color: '#a1a1aa', fontSize: 12, textTransform: 'uppercase' };
const td = { padding: '10px 12px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 14 };
const btnPrimary = { padding: '8px 16px', borderRadius: 8, border: 'none', background: 'linear-gradient(135deg,#6366f1,#8b5cf6)', color: '#fff', cursor: 'pointer' };
const btnSecondary = { padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)', background: 'transparent', color: '#fff', cursor: 'pointer' };
const btnDanger = { padding: '6px 12px', borderRadius: 6, border: '1px solid rgba(239,68,68,0.3)', background: 'transparent', color: '#ef4444', cursor: 'pointer' };
const modalBackdrop = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modal = { background: '#1f2937', padding: 24, borderRadius: 12, width: 480, color: '#fff' };
const fg = { marginBottom: 12 };
const input = { width: '100%', padding: 8, background: '#111827', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6, color: '#fff' };

export default Watchlist;
