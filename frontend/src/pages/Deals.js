import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';

const initialFormData = {
  company_id: '', deal_name: '', deal_type: '', stage: 'Initial Review',
  valuation: '', offer_price: '', expected_close_date: '',
  lead_partner: '', deal_team: '', priority: 'Medium', notes: '',
};

const filterOptions = [
  { key: 'company_name', label: 'Company' },
  { key: 'stage', label: 'Stage' },
  { key: 'deal_type', label: 'Type' },
  { key: 'priority', label: 'Priority' },
];

const Deals = () => {
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
  const [formData, setFormData] = useState({ ...initialFormData });
  const [errors, setErrors] = useState({});

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null);
  const [confirmBulkIds, setConfirmBulkIds] = useState(null);

  const fetchData = useCallback(async () => {
    try {
      const [dealsRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/deals`),
        axios.get(`${API_URL}/companies`),
      ]);
      setData(dealsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast('Failed to load deals data.', 'error');
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ---- Form Validation ----
  const validate = () => {
    const errs = {};
    if (!formData.deal_name.trim()) errs.deal_name = 'Deal name is required.';
    if (!formData.company_id) errs.company_id = 'Target company is required.';
    if (!formData.deal_type) errs.deal_type = 'Deal type is required.';
    if (!formData.stage) errs.stage = 'Stage is required.';
    if (formData.valuation && (isNaN(Number(formData.valuation)) || Number(formData.valuation) < 0)) {
      errs.valuation = 'Valuation must be a positive number.';
    }
    if (formData.offer_price && (isNaN(Number(formData.offer_price)) || Number(formData.offer_price) < 0)) {
      errs.offer_price = 'Offer price must be a positive number.';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  // ---- CRUD Handlers ----
  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) {
      addToast('Please fix the highlighted errors.', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/deals/${selectedItem.id}`, formData);
        addToast('Deal updated successfully.', 'success');
      } else {
        await axios.post(`${API_URL}/deals`, formData);
        addToast('Deal created successfully.', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      console.error('Error saving:', error);
      const msg = error.response?.data?.error || 'Failed to save deal.';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Opens the ConfirmDialog for a single delete
  const handleDeleteRequest = (item) => {
    setConfirmTarget(item);
    setConfirmBulkIds(null);
    setConfirmOpen(true);
  };

  // Executes once user confirms
  const handleDeleteConfirm = async () => {
    setConfirmOpen(false);
    if (confirmTarget) {
      try {
        await axios.delete(`${API_URL}/deals/${confirmTarget.id}`);
        addToast('Deal deleted successfully.', 'success');
        fetchData();
        // If the detail modal was showing this item, close it
        if (showDetailModal && selectedItem && selectedItem.id === confirmTarget.id) {
          setShowDetailModal(false);
          setSelectedItem(null);
        }
      } catch (error) {
        console.error('Error deleting:', error);
        addToast('Failed to delete deal.', 'error');
      }
      setConfirmTarget(null);
    }
  };

  const handleDeleteCancel = () => {
    setConfirmOpen(false);
    setConfirmTarget(null);
    setConfirmBulkIds(null);
  };

  // Bulk delete
  const handleBulkDeleteRequest = (ids) => {
    if (!hasPermission('bulk')) {
      addToast('You do not have permission to perform bulk operations.', 'error');
      return;
    }
    setConfirmBulkIds(ids);
    setConfirmTarget(null);
    setConfirmOpen(true);
  };

  const handleBulkDeleteConfirm = async () => {
    setConfirmOpen(false);
    if (confirmBulkIds && confirmBulkIds.length > 0) {
      try {
        await Promise.all(confirmBulkIds.map(id => axios.delete(`${API_URL}/deals/${id}`)));
        addToast(`${confirmBulkIds.length} deal(s) deleted successfully.`, 'success');
        fetchData();
      } catch (error) {
        console.error('Error bulk deleting:', error);
        addToast('Failed to delete some deals.', 'error');
      }
      setConfirmBulkIds(null);
    }
  };

  const handleEdit = (item) => {
    if (!hasPermission('edit')) {
      addToast('You do not have permission to edit deals.', 'error');
      return;
    }
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '',
      deal_name: item.deal_name || '',
      deal_type: item.deal_type || '',
      stage: item.stage || 'Initial Review',
      valuation: item.valuation || '',
      offer_price: item.offer_price || '',
      expected_close_date: item.expected_close_date?.split('T')[0] || '',
      lead_partner: item.lead_partner || '',
      deal_team: item.deal_team || '',
      priority: item.priority || 'Medium',
      notes: item.notes || '',
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
      addToast('You do not have permission to run AI analysis.', 'error');
      return;
    }
    setAnalyzing(true);
    try {
      const response = await axios.post(`${API_URL}/deals/${selectedItem.id}/analyze`);
      setAiAnalysis(response.data.analysis);
      addToast('AI analysis completed.', 'success');
      fetchData();
      setSelectedItem(prev => ({ ...prev, ai_analysis: response.data.analysis }));
    } catch (error) {
      setAiAnalysis('Error: Unable to perform AI analysis. Please check your OpenRouter API key.');
      addToast('AI analysis failed.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setErrors({});
    setFormData({ ...initialFormData });
  };

  const handleNew = () => {
    if (!hasPermission('create')) {
      addToast('You do not have permission to create deals.', 'error');
      return;
    }
    setSelectedItem(null);
    setErrors({});
    setFormData({ ...initialFormData });
    setShowModal(true);
  };

  // ---- Column Helpers ----
  const getStageColor = (stage) => {
    switch (stage) {
      case 'Due Diligence': return { bg: 'rgba(139, 92, 246, 0.2)', color: '#8b5cf6' };
      case 'LOI Signed': return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
      case 'Term Sheet': return { bg: 'rgba(59, 130, 246, 0.2)', color: '#3b82f6' };
      case 'Closed': return { bg: 'rgba(20, 184, 166, 0.2)', color: '#14b8a6' };
      default: return { bg: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' };
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'Critical': return { bg: 'rgba(220, 38, 38, 0.2)', color: '#dc2626' };
      case 'High': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      case 'Medium': return { bg: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b' };
      default: return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
    }
  };

  const columns = [
    { key: 'deal_name', label: 'Deal Name' },
    { key: 'company_name', label: 'Target Company' },
    { key: 'deal_type', label: 'Type' },
    { key: 'stage', label: 'Stage', render: (val) => {
      const { bg, color } = getStageColor(val);
      return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: bg, color }}>{val}</span>;
    }},
    { key: 'valuation', label: 'Valuation', render: (val) => val ? `$${(Number(val)/1000000).toFixed(0)}M` : '-' },
    { key: 'priority', label: 'Priority', render: (val) => {
      const { bg, color } = getPriorityColor(val);
      return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: bg, color }}>{val}</span>;
    }},
    { key: 'expected_close_date', label: 'Expected Close', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
  ];

  // ---- Confirm dialog message ----
  const confirmTitle = confirmBulkIds ? 'Delete Selected Deals' : 'Delete Deal';
  const confirmMessage = confirmBulkIds
    ? `Are you sure you want to delete ${confirmBulkIds.length} selected deal(s)? This action cannot be undone.`
    : `Are you sure you want to delete "${confirmTarget?.deal_name}"? This action cannot be undone.`;

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Track and manage M&A deal pipeline</p>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Deal</button>
        )}
      </div>

      <DataTable
        columns={columns}
        data={data}
        onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDeleteRequest : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDeleteRequest : undefined}
        filterOptions={filterOptions}
      />

      {/* Create / Edit Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Deal' : 'Add Deal'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput
              label="Deal Name" value={formData.deal_name} required
              error={errors.deal_name}
              onChange={(e) => setFormData({ ...formData, deal_name: e.target.value })}
            />
            <FormInput
              label="Target Company" type="select" value={formData.company_id} required
              error={errors.company_id}
              options={companies.map(c => ({ value: c.id, label: c.name }))}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
            />
          </FormRow>
          <FormRow>
            <FormInput
              label="Deal Type" type="select" value={formData.deal_type} required
              error={errors.deal_type}
              options={['Acquisition', 'Majority Stake', 'Strategic Investment', 'Merger', 'Joint Venture']}
              onChange={(e) => setFormData({ ...formData, deal_type: e.target.value })}
            />
            <FormInput
              label="Stage" type="select" value={formData.stage} required
              error={errors.stage}
              options={['Initial Review', 'Preliminary', 'Term Sheet', 'LOI Signed', 'Due Diligence', 'Negotiation', 'Closed', 'Terminated']}
              onChange={(e) => setFormData({ ...formData, stage: e.target.value })}
            />
          </FormRow>
          <FormRow>
            <FormInput
              label="Valuation ($)" type="number" value={formData.valuation}
              error={errors.valuation}
              onChange={(e) => setFormData({ ...formData, valuation: e.target.value })}
            />
            <FormInput
              label="Offer Price ($)" type="number" value={formData.offer_price}
              error={errors.offer_price}
              onChange={(e) => setFormData({ ...formData, offer_price: e.target.value })}
            />
          </FormRow>
          <FormRow>
            <FormInput
              label="Expected Close Date" type="date" value={formData.expected_close_date}
              onChange={(e) => setFormData({ ...formData, expected_close_date: e.target.value })}
            />
            <FormInput
              label="Priority" type="select" value={formData.priority}
              options={['Low', 'Medium', 'High', 'Critical']}
              onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
            />
          </FormRow>
          <FormRow>
            <FormInput
              label="Lead Partner" value={formData.lead_partner}
              onChange={(e) => setFormData({ ...formData, lead_partner: e.target.value })}
            />
            <FormInput
              label="Deal Team" value={formData.deal_team}
              onChange={(e) => setFormData({ ...formData, deal_team: e.target.value })}
            />
          </FormRow>
          <FormInput
            label="Notes" type="textarea" value={formData.notes}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
          />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Deal Details" size="large">
        {selectedItem && (
          <div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>{selectedItem.deal_name}</h3>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Target Company</span>
                <span style={styles.detailValue}>{selectedItem.company_name || '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Deal Type</span>
                <span style={styles.detailValue}>{selectedItem.deal_type || '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Stage</span>
                <span style={styles.detailValue}>{selectedItem.stage || '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Priority</span>
                <span style={styles.detailValue}>{selectedItem.priority || '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Valuation</span>
                <span style={styles.detailValue}>{selectedItem.valuation ? `$${(Number(selectedItem.valuation)/1000000).toFixed(0)}M` : '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Offer Price</span>
                <span style={styles.detailValue}>{selectedItem.offer_price ? `$${(Number(selectedItem.offer_price)/1000000).toFixed(0)}M` : '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Expected Close</span>
                <span style={styles.detailValue}>{selectedItem.expected_close_date ? new Date(selectedItem.expected_close_date).toLocaleDateString() : '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Lead Partner</span>
                <span style={styles.detailValue}>{selectedItem.lead_partner || '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Deal Team</span>
                <span style={styles.detailValue}>{selectedItem.deal_team || '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Company ID</span>
                <span style={styles.detailValue}>{selectedItem.company_id || '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Created</span>
                <span style={styles.detailValue}>{selectedItem.created_at ? new Date(selectedItem.created_at).toLocaleDateString() : '-'}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Updated</span>
                <span style={styles.detailValue}>{selectedItem.updated_at ? new Date(selectedItem.updated_at).toLocaleDateString() : '-'}</span>
              </div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Notes</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.notes || '-'}</p>
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
                  {analyzing ? 'Analyzing...' : 'AI Deal Analysis'}
                </button>
              )}
              {aiAnalysis && (
                <div style={styles.aiResult}>
                  <h4 style={{ color: '#3b82f6', marginBottom: '12px' }}>AI Analysis Result</h4>
                  <p style={{ color: '#e4e4e7', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{aiAnalysis}</p>
                </div>
              )}
            </div>

            {/* Detail Modal Actions - permission guarded */}
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
                  onClick={() => { setShowDetailModal(false); handleDeleteRequest(selectedItem); }}
                  style={styles.deleteModalBtn}
                >
                  Delete
                </button>
              )}
            </div>
          </div>
        )}
      </Modal>

      {/* Custom Confirm Dialog for Delete */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={confirmBulkIds ? handleBulkDeleteConfirm : handleDeleteConfirm}
        onCancel={handleDeleteCancel}
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
  detailGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
    gap: '16px',
  },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: {
    color: '#a1a1aa',
    fontSize: '12px',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '500' },
  aiSection: {
    marginTop: '24px',
    paddingTop: '24px',
    borderTop: '1px solid rgba(59, 130, 246, 0.2)',
  },
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

export default Deals;
