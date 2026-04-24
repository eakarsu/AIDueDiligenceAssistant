import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';

const Market = () => {
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
  const [errors, setErrors] = useState({});
  const [confirmDialog, setConfirmDialog] = useState({ isOpen: false, title: '', message: '', onConfirm: null });
  const [formData, setFormData] = useState({
    company_id: '', market_size: '', market_growth_rate: '', market_share: '', competitive_position: '', target_segments: '', geographic_presence: '', trends: ''
  });

  const fetchData = async () => {
    try {
      const [marketRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/market`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(marketRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast('Failed to load market data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.company_id) {
      newErrors.company_id = 'Company is required';
    }
    if (formData.market_size && (isNaN(Number(formData.market_size)) || Number(formData.market_size) < 0)) {
      newErrors.market_size = 'Market size must be a positive number';
    }
    if (formData.market_growth_rate && (isNaN(Number(formData.market_growth_rate)) || Number(formData.market_growth_rate) < -100 || Number(formData.market_growth_rate) > 1000)) {
      newErrors.market_growth_rate = 'Growth rate must be between -100% and 1000%';
    }
    if (formData.market_share && (isNaN(Number(formData.market_share)) || Number(formData.market_share) < 0 || Number(formData.market_share) > 100)) {
      newErrors.market_share = 'Market share must be between 0% and 100%';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validateForm()) {
      addToast('Please fix the form errors', 'error');
      return;
    }
    setSaving(true);
    try {
      if (selectedItem) {
        if (!hasPermission('edit')) {
          addToast('You do not have permission to edit', 'error');
          setSaving(false);
          return;
        }
        await axios.put(`${API_URL}/market/${selectedItem.id}`, formData);
        addToast('Market analysis updated', 'success');
      } else {
        if (!hasPermission('create')) {
          addToast('You do not have permission to create', 'error');
          setSaving(false);
          return;
        }
        await axios.post(`${API_URL}/market`, formData);
        addToast('Market analysis created', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving:', error);
      addToast(error.response?.data?.error || 'Failed to save market analysis', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    if (!hasPermission('delete')) {
      addToast('You do not have permission to delete', 'error');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Market Analysis',
      message: `Are you sure you want to delete the market analysis for "${item.company_name || 'this company'}"? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await axios.delete(`${API_URL}/market/${item.id}`);
          addToast('Market analysis deleted', 'success');
          fetchData();
        } catch (error) {
          console.error('Error deleting:', error);
          addToast('Failed to delete market analysis', 'error');
        }
      },
    });
  };

  const handleBulkDelete = (selectedIds) => {
    if (!hasPermission('bulk')) {
      addToast('You do not have permission for bulk operations', 'error');
      return;
    }
    setConfirmDialog({
      isOpen: true,
      title: 'Delete Selected Market Analyses',
      message: `Are you sure you want to delete ${selectedIds.length} selected market ${selectedIds.length === 1 ? 'analysis' : 'analyses'}? This action cannot be undone.`,
      onConfirm: async () => {
        setConfirmDialog(prev => ({ ...prev, isOpen: false }));
        try {
          await Promise.all(selectedIds.map(id => axios.delete(`${API_URL}/market/${id}`)));
          addToast(`${selectedIds.length} market ${selectedIds.length === 1 ? 'analysis' : 'analyses'} deleted`, 'success');
          fetchData();
        } catch (error) {
          console.error('Error bulk deleting:', error);
          addToast('Failed to delete some market analyses', 'error');
        }
      },
    });
  };

  const handleEdit = (item) => {
    if (!hasPermission('edit')) {
      addToast('You do not have permission to edit', 'error');
      return;
    }
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', market_size: item.market_size || '', market_growth_rate: item.market_growth_rate || '',
      market_share: item.market_share || '', competitive_position: item.competitive_position || '', target_segments: item.target_segments || '',
      geographic_presence: item.geographic_presence || '', trends: item.trends || ''
    });
    setShowModal(true);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setAiAnalysis(item.ai_analysis || '');
    setShowDetailModal(true);
  };

  const handleAnalyze = async () => {
    if (!hasPermission('analyze')) {
      addToast('You do not have permission to run AI analysis', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/market/${selectedItem.id}/analyze`);
      setAiAnalysis(response.data.analysis);
      fetchData();
      setSelectedItem(prev => ({ ...prev, ai_analysis: response.data.analysis }));
      addToast('AI analysis completed', 'success');
    } catch (error) {
      setAiAnalysis('Error: Unable to perform AI analysis. Please check your OpenRouter API key.');
      addToast('AI analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', market_size: '', market_growth_rate: '', market_share: '', competitive_position: '', target_segments: '', geographic_presence: '', trends: '' });
  };

  const handleNew = () => {
    if (!hasPermission('create')) {
      addToast('You do not have permission to create', 'error');
      return;
    }
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', market_size: '', market_growth_rate: '', market_share: '', competitive_position: '', target_segments: '', geographic_presence: '', trends: '' });
    setShowModal(true);
  };

  const columns = [
    { key: 'company_name', label: 'Company' },
    { key: 'market_size', label: 'Market Size', render: (val) => val ? `$${(Number(val)/1000000000).toFixed(1)}B` : '-' },
    { key: 'market_growth_rate', label: 'Growth Rate', render: (val) => val ? `${val}%` : '-' },
    { key: 'market_share', label: 'Market Share', render: (val) => val ? `${val}%` : '-' },
    { key: 'competitive_position', label: 'Position' },
    { key: 'geographic_presence', label: 'Geography' },
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'competitive_position', label: 'Position' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Analyze market positioning and growth opportunities</p>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Market Analysis</button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions}
      />

      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Market Analysis' : 'Add Market Analysis'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Company" type="select" value={formData.company_id} onChange={(e) => { setFormData({...formData, company_id: e.target.value}); setErrors(prev => ({ ...prev, company_id: '' })); }} required
              options={companies.map(c => ({ value: c.id, label: c.name }))} error={errors.company_id} />
            <FormInput label="Competitive Position" type="select" value={formData.competitive_position} onChange={(e) => setFormData({...formData, competitive_position: e.target.value})}
              options={['Leader', 'Challenger', 'Fast Follower', 'Niche Player']} />
          </FormRow>
          <FormRow>
            <FormInput label="Market Size ($)" type="number" value={formData.market_size} onChange={(e) => { setFormData({...formData, market_size: e.target.value}); setErrors(prev => ({ ...prev, market_size: '' })); }} error={errors.market_size} />
            <FormInput label="Market Growth Rate (%)" type="number" value={formData.market_growth_rate} onChange={(e) => { setFormData({...formData, market_growth_rate: e.target.value}); setErrors(prev => ({ ...prev, market_growth_rate: '' })); }} error={errors.market_growth_rate} />
          </FormRow>
          <FormRow>
            <FormInput label="Market Share (%)" type="number" value={formData.market_share} onChange={(e) => { setFormData({...formData, market_share: e.target.value}); setErrors(prev => ({ ...prev, market_share: '' })); }} error={errors.market_share} />
            <FormInput label="Geographic Presence" value={formData.geographic_presence} onChange={(e) => setFormData({...formData, geographic_presence: e.target.value})} />
          </FormRow>
          <FormInput label="Target Segments" type="textarea" value={formData.target_segments} onChange={(e) => setFormData({...formData, target_segments: e.target.value})} />
          <FormInput label="Market Trends" type="textarea" value={formData.trends} onChange={(e) => setFormData({...formData, trends: e.target.value})} />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Market Analysis Details" size="large">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Market Size</span><span style={styles.detailValue}>{selectedItem.market_size ? `$${(Number(selectedItem.market_size)/1000000000).toFixed(1)}B` : '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Growth Rate</span><span style={styles.detailValue}>{selectedItem.market_growth_rate ? `${selectedItem.market_growth_rate}%` : '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Market Share</span><span style={styles.detailValue}>{selectedItem.market_share ? `${selectedItem.market_share}%` : '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Competitive Position</span><span style={styles.detailValue}>{selectedItem.competitive_position || '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Geographic Presence</span><span style={styles.detailValue}>{selectedItem.geographic_presence || '-'}</span></div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Target Segments</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.target_segments || '-'}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Market Trends</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.trends || '-'}</p>
            </div>
            <div style={styles.aiSection}>
              <button onClick={handleAnalyze} disabled={analyzing || !hasPermission('analyze')} style={{
                ...styles.aiBtn,
                opacity: analyzing || !hasPermission('analyze') ? 0.6 : 1,
                cursor: analyzing || !hasPermission('analyze') ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}>
                {analyzing && (
                  <span style={{
                    display: 'inline-block', width: '14px', height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    borderRadius: '50%', animation: 'spin 0.6s linear infinite',
                  }} />
                )}
                {analyzing ? 'Analyzing...' : 'AI Market Analysis'}
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
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
      />

      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
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
  aiBtn: { padding: '12px 24px', background: 'linear-gradient(90deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  aiResult: { marginTop: '16px', padding: '20px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.2)' },
  modalActions: { display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  editModalBtn: { padding: '12px 24px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#3b82f6', fontWeight: '600', cursor: 'pointer' },
  deleteModalBtn: { padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' },
};

export default Market;
