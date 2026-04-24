import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const SynergyCalculator = () => {
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
    company_id: '', deal_name: '', acquirer_name: '', revenue_synergy: '', cost_synergy: '',
    tax_synergy: '', total_synergy: '', synergy_timeline_months: '', probability_of_achievement: '',
    synergy_categories: '', implementation_costs: '', net_synergy_value: ''
  });

  const fetchData = async () => {
    try {
      const [synergiesRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/synergies`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(synergiesRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load synergy data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.company_id) errs.company_id = 'Target company is required';
    if (!formData.deal_name || !formData.deal_name.trim()) errs.deal_name = 'Deal name is required';
    if (!formData.acquirer_name || !formData.acquirer_name.trim()) errs.acquirer_name = 'Acquirer name is required';
    if (!formData.revenue_synergy && formData.revenue_synergy !== 0) errs.revenue_synergy = 'Revenue synergy is required';
    else if (isNaN(Number(formData.revenue_synergy))) errs.revenue_synergy = 'Must be a valid number';
    if (!formData.cost_synergy && formData.cost_synergy !== 0) errs.cost_synergy = 'Cost synergy is required';
    else if (isNaN(Number(formData.cost_synergy))) errs.cost_synergy = 'Must be a valid number';
    if (!formData.tax_synergy && formData.tax_synergy !== 0) errs.tax_synergy = 'Tax synergy is required';
    else if (isNaN(Number(formData.tax_synergy))) errs.tax_synergy = 'Must be a valid number';
    if (!formData.total_synergy && formData.total_synergy !== 0) errs.total_synergy = 'Total synergy is required';
    else if (isNaN(Number(formData.total_synergy))) errs.total_synergy = 'Must be a valid number';
    if (!formData.implementation_costs && formData.implementation_costs !== 0) errs.implementation_costs = 'Implementation costs is required';
    else if (isNaN(Number(formData.implementation_costs))) errs.implementation_costs = 'Must be a valid number';
    if (!formData.net_synergy_value && formData.net_synergy_value !== 0) errs.net_synergy_value = 'Net synergy value is required';
    else if (isNaN(Number(formData.net_synergy_value))) errs.net_synergy_value = 'Must be a valid number';
    if (!formData.synergy_timeline_months && formData.synergy_timeline_months !== 0) errs.synergy_timeline_months = 'Timeline is required';
    else if (isNaN(Number(formData.synergy_timeline_months)) || Number(formData.synergy_timeline_months) < 1) errs.synergy_timeline_months = 'Must be a positive number';
    if (!formData.probability_of_achievement && formData.probability_of_achievement !== 0) errs.probability_of_achievement = 'Probability is required';
    else if (isNaN(Number(formData.probability_of_achievement)) || Number(formData.probability_of_achievement) < 0 || Number(formData.probability_of_achievement) > 100) errs.probability_of_achievement = 'Must be between 0 and 100';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/synergies/${selectedItem.id}`, formData);
        addToast('Synergy calculation updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/synergies`, formData);
        addToast('Synergy calculation created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save synergy calculation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Synergy Calculation',
      message: `Are you sure you want to delete the synergy calculation "${item.deal_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/synergies/${item.id}`);
          addToast('Synergy calculation deleted successfully', 'success');
          fetchData();
          setShowDetailModal(false);
        } catch (error) {
          addToast('Failed to delete synergy calculation', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Synergy Calculations',
      message: `Are you sure you want to delete ${ids.length} synergy calculations? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/synergies/bulk-delete`, { ids });
          addToast(`${ids.length} synergy calculations deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete synergy calculations', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', deal_name: item.deal_name || '', acquirer_name: item.acquirer_name || '',
      revenue_synergy: item.revenue_synergy || '', cost_synergy: item.cost_synergy || '',
      tax_synergy: item.tax_synergy || '', total_synergy: item.total_synergy || '',
      synergy_timeline_months: item.synergy_timeline_months || '', probability_of_achievement: item.probability_of_achievement || '',
      synergy_categories: item.synergy_categories || '', implementation_costs: item.implementation_costs || '',
      net_synergy_value: item.net_synergy_value || ''
    });
    setShowModal(true);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await axios.post(`${API_URL}/synergies/${selectedItem.id}/analyze`);
      const updated = await axios.get(`${API_URL}/synergies/${selectedItem.id}`);
      setSelectedItem(updated.data);
      fetchData();
      addToast('AI synergy analysis completed', 'success');
    } catch (error) {
      addToast('AI analysis failed. Please check your API key.', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setSelectedItem(null);
    setErrors({});
    setFormData({
      company_id: '', deal_name: '', acquirer_name: '', revenue_synergy: '', cost_synergy: '',
      tax_synergy: '', total_synergy: '', synergy_timeline_months: '', probability_of_achievement: '',
      synergy_categories: '', implementation_costs: '', net_synergy_value: ''
    });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({
      company_id: '', deal_name: '', acquirer_name: '', revenue_synergy: '', cost_synergy: '',
      tax_synergy: '', total_synergy: '', synergy_timeline_months: '', probability_of_achievement: '',
      synergy_categories: '', implementation_costs: '', net_synergy_value: ''
    });
    setShowModal(true);
  };

  const formatCurrency = (value) => {
    if (!value && value !== 0) return '$0';
    return `$${(parseFloat(value) / 1000000).toFixed(1)}M`;
  };

  const renderAnalysis = (analysis) => {
    if (!analysis) return null;
    const sections = analysis.split(/##\s+/).filter(Boolean);
    return (
      <div style={styles.analysisContainer}>
        {sections.map((section, idx) => {
          const [title, ...content] = section.split('\n');
          return (
            <div key={idx} style={styles.analysisSection}>
              <h4 style={styles.analysisSectionTitle}>{title}</h4>
              <div style={styles.analysisSectionContent}>
                {content.join('\n').split('\n').map((line, lineIdx) => {
                  if (line.startsWith('### ')) {
                    return <h5 key={lineIdx} style={styles.analysisSubTitle}>{line.replace('### ', '')}</h5>;
                  }
                  if (line.startsWith('- ') || line.startsWith('* ')) {
                    return <li key={lineIdx} style={styles.analysisBullet}>{line.replace(/^[-*]\s/, '')}</li>;
                  }
                  if (line.trim()) {
                    return <p key={lineIdx} style={styles.analysisParagraph}>{line}</p>;
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
    { key: 'company_name', label: 'Target' },
    { key: 'acquirer_name', label: 'Acquirer' },
    { key: 'revenue_synergy', label: 'Revenue Synergy', render: (val) => <span style={styles.revenueBadge}>{formatCurrency(val)}</span> },
    { key: 'cost_synergy', label: 'Cost Synergy', render: (val) => <span style={styles.costBadge}>{formatCurrency(val)}</span> },
    { key: 'tax_synergy', label: 'Tax Synergy', render: (val) => <span style={styles.taxBadge}>{formatCurrency(val)}</span> },
    { key: 'total_synergy', label: 'Total Synergy', render: (val) => <span style={styles.totalBadge}>{formatCurrency(val)}</span> },
    { key: 'net_synergy_value', label: 'Net Value', render: (val) => <span style={styles.netBadge}>{formatCurrency(val)}</span> },
    { key: 'probability_of_achievement', label: 'Probability', render: (val) => val ? `${val}%` : '-' },
    { key: 'synergy_timeline_months', label: 'Timeline', render: (val) => val ? `${val} mo` : '-' },
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'acquirer_name', label: 'Acquirer' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>AI Synergy Calculator</h2>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Estimate merger synergies with AI-powered analysis</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ New Synergy Calculation</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Synergy Calculations"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Synergy Calculation' : 'New Synergy Calculation'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Target Company" type="select" value={formData.company_id} onChange={(e) => setFormData({...formData, company_id: e.target.value})} required error={errors.company_id}
              options={companies.map(c => ({ value: c.id, label: c.name }))} />
            <FormInput label="Deal Name" value={formData.deal_name} onChange={(e) => setFormData({...formData, deal_name: e.target.value})} required error={errors.deal_name} />
          </FormRow>
          <FormRow>
            <FormInput label="Acquirer Name" value={formData.acquirer_name} onChange={(e) => setFormData({...formData, acquirer_name: e.target.value})} required error={errors.acquirer_name} />
            <FormInput label="Revenue Synergy ($)" type="number" value={formData.revenue_synergy} onChange={(e) => setFormData({...formData, revenue_synergy: e.target.value})} required error={errors.revenue_synergy} />
          </FormRow>
          <FormRow>
            <FormInput label="Cost Synergy ($)" type="number" value={formData.cost_synergy} onChange={(e) => setFormData({...formData, cost_synergy: e.target.value})} required error={errors.cost_synergy} />
            <FormInput label="Tax Synergy ($)" type="number" value={formData.tax_synergy} onChange={(e) => setFormData({...formData, tax_synergy: e.target.value})} required error={errors.tax_synergy} />
          </FormRow>
          <FormRow>
            <FormInput label="Total Synergy ($)" type="number" value={formData.total_synergy} onChange={(e) => setFormData({...formData, total_synergy: e.target.value})} required error={errors.total_synergy} />
            <FormInput label="Implementation Costs ($)" type="number" value={formData.implementation_costs} onChange={(e) => setFormData({...formData, implementation_costs: e.target.value})} required error={errors.implementation_costs} />
          </FormRow>
          <FormRow>
            <FormInput label="Net Synergy Value ($)" type="number" value={formData.net_synergy_value} onChange={(e) => setFormData({...formData, net_synergy_value: e.target.value})} required error={errors.net_synergy_value} />
            <FormInput label="Timeline (months)" type="number" value={formData.synergy_timeline_months} onChange={(e) => setFormData({...formData, synergy_timeline_months: e.target.value})} required error={errors.synergy_timeline_months} />
          </FormRow>
          <FormRow>
            <FormInput label="Probability of Achievement (%)" type="number" value={formData.probability_of_achievement} onChange={(e) => setFormData({...formData, probability_of_achievement: e.target.value})} required error={errors.probability_of_achievement} />
          </FormRow>
          <FormInput label="Synergy Categories" type="textarea" value={formData.synergy_categories} onChange={(e) => setFormData({...formData, synergy_categories: e.target.value})} placeholder="Describe the synergy categories (e.g., cross-selling, cost reduction, shared services...)" error={errors.synergy_categories} />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Synergy Calculation Details" size="xlarge">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Deal Name</span><span style={styles.detailValue}>{selectedItem.deal_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Target Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Acquirer</span><span style={styles.detailValue}>{selectedItem.acquirer_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Timeline</span><span style={styles.detailValue}>{selectedItem.synergy_timeline_months} months</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Probability</span><span style={styles.detailValue}>{selectedItem.probability_of_achievement}%</span></div>
            </div>

            <div style={styles.synergyBreakdown}>
              <h4 style={styles.breakdownTitle}>Synergy Breakdown</h4>
              <div style={styles.breakdownGrid}>
                <div style={styles.breakdownItem}>
                  <span style={styles.breakdownLabel}>Revenue Synergies</span>
                  <span style={styles.revenueBadge}>{formatCurrency(selectedItem.revenue_synergy)}</span>
                </div>
                <div style={styles.breakdownItem}>
                  <span style={styles.breakdownLabel}>Cost Synergies</span>
                  <span style={styles.costBadge}>{formatCurrency(selectedItem.cost_synergy)}</span>
                </div>
                <div style={styles.breakdownItem}>
                  <span style={styles.breakdownLabel}>Tax Synergies</span>
                  <span style={styles.taxBadge}>{formatCurrency(selectedItem.tax_synergy)}</span>
                </div>
                <div style={styles.breakdownItem}>
                  <span style={styles.breakdownLabel}>Total Gross</span>
                  <span style={styles.totalBadge}>{formatCurrency(selectedItem.total_synergy)}</span>
                </div>
                <div style={styles.breakdownItem}>
                  <span style={styles.breakdownLabel}>Implementation Costs</span>
                  <span style={styles.costsBadge}>-{formatCurrency(selectedItem.implementation_costs)}</span>
                </div>
                <div style={styles.breakdownItem}>
                  <span style={styles.breakdownLabel}>Net Synergy Value</span>
                  <span style={styles.netBadge}>{formatCurrency(selectedItem.net_synergy_value)}</span>
                </div>
              </div>
            </div>

            {selectedItem.synergy_categories && (
              <div style={styles.textSection}>
                <h4 style={styles.sectionLabel}>Synergy Categories</h4>
                <p style={styles.textContent}>{selectedItem.synergy_categories}</p>
              </div>
            )}

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
              {selectedItem.ai_analysis && (
                <div style={styles.aiResult}>
                  <h4 style={{ color: '#8b5cf6', marginBottom: '12px' }}>AI Synergy Analysis</h4>
                  {renderAnalysis(selectedItem.ai_analysis)}
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
  addBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  revenueBadge: { padding: '4px 12px', borderRadius: '6px', background: '#10b981', color: '#fff', fontWeight: '600', fontSize: '13px' },
  costBadge: { padding: '4px 12px', borderRadius: '6px', background: '#3b82f6', color: '#fff', fontWeight: '600', fontSize: '13px' },
  taxBadge: { padding: '4px 12px', borderRadius: '6px', background: '#8b5cf6', color: '#fff', fontWeight: '600', fontSize: '13px' },
  totalBadge: { padding: '4px 12px', borderRadius: '6px', background: '#f59e0b', color: '#fff', fontWeight: '600', fontSize: '13px' },
  netBadge: { padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', fontWeight: '700', fontSize: '14px' },
  costsBadge: { padding: '4px 12px', borderRadius: '6px', background: '#ef4444', color: '#fff', fontWeight: '600', fontSize: '13px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '16px' },
  detailLabel: { color: '#a1a1aa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '500' },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '600' },
  synergyBreakdown: { marginBottom: '24px', padding: '20px', background: 'rgba(26, 26, 46, 0.8)', borderRadius: '12px' },
  breakdownTitle: { color: '#8b5cf6', fontSize: '16px', fontWeight: '600', marginBottom: '16px' },
  breakdownGrid: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' },
  breakdownItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(139, 92, 246, 0.1)', borderRadius: '8px' },
  breakdownLabel: { color: '#a1a1aa', fontSize: '12px' },
  textSection: { marginBottom: '20px' },
  sectionLabel: { color: '#8b5cf6', fontSize: '14px', fontWeight: '600', marginBottom: '8px' },
  textContent: { color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', background: 'rgba(26, 26, 46, 0.8)', padding: '12px', borderRadius: '8px' },
  aiSection: { marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  aiBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, #8b5cf6, #6366f1)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '600' },
  aiResult: { marginTop: '16px', padding: '20px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(99, 102, 241, 0.1))', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.3)' },
  analysisContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  analysisSection: { background: 'rgba(26, 26, 46, 0.6)', borderRadius: '8px', padding: '16px' },
  analysisSectionTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid rgba(139, 92, 246, 0.2)', paddingBottom: '8px' },
  analysisSectionContent: { color: '#d1d5db', fontSize: '14px', lineHeight: '1.7' },
  analysisSubTitle: { color: '#8b5cf6', fontSize: '14px', fontWeight: '600', marginTop: '12px', marginBottom: '8px' },
  analysisBullet: { marginLeft: '16px', marginBottom: '4px', color: '#d1d5db' },
  analysisParagraph: { marginBottom: '8px' },
  modalActions: { display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  editModalBtn: { padding: '12px 24px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#3b82f6', fontWeight: '600', cursor: 'pointer' },
  deleteModalBtn: { padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' },
};

export default SynergyCalculator;
