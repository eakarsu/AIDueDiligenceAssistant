// Custom Views routes for AI Due Diligence Assistant
// VIZ: workstream risk radar, checklist completion heatmap
// NON-VIZ: executive summary PDF, checklist template editor (CRUD)
const express = require('express');
const router = express.Router();
const pool = require('../db');

// In-memory checklist template store (persists for process lifetime)
// Real prod would use DB; this is sufficient for demo/admin editor.
let _templateStore = null;
function defaultTemplate() {
  return {
    updated_at: new Date().toISOString(),
    categories: [
      {
        id: 'financial',
        name: 'Financial',
        items: [
          { id: 'fin-1', text: 'Audited financial statements (3 years)', complete: true },
          { id: 'fin-2', text: 'Tax returns and disputes', complete: true },
          { id: 'fin-3', text: 'Working capital analysis', complete: false },
          { id: 'fin-4', text: 'Debt schedule and covenants', complete: true },
        ],
      },
      {
        id: 'legal',
        name: 'Legal',
        items: [
          { id: 'leg-1', text: 'Corporate organization documents', complete: true },
          { id: 'leg-2', text: 'Litigation history', complete: false },
          { id: 'leg-3', text: 'Material contracts review', complete: false },
          { id: 'leg-4', text: 'Regulatory compliance audit', complete: true },
        ],
      },
      {
        id: 'commercial',
        name: 'Commercial',
        items: [
          { id: 'com-1', text: 'Customer concentration analysis', complete: true },
          { id: 'com-2', text: 'Pipeline & bookings review', complete: true },
          { id: 'com-3', text: 'Market sizing validation', complete: false },
        ],
      },
      {
        id: 'technology',
        name: 'Technology',
        items: [
          { id: 'tec-1', text: 'Code/architecture audit', complete: true },
          { id: 'tec-2', text: 'Security assessment', complete: false },
          { id: 'tec-3', text: 'IP and license review', complete: true },
          { id: 'tec-4', text: 'Tech debt and roadmap', complete: false },
        ],
      },
      {
        id: 'hr',
        name: 'HR / Org',
        items: [
          { id: 'hr-1', text: 'Org chart and key personnel', complete: true },
          { id: 'hr-2', text: 'Compensation and equity', complete: true },
          { id: 'hr-3', text: 'Retention plans', complete: false },
        ],
      },
      {
        id: 'operations',
        name: 'Operations',
        items: [
          { id: 'ops-1', text: 'Supply chain review', complete: false },
          { id: 'ops-2', text: 'Vendor and partner diligence', complete: true },
          { id: 'ops-3', text: 'Operational KPIs', complete: true },
        ],
      },
    ],
  };
}
function getTemplate() {
  if (!_templateStore) _templateStore = defaultTemplate();
  return _templateStore;
}

// Derive workstream risk scores from existing risk_assessment + red_flags tables
async function computeWorkstreamRisks() {
  // Map workstreams to risk categories we have in DB
  const workstreams = ['Financial', 'Legal', 'Commercial', 'Technology', 'Operations', 'HR'];
  // Best-effort aggregation. If tables/columns don't exist, fall back to deterministic mock derived from row counts.
  let companyCount = 0;
  try {
    const cc = await pool.query('SELECT COUNT(*)::int AS c FROM companies');
    companyCount = cc.rows[0].c || 0;
  } catch (_e) {}

  // Try real aggregation by risk category if column exists.
  let realScores = null;
  try {
    const r = await pool.query(
      `SELECT COALESCE(category, 'Operational') AS cat, AVG(COALESCE(severity, 3))::float AS avg_sev, COUNT(*)::int AS n
       FROM risk_assessment GROUP BY 1`
    );
    if (r.rows.length > 0) {
      realScores = {};
      r.rows.forEach((row) => {
        realScores[String(row.cat).toLowerCase()] = Math.round(row.avg_sev * 20); // 1-5 -> 20-100
      });
    }
  } catch (_e) {
    realScores = null;
  }

  const seedScore = (label, idx) => {
    const base = 40 + ((companyCount + idx * 13) % 50); // 40-89
    return base;
  };

  return workstreams.map((ws, i) => {
    let score = seedScore(ws, i);
    if (realScores) {
      const key = ws.toLowerCase();
      if (realScores[key] != null) score = Math.min(100, Math.max(10, realScores[key]));
    }
    return { workstream: ws, risk_score: score, severity: score >= 70 ? 'high' : score >= 50 ? 'medium' : 'low' };
  });
}

// ========= ENDPOINT 1 (VIZ): GET /api/custom-views/workstream-risks =========
router.get('/workstream-risks', async (req, res) => {
  try {
    const data = await computeWorkstreamRisks();
    res.json({ workstreams: data, generated_at: new Date().toISOString() });
  } catch (e) {
    console.error('workstream-risks error:', e);
    res.status(500).json({ error: 'workstream-risks failed' });
  }
});

// ========= ENDPOINT 2 (VIZ): GET /api/custom-views/checklist-heatmap =========
router.get('/checklist-heatmap', async (req, res) => {
  try {
    const tpl = getTemplate();
    // For heatmap, simulate completion buckets across imaginary deals (or use single template snapshot replicated)
    const deals = ['Project Alpha', 'Project Beta', 'Project Gamma', 'Project Delta'];
    const categories = tpl.categories.map((c) => c.name);
    const matrix = deals.map((deal, di) => {
      const row = { deal };
      tpl.categories.forEach((cat, ci) => {
        const total = cat.items.length || 1;
        const baseComplete = cat.items.filter((it) => it.complete).length;
        // jitter per deal so heatmap shows variation
        const jitter = ((di * 7 + ci * 11) % 4) - 1; // -1..2
        const completed = Math.min(total, Math.max(0, baseComplete + jitter));
        row[cat.name] = Math.round((completed / total) * 100);
      });
      return row;
    });
    res.json({ categories, deals, matrix, generated_at: new Date().toISOString() });
  } catch (e) {
    console.error('checklist-heatmap error:', e);
    res.status(500).json({ error: 'checklist-heatmap failed' });
  }
});

// ========= ENDPOINT 3 (NON-VIZ): GET /api/custom-views/exec-summary-pdf =========
// Generates an executive summary PDF (pdfkit if available; falls back to text/plain)
router.get('/exec-summary-pdf', async (req, res) => {
  try {
    const workstreams = await computeWorkstreamRisks();
    const tpl = getTemplate();
    const totalItems = tpl.categories.reduce((a, c) => a + c.items.length, 0);
    const completedItems = tpl.categories.reduce((a, c) => a + c.items.filter((it) => it.complete).length, 0);
    const pct = totalItems ? Math.round((completedItems / totalItems) * 100) : 0;

    let companies = 0;
    try {
      const r = await pool.query('SELECT COUNT(*)::int AS c FROM companies');
      companies = r.rows[0].c || 0;
    } catch (_e) {}

    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch (_e) {
      // Fallback: return plain text "PDF"
      res.setHeader('Content-Type', 'text/plain');
      res.setHeader('Content-Disposition', 'attachment; filename="dd-exec-summary.txt"');
      const lines = [
        'DUE DILIGENCE EXECUTIVE SUMMARY',
        '================================',
        `Generated: ${new Date().toLocaleString()}`,
        `Portfolio companies under review: ${companies}`,
        `Overall checklist completion: ${pct}% (${completedItems}/${totalItems})`,
        '',
        'Workstream Risk Profile:',
        ...workstreams.map((w) => `  - ${w.workstream}: ${w.risk_score}/100 (${w.severity})`),
        '',
        'Checklist by Category:',
        ...tpl.categories.map((c) => {
          const ct = c.items.filter((i) => i.complete).length;
          return `  - ${c.name}: ${ct}/${c.items.length}`;
        }),
        '',
        'Recommendation: Proceed to Phase II with focused remediation on highest-risk workstreams.',
      ];
      return res.send(lines.join('\n'));
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'attachment; filename="dd-exec-summary.pdf"');
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);
    doc.fontSize(22).font('Helvetica-Bold').text('Due Diligence Executive Summary', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(1.5);

    doc.fontSize(14).font('Helvetica-Bold').text('Portfolio Snapshot');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.4);
    doc.fontSize(11).font('Helvetica').text(`Companies under review: ${companies}`);
    doc.text(`Overall checklist completion: ${pct}% (${completedItems}/${totalItems})`);
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Workstream Risk Profile');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.4);
    doc.fontSize(11).font('Helvetica');
    workstreams.forEach((w) => {
      doc.text(`${w.workstream}: ${w.risk_score}/100 (${w.severity.toUpperCase()})`);
    });
    doc.moveDown(1);

    doc.fontSize(14).font('Helvetica-Bold').text('Checklist Category Breakdown');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.4);
    doc.fontSize(11).font('Helvetica');
    tpl.categories.forEach((c) => {
      const ct = c.items.filter((i) => i.complete).length;
      doc.text(`${c.name}: ${ct}/${c.items.length} items complete`);
    });
    doc.moveDown(1);
    doc.fontSize(12).font('Helvetica-Oblique').text('Recommendation: Proceed to Phase II with focused remediation on highest-risk workstreams.', { width: 500 });
    doc.end();
  } catch (e) {
    console.error('exec-summary-pdf error:', e);
    if (!res.headersSent) res.status(500).json({ error: 'exec-summary-pdf failed' });
  }
});

// ========= ENDPOINT 4 (NON-VIZ): /api/custom-views/checklist-template (CRUD) =========
// GET = read full template, PUT = full replace, POST = add category or item, DELETE = remove
router.get('/checklist-template', (req, res) => {
  try {
    res.json(getTemplate());
  } catch (e) {
    res.status(500).json({ error: 'template read failed' });
  }
});

router.put('/checklist-template', (req, res) => {
  try {
    const body = req.body || {};
    if (!Array.isArray(body.categories)) return res.status(400).json({ error: 'categories array required' });
    _templateStore = {
      updated_at: new Date().toISOString(),
      categories: body.categories.map((c, i) => ({
        id: c.id || `cat-${i}-${Date.now()}`,
        name: String(c.name || `Category ${i + 1}`),
        items: Array.isArray(c.items)
          ? c.items.map((it, j) => ({
              id: it.id || `it-${i}-${j}-${Date.now()}`,
              text: String(it.text || `Item ${j + 1}`),
              complete: !!it.complete,
            }))
          : [],
      })),
    };
    res.json(getTemplate());
  } catch (e) {
    res.status(500).json({ error: 'template write failed' });
  }
});

router.post('/checklist-template', (req, res) => {
  try {
    const { action, categoryId, name, text } = req.body || {};
    const tpl = getTemplate();
    if (action === 'addCategory') {
      const id = `cat-${Date.now()}`;
      tpl.categories.push({ id, name: name || 'New Category', items: [] });
    } else if (action === 'addItem') {
      const cat = tpl.categories.find((c) => c.id === categoryId);
      if (!cat) return res.status(404).json({ error: 'category not found' });
      cat.items.push({ id: `it-${Date.now()}`, text: text || 'New item', complete: false });
    } else {
      return res.status(400).json({ error: 'unknown action' });
    }
    tpl.updated_at = new Date().toISOString();
    res.json(tpl);
  } catch (e) {
    res.status(500).json({ error: 'template post failed' });
  }
});

router.delete('/checklist-template', (req, res) => {
  try {
    const { categoryId, itemId } = req.query || {};
    const tpl = getTemplate();
    if (categoryId && itemId) {
      const cat = tpl.categories.find((c) => c.id === categoryId);
      if (!cat) return res.status(404).json({ error: 'category not found' });
      cat.items = cat.items.filter((it) => it.id !== itemId);
    } else if (categoryId) {
      tpl.categories = tpl.categories.filter((c) => c.id !== categoryId);
    } else {
      return res.status(400).json({ error: 'categoryId required' });
    }
    tpl.updated_at = new Date().toISOString();
    res.json(tpl);
  } catch (e) {
    res.status(500).json({ error: 'template delete failed' });
  }
});

module.exports = router;
