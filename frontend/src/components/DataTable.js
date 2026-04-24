import React, { useState, useMemo } from 'react';

const DataTable = ({ columns, data, onRowClick, onEdit, onDelete, onBulkDelete, onBulkUpdate, filterOptions = [], title = '' }) => {
  const [search, setSearch] = useState('');
  const [filterKey, setFilterKey] = useState('');
  const [filterValue, setFilterValue] = useState('');
  const [sortKey, setSortKey] = useState('');
  const [sortDir, setSortDir] = useState('asc');
  const [page, setPage] = useState(1);
  const [pageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState([]);

  // Filter
  const filtered = useMemo(() => {
    let result = [...data];
    if (search) {
      const s = search.toLowerCase();
      result = result.filter(row => columns.some(col => String(row[col.key] || '').toLowerCase().includes(s)));
    }
    if (filterKey && filterValue) {
      result = result.filter(row => String(row[filterKey] || '').toLowerCase() === filterValue.toLowerCase());
    }
    return result;
  }, [data, search, filterKey, filterValue, columns]);

  // Sort
  const sorted = useMemo(() => {
    if (!sortKey) return filtered;
    return [...filtered].sort((a, b) => {
      const av = a[sortKey] ?? '', bv = b[sortKey] ?? '';
      const cmp = typeof av === 'number' && typeof bv === 'number' ? av - bv : String(av).localeCompare(String(bv));
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Paginate
  const totalPages = Math.max(1, Math.ceil(sorted.length / pageSize));
  const paginated = sorted.slice((page - 1) * pageSize, page * pageSize);

  const handleSort = (key) => {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortKey(key); setSortDir('asc'); }
  };

  const toggleSelect = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };

  const toggleSelectAll = () => {
    const ids = paginated.map(r => r.id);
    const allSelected = ids.every(id => selectedIds.includes(id));
    setSelectedIds(prev => allSelected ? prev.filter(x => !ids.includes(x)) : [...new Set([...prev, ...ids])]);
  };

  const exportCSV = () => {
    const headers = columns.map(c => c.label).join(',');
    const rows = sorted.map(row => columns.map(c => `"${String(row[c.key] || '').replace(/"/g, '""')}"`).join(','));
    const blob = new Blob([headers + '\n' + rows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = `${title || 'export'}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const win = window.open('', '_blank');
    const html = `<html><head><title>${title || 'Export'}</title><style>
      body{font-family:Arial;padding:20px}table{width:100%;border-collapse:collapse;margin-top:16px}
      th,td{border:1px solid #ddd;padding:8px;text-align:left;font-size:12px}
      th{background:#f5f5f5;font-weight:600}h1{font-size:18px}
    </style></head><body><h1>${title || 'Data Export'}</h1><p>${sorted.length} records - ${new Date().toLocaleDateString()}</p>
    <table><thead><tr>${columns.map(c => `<th>${c.label}</th>`).join('')}</tr></thead>
    <tbody>${sorted.map(row => `<tr>${columns.map(c => `<td>${row[c.key] || '-'}</td>`).join('')}</tr>`).join('')}</tbody></table>
    <script>window.print();</script></body></html>`;
    win.document.write(html); win.document.close();
  };

  // Unique filter values
  const filterVals = useMemo(() => {
    if (!filterKey) return [];
    return [...new Set(data.map(r => r[filterKey]).filter(Boolean))];
  }, [data, filterKey]);

  const allPageSelected = paginated.length > 0 && paginated.every(r => selectedIds.includes(r.id));

  return (
    <div>
      {/* Toolbar */}
      <div style={styles.toolbar}>
        <div style={styles.toolbarLeft}>
          {/* Search */}
          <input
            value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search..." style={styles.searchInput}
          />
          {/* Filter */}
          {filterOptions.length > 0 && (
            <>
              <select value={filterKey} onChange={e => { setFilterKey(e.target.value); setFilterValue(''); setPage(1); }} style={styles.filterSelect}>
                <option value="">Filter by...</option>
                {filterOptions.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>
              {filterKey && (
                <select value={filterValue} onChange={e => { setFilterValue(e.target.value); setPage(1); }} style={styles.filterSelect}>
                  <option value="">All</option>
                  {filterVals.map(v => <option key={v} value={v}>{v}</option>)}
                </select>
              )}
            </>
          )}
        </div>
        <div style={styles.toolbarRight}>
          {selectedIds.length > 0 && (
            <div style={styles.bulkActions}>
              <span style={{ color: '#a1a1aa', fontSize: '13px' }}>{selectedIds.length} selected</span>
              {onBulkDelete && (
                <button onClick={() => onBulkDelete(selectedIds)} style={styles.bulkDeleteBtn}>Delete Selected</button>
              )}
              {onBulkUpdate && (
                <button onClick={() => onBulkUpdate(selectedIds)} style={styles.bulkUpdateBtn}>Update Selected</button>
              )}
            </div>
          )}
          <button onClick={exportCSV} style={styles.exportBtn}>CSV</button>
          <button onClick={exportPDF} style={styles.exportBtn}>PDF</button>
        </div>
      </div>

      {/* Table */}
      <div style={styles.tableContainer}>
        <table style={styles.table}>
          <thead>
            <tr>
              <th style={{ ...styles.th, width: '40px' }}>
                <input type="checkbox" checked={allPageSelected} onChange={toggleSelectAll}
                  style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
              </th>
              {columns.map(col => (
                <th key={col.key} style={styles.th} onClick={() => handleSort(col.key)}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                    {col.label}
                    {sortKey === col.key && (
                      <span style={{ fontSize: '10px', color: '#3b82f6' }}>{sortDir === 'asc' ? ' ▲' : ' ▼'}</span>
                    )}
                  </div>
                </th>
              ))}
              <th style={styles.th}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 2} style={styles.emptyCell}>
                  <div style={styles.emptyState}>
                    <div style={styles.emptyIcon}>?</div>
                    <h3 style={styles.emptyTitle}>{search || filterValue ? 'No matching results' : 'No data yet'}</h3>
                    <p style={styles.emptyDesc}>{search || filterValue ? 'Try adjusting your search or filters' : 'Get started by adding your first record'}</p>
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map(row => (
                <tr key={row.id} style={{
                  ...styles.tr,
                  background: selectedIds.includes(row.id) ? 'rgba(59,130,246,0.08)' : 'transparent',
                }}
                  onClick={() => onRowClick && onRowClick(row)}
                  onMouseEnter={e => { if (!selectedIds.includes(row.id)) e.currentTarget.style.background = 'rgba(59,130,246,0.1)'; }}
                  onMouseLeave={e => { if (!selectedIds.includes(row.id)) e.currentTarget.style.background = 'transparent'; }}
                >
                  <td style={styles.td} onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(row.id)} onChange={() => toggleSelect(row.id)}
                      style={{ cursor: 'pointer', width: '16px', height: '16px' }} />
                  </td>
                  {columns.map(col => (
                    <td key={col.key} style={styles.td}>
                      {col.render ? col.render(row[col.key], row) : row[col.key]}
                    </td>
                  ))}
                  <td style={styles.td}>
                    <div style={styles.actions}>
                      <button onClick={e => { e.stopPropagation(); onEdit && onEdit(row); }} style={styles.editBtn}>Edit</button>
                      <button onClick={e => { e.stopPropagation(); onDelete && onDelete(row); }} style={styles.deleteBtn}>Delete</button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={styles.pagination}>
        <span style={{ color: '#a1a1aa', fontSize: '13px' }}>
          Showing {Math.min((page - 1) * pageSize + 1, sorted.length)}-{Math.min(page * pageSize, sorted.length)} of {sorted.length}
        </span>
        <div style={styles.pageButtons}>
          <button onClick={() => setPage(1)} disabled={page === 1} style={styles.pageBtn}>First</button>
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={styles.pageBtn}>Prev</button>
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            const start = Math.max(1, Math.min(page - 2, totalPages - 4));
            const p = start + i;
            if (p > totalPages) return null;
            return (
              <button key={p} onClick={() => setPage(p)}
                style={{ ...styles.pageBtn, ...(p === page ? styles.pageBtnActive : {}) }}>
                {p}
              </button>
            );
          })}
          <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={styles.pageBtn}>Next</button>
          <button onClick={() => setPage(totalPages)} disabled={page === totalPages} style={styles.pageBtn}>Last</button>
        </div>
      </div>
    </div>
  );
};

const styles = {
  toolbar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', gap: '12px', flexWrap: 'wrap' },
  toolbarLeft: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  toolbarRight: { display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' },
  searchInput: {
    padding: '10px 14px', width: '240px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', color: '#fff',
    fontSize: '13px', outline: 'none',
  },
  filterSelect: {
    padding: '10px 12px', background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', color: '#fff',
    fontSize: '13px', outline: 'none', cursor: 'pointer',
  },
  bulkActions: { display: 'flex', gap: '8px', alignItems: 'center' },
  bulkDeleteBtn: {
    padding: '8px 14px', background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.4)',
    borderRadius: '6px', color: '#ef4444', fontSize: '12px', cursor: 'pointer', fontWeight: '500',
  },
  bulkUpdateBtn: {
    padding: '8px 14px', background: 'rgba(59,130,246,0.15)', border: '1px solid rgba(59,130,246,0.4)',
    borderRadius: '6px', color: '#3b82f6', fontSize: '12px', cursor: 'pointer', fontWeight: '500',
  },
  exportBtn: {
    padding: '8px 14px', background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.3)',
    borderRadius: '6px', color: '#10b981', fontSize: '12px', cursor: 'pointer', fontWeight: '500',
  },
  tableContainer: { overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(59,130,246,0.2)', background: 'rgba(26,26,46,0.6)' },
  table: { width: '100%', borderCollapse: 'collapse' },
  th: {
    padding: '14px 16px', textAlign: 'left', background: 'rgba(59,130,246,0.1)', color: '#a1a1aa',
    fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.5px',
    borderBottom: '1px solid rgba(59,130,246,0.2)', userSelect: 'none',
  },
  tr: { cursor: 'pointer', transition: 'background 0.2s ease' },
  td: { padding: '14px 16px', borderBottom: '1px solid rgba(59,130,246,0.1)', color: '#e4e4e7', fontSize: '14px' },
  emptyCell: { padding: '0' },
  emptyState: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    padding: '60px 20px', textAlign: 'center',
  },
  emptyIcon: {
    width: '64px', height: '64px', borderRadius: '16px', background: 'rgba(59,130,246,0.1)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '28px',
    color: '#3b82f6', marginBottom: '16px',
  },
  emptyTitle: { color: '#fff', fontSize: '18px', fontWeight: '600', marginBottom: '8px' },
  emptyDesc: { color: '#71717a', fontSize: '14px' },
  actions: { display: 'flex', gap: '8px' },
  editBtn: {
    padding: '6px 12px', background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
    borderRadius: '6px', color: '#3b82f6', fontSize: '12px', cursor: 'pointer',
  },
  deleteBtn: {
    padding: '6px 12px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: '6px', color: '#ef4444', fontSize: '12px', cursor: 'pointer',
  },
  pagination: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', flexWrap: 'wrap', gap: '12px',
  },
  pageButtons: { display: 'flex', gap: '4px' },
  pageBtn: {
    padding: '6px 12px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(59,130,246,0.2)',
    borderRadius: '6px', color: '#a1a1aa', fontSize: '12px', cursor: 'pointer',
  },
  pageBtnActive: { background: 'rgba(59,130,246,0.2)', color: '#3b82f6', borderColor: 'rgba(59,130,246,0.5)' },
};

export default DataTable;
