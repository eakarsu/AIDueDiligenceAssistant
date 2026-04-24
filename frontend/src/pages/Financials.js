import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const Financials = () => {
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
    company_id: '', fiscal_year: new Date().getFullYear(), revenue: '', net_income: '', total_assets: '',
    total_liabilities: '', ebitda: '', gross_margin: '', operating_margin: '', debt_to_equity: ''
  });

  const fetchData = async () => {
    try {
      const [financialsRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/financials`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(financialsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load financial data', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.company_id) errs.company_id = 'Company is required';
    if (!formData.fiscal_year) errs.fiscal_year = 'Fiscal year is required';
    else if (isNaN(Number(formData.fiscal_year)) || Number(formData.fiscal_year) < 1900 || Number(formData.fiscal_year) > 2100) errs.fiscal_year = 'Enter a valid year (1900-2100)';
    if (formData.revenue && isNaN(Number(formData.revenue))) errs.revenue = 'Must be a valid number';
    if (formData.net_income && isNaN(Number(formData.net_income))) errs.net_income = 'Must be a valid number';
    if (formData.total_assets && isNaN(Number(formData.total_assets))) errs.total_assets = 'Must be a valid number';
    if (formData.total_liabilities && isNaN(Number(formData.total_liabilities))) errs.total_liabilities = 'Must be a valid number';
    if (formData.ebitda && isNaN(Number(formData.ebitda))) errs.ebitda = 'Must be a valid number';
    if (formData.gross_margin && isNaN(Number(formData.gross_margin))) errs.gross_margin = 'Must be a valid number';
    if (formData.operating_margin && isNaN(Number(formData.operating_margin))) errs.operating_margin = 'Must be a valid number';
    if (formData.debt_to_equity && isNaN(Number(formData.debt_to_equity))) errs.debt_to_equity = 'Must be a valid number';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/financials/${selectedItem.id}`, formData);
        addToast('Financial record updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/financials`, formData);
        addToast('Financial record created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save financial record', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Financial Record',
      message: `Are you sure you want to delete the financial record for "${item.company_name}" (${item.fiscal_year})? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/financials/${item.id}`);
          addToast('Financial record deleted successfully', 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete financial record', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple Financial Records',
      message: `Are you sure you want to delete ${ids.length} financial records? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/financials/bulk-delete`, { ids });
          addToast(`${ids.length} financial records deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete financial records', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', fiscal_year: item.fiscal_year || new Date().getFullYear(),
      revenue: item.revenue || '', net_income: item.net_income || '', total_assets: item.total_assets || '',
      total_liabilities: item.total_liabilities || '', ebitda: item.ebitda || '', gross_margin: item.gross_margin || '',
      operating_margin: item.operating_margin || '', debt_to_equity: item.debt_to_equity || ''
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
      const response = await axios.post(`${API_URL}/financials/${selectedItem.id}/analyze`);
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
    setFormData({ company_id: '', fiscal_year: new Date().getFullYear(), revenue: '', net_income: '', total_assets: '', total_liabilities: '', ebitda: '', gross_margin: '', operating_margin: '', debt_to_equity: '' });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', fiscal_year: new Date().getFullYear(), revenue: '', net_income: '', total_assets: '', total_liabilities: '', ebitda: '', gross_margin: '', operating_margin: '', debt_to_equity: '' });
    setShowModal(true);
  };

  const columns = [
    { key: 'company_name', label: 'Company' },
    { key: 'fiscal_year', label: 'Year' },
    { key: 'revenue', label: 'Revenue', render: (val) => val ? `$${Number(val).toLocaleString()}` : '-' },
    { key: 'net_income', label: 'Net Income', render: (val) => val ? `$${Number(val).toLocaleString()}` : '-' },
    { key: 'ebitda', label: 'EBITDA', render: (val) => val ? `$${Number(val).toLocaleString()}` : '-' },
    { key: 'gross_margin', label: 'Gross Margin', render: (val) => val ? `${val}%` : '-' },
    { key: 'operating_margin', label: 'Op Margin', render: (val) => val ? `${val}%` : '-' },
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'fiscal_year', label: 'Year' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Analyze financial metrics and health indicators</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add Financial Record</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="Financials"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit Financial Record' : 'Add Financial Record'} size="large">
        <form onSubmit={handleSubmit}>
          <FormRow>
            <FormInput label="Company" type="select" value={formData.company_id} onChange={(e) => setFormData({...formData, company_id: e.target.value})} required error={errors.company_id}
              options={companies.map(c => ({ value: c.id, label: c.name }))} />
            <FormInput label="Fiscal Year" type="number" value={formData.fiscal_year} onChange={(e) => setFormData({...formData, fiscal_year: e.target.value})} required error={errors.fiscal_year} />
          </FormRow>
          <FormRow>
            <FormInput label="Revenue ($)" type="number" value={formData.revenue} onChange={(e) => setFormData({...formData, revenue: e.target.value})} error={errors.revenue} />
            <FormInput label="Net Income ($)" type="number" value={formData.net_income} onChange={(e) => setFormData({...formData, net_income: e.target.value})} error={errors.net_income} />
          </FormRow>
          <FormRow>
            <FormInput label="Total Assets ($)" type="number" value={formData.total_assets} onChange={(e) => setFormData({...formData, total_assets: e.target.value})} error={errors.total_assets} />
            <FormInput label="Total Liabilities ($)" type="number" value={formData.total_liabilities} onChange={(e) => setFormData({...formData, total_liabilities: e.target.value})} error={errors.total_liabilities} />
          </FormRow>
          <FormRow>
            <FormInput label="EBITDA ($)" type="number" value={formData.ebitda} onChange={(e) => setFormData({...formData, ebitda: e.target.value})} error={errors.ebitda} />
            <FormInput label="Gross Margin (%)" type="number" value={formData.gross_margin} onChange={(e) => setFormData({...formData, gross_margin: e.target.value})} error={errors.gross_margin} />
          </FormRow>
          <FormRow>
            <FormInput label="Operating Margin (%)" type="number" value={formData.operating_margin} onChange={(e) => setFormData({...formData, operating_margin: e.target.value})} error={errors.operating_margin} />
            <FormInput label="Debt to Equity" type="number" value={formData.debt_to_equity} onChange={(e) => setFormData({...formData, debt_to_equity: e.target.value})} error={errors.debt_to_equity} />
          </FormRow>
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="Financial Details" size="large">
        {selectedItem && (
          <div>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Fiscal Year</span><span style={styles.detailValue}>{selectedItem.fiscal_year}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Revenue</span><span style={styles.detailValue}>${Number(selectedItem.revenue).toLocaleString()}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Net Income</span><span style={styles.detailValue}>${Number(selectedItem.net_income).toLocaleString()}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Total Assets</span><span style={styles.detailValue}>${Number(selectedItem.total_assets).toLocaleString()}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Total Liabilities</span><span style={styles.detailValue}>${Number(selectedItem.total_liabilities).toLocaleString()}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>EBITDA</span><span style={styles.detailValue}>${Number(selectedItem.ebitda).toLocaleString()}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Gross Margin</span><span style={styles.detailValue}>{selectedItem.gross_margin}%</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Operating Margin</span><span style={styles.detailValue}>{selectedItem.operating_margin}%</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Debt to Equity</span><span style={styles.detailValue}>{selectedItem.debt_to_equity}</span></div>
            </div>
            <div style={styles.aiSection}>
              <button onClick={handleAnalyze} disabled={analyzing} style={{
                ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                {analyzing ? 'Analyzing...' : 'AI Financial Analysis'}
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

export default Financials;
