import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const Risks = () => {
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
    company_id: '', risk_type: '', title: '', description: '', severity: 'Medium', likelihood: 'Medium', impact: 'Medium', mitigation_strategy: '', status: 'Open'
  });

  const fetchData = async () => {
    try {
      const [risksRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/risks`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(risksRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load risks', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Risk title is required';
    else if (formData.title.trim().length < 3) errs.title = 'Title must be at least 3 characters';
    if (!formData.company_id) errs.company_id = 'Company is required';
    if (!formData.risk_type.trim()) errs.risk_type = 'Risk type is required';
    if (!formData.description.trim()) errs.description = 'Description is required';
    if (!formData.mitigation_strategy.trim()) errs.mitigation_strategy = 'Mitigation strategy is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/risks/${selectedItem.id}`, formData);
        addToast('Risk updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/risks`, formData);
        addToast('Risk created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save risk', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Risk',
      message: `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/risks/${item.id}`);
          addToast('Risk deleted successfully', 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete risk', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Risks',
      message: `Are you sure you want to delete ${ids.length} risks? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/risks/bulk-delete`, { ids });
          addToast(`${ids.length} risks deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete risks', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', risk_type: item.risk_type || '', title: item.title || '',
      description: item.description || '', severity: item.severity || 'Medium', likelihood: item.likelihood || 'Medium',
      impact: item.impact || 'Medium', mitigation_strategy: item.mitigation_strategy || '', status: item.status || 'Open'
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
      const response = await axios.post(`${API_URL}/risks/${selectedItem.id}/analyze`);
      setAiAnalysis(response.data.analysis);
      fetchData();
      setSelectedItem(prev => ({ ...prev, ai_analysis: response.data.analysis }));
      addToast('AI risk analysis completed', 'success');
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
    setFormData({ company_id: '', risk_type: '', title: '', description: '', severity: 'Medium', likelihood: 'Medium', impact: 'Medium', mitigation_strategy: '', status: 'Open' });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', risk_type: '', title: '', description: '', severity: 'Medium', likelihood: 'Medium', impact: 'Medium', mitigation_strategy: '', status: 'Open' });
    setShowModal(true);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return { bg: 'rgba(220, 38, 38, 0.2)', color: '#dc2626' };
      case 'High': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      case 'Medium': return { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      default: return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    }
  };

  const columns = [
    { key: 'title', label: 'Risk Title' },
    { key: 'company_name', label: 'Company' },
    { key: 'risk_type', label: 'Type' },
    { key: 'severity', label: 'Severity', render: (val) => {
      const { bg, color } = getSeverityColor(val);
      return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: bg, color }}>{val}</span>;
    }},
    { key: 'likelihood', label: 'Likelihood' },
    { key: 'status', label: 'Status', render: (val) => (
      <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
        background: val === 'Resolved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
        color: val === 'Resolved' ? '#10b981' : '#ef4444' }}>{val}</span>
    )},
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'severity', label: 'Severity' },
    { key: 'status', label: 'Status' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Identify and track potential deal risks</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Risk</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Risks"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Risk' : 'Add Risk'} size="large">
        <form onSubmit={handleSubmit}>
          <FormInput label="Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required error={errors.title} />
          <FormRow>
            <FormInput label="Company" type="select" value={formData.company_id} onChange={(e) => setFormData({...formData, company_id: e.target.value})}
              options={companies.map(c => ({ value: c.id, label: c.name }))} required error={errors.company_id} />
            <FormInput label="Risk Type" value={formData.risk_type} onChange={(e) => setFormData({...formData, risk_type: e.target.value})} required error={errors.risk_type} />
          </FormRow>
          <FormRow>
            <FormInput label="Severity" type="select" value={formData.severity} onChange={(e) => setFormData({...formData, severity: e.target.value})}
              options={['Low', 'Medium', 'High', 'Critical']} />
            <FormInput label="Likelihood" type="select" value={formData.likelihood} onChange={(e) => setFormData({...formData, likelihood: e.target.value})}
              options={['Low', 'Medium', 'High']} />
          </FormRow>
          <FormRow>
            <FormInput label="Impact" type="select" value={formData.impact} onChange={(e) => setFormData({...formData, impact: e.target.value})}
              options={['Low', 'Medium', 'High', 'Critical']} />
            <FormInput label="Status" type="select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
              options={['Open', 'In Progress', 'Mitigated', 'Resolved']} />
          </FormRow>
          <FormInput label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} required error={errors.description} />
          <FormInput label="Mitigation Strategy" type="textarea" value={formData.mitigation_strategy} onChange={(e) => setFormData({...formData, mitigation_strategy: e.target.value})} required error={errors.mitigation_strategy} />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Risk Details" size="large">
        {selectedItem && (
          <div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>{selectedItem.title}</h3>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Risk Type</span><span style={styles.detailValue}>{selectedItem.risk_type}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Severity</span><span style={styles.detailValue}>{selectedItem.severity}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Likelihood</span><span style={styles.detailValue}>{selectedItem.likelihood}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Impact</span><span style={styles.detailValue}>{selectedItem.impact}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Status</span><span style={styles.detailValue}>{selectedItem.status}</span></div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Description</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.description}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Mitigation Strategy</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.mitigation_strategy}</p>
            </div>
            <div style={styles.aiSection}>
              <button onClick={handleAnalyze} disabled={analyzing} style={{
                ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                {analyzing ? 'Analyzing...' : 'AI Risk Analysis'}
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

export default Risks;
