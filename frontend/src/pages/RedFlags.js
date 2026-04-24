import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';

const initialFormData = {
  company_id: '', category: '', title: '', description: '',
  evidence: '', priority: 'Medium', recommendation: '', status: 'Active',
};

const filterOptions = [
  { key: 'company_name', label: 'Company' },
  { key: 'category', label: 'Category' },
  { key: 'priority', label: 'Priority' },
  { key: 'status', label: 'Status' },
];

const RedFlags = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();

  const [data, setData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [aiAnalysis, setAiAnalysis] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [formData, setFormData] = useState({ ...initialFormData });
  const [formErrors, setFormErrors] = useState({});

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmBulkIds, setConfirmBulkIds] = useState(null);

  const fetchData = async () => {
    try {
      const [flagsRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/redflags`),
        axios.get(`${API_URL}/companies`),
      ]);
      setData(flagsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load red flags data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---------- Validation ----------
  const validate = () => {
    const errors = {};
    if (!formData.title.trim()) errors.title = 'Title is required';
    if (!formData.company_id) errors.company_id = 'Company is required';
    if (!formData.category) errors.category = 'Category is required';
    if (!formData.description.trim()) errors.description = 'Description is required';
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // ---------- Submit (Create / Update) ----------
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/redflags/${selectedItem.id}`, formData);
        addToast('Red flag updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/redflags`, formData);
        addToast('Red flag created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      const msg = error.response?.data?.error || 'Failed to save red flag';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // ---------- Delete (single) ----------
  const requestDelete = (item) => {
    setConfirmTarget(item);
    setConfirmBulkIds(null);
    setConfirmOpen(true);
  };

  const executeDelete = async () => {
    if (!confirmTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/redflags/${confirmTarget.id}`);
      addToast('Red flag deleted successfully', 'success');
      fetchData();
    } catch (error) {
      addToast('Failed to delete red flag', 'error');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmTarget(null);
    }
  };

  // ---------- Bulk Delete ----------
  const onBulkDelete = (ids) => {
    if (!hasPermission('bulk')) return;
    setConfirmBulkIds(ids);
    setConfirmTarget(null);
    setConfirmOpen(true);
  };

  const executeBulkDelete = async () => {
    if (!confirmBulkIds || confirmBulkIds.length === 0) return;
    setDeleting(true);
    try {
      await Promise.all(confirmBulkIds.map((id) => axios.delete(`${API_URL}/redflags/${id}`)));
      addToast(`${confirmBulkIds.length} red flag(s) deleted successfully`, 'success');
      fetchData();
    } catch (error) {
      addToast('Failed to delete some red flags', 'error');
    } finally {
      setDeleting(false);
      setConfirmOpen(false);
      setConfirmBulkIds(null);
    }
  };

  const handleConfirm = () => {
    if (confirmBulkIds) {
      executeBulkDelete();
    } else {
      executeDelete();
    }
  };

  // ---------- Edit ----------
  const handleEdit = (item) => {
    if (!hasPermission('edit')) {
      addToast('You do not have permission to edit red flags', 'warning');
      return;
    }
    setSelectedItem(item);
    setFormErrors({});
    setFormData({
      company_id: item.company_id || '',
      category: item.category || '',
      title: item.title || '',
      description: item.description || '',
      evidence: item.evidence || '',
      priority: item.priority || 'Medium',
      recommendation: item.recommendation || '',
      status: item.status || 'Active',
    });
    setShowModal(true);
  };

  // ---------- Row click -> detail modal ----------
  const handleRowClick = (item) => {
    setSelectedItem(item);
    setAiAnalysis(item.ai_analysis || '');
    setShowDetailModal(true);
  };

  // ---------- AI Analysis ----------
  const handleAnalyze = async () => {
    if (!hasPermission('analyze')) {
      addToast('You do not have permission to run AI analysis', 'warning');
      return;
    }
    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/redflags/${selectedItem.id}/analyze`);
      setAiAnalysis(response.data.analysis);
      addToast('AI analysis completed', 'success');
      fetchData();
      setSelectedItem((prev) => ({ ...prev, ai_analysis: response.data.analysis }));
    } catch (error) {
      setAiAnalysis('Error: Unable to perform AI analysis. Please check your OpenRouter API key.');
      addToast('AI analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  // ---------- Modal helpers ----------
  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setFormErrors({});
    setFormData({ ...initialFormData });
  };

  const handleNew = () => {
    if (!hasPermission('create')) {
      addToast('You do not have permission to create red flags', 'warning');
      return;
    }
    setSelectedItem(null);
    setFormErrors({});
    setFormData({ ...initialFormData });
    setShowModal(true);
  };

  // ---------- Helpers ----------
  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical': return { bg: 'rgba(220, 38, 38, 0.2)', color: '#dc2626' };
      case 'High': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      case 'Medium': return { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      default: return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    }
  };

  // ---------- Columns ----------
  const columns = [
    { key: 'title', label: 'Red Flag' },
    { key: 'company_name', label: 'Company' },
    { key: 'category', label: 'Category' },
    {
      key: 'priority',
      label: 'Priority',
      render: (val) => {
        const { bg, color } = getPriorityColor(val);
        return (
          <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: bg, color }}>
            {val}
          </span>
        );
      },
    },
    {
      key: 'status',
      label: 'Status',
      render: (val) => (
        <span
          style={{
            padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
            background: val === 'Resolved' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
            color: val === 'Resolved' ? '#10b981' : '#ef4444',
          }}
        >
          {val}
        </span>
      ),
    },
  ];

  // ---------- Render ----------
  if (loading) {
    return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Track and investigate potential deal-breakers</p>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Red Flag</button>
        )}
      </div>

      {/* Data Table */}
      <DataTable
        columns={columns}
        data={data}
        onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? requestDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? onBulkDelete : undefined}
        filterOptions={filterOptions}
      />

      {/* Create / Edit Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Red Flag' : 'Add Red Flag'} size="large">
        <form onSubmit={handleSubmit}>
          <FormInput
            label="Title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            required
            error={formErrors.title}
          />
          <FormRow>
            <FormInput
              label="Company"
              type="select"
              value={formData.company_id}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              options={companies.map((c) => ({ value: c.id, label: c.name }))}
              required
              error={formErrors.company_id}
            />
            <FormInput
              label="Category"
              type="select"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              options={['Financial', 'Legal', 'Regulatory', 'Management', 'Operational', 'Market', 'Environmental', 'Compliance', 'Security', 'Product']}
              required
              error={formErrors.category}
            />
          </FormRow>
          <FormRow>
            <FormInput
              label="Priority"
              type="select"
              value={formData.priority}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
              options={['Low', 'Medium', 'High', 'Critical']}
            />
            <FormInput
              label="Status"
              type="select"
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              options={['Active', 'Under Investigation', 'Resolved', 'Dismissed']}
            />
          </FormRow>
          <FormInput
            label="Description"
            type="textarea"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            required
            error={formErrors.description}
          />
          <FormInput
            label="Evidence"
            type="textarea"
            value={formData.evidence}
            onChange={(e) => setFormData({ ...formData, evidence: e.target.value })}
          />
          <FormInput
            label="Recommendation"
            type="textarea"
            value={formData.recommendation}
            onChange={(e) => setFormData({ ...formData, recommendation: e.target.value })}
          />
          <FormButtons
            onCancel={handleCloseModal}
            submitLabel={selectedItem ? 'Update' : 'Create'}
            loading={saving}
          />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Red Flag Details" size="large">
        {selectedItem && (
          <div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>{selectedItem.title}</h3>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Company</span>
                <span style={styles.detailValue}>{selectedItem.company_name}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Category</span>
                <span style={styles.detailValue}>{selectedItem.category}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Priority</span>
                <span style={styles.detailValue}>{selectedItem.priority}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Status</span>
                <span style={styles.detailValue}>{selectedItem.status}</span>
              </div>
            </div>

            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Description</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.description}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Evidence</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.evidence}</p>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Recommendation</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.recommendation}</p>
            </div>

            {/* AI Analysis Section */}
            <div style={styles.aiSection}>
              {hasPermission('analyze') && (
                <button onClick={handleAnalyze} disabled={analyzing} style={{
                  ...styles.aiBtn,
                  opacity: analyzing ? 0.7 : 1,
                  cursor: analyzing ? 'not-allowed' : 'pointer',
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
                  {analyzing ? 'Analyzing...' : 'AI Red Flag Analysis'}
                </button>
              )}
              {aiAnalysis && (
                <div style={styles.aiResult}>
                  <h4 style={{ color: '#3b82f6', marginBottom: '12px' }}>AI Analysis Result</h4>
                  <p style={{ color: '#e4e4e7', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{aiAnalysis}</p>
                </div>
              )}
            </div>

            {/* Detail modal actions */}
            <div style={styles.modalActions}>
              {hasPermission('edit') && (
                <button
                  onClick={() => { setShowDetailModal(false); handleEdit(selectedItem); }}
                  style={styles.editModalBtn}
                >
                  Edit
                </button>
              )}
              {hasPermission('delete') && (
                <button
                  onClick={() => { setShowDetailModal(false); requestDelete(selectedItem); }}
                  style={styles.deleteModalBtn}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Confirm Delete Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmBulkIds ? 'Delete Selected Red Flags' : 'Delete Red Flag'}
        message={
          confirmBulkIds
            ? `Are you sure you want to delete ${confirmBulkIds.length} selected red flag(s)? This action cannot be undone.`
            : `Are you sure you want to delete "${confirmTarget?.title}"? This action cannot be undone.`
        }
        confirmLabel={deleting ? 'Deleting...' : 'Delete'}
        onConfirm={handleConfirm}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); setConfirmBulkIds(null); }}
        variant="danger"
      />
    </div>
  );
};

const styles = {
  addBtn: {
    padding: '12px 20px',
    background: 'linear-gradient(90deg, #3b82f6, #8b5cf6)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
    cursor: 'pointer',
  },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { color: '#a1a1aa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '500' },
  aiSection: { marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  aiBtn: {
    padding: '12px 24px',
    background: 'linear-gradient(90deg, #8b5cf6, #ec4899)',
    border: 'none',
    borderRadius: '8px',
    color: '#fff',
    fontSize: '14px',
    fontWeight: '500',
  },
  aiResult: {
    marginTop: '16px',
    padding: '20px',
    background: 'rgba(59, 130, 246, 0.1)',
    borderRadius: '12px',
    border: '1px solid rgba(59, 130, 246, 0.2)',
  },
  modalActions: {
    display: 'flex',
    gap: '12px',
    marginTop: '24px',
    paddingTop: '20px',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
  },
  editModalBtn: {
    padding: '12px 24px',
    background: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.5)',
    borderRadius: '8px',
    color: '#3b82f6',
    fontWeight: '600',
    cursor: 'pointer',
  },
  deleteModalBtn: {
    padding: '12px 24px',
    background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)',
    borderRadius: '8px',
    color: '#ef4444',
    fontWeight: '600',
    cursor: 'pointer',
  },
};

export default RedFlags;
