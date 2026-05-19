import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL } from '../../context/AuthContext';

// NON-VIZ #2 - Checklist Template Editor (CRUD categories/items)
const ChecklistTemplateEditor = () => {
  const [tpl, setTpl] = useState(null);
  const [err, setErr] = useState('');
  const [newCatName, setNewCatName] = useState('');
  const [newItem, setNewItem] = useState({}); // {categoryId: text}

  const load = () => {
    axios.get(`${API_URL}/custom-views/checklist-template`)
      .then(r => setTpl(r.data))
      .catch(e => setErr(e.response?.data?.error || 'Failed to load'));
  };
  useEffect(() => { load(); }, []);

  const addCategory = async () => {
    if (!newCatName.trim()) return;
    try {
      const r = await axios.post(`${API_URL}/custom-views/checklist-template`, { action: 'addCategory', name: newCatName.trim() });
      setTpl(r.data);
      setNewCatName('');
    } catch (e) { setErr(e.response?.data?.error || 'Add failed'); }
  };

  const addItem = async (categoryId) => {
    const text = (newItem[categoryId] || '').trim();
    if (!text) return;
    try {
      const r = await axios.post(`${API_URL}/custom-views/checklist-template`, { action: 'addItem', categoryId, text });
      setTpl(r.data);
      setNewItem({ ...newItem, [categoryId]: '' });
    } catch (e) { setErr(e.response?.data?.error || 'Add item failed'); }
  };

  const deleteCategory = async (categoryId) => {
    if (!window.confirm('Delete this category?')) return;
    try {
      const r = await axios.delete(`${API_URL}/custom-views/checklist-template`, { params: { categoryId } });
      setTpl(r.data);
    } catch (e) { setErr(e.response?.data?.error || 'Delete failed'); }
  };

  const deleteItem = async (categoryId, itemId) => {
    try {
      const r = await axios.delete(`${API_URL}/custom-views/checklist-template`, { params: { categoryId, itemId } });
      setTpl(r.data);
    } catch (e) { setErr(e.response?.data?.error || 'Delete item failed'); }
  };

  const toggleItem = async (categoryId, itemId) => {
    if (!tpl) return;
    const next = {
      categories: tpl.categories.map(c => c.id === categoryId
        ? { ...c, items: c.items.map(it => it.id === itemId ? { ...it, complete: !it.complete } : it) }
        : c
      ),
    };
    try {
      const r = await axios.put(`${API_URL}/custom-views/checklist-template`, next);
      setTpl(r.data);
    } catch (e) { setErr(e.response?.data?.error || 'Update failed'); }
  };

  if (err && !tpl) return <div style={{ color: '#ef4444' }}>{err}</div>;
  if (!tpl) return <div style={{ color: '#a1a1aa' }}>Loading template...</div>;

  return (
    <div data-testid="checklist-template-editor" style={{ background: 'rgba(26,26,46,0.6)', borderRadius: 12, padding: 20, border: '1px solid rgba(59,130,246,0.2)' }}>
      <h3 style={{ color: '#fff', margin: 0, marginBottom: 6 }}>Checklist Template Editor</h3>
      <p style={{ color: '#a1a1aa', fontSize: 12, margin: 0, marginBottom: 16 }}>
        Add/remove categories & items, toggle completion. Last updated: {new Date(tpl.updated_at).toLocaleString()}
      </p>

      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input
          value={newCatName}
          onChange={e => setNewCatName(e.target.value)}
          placeholder="New category name"
          style={{ flex: 1, padding: 8, borderRadius: 6, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(17,24,39,0.6)', color: '#fff' }}
        />
        <button onClick={addCategory} style={btnPrimary}>+ Category</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
        {tpl.categories.map(cat => (
          <div key={cat.id} style={{ background: 'rgba(17,24,39,0.5)', padding: 12, borderRadius: 8, border: '1px solid rgba(99,102,241,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h4 style={{ color: '#fff', margin: 0, fontSize: 14 }}>{cat.name}</h4>
              <button onClick={() => deleteCategory(cat.id)} style={btnDanger}>Delete</button>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
              {cat.items.map(it => (
                <li key={it.id} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 0', fontSize: 13 }}>
                  <input type="checkbox" checked={!!it.complete} onChange={() => toggleItem(cat.id, it.id)} />
                  <span style={{ color: it.complete ? '#10b981' : '#e5e7eb', flex: 1, textDecoration: it.complete ? 'line-through' : 'none' }}>{it.text}</span>
                  <button onClick={() => deleteItem(cat.id, it.id)} style={btnTiny}>x</button>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              <input
                value={newItem[cat.id] || ''}
                onChange={e => setNewItem({ ...newItem, [cat.id]: e.target.value })}
                placeholder="New item"
                style={{ flex: 1, padding: 6, borderRadius: 4, border: '1px solid rgba(99,102,241,0.3)', background: 'rgba(17,24,39,0.8)', color: '#fff', fontSize: 12 }}
              />
              <button onClick={() => addItem(cat.id)} style={btnSmall}>+ Item</button>
            </div>
          </div>
        ))}
      </div>
      {err && <div style={{ color: '#ef4444', marginTop: 10 }}>{err}</div>}
    </div>
  );
};

const btnPrimary = { padding: '8px 14px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: 6, color: '#fff', fontWeight: 600, cursor: 'pointer' };
const btnSmall = { padding: '4px 10px', background: 'rgba(59,130,246,0.2)', border: '1px solid rgba(59,130,246,0.4)', borderRadius: 4, color: '#3b82f6', fontSize: 12, cursor: 'pointer' };
const btnDanger = { padding: '3px 8px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 4, color: '#ef4444', fontSize: 11, cursor: 'pointer' };
const btnTiny = { padding: '0 6px', background: 'transparent', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: 14 };

export default ChecklistTemplateEditor;
