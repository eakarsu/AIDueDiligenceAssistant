import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const ValuationModeler = () => {
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
    company_id: '', deal_name: '', dcf_valuation: '', comparable_companies_valuation: '',
    precedent_transactions_valuation: '', lbo_valuation: '', asset_based_valuation: '',
    weighted_average_valuation: '', valuation_range_low: '', valuation_range_high: '',
    implied_ev_ebitda_multiple: '', implied_ev_revenue_multiple: '', key_assumptions: ''
  });

  const fetchData = async () => {
    try {
      const [valuationsRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/valuations`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(valuationsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load valuation data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.company_id) errs.company_id = 'Company is required';
    if (!formData.deal_name || !formData.deal_name.trim()) errs.deal_name = 'Deal name is required';
    if (!formData.dcf_valuation) errs.dcf_valuation = 'DCF valuation is required';
    else if (isNaN(Number(formData.dcf_valuation)) || Number(formData.dcf_valuation) < 0) errs.dcf_valuation = 'Must be a valid positive number';
    if (!formData.comparable_companies_valuation) errs.comparable_companies_valuation = 'Comparable companies valuation is required';
    else if (isNaN(Number(formData.comparable_companies_valuation)) || Number(formData.comparable_companies_valuation) < 0) errs.comparable_companies_valuation = 'Must be a valid positive number';
    if (!formData.precedent_transactions_valuation) errs.precedent_transactions_valuation = 'Precedent transactions valuation is required';
    else if (isNaN(Number(formData.precedent_transactions_valuation)) || Number(formData.precedent_transactions_valuation) < 0) errs.precedent_transactions_valuation = 'Must be a valid positive number';
    if (!formData.lbo_valuation) errs.lbo_valuation = 'LBO valuation is required';
    else if (isNaN(Number(formData.lbo_valuation)) || Number(formData.lbo_valuation) < 0) errs.lbo_valuation = 'Must be a valid positive number';
    if (!formData.asset_based_valuation) errs.asset_based_valuation = 'Asset-based valuation is required';
    else if (isNaN(Number(formData.asset_based_valuation)) || Number(formData.asset_based_valuation) < 0) errs.asset_based_valuation = 'Must be a valid positive number';
    if (!formData.weighted_average_valuation) errs.weighted_average_valuation = 'Weighted average is required';
    else if (isNaN(Number(formData.weighted_average_valuation)) || Number(formData.weighted_average_valuation) < 0) errs.weighted_average_valuation = 'Must be a valid positive number';
    if (!formData.valuation_range_low) errs.valuation_range_low = 'Range low is required';
    else if (isNaN(Number(formData.valuation_range_low)) || Number(formData.valuation_range_low) < 0) errs.valuation_range_low = 'Must be a valid positive number';
    if (!formData.valuation_range_high) errs.valuation_range_high = 'Range high is required';
    else if (isNaN(Number(formData.valuation_range_high)) || Number(formData.valuation_range_high) < 0) errs.valuation_range_high = 'Must be a valid positive number';
    if (formData.valuation_range_low && formData.valuation_range_high && Number(formData.valuation_range_low) > Number(formData.valuation_range_high)) errs.valuation_range_high = 'Range high must be greater than range low';
    if (!formData.implied_ev_ebitda_multiple) errs.implied_ev_ebitda_multiple = 'EV/EBITDA multiple is required';
    else if (isNaN(Number(formData.implied_ev_ebitda_multiple)) || Number(formData.implied_ev_ebitda_multiple) < 0) errs.implied_ev_ebitda_multiple = 'Must be a valid positive number';
    if (!formData.implied_ev_revenue_multiple) errs.implied_ev_revenue_multiple = 'EV/Revenue multiple is required';
    else if (isNaN(Number(formData.implied_ev_revenue_multiple)) || Number(formData.implied_ev_revenue_multiple) < 0) errs.implied_ev_revenue_multiple = 'Must be a valid positive number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/valuations/${selectedItem.id}`, formData);
        addToast('Valuation updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/valuations`, formData);
        addToast('Valuation created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save valuation', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Valuation',
      message: `Are you sure you want to delete the valuation "${item.deal_name}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/valuations/${item.id}`);
          addToast('Valuation deleted successfully', 'success');
          fetchData();
          setShowDetailModal(false);
        } catch (error) {
          addToast('Failed to delete valuation', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Valuations',
      message: `Are you sure you want to delete ${ids.length} valuations? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/valuations/bulk-delete`, { ids });
          addToast(`${ids.length} valuations deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete valuations', 'error');
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
      dcf_valuation: item.dcf_valuation || '', comparable_companies_valuation: item.comparable_companies_valuation || '',
      precedent_transactions_valuation: item.precedent_transactions_valuation || '',
      lbo_valuation: item.lbo_valuation || '', asset_based_valuation: item.asset_based_valuation || '',
      weighted_average_valuation: item.weighted_average_valuation || '',
      valuation_range_low: item.valuation_range_low || '', valuation_range_high: item.valuation_range_high || '',
      implied_ev_ebitda_multiple: item.implied_ev_ebitda_multiple || '',
      implied_ev_revenue_multiple: item.implied_ev_revenue_multiple || '',
      key_assumptions: item.key_assumptions || ''
    });
    setShowDetailModal(false);
    setShowModal(true);
  };

  const handleRowClick = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const handleAnalyze = async () => {
    setAnalyzing(true);
    try {
      await axios.post(`${API_URL}/valuations/${selectedItem.id}/analyze`);
      const updated = await axios.get(`${API_URL}/valuations/${selectedItem.id}`);
      setSelectedItem(updated.data);
      fetchData();
      addToast('AI analysis completed', 'success');
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
      company_id: '', deal_name: '', dcf_valuation: '', comparable_companies_valuation: '',
      precedent_transactions_valuation: '', lbo_valuation: '', asset_based_valuation: '',
      weighted_average_valuation: '', valuation_range_low: '', valuation_range_high: '',
      implied_ev_ebitda_multiple: '', implied_ev_revenue_multiple: '', key_assumptions: ''
    });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({
      company_id: '', deal_name: '', dcf_valuation: '', comparable_companies_valuation: '',
      precedent_transactions_valuation: '', lbo_valuation: '', asset_based_valuation: '',
      weighted_average_valuation: '', valuation_range_low: '', valuation_range_high: '',
      implied_ev_ebitda_multiple: '', implied_ev_revenue_multiple: '', key_assumptions: ''
    });
    setShowModal(true);
  };

  const formatCurrency = (value) => {
    if (!value) return '$0';
    return `$${(parseFloat(value) / 1000000).toFixed(1)}M`;
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
              <h4 style={{ color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid rgba(59, 130, 246, 0.2)', paddingBottom: '8px' }}>{title}</h4>
              <div style={{ color: '#d1d5db', fontSize: '14px', lineHeight: '1.7' }}>
                {content.join('\n').split('\n').map((line, lineIdx) => {
                  if (line.startsWith('### ')) {
                    return <h5 key={lineIdx} style={{ color: '#0ea5e9', fontSize: '14px', fontWeight: '600', marginTop: '12px', marginBottom: '8px' }}>{line.replace('### ', '')}</h5>;
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
    { key: 'deal_name', label: 'Deal Name' },
    { key: 'company_name', label: 'Company' },
    { key: 'dcf_valuation', label: 'DCF', render: (val) => <span style={styles.dcfBadge}>{formatCurrency(val)}</span> },
    { key: 'comparable_companies_valuation', label: 'Comps', render: (val) => <span style={styles.compsBadge}>{formatCurrency(val)}</span> },
    { key: 'precedent_transactions_valuation', label: 'Precedent', render: (val) => <span style={styles.precBadge}>{formatCurrency(val)}</span> },
    { key: 'lbo_valuation', label: 'LBO', render: (val) => <span style={styles.lboBadge}>{formatCurrency(val)}</span> },
    { key: 'weighted_average_valuation', label: 'Weighted Avg', render: (val) => <span style={styles.avgBadge}>{formatCurrency(val)}</span> },
    { key: 'valuation_range_low', label: 'Range', render: (val, row) => <span style={styles.rangeBadge}>{formatCurrency(val)} - {formatCurrency(row.valuation_range_high)}</span> },
    { key: 'implied_ev_ebitda_multiple', label: 'EV/EBITDA', render: (val) => val ? `${val}x` : '-' },
    { key: 'implied_ev_revenue_multiple', label: 'EV/Rev', render: (val) => val ? `${val}x` : '-' },
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h2 style={{ fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '4px' }}>AI Valuation Modeler</h2>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Multiple valuation methods with AI-powered analysis</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ New Valuation</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Valuations"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Valuation' : 'New Valuation'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Company" type="select" value={formData.company_id} onChange={(e) => setFormData({...formData, company_id: e.target.value})} required error={errors.company_id}
              options={companies.map(c => ({ value: c.id, label: c.name }))} />
            <FormInput label="Deal Name" value={formData.deal_name} onChange={(e) => setFormData({...formData, deal_name: e.target.value})} required error={errors.deal_name} />
          </FormRow>
          <FormRow>
            <FormInput label="DCF Valuation ($)" type="number" value={formData.dcf_valuation} onChange={(e) => setFormData({...formData, dcf_valuation: e.target.value})} required error={errors.dcf_valuation} />
            <FormInput label="Comparable Companies ($)" type="number" value={formData.comparable_companies_valuation} onChange={(e) => setFormData({...formData, comparable_companies_valuation: e.target.value})} required error={errors.comparable_companies_valuation} />
          </FormRow>
          <FormRow>
            <FormInput label="Precedent Transactions ($)" type="number" value={formData.precedent_transactions_valuation} onChange={(e) => setFormData({...formData, precedent_transactions_valuation: e.target.value})} required error={errors.precedent_transactions_valuation} />
            <FormInput label="LBO Valuation ($)" type="number" value={formData.lbo_valuation} onChange={(e) => setFormData({...formData, lbo_valuation: e.target.value})} required error={errors.lbo_valuation} />
          </FormRow>
          <FormRow>
            <FormInput label="Asset-Based Valuation ($)" type="number" value={formData.asset_based_valuation} onChange={(e) => setFormData({...formData, asset_based_valuation: e.target.value})} required error={errors.asset_based_valuation} />
            <FormInput label="Weighted Average ($)" type="number" value={formData.weighted_average_valuation} onChange={(e) => setFormData({...formData, weighted_average_valuation: e.target.value})} required error={errors.weighted_average_valuation} />
          </FormRow>
          <FormRow>
            <FormInput label="Range Low ($)" type="number" value={formData.valuation_range_low} onChange={(e) => setFormData({...formData, valuation_range_low: e.target.value})} required error={errors.valuation_range_low} />
            <FormInput label="Range High ($)" type="number" value={formData.valuation_range_high} onChange={(e) => setFormData({...formData, valuation_range_high: e.target.value})} required error={errors.valuation_range_high} />
          </FormRow>
          <FormRow>
            <FormInput label="Implied EV/EBITDA" type="number" value={formData.implied_ev_ebitda_multiple} onChange={(e) => setFormData({...formData, implied_ev_ebitda_multiple: e.target.value})} required error={errors.implied_ev_ebitda_multiple} placeholder="e.g. 12.5" />
            <FormInput label="Implied EV/Revenue" type="number" value={formData.implied_ev_revenue_multiple} onChange={(e) => setFormData({...formData, implied_ev_revenue_multiple: e.target.value})} required error={errors.implied_ev_revenue_multiple} placeholder="e.g. 3.2" />
          </FormRow>
          <FormInput label="Key Assumptions" type="textarea" value={formData.key_assumptions} onChange={(e) => setFormData({...formData, key_assumptions: e.target.value})} placeholder="WACC, terminal growth rate, comparable companies selection criteria..." />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Valuation Details" size="xlarge">
        {selectedItem && (
          <div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>{selectedItem.deal_name}</h3>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Deal Name</span><span style={styles.detailValue}>{selectedItem.deal_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Weighted Average</span><span style={{...styles.avgBadge, fontSize: '16px'}}>{formatCurrency(selectedItem.weighted_average_valuation)}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>EV/EBITDA</span><span style={styles.detailValue}>{selectedItem.implied_ev_ebitda_multiple}x</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>EV/Revenue</span><span style={styles.detailValue}>{selectedItem.implied_ev_revenue_multiple}x</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Valuation Range</span><span style={styles.rangeBadge}>{formatCurrency(selectedItem.valuation_range_low)} - {formatCurrency(selectedItem.valuation_range_high)}</span></div>
            </div>

            <div style={{ marginTop: '24px', padding: '20px', background: 'rgba(26, 26, 46, 0.8)', borderRadius: '12px' }}>
              <h4 style={{ color: '#0ea5e9', fontSize: '16px', fontWeight: '600', marginBottom: '16px' }}>Valuation Methods</h4>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: '12px', marginBottom: '16px' }}>
                <div style={styles.valuationItem}>
                  <span style={styles.valuationLabel}>DCF Analysis</span>
                  <span style={styles.dcfBadge}>{formatCurrency(selectedItem.dcf_valuation)}</span>
                </div>
                <div style={styles.valuationItem}>
                  <span style={styles.valuationLabel}>Comparable Companies</span>
                  <span style={styles.compsBadge}>{formatCurrency(selectedItem.comparable_companies_valuation)}</span>
                </div>
                <div style={styles.valuationItem}>
                  <span style={styles.valuationLabel}>Precedent Transactions</span>
                  <span style={styles.precBadge}>{formatCurrency(selectedItem.precedent_transactions_valuation)}</span>
                </div>
                <div style={styles.valuationItem}>
                  <span style={styles.valuationLabel}>LBO Analysis</span>
                  <span style={styles.lboBadge}>{formatCurrency(selectedItem.lbo_valuation)}</span>
                </div>
                <div style={styles.valuationItem}>
                  <span style={styles.valuationLabel}>Asset-Based</span>
                  <span style={styles.assetBadge}>{formatCurrency(selectedItem.asset_based_valuation)}</span>
                </div>
              </div>
            </div>

            {selectedItem.key_assumptions && (
              <div style={{ marginTop: '16px' }}>
                <span style={styles.detailLabel}>Key Assumptions</span>
                <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6', background: 'rgba(26, 26, 46, 0.8)', padding: '12px', borderRadius: '8px' }}>{selectedItem.key_assumptions}</p>
              </div>
            )}

            <div style={styles.aiSection}>
              {hasPermission('analyze') && (
                <button onClick={handleAnalyze} disabled={analyzing} style={{
                  ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', gap: '8px',
                }}>
                  {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                  {analyzing ? 'Analyzing...' : 'AI Valuation Analysis'}
                </button>
              )}
              {selectedItem.ai_analysis && (
                <div style={styles.aiResult}>
                  <h4 style={{ color: '#0ea5e9', marginBottom: '12px' }}>AI Analysis Result</h4>
                  {renderAnalysis(selectedItem.ai_analysis)}
                </div>
              )}
            </div>

            <div style={styles.modalActions}>
              {hasPermission('edit') && (
                <button onClick={() => handleEdit(selectedItem)} style={styles.editModalBtn}>Edit</button>
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
  addBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '600', cursor: 'pointer' },
  dcfBadge: { padding: '4px 10px', borderRadius: '6px', background: '#3b82f6', color: '#fff', fontWeight: '600', fontSize: '12px' },
  compsBadge: { padding: '4px 10px', borderRadius: '6px', background: '#8b5cf6', color: '#fff', fontWeight: '600', fontSize: '12px' },
  precBadge: { padding: '4px 10px', borderRadius: '6px', background: '#ec4899', color: '#fff', fontWeight: '600', fontSize: '12px' },
  lboBadge: { padding: '4px 10px', borderRadius: '6px', background: '#f59e0b', color: '#fff', fontWeight: '600', fontSize: '12px' },
  assetBadge: { padding: '4px 10px', borderRadius: '6px', background: '#06b6d4', color: '#fff', fontWeight: '600', fontSize: '12px' },
  avgBadge: { padding: '6px 14px', borderRadius: '8px', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', color: '#fff', fontWeight: '700', fontSize: '14px' },
  rangeBadge: { padding: '4px 10px', borderRadius: '6px', background: 'rgba(16, 185, 129, 0.2)', border: '1px solid #10b981', color: '#10b981', fontWeight: '500', fontSize: '12px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' },
  detailItem: { display: 'flex', flexDirection: 'column', gap: '4px' },
  detailLabel: { color: '#a1a1aa', fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.5px' },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '500' },
  valuationItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(59, 130, 246, 0.1)', borderRadius: '8px' },
  valuationLabel: { color: '#a1a1aa', fontSize: '11px', textAlign: 'center' },
  aiSection: { marginTop: '24px', paddingTop: '24px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  aiBtn: { padding: '12px 24px', background: 'linear-gradient(135deg, #0ea5e9, #3b82f6)', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', fontWeight: '500' },
  aiResult: { marginTop: '16px', padding: '20px', background: 'linear-gradient(135deg, rgba(14, 165, 233, 0.1), rgba(59, 130, 246, 0.1))', borderRadius: '12px', border: '1px solid rgba(59, 130, 246, 0.3)' },
  modalActions: { display: 'flex', gap: '12px', marginTop: '24px', paddingTop: '20px', borderTop: '1px solid rgba(59, 130, 246, 0.2)' },
  editModalBtn: { padding: '12px 24px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#3b82f6', fontWeight: '600', cursor: 'pointer' },
  deleteModalBtn: { padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' },
};

export default ValuationModeler;
