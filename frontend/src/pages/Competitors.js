import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const Competitors = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [data, setData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    company_id: '', competitor_name: '', market_share: '', strengths: '', weaknesses: '', strategy: '', threat_level: 'Medium', notes: ''
  });

  const fetchData = async () => {
    try {
      const [competitorsRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/competitors`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(competitorsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load competitors', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.company_id) errs.company_id = 'Target company is required';
    if (!formData.competitor_name.trim()) errs.competitor_name = 'Competitor name is required';
    else if (formData.competitor_name.trim().length < 2) errs.competitor_name = 'Name must be at least 2 characters';
    if (formData.market_share && (isNaN(Number(formData.market_share)) || Number(formData.market_share) < 0 || Number(formData.market_share) > 100)) errs.market_share = 'Must be a number between 0 and 100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/competitors/${selectedItem.id}`, formData);
        addToast('Competitor updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/competitors`, formData);
        addToast('Competitor created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save competitor', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Competitor',
      message: `Are you sure you want to delete "${item.competitor_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/competitors/${item.id}`);
          addToast('Competitor deleted successfully', 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete competitor', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Competitors',
      message: `Are you sure you want to delete ${ids.length} competitors? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/competitors/bulk-delete`, { ids });
          addToast(`${ids.length} competitors deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete competitors', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', competitor_name: item.competitor_name || '', market_share: item.market_share || '',
      strengths: item.strengths || '', weaknesses: item.weaknesses || '', strategy: item.strategy || '',
      threat_level: item.threat_level || 'Medium', notes: item.notes || ''
    });
    setShowModal(true);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setAiAnalysis(item.ai_analysis || '');
    setShowDetailModal(true);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/competitors/${selectedItem.id}/analyze`);
      setAiAnalysis(response.data.analysis);
      fetchData();
      setSelectedItem(prev => ({ ...prev, ai_analysis: response.data.analysis }));
      addToast('AI analysis completed', 'success');
    } catch (error) {
      setAiAnalysis('Error: Unable to perform AI analysis.');
      addToast('AI analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', competitor_name: '', market_share: '', strengths: '', weaknesses: '', strategy: '', threat_level: 'Medium', notes: '' });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', competitor_name: '', market_share: '', strengths: '', weaknesses: '', strategy: '', threat_level: 'Medium', notes: '' });
    setShowModal(true);
  };

  const getThreatColor = (level) => {
    switch (level) {
      case 'Critical': return { bg: 'rgba(220, 38, 38, 0.2)', color: '#dc2626' };
      case 'High': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      case 'Medium': return { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      default: return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    }
  };

  const columns = [
    { key: 'competitor_name', label: 'Competitor' },
    { key: 'company_name', label: 'Target Company' },
    { key: 'market_share', label: 'Market Share', render: (val) => val ? `${val}%` : '-' },
    { key: 'threat_level', label: 'Threat Level', render: (val) => {
      const { bg, color } = getThreatColor(val);
      return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: bg, color }}>{val}</span>;
    }},
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'threat_level', label: 'Threat Level' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Analyze competitive landscape and threats</p>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Competitor</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Competitors"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Competitor' : 'Add Competitor'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Target Company" type="select" value={formData.company_id} onChange={(e) => setFormData({...formData, company_id: e.target.value})} required error={errors.company_id}
              options={companies.map(c => ({ value: c.id, label: c.name }))} />
            <FormInput label="Competitor Name" value={formData.competitor_name} onChange={(e) => setFormData({...formData, competitor_name: e.target.value})} required error={errors.competitor_name} />
          </FormRow>
          <FormRow>
            <FormInput label="Market Share (%)" type="number" value={formData.market_share} onChange={(e) => setFormData({...formData, market_share: e.target.value})} error={errors.market_share} />
            <FormInput label="Threat Level" type="select" value={formData.threat_level} onChange={(e) => setFormData({...formData, threat_level: e.target.value})}
              options={['Low', 'Medium', 'High', 'Critical']} />
          </FormRow>
          <FormInput label="Strengths" type="textarea" value={formData.strengths} onChange={(e) => setFormData({...formData, strengths: e.target.value})} />
          <FormInput label="Weaknesses" type="textarea" value={formData.weaknesses} onChange={(e) => setFormData({...formData, weaknesses: e.target.value})} />
          <FormInput label="Strategy" type="textarea" value={formData.strategy} onChange={(e) => setFormData({...formData, strategy: e.target.value})} />
          <FormInput label="Notes" type="textarea" value={formData.notes} onChange={(e) => setFormData({...formData, notes: e.target.value})} />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Competitor Details" size="large">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Competitor</span><span style={styles.detailValue}>{selectedItem.competitor_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Target Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Market Share</span><span style={styles.detailValue}>{selectedItem.market_share ? `${selectedItem.market_share}%` : '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Threat Level</span><span style={styles.detailValue}>{selectedItem.threat_level}</span></div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Strengths</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.strengths || '-'}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Weaknesses</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.weaknesses || '-'}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Strategy</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.strategy || '-'}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Notes</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.notes || '-'}</p>
            </div>
            <div style={styles.aiSection}>
              <button onClick={handleAnalyze} disabled={analyzing} style={{
                ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                {analyzing ? 'Analyzing...' : 'AI Competitive Analysis'}
              </button>
              {aiAnalysis && (
                <div style={styles.aiResult}>
                  <h4 style={{ color: '#3b82f6', marginBottom: '12px' }}>AI Analysis Result</h4>
                  <p style={{ color: '#e4e4e7', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{aiAnalysis}</p>
                </div>
              )}
            </div>
            <div style={styles.modalActions}>
              {hasPermission('edit') && (
                <button onClick={() => { setShowDetailModal(false); handleEdit(selectedItem); }} style={styles.editModalBtn}>Edit</button>
              )}
              {hasPermission('delete') && (
                <button onClick={() => { setShowDetailModal(false); handleDelete(selectedItem); }} style={styles.deleteModalBtn}>Delete</button>
              )}
            </div>
          </div>
        )}
      </Modal>

      <ConfirmDialog
        isOpen={confirmDialog.open}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ open: false })}
      />
    </div>
  );
};

const styles = {
  addBtn: { padding: '12px 20px', background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { color: '#a1a1aa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '500' },
  aiSection: { marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  aiBtn: { padding: '12px 24px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500' },
  aiResult: { marginTop: '16px', padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' },
  modalActions: { display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  editModalBtn: { padding: '12px 24px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#3b82f6', fontWeight: '600', cursor: 'pointer' },
  deleteModalBtn: { padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' },
};

export default Competitors;
