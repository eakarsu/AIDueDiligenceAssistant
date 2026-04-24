import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const IntegrationPlanner = () => {
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
    company_id: '', deal_name: '', integration_approach: '', day_one_priorities: '',
    first_100_days_plan: '', organizational_structure: '', technology_integration: '',
    cultural_integration: '', key_milestones: '', estimated_integration_costs: '',
    integration_timeline_months: '', risk_mitigation_plan: '', success_metrics: ''
  });

  const fetchData = async () => {
    try {
      const [plansRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/integration-plans`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(plansRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load integration plans', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.company_id) errs.company_id = 'Company is required';
    if (!formData.deal_name || !formData.deal_name.trim()) errs.deal_name = 'Deal name is required';
    if (!formData.integration_approach) errs.integration_approach = 'Integration approach is required';
    if (!formData.integration_timeline_months) errs.integration_timeline_months = 'Timeline is required';
    else if (isNaN(Number(formData.integration_timeline_months)) || Number(formData.integration_timeline_months) <= 0) errs.integration_timeline_months = 'Enter a valid number of months';
    if (!formData.estimated_integration_costs) errs.estimated_integration_costs = 'Estimated costs are required';
    else if (isNaN(Number(formData.estimated_integration_costs)) || Number(formData.estimated_integration_costs) < 0) errs.estimated_integration_costs = 'Enter a valid cost amount';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/integration-plans/${selectedItem.id}`, formData);
        addToast('Integration plan updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/integration-plans`, formData);
        addToast('Integration plan created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save integration plan', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Integration Plan',
      message: `Are you sure you want to delete the integration plan "${item.deal_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/integration-plans/${item.id}`);
          addToast('Integration plan deleted successfully', 'success');
          setShowDetailModal(false);
          fetchData();
        } catch (error) {
          addToast('Failed to delete integration plan', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Integration Plans',
      message: `Are you sure you want to delete ${ids.length} integration plans? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/integration-plans/bulk-delete`, { ids });
          addToast(`${ids.length} integration plans deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete integration plans', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', deal_name: item.deal_name || '',
      integration_approach: item.integration_approach || '', day_one_priorities: item.day_one_priorities || '',
      first_100_days_plan: item.first_100_days_plan || '', organizational_structure: item.organizational_structure || '',
      technology_integration: item.technology_integration || '', cultural_integration: item.cultural_integration || '',
      key_milestones: item.key_milestones || '', estimated_integration_costs: item.estimated_integration_costs || '',
      integration_timeline_months: item.integration_timeline_months || '', risk_mitigation_plan: item.risk_mitigation_plan || '',
      success_metrics: item.success_metrics || ''
    });
    setShowDetailModal(false);
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
      const response = await axios.post(`${API_URL}/integration-plans/${selectedItem.id}/analyze`);
      const analysis = response.data.analysis || response.data.ai_analysis || '';
      setAiAnalysis(analysis);
      fetchData();
      setSelectedItem(prev => ({ ...prev, ai_analysis: analysis }));
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
    setFormData({
      company_id: '', deal_name: '', integration_approach: '', day_one_priorities: '',
      first_100_days_plan: '', organizational_structure: '', technology_integration: '',
      cultural_integration: '', key_milestones: '', estimated_integration_costs: '',
      integration_timeline_months: '', risk_mitigation_plan: '', success_metrics: ''
    });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({
      company_id: '', deal_name: '', integration_approach: '', day_one_priorities: '',
      first_100_days_plan: '', organizational_structure: '', technology_integration: '',
      cultural_integration: '', key_milestones: '', estimated_integration_costs: '',
      integration_timeline_months: '', risk_mitigation_plan: '', success_metrics: ''
    });
    setShowModal(true);
  };

  const formatCurrency = (value) => {
    if (!value) return '$0';
    return `$${(parseFloat(value) / 1000000).toFixed(1)}M`;
  };

  const columns = [
    { key: 'deal_name', label: 'Deal Name', render: (val) => <strong>{val}</strong> },
    { key: 'company_name', label: 'Company' },
    { key: 'integration_approach', label: 'Approach', render: (val) => <span style={styles.approachBadge}>{val}</span> },
    { key: 'integration_timeline_months', label: 'Timeline', render: (val) => <span style={styles.timelineBadge}>{val} months</span> },
    { key: 'estimated_integration_costs', label: 'Est. Costs', render: (val) => <span style={styles.costBadge}>{formatCurrency(val)}</span> },
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'integration_approach', label: 'Approach' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Create comprehensive post-merger integration roadmaps</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ New Integration Plan</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Integration Plans"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Integration Plan' : 'New Integration Plan'} size="xlarge">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Company" type="select" value={formData.company_id}
              onChange={(e) => setFormData({...formData, company_id: e.target.value})} required error={errors.company_id}
              options={companies.map(c => ({ value: c.id, label: c.name }))} />
            <FormInput label="Deal Name" value={formData.deal_name}
              onChange={(e) => setFormData({...formData, deal_name: e.target.value})} required error={errors.deal_name} />
          </FormRow>
          <FormRow>
            <FormInput label="Integration Approach" type="select" value={formData.integration_approach}
              onChange={(e) => setFormData({...formData, integration_approach: e.target.value})} required error={errors.integration_approach}
              options={[
                { value: 'Full Integration', label: 'Full Integration' },
                { value: 'Bolt-on Integration', label: 'Bolt-on Integration' },
                { value: 'Strategic Merger', label: 'Strategic Merger' },
                { value: 'Holding Company Model', label: 'Holding Company Model' },
                { value: 'Platform Integration', label: 'Platform Integration' },
                { value: 'R&D Partnership Model', label: 'R&D Partnership Model' },
              ]} />
            <FormInput label="Timeline (months)" type="number" value={formData.integration_timeline_months}
              onChange={(e) => setFormData({...formData, integration_timeline_months: e.target.value})} required error={errors.integration_timeline_months} />
          </FormRow>
          <FormRow>
            <FormInput label="Estimated Costs ($)" type="number" value={formData.estimated_integration_costs}
              onChange={(e) => setFormData({...formData, estimated_integration_costs: e.target.value})} required error={errors.estimated_integration_costs} />
          </FormRow>
          <FormInput label="Day One Priorities" type="textarea" value={formData.day_one_priorities}
            onChange={(e) => setFormData({...formData, day_one_priorities: e.target.value})} placeholder="Critical actions for day one..." />
          <FormInput label="First 100 Days Plan" type="textarea" value={formData.first_100_days_plan}
            onChange={(e) => setFormData({...formData, first_100_days_plan: e.target.value})} placeholder="Key initiatives for the first 100 days..." />
          <FormRow>
            <FormInput label="Organizational Structure" type="textarea" value={formData.organizational_structure}
              onChange={(e) => setFormData({...formData, organizational_structure: e.target.value})} />
            <FormInput label="Technology Integration" type="textarea" value={formData.technology_integration}
              onChange={(e) => setFormData({...formData, technology_integration: e.target.value})} />
          </FormRow>
          <FormRow>
            <FormInput label="Cultural Integration" type="textarea" value={formData.cultural_integration}
              onChange={(e) => setFormData({...formData, cultural_integration: e.target.value})} />
            <FormInput label="Key Milestones" type="textarea" value={formData.key_milestones}
              onChange={(e) => setFormData({...formData, key_milestones: e.target.value})} />
          </FormRow>
          <FormRow>
            <FormInput label="Risk Mitigation Plan" type="textarea" value={formData.risk_mitigation_plan}
              onChange={(e) => setFormData({...formData, risk_mitigation_plan: e.target.value})} />
            <FormInput label="Success Metrics" type="textarea" value={formData.success_metrics}
              onChange={(e) => setFormData({...formData, success_metrics: e.target.value})} />
          </FormRow>
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Integration Plan Details" size="xlarge">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Deal Name</span><span style={styles.detailValue}>{selectedItem.deal_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Integration Approach</span><span style={styles.approachBadge}>{selectedItem.integration_approach}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Timeline</span><span style={styles.timelineBadge}>{selectedItem.integration_timeline_months} months</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Estimated Costs</span><span style={styles.costBadge}>{formatCurrency(selectedItem.estimated_integration_costs)}</span></div>
            </div>

            <div style={styles.sectionBlock}>
              <h4 style={styles.sectionTitle}>Day One Priorities</h4>
              <p style={styles.sectionContent}>{selectedItem.day_one_priorities || '-'}</p>
            </div>

            <div style={styles.sectionBlock}>
              <h4 style={styles.sectionTitle}>First 100 Days Plan</h4>
              <p style={styles.sectionContent}>{selectedItem.first_100_days_plan || '-'}</p>
            </div>

            <div style={styles.twoColGrid}>
              <div style={styles.sectionBlock}>
                <h4 style={styles.sectionTitle}>Organizational Structure</h4>
                <p style={styles.sectionContent}>{selectedItem.organizational_structure || '-'}</p>
              </div>
              <div style={styles.sectionBlock}>
                <h4 style={styles.sectionTitle}>Technology Integration</h4>
                <p style={styles.sectionContent}>{selectedItem.technology_integration || '-'}</p>
              </div>
            </div>

            <div style={styles.twoColGrid}>
              <div style={styles.sectionBlock}>
                <h4 style={styles.sectionTitle}>Cultural Integration</h4>
                <p style={styles.sectionContent}>{selectedItem.cultural_integration || '-'}</p>
              </div>
              <div style={styles.sectionBlock}>
                <h4 style={styles.sectionTitle}>Risk Mitigation Plan</h4>
                <p style={styles.sectionContent}>{selectedItem.risk_mitigation_plan || '-'}</p>
              </div>
            </div>

            <div style={styles.sectionBlock}>
              <h4 style={styles.sectionTitle}>Key Milestones</h4>
              <p style={styles.sectionContent}>{selectedItem.key_milestones || '-'}</p>
            </div>

            <div style={styles.sectionBlock}>
              <h4 style={styles.sectionTitle}>Success Metrics</h4>
              <p style={styles.sectionContent}>{selectedItem.success_metrics || '-'}</p>
            </div>

            <div style={styles.aiSection}>
              {hasPermission('analyze') && (
                <button onClick={handleAnalyze} disabled={analyzing} style={{
                  ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                  {analyzing ? 'Analyzing...' : 'Generate AI Analysis'}
                </button>
              )}
              {aiAnalysis && (
                <div style={styles.aiResult}>
                  <h4 style={{ color: '#10b981', marginBottom: '12px' }}>AI Analysis Result</h4>
                  <p style={{ color: '#e4e4e7', lineHeight: '1.8', whiteSpace: 'pre-wrap' }}>{aiAnalysis}</p>
                </div>
              )}
            </div>

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
  addBtn: { padding: '12px 20px', background: 'linear-gradient(90deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500', cursor: 'pointer' },
  approachBadge: { padding: '4px 12px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid rgba(16, 185, 129, 0.5)', color: '#34d399', fontWeight: '500', fontSize: '12px', display: 'inline-block' },
  timelineBadge: { padding: '4px 12px', borderRadius: '6px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', color: '#60a5fa', fontWeight: '500', fontSize: '12px', display: 'inline-block' },
  costBadge: { padding: '4px 12px', borderRadius: '6px', background: 'rgba(139, 92, 246, 0.2)', border: '1px solid rgba(139, 92, 246, 0.5)', color: '#a78bfa', fontWeight: '500', fontSize: '12px', display: 'inline-block' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', marginBottom: '24px' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { color: '#a1a1aa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '500' },
  sectionBlock: { marginBottom: '20px' },
  sectionTitle: { color: '#10b981', fontSize: '14px', fontWeight: '600', marginBottom: '8px' },
  sectionContent: { color: '#d1d5db', fontSize: '14px', lineHeight: '1.7', background: 'rgba(26, 26, 46, 0.8)', padding: '14px', borderRadius: '8px' },
  twoColGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '20px' },
  aiSection: { marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(16, 185, 129, 0.2)' },
  aiBtn: { padding: '12px 24px', background: 'linear-gradient(90deg, #10b981, #059669)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500' },
  aiResult: { marginTop: '16px', padding: '20px', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '12px', border: '1px solid rgba(16, 185, 129, 0.2)' },
  modalActions: { display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(16, 185, 129, 0.2)' },
  editModalBtn: { padding: '12px 24px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#3b82f6', fontWeight: '600', cursor: 'pointer' },
  deleteModalBtn: { padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' },
};

export default IntegrationPlanner;
