import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const Companies = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [data, setData] = useState([]);
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
    name: '', industry: '', revenue: '', employees: '', headquarters: '', website: '', description: '', status: 'Under Review'
  });

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/companies`);
      setData(response.data);
    } catch (error) {
      addToast('Failed to load companies', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.name.trim()) errs.name = 'Company name is required';
    else if (formData.name.trim().length < 2) errs.name = 'Name must be at least 2 characters';
    if (formData.revenue && isNaN(Number(formData.revenue))) errs.revenue = 'Must be a valid number';
    if (formData.employees && isNaN(Number(formData.employees))) errs.employees = 'Must be a valid number';
    if (formData.website && formData.website.trim() && !/^(https?:\/\/)?[\w.-]+\.\w{2,}/.test(formData.website)) errs.website = 'Invalid website format';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/companies/${selectedItem.id}`, formData);
        addToast('Company updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/companies`, formData);
        addToast('Company created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save company', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Company',
      message: `Are you sure you want to delete "${item.name}"? This action cannot be undone and will remove all associated data.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/companies/${item.id}`);
          addToast('Company deleted successfully', 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete company', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Companies',
      message: `Are you sure you want to delete ${ids.length} companies? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/companies/bulk-delete`, { ids });
          addToast(`${ids.length} companies deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete companies', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      name: item.name || '', industry: item.industry || '', revenue: item.revenue || '',
      employees: item.employees || '', headquarters: item.headquarters || '',
      website: item.website || '', description: item.description || '', status: item.status || 'Under Review'
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
      const response = await axios.post(`${API_URL}/companies/${selectedItem.id}/analyze`);
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
    setFormData({ name: '', industry: '', revenue: '', employees: '', headquarters: '', website: '', description: '', status: 'Under Review' });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({ name: '', industry: '', revenue: '', employees: '', headquarters: '', website: '', description: '', status: 'Under Review' });
    setShowModal(true);
  };

  const columns = [
    { key: 'name', label: 'Company Name' },
    { key: 'industry', label: 'Industry' },
    { key: 'revenue', label: 'Revenue', render: (val) => val ? `$${Number(val).toLocaleString()}` : '-' },
    { key: 'employees', label: 'Employees', render: (val) => val ? Number(val).toLocaleString() : '-' },
    { key: 'headquarters', label: 'HQ' },
    { key: 'status', label: 'Status', render: (val) => (
      <span style={{
        padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500',
        background: val === 'Active Due Diligence' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(59, 130, 246, 0.2)',
        color: val === 'Active Due Diligence' ? '#10b981' : '#3b82f6'
      }}>{val}</span>
    )},
  ];

  const filterOptions = [
    { key: 'industry', label: 'Industry' },
    { key: 'status', label: 'Status' },
    { key: 'headquarters', label: 'Headquarters' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Manage target companies for M&A analysis</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Company</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Companies"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Company' : 'Add Company'}>
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Company Name" value={formData.name} onChange={(e) => setFormData({...formData, name: e.target.value})} required error={errors.name} />
            <FormInput label="Industry" value={formData.industry} onChange={(e) => setFormData({...formData, industry: e.target.value})} />
          </FormRow>
          <FormRow>
            <FormInput label="Revenue ($)" type="number" value={formData.revenue} onChange={(e) => setFormData({...formData, revenue: e.target.value})} error={errors.revenue} />
            <FormInput label="Employees" type="number" value={formData.employees} onChange={(e) => setFormData({...formData, employees: e.target.value})} error={errors.employees} />
          </FormRow>
          <FormRow>
            <FormInput label="Headquarters" value={formData.headquarters} onChange={(e) => setFormData({...formData, headquarters: e.target.value})} />
            <FormInput label="Website" value={formData.website} onChange={(e) => setFormData({...formData, website: e.target.value})} error={errors.website} />
          </FormRow>
          <FormInput label="Status" type="select" value={formData.status} onChange={(e) => setFormData({...formData, status: e.target.value})}
            options={['Preliminary', 'Under Review', 'Active Due Diligence', 'On Hold', 'Completed']} />
          <FormInput label="Description" type="textarea" value={formData.description} onChange={(e) => setFormData({...formData, description: e.target.value})} />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Company Details" size="large">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company Name</span><span style={styles.detailValue}>{selectedItem.name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Industry</span><span style={styles.detailValue}>{selectedItem.industry}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Revenue</span><span style={styles.detailValue}>${Number(selectedItem.revenue).toLocaleString()}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Employees</span><span style={styles.detailValue}>{Number(selectedItem.employees).toLocaleString()}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Headquarters</span><span style={styles.detailValue}>{selectedItem.headquarters}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Website</span><span style={styles.detailValue}>{selectedItem.website}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Status</span><span style={styles.detailValue}>{selectedItem.status}</span></div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Description</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.description}</p>
            </div>
            <div style={styles.aiSection}>
              <button onClick={handleAnalyze} disabled={analyzing} style={{
                ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                {analyzing ? 'Analyzing...' : 'AI Analysis'}
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

export default Companies;
