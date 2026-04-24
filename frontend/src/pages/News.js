import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_URL, useAuth } from '../context/AuthContext';
import DataTable from '../components/DataTable';
import Modal from '../components/Modal';
import ConfirmDialog from '../components/ConfirmDialog';
import { FormInput, FormRow, FormButtons } from '../components/FormInput';
import { useToast } from '../components/Toast';

const News = () => {
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
    company_id: '', title: '', source: '', url: '', summary: '', sentiment: 'Neutral', published_date: '', category: ''
  });

  const fetchData = async () => {
    try {
      const [newsRes, companiesRes] = await Promise.all([
        axios.get(`${API_URL}/news`),
        axios.get(`${API_URL}/companies`)
      ]);
      setData(newsRes.data);
      setCompanies(companiesRes.data);
    } catch (error) {
      addToast('Failed to load news articles', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const validate = () => {
    const errs = {};
    if (!formData.title.trim()) errs.title = 'Title is required';
    else if (formData.title.trim().length < 3) errs.title = 'Title must be at least 3 characters';
    if (!formData.company_id) errs.company_id = 'Company is required';
    if (!formData.source.trim()) errs.source = 'Source is required';
    if (formData.url && formData.url.trim() && !/^(https?:\/\/)?[\w.-]+\.\w{2,}/.test(formData.url)) errs.url = 'Invalid URL format';
    if (!formData.published_date) errs.published_date = 'Published date is required';
    if (!formData.sentiment) errs.sentiment = 'Sentiment is required';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      if (selectedItem) {
        await axios.put(`${API_URL}/news/${selectedItem.id}`, formData);
        addToast('News article updated successfully', 'success');
      } else {
        await axios.post(`${API_URL}/news`, formData);
        addToast('News article created successfully', 'success');
      }
      fetchData();
      handleCloseModal();
    } catch (error) {
      addToast(error.response?.data?.error || 'Failed to save news article', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = (item) => {
    setConfirmDialog({
      open: true,
      title: 'Delete News Article',
      message: `Are you sure you want to delete "${item.title}"? This action cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.delete(`${API_URL}/news/${item.id}`);
          addToast('News article deleted successfully', 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete news article', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleBulkDelete = (ids) => {
    setConfirmDialog({
      open: true,
      title: 'Delete Multiple News Articles',
      message: `Are you sure you want to delete ${ids.length} news articles? This cannot be undone.`,
      onConfirm: async () => {
        try {
          await axios.post(`${API_URL}/news/bulk-delete`, { ids });
          addToast(`${ids.length} news articles deleted`, 'success');
          fetchData();
        } catch (error) {
          addToast('Failed to delete news articles', 'error');
        }
        setConfirmDialog({ open: false });
      },
    });
  };

  const handleEdit = (item) => {
    setSelectedItem(item);
    setErrors({});
    setFormData({
      company_id: item.company_id || '', title: item.title || '', source: item.source || '',
      url: item.url || '', summary: item.summary || '', sentiment: item.sentiment || 'Neutral',
      published_date: item.published_date?.split('T')[0] || '', category: item.category || ''
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
      const response = await axios.post(`${API_URL}/news/${selectedItem.id}/analyze`);
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
    setFormData({ company_id: '', title: '', source: '', url: '', summary: '', sentiment: 'Neutral', published_date: '', category: '' });
  };

  const handleNew = () => {
    setSelectedItem(null);
    setErrors({});
    setFormData({ company_id: '', title: '', source: '', url: '', summary: '', sentiment: 'Neutral', published_date: '', category: '' });
    setShowModal(true);
  };

  const getSentimentColor = (sentiment) => {
    switch (sentiment) {
      case 'Positive': return { bg: 'rgba(16, 185, 129, 0.2)', color: '#10b981' };
      case 'Negative': return { bg: 'rgba(239, 68, 68, 0.2)', color: '#ef4444' };
      default: return { bg: 'rgba(156, 163, 175, 0.2)', color: '#9ca3af' };
    }
  };

  const columns = [
    { key: 'title', label: 'Title' },
    { key: 'company_name', label: 'Company' },
    { key: 'source', label: 'Source' },
    { key: 'category', label: 'Category' },
    { key: 'published_date', label: 'Date', render: (val) => val ? new Date(val).toLocaleDateString() : '-' },
    { key: 'sentiment', label: 'Sentiment', render: (val) => {
      const { bg, color } = getSentimentColor(val);
      return <span style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '12px', fontWeight: '500', background: bg, color }}>{val}</span>;
    }},
  ];

  const filterOptions = [
    { key: 'company_name', label: 'Company' },
    { key: 'sentiment', label: 'Sentiment' },
    { key: 'category', label: 'Category' },
  ];

  if (loading) return <div style={{ color: '#fff', textAlign: 'center', padding: '40px' }}>Loading...</div>;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <p style={{ color: '#a1a1aa', fontSize: '14px' }}>Monitor news and market sentiment for target companies</p>
        </div>
        {hasPermission('create') && (
          <button onClick={handleNew} style={styles.addBtn}>+ Add News Article</button>
        )}
      </div>

      <DataTable
        columns={columns} data={data} onRowClick={handleRowClick}
        onEdit={hasPermission('edit') ? handleEdit : undefined}
        onDelete={hasPermission('delete') ? handleDelete : undefined}
        onBulkDelete={hasPermission('bulk') ? handleBulkDelete : undefined}
        filterOptions={filterOptions} title="News"
      />

      {/* Form Modal */}
      <Modal isOpen={showModal} onClose={handleCloseModal} title={selectedItem ? 'Edit News Article' : 'Add News Article'} size="large">
        <form onSubmit={handleSubmit}>
          <FormInput label="Title" value={formData.title} onChange={(e) => setFormData({...formData, title: e.target.value})} required error={errors.title} />
          <FormRow>
            <FormInput label="Company" type="select" value={formData.company_id} onChange={(e) => setFormData({...formData, company_id: e.target.value})}
              options={companies.map(c => ({ value: c.id, label: c.name }))} required error={errors.company_id} />
            <FormInput label="Source" value={formData.source} onChange={(e) => setFormData({...formData, source: e.target.value})} required error={errors.source} />
          </FormRow>
          <FormRow>
            <FormInput label="Category" value={formData.category} onChange={(e) => setFormData({...formData, category: e.target.value})} />
            <FormInput label="Published Date" type="date" value={formData.published_date} onChange={(e) => setFormData({...formData, published_date: e.target.value})} required error={errors.published_date} />
          </FormRow>
          <FormRow>
            <FormInput label="URL" value={formData.url} onChange={(e) => setFormData({...formData, url: e.target.value})} error={errors.url} />
            <FormInput label="Sentiment" type="select" value={formData.sentiment} onChange={(e) => setFormData({...formData, sentiment: e.target.value})}
              options={['Positive', 'Neutral', 'Negative']} required error={errors.sentiment} />
          </FormRow>
          <FormInput label="Summary" type="textarea" value={formData.summary} onChange={(e) => setFormData({...formData, summary: e.target.value})} />
          <FormButtons onCancel={handleCloseModal} submitLabel={selectedItem ? 'Update' : 'Create'} loading={saving} />
        </form>
      </Modal>

      {/* Detail Modal */}
      <Modal isOpen={showDetailModal} onClose={() => setShowDetailModal(false)} title="News Article Details" size="large">
        {selectedItem && (
          <div>
            <h3 style={{ color: '#fff', fontSize: '18px', marginBottom: '16px' }}>{selectedItem.title}</h3>
            <div style={styles.detailGrid}>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Company</span><span style={styles.detailValue}>{selectedItem.company_name}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Source</span><span style={styles.detailValue}>{selectedItem.source}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Category</span><span style={styles.detailValue}>{selectedItem.category}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Published Date</span><span style={styles.detailValue}>{selectedItem.published_date ? new Date(selectedItem.published_date).toLocaleDateString() : '-'}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>Sentiment</span><span style={styles.detailValue}>{selectedItem.sentiment}</span></div>
              <div style={styles.detailItem}><span style={styles.detailLabel}>URL</span><span style={styles.detailValue}>{selectedItem.url ? <a href={selectedItem.url} target="_blank" rel="noopener noreferrer" style={{ color: '#3b82f6', textDecoration: 'underline' }}>{selectedItem.url}</a> : '-'}</span></div>
            </div>
            <div style={{ marginTop: '16px' }}>
              <span style={styles.detailLabel}>Summary</span>
              <p style={{ color: '#e4e4e7', marginTop: '8px', lineHeight: '1.6' }}>{selectedItem.summary}</p>
            </div>
            <div style={styles.aiSection}>
              <button onClick={handleAnalyze} disabled={analyzing} style={{
                ...styles.aiBtn, opacity: analyzing ? 0.7 : 1, cursor: analyzing ? 'not-allowed' : 'pointer',
                display: 'flex', alignItems: 'center', gap: '8px',
              }}>
                {analyzing && <span style={{ display: 'inline-block', width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />}
                {analyzing ? 'Analyzing...' : 'AI Sentiment Analysis'}
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

export default News;
