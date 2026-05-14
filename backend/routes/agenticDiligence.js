// Agentic diligence agent: scheduled deep-dive on portfolio companies with
// anomaly flagging. Single-run endpoint + a cron-friendly batch endpoint.
const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { parseAIJson } = require('../middleware/parseAIJson');
const router = express.Router();

async function callOpenRouter(prompt, systemPrompt) {
  // TODO: configure credentials — OPENROUTER_API_KEY
  const key = process.env.OPENROUTER_API_KEY;
  if (!key) throw new Error('OPENROUTER_API_KEY missing');
  const r = await axios.post(
    'https://openrouter.ai/api/v1/chat/completions',
    {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ],
      max_tokens: 2000,
    },
    { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } }
  );
  return r.data.choices?.[0]?.message?.content;
}

async function buildSummary(companyId) {
  const c = await pool.query('SELECT * FROM companies WHERE id = $1', [companyId]);
  if (!c.rows[0]) return null;
  const fin = await pool.query(`SELECT * FROM financials WHERE company_id = $1 ORDER BY reporting_date DESC LIMIT 5`, [companyId]).catch(() => ({ rows: [] }));
  const news = await pool.query(`SELECT title, sentiment, published_at FROM news_monitoring WHERE company_id = $1 ORDER BY published_at DESC LIMIT 10`, [companyId]).catch(() => ({ rows: [] }));
  const risks = await pool.query(`SELECT * FROM risks WHERE company_id = $1 ORDER BY severity DESC LIMIT 10`, [companyId]).catch(() => ({ rows: [] }));
  return { company: c.rows[0], financials: fin.rows, recent_news: news.rows, risks: risks.rows };
}

// POST /api/agentic-diligence/run { companyId }
router.post('/run', async (req, res) => {
  try {
    const { companyId } = req.body || {};
    if (!companyId) return res.status(400).json({ error: 'companyId required' });
    const context = await buildSummary(companyId);
    if (!context) return res.status(404).json({ error: 'company not found' });

    const system = 'You are a senior diligence analyst. Identify anomalies, surface red flags, and recommend follow-up questions. Output JSON: {"summary":"...","anomalies":["..."],"red_flags":["..."],"next_questions":["..."]}.';
    const raw = await callOpenRouter(JSON.stringify(context).slice(0, 6000), system);
    const out = parseAIJson(raw) || { raw };
    try {
      await pool.query(
        `INSERT INTO red_flag_detections (company_id, detection_type, severity, description, created_at)
         VALUES ($1, 'agentic_run', 'medium', $2, NOW())`,
        [companyId, JSON.stringify(out)]
      );
    } catch {}
    return res.json({ companyId, result: out });
  } catch (e) {
    console.error('agentic-diligence error:', e);
    return res.status(500).json({ error: 'agent run failed', detail: e.message });
  }
});

// POST /api/agentic-diligence/batch — run on all watchlisted companies
router.post('/batch', async (req, res) => {
  try {
    const wl = await pool.query(`SELECT DISTINCT company_id FROM watchlist`).catch(() => ({ rows: [] }));
    const results = [];
    for (const row of wl.rows.slice(0, 10)) {
      const context = await buildSummary(row.company_id);
      if (!context) continue;
      try {
        const raw = await callOpenRouter(JSON.stringify(context).slice(0, 4000), 'Summarise risks/anomalies in <100 words. JSON {"summary":"...","red_flags":[...]}.');
        results.push({ companyId: row.company_id, ...(parseAIJson(raw) || { raw }) });
      } catch (e) {
        results.push({ companyId: row.company_id, error: e.message });
      }
    }
    return res.json({ ran: results.length, results });
  } catch (e) {
    console.error('batch agentic error:', e);
    return res.status(500).json({ error: 'batch failed' });
  }
});

module.exports = router;
