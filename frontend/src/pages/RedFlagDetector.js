import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const RedFlagDetector = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();
  const [data, setData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, title: '', message: '', onConfirm: null });
  const [errors, setErrors] = useState({});
  const [formData, setFormData] = useState({
    company_id: '', deal_name: '', flag_type: '', severity_level: 'Medium', flag_title: '',
    flag_description: '', supporting_evidence: '', deal_breaker_potential: false,
    recommended_action: '', investigation_status: 'Pending', resolution_notes: ''
  });

  useEffect(() => {
    fetchData();
    fetchCompanies();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/red-flag-detections`);
      setData(response.data);
    } catch (error) {
      addToast('Failed to load red flag detections', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API_URL}/companies`);
      setCompanies(response.data);
    } catch (error) {
      addToast('Failed to load companies', 'error');
    }
  };

  const validate = () => {
    const errs = {};
    if (!formData.company_id) errs.company_id = 'Company is required';
    if (!formData.deal_name.trim()) errs.deal_name = 'Deal name is required';
    else if (formData.deal_name.trim().length < 2) errs.deal_name = 'Deal name must be at least 2 characters';
    if (!formData.flag_type) errs.flag_type = 'Flag type is required';
    if (!formData.flag_title.trim()) errs.flag_title = 'Flag title is required';
    else if (formData.flag_title.trim().length < 3) errs.flag_title = 'Flag title must be at least 3 characters';
    if (!formData.flag_description.trim()) errs.flag_description = 'Description is required';
    else if (formData.flag_description.trim().length < 10) errs.flag_description = 'Description must be at least 10 characters';
    if (!formData.severity_level) errs.severity_level = 'Severity level is required';
    if (!formData.investigation_status) errs.investigation_status = 'Investigation status is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/red-flag-detections/${selectedItem.id}`, formData);
        addToast('Red flag updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/red-flag-detections`, formData);
        addToast('Red flag created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save red flag', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Red Flag',
      message: `Are you sure you want to delete "${item.flag_title}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/red-flag-detections/${item.id}`);
          addToast('Red flag deleted successfully', 'success');
          fetchData();
          setShowDetailModal(false);
        } catch (error) {
          addToast('Failed to delete red flag', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Red Flags',
      message: `Are you sure you want to delete ${ids.length} red flag detections? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/red-flag-detections/bulk-delete`, { ids });
          addToast(`${ids.length} red flags deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete red flags', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await axios.post(`${API_URL}/red-flag-detections/${selectedItem.id}/analyze`);
      const updated = await axios.get(`${API_URL}/red-flag-detections/${selectedItem.id}`);
      setSelectedItem(updated.data);
      fetchData();
      addToast('AI analysis completed', 'success');
    } catch (error) {
      addToast('AI analysis failed', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', deal_name: item.deal_name || '', flag_type: item.flag_type || '',
      severity_level: item.severity_level || 'Medium', flag_title: item.flag_title || '',
      flag_description: item.flag_description || '', supporting_evidence: item.supporting_evidence || '',
      deal_breaker_potential: item.deal_breaker_potential || false,
      recommended_action: item.recommended_action || '', investigation_status: item.investigation_status || 'Pending',
      resolution_notes: item.resolution_notes || ''
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setErrors({});
    setFormData({
      company_id: '', deal_name: '', flag_type: '', severity_level: 'Medium', flag_title: '',
      flag_description: '', supporting_evidence: '', deal_breaker_potential: false,
      recommended_action: '', investigation_status: 'Pending', resolution_notes: ''
    });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({
      company_id: '', deal_name: '', flag_type: '', severity_level: 'Medium', flag_title: '',
      flag_description: '', supporting_evidence: '', deal_breaker_potential: false,
      recommended_action: '', investigation_status: 'Pending', resolution_notes: ''
    });
    setShowModal(true);
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'Critical': return '#dc2626';
      case 'High': return '#ef4444';
      case 'Medium': return '#f59e0b';
      case 'Low': return '#10b981';
      default: return '#6b7280';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'Resolved': return '#10b981';
      case 'In Progress': return '#3b82f6';
      case 'Pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  const renderAnalysis = (analysis) => {
    if (!analysis) return null;
    const sections = analysis.split(/##\s+/).filter(Boolean);
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {sections.map((section, idx) => {
          const [title, ...content] = section.split('\n');
          return (
            <div key={idx} style={{ background: 'rgba(26, 26, 46, 0.6)', borderRadius: '8px', padding: '16px' }}>
              <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid rgba(239, 68, 68, 0.2)', paddingBottom: '8px' }}>{title}</h4>
              <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.7' }}>
                {content.join('\n').split('\n').map((line, lineIdx) => {
                  if (line.startsWith('### ')) {
                    return <h5 key={lineIdx} style={{ color: '#ef4444', fontSize: '14px', fontWeight: '600', marginTop: '12px', marginBottom: '8px' }}>{line.replace('### ', '')}</h5>;
                  }
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <li key={lineIdx} style={{ marginLeft: '16px', marginBottom: '4px', color: '#d1d5db' }}>{line.replace(/^[-*]\s/, '')}</li>;
                  }
                  if (line.trim()) {
                    return <p key={lineIdx} style={{ marginBottom: '8px' }}>{line}</p>;
                  }
                  return null;
                })}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const columns = [
    { key: 'deal_name', label: 'Deal Name', render: (val) => <strong>{val}</strong> },
    { key: 'company_name', label: 'Company' },
    { key: 'flag_type', label: 'Flag Type', render: (val) => (
      <span style={{
        padding: '4px 10px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)',
        border: '1px solid rgba(139, 92, 246, 0.5)', color: '#a78bfa', fontWeight: '500', fontSize: '12px'
      }}>{val}</span>
    )},
    { key: 'flag_title', label: 'Title' },
    { key: 'severity_level', label: 'Severity', render: (val) => (
      <span style={{ padding: '4px 12px', borderRadius: '6px', color: '#fff', fontWeight: '600', fontSize: '12px', background: getSeverityColor(val) }}>{val}</span>
    )},
    { key: 'deal_breaker_potential', label: 'Deal Breaker', render: (val) => (
      val ? <span style={{ padding: '4px 12px', borderRadius: '6px', background: '#dc2626', color: '#fff', fontWeight: '700', fontSize: '12px' }}>YES</span>
           : <span style={{ padding: '4px 12px', borderRadius: '6px', background: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af', fontWeight: '500', fontSize: '12px' }}>NO</span>
    )},
    { key: 'investigation_status', label: 'Status', render: (val) => (
      <span style={{ padding: '4px 12px', borderRadius: '6px', color: '#fff', fontWeight: '500', fontSize: '12px', background: getStatusColor(val) }}>{val}</span>
    )},
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'severity_level', label: 'Severity' },
    { key: 'investigation_status', label: 'Status' },
  ];

  const companyOptions = companies.map(c => ({ value: c.id, label: c.name }));

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>AI Red Flag Detector</h2>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Identify potential deal breakers with AI-powered analysis</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ New Red Flag</button>
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
        title="Red Flag Detections"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Red Flag' : 'New Red Flag Detection'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput
              label="Company" type="select" value={formData.company_id}
              onChange={(e) => setFormData({ ...formData, company_id: e.target.value })}
              options={companyOptions} required error={errors.company_id}
            />
            <FormInput
              label="Deal Name" value={formData.deal_name}
              onChange={(e) => setFormData({ ...formData, deal_name: e.target.value })}
              required error={errors.deal_name}
            />
          </FormRow>
          <FormRow>
            <FormInput
              label="Flag Type" type="select" value={formData.flag_type}
              onChange={(e) => setFormData({ ...formData, flag_type: e.target.value })}
              options={['Financial', 'Legal', 'Regulatory', 'Operational', 'Compliance', 'Security', 'Environmental', 'Market']}
              required error={errors.flag_type}
            />
            <FormInput
              label="Severity Level" type="select" value={formData.severity_level}
              onChange={(e) => setFormData({ ...formData, severity_level: e.target.value })}
              options={['Low', 'Medium', 'High', 'Critical']}
              required error={errors.severity_level}
            />
          </FormRow>
          <FormRow>
            <FormInput
              label="Flag Title" value={formData.flag_title}
              onChange={(e) => setFormData({ ...formData, flag_title: e.target.value })}
              required error={errors.flag_title}
            />
            <FormInput
              label="Investigation Status" type="select" value={formData.investigation_status}
              onChange={(e) => setFormData({ ...formData, investigation_status: e.target.value })}
              options={['Pending', 'In Progress', 'Resolved']}
              required error={errors.investigation_status}
            />
          </FormRow>
          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.deal_breaker_potential}
                onChange={(e) => setFormData({ ...formData, deal_breaker_potential: e.target.checked })}
                style={{ width: '16px', height: '16px', cursor: 'pointer' }}
              />
              <span style={{ color: '#ef4444', fontSize: '14px', fontWeight: '500' }}>Deal Breaker Potential</span>
            </label>
          </div>
          <FormInput
            label="Description" type="textarea" value={formData.flag_description}
            onChange={(e) => setFormData({ ...formData, flag_description: e.target.value })}
            required error={errors.flag_description}
          />
          <FormInput
            label="Supporting Evidence" type="textarea" value={formData.supporting_evidence}
            onChange={(e) => setFormData({ ...formData, supporting_evidence: e.target.value })}
          />
          <FormInput
            label="Recommended Action" type="textarea" value={formData.recommended_action}
            onChange={(e) => setFormData({ ...formData, recommended_action: e.target.value })}
          />
          <FormInput
            label="Resolution Notes" type="textarea" value={formData.resolution_notes}
            onChange={(e) => setFormData({ ...formData, resolution_notes: e.target.value })}
          />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Red Flag Details" size="xlarge">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Company</span>
                <span style={styles.detailValue}>{selectedItem.company_name}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Deal Name</span>
                <span style={styles.detailValue}>{selectedItem.deal_name}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Flag Title</span>
                <span style={styles.detailValue}>{selectedItem.flag_title}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Flag Type</span>
                <span style={{
                  padding: '4px 10px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)',
                  border: '1px solid rgba(139, 92, 246, 0.5)', color: '#a78bfa', fontWeight: '500', fontSize: '12px'
                }}>{selectedItem.flag_type}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Severity</span>
                <span style={{ padding: '4px 12px', borderRadius: '6px', color: '#fff', fontWeight: '600', fontSize: '14px', background: getSeverityColor(selectedItem.severity_level) }}>{selectedItem.severity_level}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Investigation Status</span>
                <span style={{ padding: '4px 12px', borderRadius: '6px', color: '#fff', fontWeight: '500', fontSize: '14px', background: getStatusColor(selectedItem.investigation_status) }}>{selectedItem.investigation_status}</span>
              </div>
              <div style={styles.detailItem}>
                <span style={styles.detailLabel}>Deal Breaker Potential</span>
                {selectedItem.deal_breaker_potential
                  ? <span style={{ padding: '4px 12px', borderRadius: '6px', background: '#dc2626', color: '#fff', fontWeight: '700', fontSize: '13px' }}>YES - CRITICAL</span>
                  : <span style={{ padding: '4px 12px', borderRadius: '6px', background: 'rgba(107, 114, 128, 0.3)', color: '#9ca3af', fontWeight: '500', fontSize: '13px' }}>NO</span>
                }
              </div>
            </div>

            <div style={{ marginTop: '20px' }}>
              <span style={styles.detailLabel}>Description</span>
              <p style={styles.textBlock}>{selectedItem.flag_description}</p>
            </div>

            {selectedItem.supporting_evidence && (
              <div style={{ marginTop: '16px' }}>
                <span style={styles.detailLabel}>Supporting Evidence</span>
                <p style={styles.textBlock}>{selectedItem.supporting_evidence}</p>
              </div>
            )}

            {selectedItem.recommended_action && (
              <div style={{ marginTop: '16px' }}>
                <span style={styles.detailLabel}>Recommended Action</span>
                <p style={styles.textBlock}>{selectedItem.recommended_action}</p>
              </div>
            )}

            {selectedItem.resolution_notes && (
              <div style={{ marginTop: '16px' }}>
                <span style={styles.detailLabel}>Resolution Notes</span>
                <p style={styles.textBlock}>{selectedItem.resolution_notes}</p>
              </div>
            )}

            {/* AI Analysis Section */}
            <div style={styles.aiSection}>
              {hasPermission('analyze') && (
                <button onClick={handleAnalyze} disabled={analyzing} style={{
                  ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {analyzing && <span style={{
                    display: 'inline-block', width: '14px', height: '14px',
                    border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
                    borderRadius: '50%', animation: 'spin 0.6s linear infinite'
                  }} />}
                  {analyzing ? 'Analyzing...' : 'Generate AI Analysis'}
                </button>
              )}
              {selectedItem.ai_analysis && (
                <div style={styles.aiResult}>
                  <h4 style={{ color: '#ef4444', fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>AI Analysis</h4>
                  {renderAnalysis(selectedItem.ai_analysis)}
                </div>
              )}
            </div>

            {/* Action Buttons */}
            <div style={styles.modalActions}>
              {hasPermission('edit') && (
                <button onClick={() => { setShowDetailModal(false); handleEdit(selectedItem); }} style={styles.editModalBtn}>Edit</button>
              )}
              {hasPermission('delete') && (
                <button onClick={() => handleDelete(selectedItem)} style={styles.deleteModalBtn}>Delete</button>
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
  addBtn: {
    padding: '12px 24px', background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
  },
  detailGrid: {
    display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px',
  },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '6px' },
  detailLabel: {
    color: '#a1a1aa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '500',
  },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '600' },
  textBlock: {
    color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6', fontSize: '14px',
    background: 'rgba(26, 26, 46, 0.8)', padding: '12px', borderRadius: '8px',
  },
  aiSection: {
    marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(239, 68, 68, 0.2)',
  },
  aiBtn: {
    padding: '12px 24px', background: 'linear-gradient(135deg, #ef4444, #dc2626)',
    border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '600',
  },
  aiResult: {
    marginTop: '16px', padding: '20px',
    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.1), rgba(220, 38, 38, 0.1))',
    borderRadius: '12px', border: '1px solid rgba(239, 68, 68, 0.3)',
  },
  modalActions: {
    display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px',
    borderTop: '1px solid rgba(239, 68, 68, 0.2)',
  },
  editModalBtn: {
    padding: '12px 24px', background: 'rgba(59, 130, 246, 0.2)',
    border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px',
    color: '#3b82f6', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
  },
  deleteModalBtn: {
    padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)',
    border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px',
    color: '#ef4444', fontWeight: '600', cursor: 'pointer', fontSize: '14px',
  },
};

export default RedFlagDetector;
