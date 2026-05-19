import React from 'react';
import WorkstreamRiskRadar from '../components/customViews/WorkstreamRiskRadar';
import ChecklistHeatmap from '../components/customViews/ChecklistHeatmap';
import ExecSummaryPdf from '../components/customViews/ExecSummaryPdf';
import ChecklistTemplateEditor from '../components/customViews/ChecklistTemplateEditor';

const CustomViewsPage = () => {
  return (
    <div data-testid="custom-views-page" style={{ padding: 24, color: '#fff' }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: 26, margin: 0 }}>DD Views</h1>
        <p style={{ color: '#a1a1aa', marginTop: 4 }}>
          Custom analytical views for M&amp;A due diligence: risk radar, checklist heatmap,
          executive summary export, and template editor.
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        <WorkstreamRiskRadar />
        <ChecklistHeatmap />
        <ExecSummaryPdf />
        <ChecklistTemplateEditor />
      </div>
    </div>
  );
};

export default CustomViewsPage;
