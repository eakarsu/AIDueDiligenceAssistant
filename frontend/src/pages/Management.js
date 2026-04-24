import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const Management = () => {
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
    company_id: '', executive_name: '', title: '', experience_years: '', background: '', leadership_score: '', retention_risk: 'Medium', key_strengths: '', concerns: '', recommendation: ''
  });

  const fetchData = async () => {
    try {
      const [managementRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/management`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(managementRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load management data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.executive_name.trim()) errs.executive_name = 'Executive name is required';
    else if (formData.executive_name.trim().length < 2) errs.executive_name = 'Name must be at least 2 characters';
    if (!formData.company_id) errs.company_id = 'Company is required';
    if (formData.experience_years && (isNaN(Number(formData.experience_years)) || Number(formData.experience_years) < 0)) errs.experience_years = 'Must be a valid positive number';
    if (formData.leadership_score && (isNaN(Number(formData.leadership_score)) || Number(formData.leadership_score) < 1 || Number(formData.leadership_score) > 10)) errs.leadership_score = 'Must be between 1 and 10';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/management/${selectedItem.id}`, formData);
        addToast('Executive updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/management`, formData);
        addToast('Executive created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save executive', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Executive',
      message: `Are you sure you want to delete "${item.executive_name}"? This action cannot be undone and will remove all associated data.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/management/${item.id}`);
          addToast('Executive deleted successfully', 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete executive', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Executives',
      message: `Are you sure you want to delete ${ids.length} executive records? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/management/bulk-delete`, { ids });
          addToast(`${ids.length} executives deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete executives', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', executive_name: item.executive_name || '', title: item.title || '',
      experience_years: item.experience_years || '', background: item.background || '', leadership_score: item.leadership_score || '',
      retention_risk: item.retention_risk || 'Medium', key_strengths: item.key_strengths || '', concerns: item.concerns || '', recommendation: item.recommendation || ''
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
      const response = await axios.post(`${API_URL}/management/${selectedItem.id}/analyze`);
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
    setFormData({ company_id: '', executive_name: '', title: '', experience_years: '', background: '', leadership_score: '', retention_risk: 'Medium', key_strengths: '', concerns: '', recommendation: '' });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', executive_name: '', title: '', experience_years: '', background: '', leadership_score: '', retention_risk: 'Medium', key_strengths: '', concerns: '', recommendation: '' });
    setShowModal(true);
  };

  const getRiskColor = (risk) => {
    switch (risk) {
      case 'High': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      case 'Medium': return { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      default: return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    }
  };

  const columns = [
    { key: 'executive_name', label: 'Executive' },
    { key: 'title', label: 'Title' },
    { key: 'company_name', label: 'Company' },
    { key: 'experience_years', label: 'Experience', render: (val) => val ? `${val} years` : '-' },
    { key: 'leadership_score', label: 'Score', render: (val) => val ? `${val}/10` : '-' },
    { key: 'retention_risk', label: 'Retention Risk', render: (val) => {
      const { bg, color } = getRiskColor(val);
      return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: bg, color }}>{val}</span>;
    }},
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'retention_risk', label: 'Retention Risk' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Assess leadership team and retention risks</p>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Executive</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Management"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Executive' : 'Add Executive'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Executive Name" value={formData.executive_name} onChange={(e) => setFormData({...formData, executive_name: e.target.value})} required error={errors.executive_name} />
            <FormInput label="Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} />
          </FormRow>
          <FormRow>
            <FormInput label="Company" type="select" value={formData.company_id} onChange={(e) => setFormData({...formData, company_id: e.target.value})} required error={errors.company_id}
              options={companies.map(c => ({ value: c.id, label: c.name }))} />
            <FormInput label="Experience (Years)" type="number" value={formData.experience_years} onChange={(e) => setFormData({...formData, experience_years: e.target.value})} error={errors.experience_years} />
          </FormRow>
          <FormRow>
            <FormInput label="Leadership Score (1-10)" type="number" value={formData.leadership_score} onChange={(e) => setFormData({...formData, leadership_score: e.target.value})} error={errors.leadership_score} />
            <FormInput label="Retention Risk" type="select" value={formData.retention_risk} onChange={(e) => setFormData({...formData, retention_risk: e.target.value})}
              options={['Low', 'Medium', 'High']} />
          </FormRow>
          <FormInput label="Background" type="textarea" value={formData.background} onChange={(e) => setFormData({...formData, background: e.target.value})} />
          <FormInput label="Key Strengths" type="textarea" value={formData.key_strengths} onChange={(e) => setFormData({...formData, key_strengths: e.target.value})} />
          <FormInput label="Concerns" type="textarea" value={formData.concerns} onChange={(e) => setFormData({...formData, concerns: e.target.value})} />
          <FormInput label="Recommendation" type="textarea" value={formData.recommendation} onChange={(e) => setFormData({...formData, recommendation: e.target.value})} />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Executive Details" size="large">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Executive Name</span><span style={styles.detailValue}>{selectedItem.executive_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Title</span><span style={styles.detailValue}>{selectedItem.title}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Experience</span><span style={styles.detailValue}>{selectedItem.experience_years} years</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Leadership Score</span><span style={styles.detailValue}>{selectedItem.leadership_score}/10</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Retention Risk</span><span style={styles.detailValue}>{selectedItem.retention_risk}</span></div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Background</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.background}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Key Strengths</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.key_strengths}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Concerns</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.concerns}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Recommendation</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.recommendation}</p>
            </div>
            <div style={styles.aiSection}>
              <button onClick={handleAnalyze} disabled={analyzing} style={{
                ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                {analyzing ? 'Analyzing...' : 'AI Leadership Analysis'}
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

export default Management;
