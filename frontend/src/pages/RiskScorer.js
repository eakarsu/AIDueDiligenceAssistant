import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import { useToast } from '../components/Toast';
import ConfirmDialog from '../components/ConfirmDialog';

const filterOptions = [
  { key: 'company_name', label: 'Company' },
  { key: 'risk_category', label: 'Risk Category' },
];

const emptyForm = {
  company_id: '', deal_name: '', financial_risk_score: '', operational_risk_score: '',
  market_risk_score: '', legal_risk_score: '', integration_risk_score: '', overall_risk_score: '',
  risk_category: 'Medium', key_risk_factors: '', risk_mitigation_suggestions: '', confidence_level: ''
};

const validateForm = (formData) => {
  const errors = {};
  if (!formData.company_id) errors.company_id = 'Company is required';
  if (!formData.deal_name || !formData.deal_name.trim()) errors.deal_name = 'Deal name is required';

  const scoreFields = [
    { key: 'financial_risk_score', label: 'Financial risk' },
    { key: 'operational_risk_score', label: 'Operational risk' },
    { key: 'market_risk_score', label: 'Market risk' },
    { key: 'legal_risk_score', label: 'Legal risk' },
    { key: 'integration_risk_score', label: 'Integration risk' },
    { key: 'overall_risk_score', label: 'Overall risk' },
  ];

  scoreFields.forEach(({ key, label }) => {
    const val = parseFloat(formData[key]);
    if (formData[key] === '' || formData[key] === null || formData[key] === undefined) {
      errors[key] = `${label} score is required`;
    } else if (isNaN(val) || val < 1 || val > 10) {
      errors[key] = `${label} must be between 1 and 10`;
    }
  });

  const conf = parseFloat(formData.confidence_level);
  if (formData.confidence_level === '' || formData.confidence_level === null || formData.confidence_level === undefined) {
    errors.confidence_level = 'Confidence level is required';
  } else if (isNaN(conf) || conf < 0 || conf > 100) {
    errors.confidence_level = 'Confidence must be between 0 and 100';
  }

  return errors;
};

const RiskScorer = () => {
  const { hasPermission } = useAuth();
  const { addToast } = useToast();

  const [data, setData] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [formData, setFormData] = useState({ ...emptyForm });
  const [formErrors, setFormErrors] = useState({});

  // Filter state
  const [filterKey, setFilterKey] = useState(filterOptions[0].key);
  const [filterValue, setFilterValue] = useState('');

  // Confirm dialog state
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmTarget, setConfirmTarget] = useState(null); // id or 'bulk'
  const [confirmMessage, setConfirmMessage] = useState('');
  const [confirmTitle, setConfirmTitle] = useState('');

  // Row selection for bulk delete
  const [selectedIds, setSelectedIds] = useState([]);

  useEffect(() => {
    fetchData();
    fetchCompanies();
  }, []);

  const fetchData = async () => {
    try {
      const response = await axios.get(`${API_URL}/risk-scores`);
      setData(response.data);
    } catch (error) {
      console.error('Error fetching data:', error);
      addToast('Failed to load risk scores', 'error');
    } finally {
      setLoading(false);
    }
  };

  const fetchCompanies = async () => {
    try {
      const response = await axios.get(`${API_URL}/companies`);
      setCompanies(response.data);
    } catch (error) {
      console.error('Error fetching companies:', error);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = validateForm(formData);
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      addToast('Please fix the validation errors before saving', 'warning');
      return;
    }
    setSaving(true);
    try {
      if (selectedItem && !showDetailModal) {
        await axios.put(`${API_URL}/risk-scores/${selectedItem.id}`, formData);
        addToast('Risk score updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/risk-scores`, formData);
        addToast('Risk score created successfully', 'success');
      }
      fetchData();
      resetForm();
    } catch (error) {
      console.error('Error saving:', error);
      const msg = error.response?.data?.error || 'Failed to save risk score';
      addToast(msg, 'error');
    } finally {
      setSaving(false);
    }
  };

  // Opens the confirm dialog for single delete
  const promptDelete = (id) => {
    setConfirmTarget(id);
    setConfirmTitle('Delete Risk Score');
    setConfirmMessage('Are you sure you want to delete this risk score? This action cannot be undone.');
    setConfirmOpen(true);
  };

  // Opens the confirm dialog for bulk delete
  const promptBulkDelete = () => {
    if (selectedIds.length === 0) {
      addToast('No items selected for deletion', 'warning');
      return;
    }
    setConfirmTarget('bulk');
    setConfirmTitle('Bulk Delete Risk Scores');
    setConfirmMessage(`Are you sure you want to delete ${selectedIds.length} selected risk score(s)? This action cannot be undone.`);
    setConfirmOpen(true);
  };

  const handleConfirmAction = async () => {
    setConfirmOpen(false);
    if (confirmTarget === 'bulk') {
      await onBulkDelete();
    } else if (confirmTarget) {
      await handleDeleteConfirmed(confirmTarget);
    }
    setConfirmTarget(null);
  };

  const handleDeleteConfirmed = async (id) => {
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/risk-scores/${id}`);
      addToast('Risk score deleted successfully', 'success');
      fetchData();
      setShowDetailModal(false);
      setSelectedItem(null);
    } catch (error) {
      console.error('Error deleting:', error);
      const msg = error.response?.data?.error || 'Failed to delete risk score';
      addToast(msg, 'error');
    } finally {
      setDeleting(false);
    }
  };

  const onBulkDelete = async () => {
    setBulkDeleting(true);
    let successCount = 0;
    let failCount = 0;
    for (const id of selectedIds) {
      try {
        await axios.delete(`${API_URL}/risk-scores/${id}`);
        successCount++;
      } catch (error) {
        console.error(`Error deleting id ${id}:`, error);
        failCount++;
      }
    }
    if (successCount > 0) {
      addToast(`Successfully deleted ${successCount} risk score(s)`, 'success');
    }
    if (failCount > 0) {
      addToast(`Failed to delete ${failCount} risk score(s)`, 'error');
    }
    setSelectedIds([]);
    fetchData();
    setBulkDeleting(false);
  };

  const handleAnalyze = async (id) => {
    setAnalyzing(true);
    try {
      await axios.post(`${API_URL}/risk-scores/${id}/analyze`);
      const updated = await axios.get(`${API_URL}/risk-scores/${id}`);
      setSelectedItem(updated.data);
      fetchData();
      addToast('AI analysis generated successfully', 'success');
    } catch (error) {
      console.error('Error analyzing:', error);
      addToast('Error generating AI analysis', 'error');
    } finally {
      setAnalyzing(false);
    }
  };

  const resetForm = () => {
    setFormData({ ...emptyForm });
    setFormErrors({});
    setSelectedItem(null);
    setShowModal(false);
  };

  const openDetail = (item) => {
    setSelectedItem(item);
    setShowDetailModal(true);
  };

  const openEdit = (item) => {
    setFormData({ ...item });
    setSelectedItem(item);
    setFormErrors({});
    setShowDetailModal(false);
    setShowModal(true);
  };

  const getRiskColor = (score) => {
    if (score >= 7) return '#ef4444';
    if (score >= 5) return '#f59e0b';
    if (score >= 3) return '#10b981';
    return '#22c55e';
  };

  const getCategoryColor = (cat) => {
    if (cat === 'High') return '#ef4444';
    if (cat === 'Medium') return '#f59e0b';
    return '#10b981';
  };

  // Checkbox toggling for bulk select
  const toggleSelectId = (id, e) => {
    e.stopPropagation();
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredData.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredData.map((item) => item.id));
    }
  };

  // Filtering
  const filteredData = data.filter((item) => {
    if (!filterValue.trim()) return true;
    const val = (item[filterKey] || '').toString().toLowerCase();
    return val.includes(filterValue.trim().toLowerCase());
  });

  const handleFieldChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear specific error when user starts typing
    if (formErrors[field]) {
      setFormErrors((prev) => {
        const next = { ...prev };
        delete next[field];
        return next;
      });
    }
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

  if (loading) return <div style={styles.loading}>Loading...</div>;

  return (
    <div style={styles.container}>
      {/* Confirm Dialog */}
      <ConfirmDialog
        isOpen={confirmOpen}
        title={confirmTitle}
        message={confirmMessage}
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={handleConfirmAction}
        onCancel={() => { setConfirmOpen(false); setConfirmTarget(null); }}
      />

      {/* Header */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.title}>AI Risk Scorer</h2>
          <p style={styles.subtitle}>Quantify deal risks automatically with AI-powered analysis</p>
        </div>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {hasPermission('bulk') && selectedIds.length > 0 && (
            <button
              style={styles.bulkDeleteButton}
              onClick={promptBulkDelete}
              disabled={bulkDeleting}
            >
              {bulkDeleting ? 'Deleting...' : `Delete Selected (${selectedIds.length})`}
            </button>
          )}
          {hasPermission('create') && (
            <button style={styles.addButton} onClick={() => setShowModal(true)}>+ New Risk Score</button>
          )}
        </div>
      </div>

      {/* Filter Bar */}
      <div style={styles.filterBar}>
        <select
          style={styles.filterSelect}
          value={filterKey}
          onChange={(e) => setFilterKey(e.target.value)}
        >
          {filterOptions.map((opt) => (
            <option key={opt.key} value={opt.key}>{opt.label}</option>
          ))}
        </select>
        <input
          style={styles.filterInput}
          placeholder={`Filter by ${filterOptions.find(o => o.key === filterKey)?.label || ''}...`}
          value={filterValue}
          onChange={(e) => setFilterValue(e.target.value)}
        />
        {filterValue && (
          <button style={styles.clearFilterButton} onClick={() => setFilterValue('')}>Clear</button>
        )}
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              {hasPermission('bulk') && (
                <th style={styles.th}>
                  <input
                    type="checkbox"
                    checked={filteredData.length > 0 && selectedIds.length === filteredData.length}
                    onChange={toggleSelectAll}
                    style={{ cursor: 'pointer' }}
                  />
                </th>
              )}
              <th style={styles.th}>Deal Name</th>
              <th style={styles.th}>Company</th>
              <th style={styles.th}>Financial</th>
              <th style={styles.th}>Operational</th>
              <th style={styles.th}>Market</th>
              <th style={styles.th}>Legal</th>
              <th style={styles.th}>Integration</th>
              <th style={styles.th}>Overall</th>
              <th style={styles.th}>Category</th>
              <th style={styles.th}>Confidence</th>
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={hasPermission('bulk') ? 12 : 11} style={{ ...styles.td, textAlign: 'center', color: '#a1a1aa', padding: '40px' }}>
                  {filterValue ? 'No risk scores match your filter.' : 'No risk scores found. Create one to get started.'}
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr key={item.id} style={styles.tr} onClick={() => openDetail(item)}>
                  {hasPermission('bulk') && (
                    <td style={styles.td}>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(item.id)}
                        onChange={(e) => toggleSelectId(item.id, e)}
                        style={{ cursor: 'pointer' }}
                      />
                    </td>
                  )}
                  <td style={styles.td}><strong>{item.deal_name}</strong></td>
                  <td style={styles.td}>{item.company_name}</td>
                  <td style={styles.td}><span style={{...styles.scoreBadge, background: getRiskColor(item.financial_risk_score)}}>{item.financial_risk_score}</span></td>
                  <td style={styles.td}><span style={{...styles.scoreBadge, background: getRiskColor(item.operational_risk_score)}}>{item.operational_risk_score}</span></td>
                  <td style={styles.td}><span style={{...styles.scoreBadge, background: getRiskColor(item.market_risk_score)}}>{item.market_risk_score}</span></td>
                  <td style={styles.td}><span style={{...styles.scoreBadge, background: getRiskColor(item.legal_risk_score)}}>{item.legal_risk_score}</span></td>
                  <td style={styles.td}><span style={{...styles.scoreBadge, background: getRiskColor(item.integration_risk_score)}}>{item.integration_risk_score}</span></td>
                  <td style={styles.td}><span style={{...styles.overallBadge, background: getRiskColor(item.overall_risk_score)}}>{item.overall_risk_score}</span></td>
                  <td style={styles.td}><span style={{...styles.categoryBadge, background: getCategoryColor(item.risk_category)}}>{item.risk_category}</span></td>
                  <td style={styles.td}>{item.confidence_level}%</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Detail Modal */}
      {showDetailModal && selectedItem && (
        <div style={styles.modalOverlay} onClick={() => setShowDetailModal(false)}>
          <div style={styles.detailModal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{selectedItem.deal_name}</h3>
              <button style={styles.closeButton} onClick={() => setShowDetailModal(false)}>x</button>
            </div>
            <div style={styles.detailContent}>
              {/* Top summary cards */}
              <div style={styles.detailGrid}>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Company</span>
                  <span style={styles.detailValue}>{selectedItem.company_name}</span>
                </div>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Risk Category</span>
                  <span style={{...styles.categoryBadge, background: getCategoryColor(selectedItem.risk_category)}}>{selectedItem.risk_category}</span>
                </div>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Overall Score</span>
                  <span style={{...styles.overallBadge, background: getRiskColor(selectedItem.overall_risk_score), fontSize: '24px'}}>{selectedItem.overall_risk_score}/10</span>
                </div>
                <div style={styles.detailCard}>
                  <span style={styles.detailLabel}>Confidence</span>
                  <span style={styles.detailValue}>{selectedItem.confidence_level}%</span>
                </div>
              </div>

              {/* Individual scores */}
              <div style={styles.scoresGrid}>
                <div style={styles.scoreItem}><span>Financial</span><span style={{...styles.scoreBadge, background: getRiskColor(selectedItem.financial_risk_score)}}>{selectedItem.financial_risk_score}</span></div>
                <div style={styles.scoreItem}><span>Operational</span><span style={{...styles.scoreBadge, background: getRiskColor(selectedItem.operational_risk_score)}}>{selectedItem.operational_risk_score}</span></div>
                <div style={styles.scoreItem}><span>Market</span><span style={{...styles.scoreBadge, background: getRiskColor(selectedItem.market_risk_score)}}>{selectedItem.market_risk_score}</span></div>
                <div style={styles.scoreItem}><span>Legal</span><span style={{...styles.scoreBadge, background: getRiskColor(selectedItem.legal_risk_score)}}>{selectedItem.legal_risk_score}</span></div>
                <div style={styles.scoreItem}><span>Integration</span><span style={{...styles.scoreBadge, background: getRiskColor(selectedItem.integration_risk_score)}}>{selectedItem.integration_risk_score}</span></div>
              </div>

              {/* All text fields */}
              <div style={styles.textSection}>
                <h4 style={styles.sectionLabel}>Deal Name</h4>
                <p style={styles.textContent}>{selectedItem.deal_name}</p>
              </div>

              <div style={styles.textSection}>
                <h4 style={styles.sectionLabel}>Key Risk Factors</h4>
                <p style={styles.textContent}>{selectedItem.key_risk_factors || 'N/A'}</p>
              </div>

              <div style={styles.textSection}>
                <h4 style={styles.sectionLabel}>Mitigation Suggestions</h4>
                <p style={styles.textContent}>{selectedItem.risk_mitigation_suggestions || 'N/A'}</p>
              </div>

              {/* Meta fields if present */}
              {selectedItem.created_at && (
                <div style={styles.textSection}>
                  <h4 style={styles.sectionLabel}>Created</h4>
                  <p style={styles.textContent}>{new Date(selectedItem.created_at).toLocaleString()}</p>
                </div>
              )}
              {selectedItem.updated_at && (
                <div style={styles.textSection}>
                  <h4 style={styles.sectionLabel}>Last Updated</h4>
                  <p style={styles.textContent}>{new Date(selectedItem.updated_at).toLocaleString()}</p>
                </div>
              )}

              {/* AI Analysis section */}
              {selectedItem.ai_analysis && (
                <div style={styles.aiAnalysisSection}>
                  <h4 style={styles.aiAnalysisTitle}>AI Analysis</h4>
                  {renderAnalysis(selectedItem.ai_analysis)}
                </div>
              )}

              {/* Action buttons */}
              <div style={styles.buttonGroup}>
                {hasPermission('analyze') && (
                  <button
                    style={{
                      ...styles.analyzeButton,
                      opacity: analyzing ? 0.7 : 1,
                      cursor: analyzing ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => handleAnalyze(selectedItem.id)}
                    disabled={analyzing}
                  >
                    {analyzing ? (
                      <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <span style={styles.spinner} />
                        Analyzing...
                      </span>
                    ) : (
                      'Generate AI Analysis'
                    )}
                  </button>
                )}
                {hasPermission('edit') && (
                  <button style={styles.editButton} onClick={() => openEdit(selectedItem)}>Edit</button>
                )}
                {hasPermission('delete') && (
                  <button
                    style={{
                      ...styles.deleteButton,
                      opacity: deleting ? 0.7 : 1,
                      cursor: deleting ? 'not-allowed' : 'pointer',
                    }}
                    onClick={() => promptDelete(selectedItem.id)}
                    disabled={deleting}
                  >
                    {deleting ? 'Deleting...' : 'Delete'}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Form Modal */}
      {showModal && (
        <div style={styles.modalOverlay} onClick={resetForm}>
          <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div style={styles.modalHeader}>
              <h3 style={styles.modalTitle}>{selectedItem ? 'Edit Risk Score' : 'New Risk Score'}</h3>
              <button style={styles.closeButton} onClick={resetForm}>x</button>
            </div>
            <form onSubmit={handleSubmit} style={styles.form} noValidate>
              <div style={styles.formGrid}>
                {/* Company */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Company</label>
                  <select
                    style={{ ...styles.select, ...(formErrors.company_id ? styles.inputError : {}) }}
                    value={formData.company_id}
                    onChange={(e) => handleFieldChange('company_id', e.target.value)}
                  >
                    <option value="">Select Company</option>
                    {companies.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  {formErrors.company_id && <span style={styles.errorText}>{formErrors.company_id}</span>}
                </div>

                {/* Deal Name */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Deal Name</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.deal_name ? styles.inputError : {}) }}
                    value={formData.deal_name}
                    onChange={(e) => handleFieldChange('deal_name', e.target.value)}
                  />
                  {formErrors.deal_name && <span style={styles.errorText}>{formErrors.deal_name}</span>}
                </div>

                {/* Financial Risk */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Financial Risk (1-10)</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.financial_risk_score ? styles.inputError : {}) }}
                    type="number" min="1" max="10" step="0.1"
                    value={formData.financial_risk_score}
                    onChange={(e) => handleFieldChange('financial_risk_score', e.target.value)}
                  />
                  {formErrors.financial_risk_score && <span style={styles.errorText}>{formErrors.financial_risk_score}</span>}
                </div>

                {/* Operational Risk */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Operational Risk (1-10)</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.operational_risk_score ? styles.inputError : {}) }}
                    type="number" min="1" max="10" step="0.1"
                    value={formData.operational_risk_score}
                    onChange={(e) => handleFieldChange('operational_risk_score', e.target.value)}
                  />
                  {formErrors.operational_risk_score && <span style={styles.errorText}>{formErrors.operational_risk_score}</span>}
                </div>

                {/* Market Risk */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Market Risk (1-10)</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.market_risk_score ? styles.inputError : {}) }}
                    type="number" min="1" max="10" step="0.1"
                    value={formData.market_risk_score}
                    onChange={(e) => handleFieldChange('market_risk_score', e.target.value)}
                  />
                  {formErrors.market_risk_score && <span style={styles.errorText}>{formErrors.market_risk_score}</span>}
                </div>

                {/* Legal Risk */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Legal Risk (1-10)</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.legal_risk_score ? styles.inputError : {}) }}
                    type="number" min="1" max="10" step="0.1"
                    value={formData.legal_risk_score}
                    onChange={(e) => handleFieldChange('legal_risk_score', e.target.value)}
                  />
                  {formErrors.legal_risk_score && <span style={styles.errorText}>{formErrors.legal_risk_score}</span>}
                </div>

                {/* Integration Risk */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Integration Risk (1-10)</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.integration_risk_score ? styles.inputError : {}) }}
                    type="number" min="1" max="10" step="0.1"
                    value={formData.integration_risk_score}
                    onChange={(e) => handleFieldChange('integration_risk_score', e.target.value)}
                  />
                  {formErrors.integration_risk_score && <span style={styles.errorText}>{formErrors.integration_risk_score}</span>}
                </div>

                {/* Overall Risk */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Overall Risk (1-10)</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.overall_risk_score ? styles.inputError : {}) }}
                    type="number" min="1" max="10" step="0.1"
                    value={formData.overall_risk_score}
                    onChange={(e) => handleFieldChange('overall_risk_score', e.target.value)}
                  />
                  {formErrors.overall_risk_score && <span style={styles.errorText}>{formErrors.overall_risk_score}</span>}
                </div>

                {/* Risk Category */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Risk Category</label>
                  <select
                    style={styles.select}
                    value={formData.risk_category}
                    onChange={(e) => handleFieldChange('risk_category', e.target.value)}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                  </select>
                </div>

                {/* Confidence Level */}
                <div style={styles.formGroup}>
                  <label style={styles.label}>Confidence Level (%)</label>
                  <input
                    style={{ ...styles.input, ...(formErrors.confidence_level ? styles.inputError : {}) }}
                    type="number" min="0" max="100"
                    value={formData.confidence_level}
                    onChange={(e) => handleFieldChange('confidence_level', e.target.value)}
                  />
                  {formErrors.confidence_level && <span style={styles.errorText}>{formErrors.confidence_level}</span>}
                </div>
              </div>

              {/* Key Risk Factors */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Key Risk Factors</label>
                <textarea
                  style={styles.textarea}
                  value={formData.key_risk_factors}
                  onChange={(e) => handleFieldChange('key_risk_factors', e.target.value)}
                  rows={3}
                />
              </div>

              {/* Mitigation Suggestions */}
              <div style={styles.formGroup}>
                <label style={styles.label}>Mitigation Suggestions</label>
                <textarea
                  style={styles.textarea}
                  value={formData.risk_mitigation_suggestions}
                  onChange={(e) => handleFieldChange('risk_mitigation_suggestions', e.target.value)}
                  rows={3}
                />
              </div>

              <div style={styles.formActions}>
                <button type="button" style={styles.cancelButton} onClick={resetForm}>Cancel</button>
                <button
                  type="submit"
                  style={{
                    ...styles.submitButton,
                    opacity: saving ? 0.7 : 1,
                    cursor: saving ? 'not-allowed' : 'pointer',
                  }}
                  disabled={saving}
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Inline spinner keyframes */}
      <style>{`
        @keyframes riskSpinnerRotate {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

const styles = {
  container: { padding: '0' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' },
  title: { fontSize: '24px', fontWeight: '600', color: '#fff', marginBottom: '4px' },
  subtitle: { color: '#a1a1aa', fontSize: '14px' },
  addButton: { padding: '12px 24px', background: 'linear-gradient(135deg, #f43f5e, #ec4899)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  bulkDeleteButton: { padding: '12px 24px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' },
  loading: { color: '#fff', textAlign: 'center', padding: '40px' },
  // Filter bar
  filterBar: { display: 'flex', gap: '12px', marginBottom: '16px', alignItems: 'center' },
  filterSelect: { padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#fff', fontSize: '14px' },
  filterInput: { padding: '10px 14px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#fff', fontSize: '14px', flex: 1, maxWidth: '320px' },
  clearFilterButton: { padding: '10px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#a1a1aa', cursor: 'pointer', fontSize: '13px' },
  // Table
  tableContainer: { background: 'rgba(26, 26, 46, 0.6)', borderRadius: '12px', overflow: 'hidden', border: '1px solid rgba(59, 130, 246, 0.2)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: { padding: '16px', textAlign: 'left', color: '#a1a1aa', fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', borderBottom: '1px solid rgba(59, 130, 246, 0.2)' },
  tr: { cursor: 'pointer', transition: 'background 0.2s', borderBottom: '1px solid rgba(59, 130, 246, 0.1)' },
  td: { padding: '16px', color: '#fff', fontSize: '14px' },
  scoreBadge: { padding: '4px 12px', borderRadius: '6px', color: '#fff', fontWeight: '600', fontSize: '13px' },
  overallBadge: { padding: '6px 14px', borderRadius: '8px', color: '#fff', fontWeight: '700', fontSize: '15px' },
  categoryBadge: { padding: '4px 12px', borderRadius: '6px', color: '#fff', fontWeight: '500', fontSize: '12px' },
  // Modals
  modalOverlay: { position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.8)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  modal: { background: '#1a1a2e', borderRadius: '16px', width: '90%', maxWidth: '700px', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(139, 92, 246, 0.3)' },
  detailModal: { background: '#1a1a2e', borderRadius: '16px', width: '90%', maxWidth: '900px', maxHeight: '90vh', overflow: 'auto', border: '1px solid rgba(139, 92, 246, 0.3)' },
  modalHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', borderBottom: '1px solid rgba(139, 92, 246, 0.2)' },
  modalTitle: { fontSize: '20px', fontWeight: '600', color: '#fff' },
  closeButton: { background: 'none', border: 'none', color: '#a1a1aa', fontSize: '28px', cursor: 'pointer' },
  // Detail modal content
  detailContent: { padding: '24px' },
  detailGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '24px' },
  detailCard: { background: 'rgba(139, 92, 246, 0.1)', borderRadius: '12px', padding: '16px', display: 'flex', flexDirection: 'column', gap: '8px' },
  detailLabel: { color: '#a1a1aa', fontSize: '12px', fontWeight: '500' },
  detailValue: { color: '#fff', fontSize: '16px', fontWeight: '600' },
  scoresGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '12px', marginBottom: '24px' },
  scoreItem: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '12px', background: 'rgba(26, 26, 46, 0.8)', borderRadius: '8px' },
  textSection: { marginBottom: '20px' },
  sectionLabel: { color: '#8b5cf6', fontSize: '14px', fontWeight: '600', marginBottom: '8px' },
  textContent: { color: '#d1d5db', fontSize: '14px', lineHeight: '1.6', background: 'rgba(26, 26, 46, 0.8)', padding: '12px', borderRadius: '8px' },
  // AI Analysis
  aiAnalysisSection: { marginTop: '24px', padding: '20px', background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.1), rgba(236, 72, 153, 0.1))', borderRadius: '12px', border: '1px solid rgba(139, 92, 246, 0.3)' },
  aiAnalysisTitle: { color: '#8b5cf6', fontSize: '18px', fontWeight: '600', marginBottom: '16px' },
  analysisContainer: { display: 'flex', flexDirection: 'column', gap: '16px' },
  analysisSection: { background: 'rgba(26, 26, 46, 0.6)', borderRadius: '8px', padding: '16px' },
  analysisSectionTitle: { color: '#fff', fontSize: '16px', fontWeight: '600', marginBottom: '12px', borderBottom: '1px solid rgba(139, 92, 246, 0.2)', paddingBottom: '8px' },
  analysisSectionContent: { color: '#d1d5db', fontSize: '14px', lineHeight: '1.7' },
  analysisSubTitle: { color: '#8b5cf6', fontSize: '14px', fontWeight: '600', marginTop: '12px', marginBottom: '8px' },
  analysisBullet: { marginLeft: '16px', marginBottom: '4px', color: '#d1d5db' },
  analysisParagraph: { marginBottom: '8px' },
  // Buttons
  buttonGroup: { display: 'flex', gap: '12px', marginTop: '24px' },
  analyzeButton: { flex: 1, padding: '14px', background: 'linear-gradient(135deg, #8b5cf6, #ec4899)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer', fontSize: '14px' },
  editButton: { padding: '14px 28px', background: 'rgba(59, 130, 246, 0.2)', border: '1px solid rgba(59, 130, 246, 0.5)', borderRadius: '8px', color: '#3b82f6', fontWeight: '600', cursor: 'pointer' },
  deleteButton: { padding: '14px 28px', background: 'rgba(239, 68, 68, 0.2)', border: '1px solid rgba(239, 68, 68, 0.5)', borderRadius: '8px', color: '#ef4444', fontWeight: '600', cursor: 'pointer' },
  // Form
  form: { padding: '24px' },
  formGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px', marginBottom: '16px' },
  formGroup: { display: 'flex', flexDirection: 'column', gap: '6px' },
  label: { color: '#a1a1aa', fontSize: '13px', fontWeight: '500' },
  input: { padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#fff', fontSize: '14px' },
  select: { padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#fff', fontSize: '14px' },
  textarea: { padding: '12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59, 130, 246, 0.3)', borderRadius: '8px', color: '#fff', fontSize: '14px', resize: 'vertical' },
  inputError: { borderColor: '#ef4444' },
  errorText: { color: '#ef4444', fontSize: '12px', marginTop: '2px' },
  formActions: { display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '20px' },
  cancelButton: { padding: '12px 24px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', color: '#a1a1aa', cursor: 'pointer' },
  submitButton: { padding: '12px 32px', background: 'linear-gradient(135deg, #f43f5e, #ec4899)', border: 'none', borderRadius: '8px', color: '#fff', fontWeight: '600', cursor: 'pointer' },
  // Spinner for AI analysis button
  spinner: {
    display: 'inline-block',
    width: '16px',
    height: '16px',
    border: '2px solid rgba(255,255,255,0.3)',
    borderTop: '2px solid #fff',
    borderRadius: '50%',
    animation: 'riskSpinnerRotate 0.8s linear infinite',
  },
};

export default RiskScorer;
