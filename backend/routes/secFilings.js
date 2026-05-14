// SEC filings agent: pull recent filings from EDGAR and summarise by risk
// category. v0 uses EDGAR's public JSON endpoint.
const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { parseAIJson } = require('../middleware/parseAIJson');
const router = express.Router();

// GET /api/sec-filings/:cik?count=5
router.get('/:cik', async (req, res) => {
  try {
    const { cik } = req.params;
    const padded = String(cik).padStart(10, '0');
    const r = await axios.get(`https://data.sec.gov/submissions/CIK${padded}.json`, {
      headers: { 'User-Agent': process.env.SEC_USER_AGENT || 'AIDueDiligence support@example.com' }, // TODO: configure SEC_USER_AGENT
    });
    const recent = r.data?.filings?.recent || {};
    const count = Math.min(parseInt(req.query.count) || 5, 25);
    const filings = [];
    for (let i = 0; i < (recent.form || []).length && filings.length < count; i++) {
      filings.push({
        form: recent.form[i],
        filing_date: recent.filingDate[i],
        accession: recent.accessionNumber[i],
        primary_doc: recent.primaryDocument[i],
        url: `https://www.sec.gov/Archives/edgar/data/${parseInt(cik, 10)}/${recent.accessionNumber[i].replace(/-/g, '')}/${recent.primaryDocument[i]}`,
      });
    }
    return res.json({ cik, name: r.data?.name, count: filings.length, filings });
  } catch (e) {
    console.error('sec-filings error:', e?.response?.status, e.message);
    return res.status(502).json({ error: 'EDGAR fetch failed', detail: e.message });
  }
});

// POST /api/sec-filings/summarise { filing_text, companyId? }
router.post('/summarise', async (req, res) => {
  try {
    const { filing_text, companyId } = req.body || {};
    if (!filing_text) return res.status(400).json({ error: 'filing_text required' });
    const key = process.env.OPENROUTER_API_KEY; // TODO: configure credentials
    if (!key) return res.status(503).json({ error: 'OPENROUTER_API_KEY missing' });
    const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
      model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
      messages: [
        { role: 'system', content: 'Summarise SEC filings by risk category. JSON {"market_risk":"...","operational_risk":"...","legal_risk":"...","financial_risk":"...","summary":"..."}.' },
        { role: 'user', content: filing_text.slice(0, 12000) },
      ],
      max_tokens: 1500,
    }, { headers: { Authorization: `Bearer ${key}` } });
    const out = parseAIJson(r.data.choices?.[0]?.message?.content) || { raw: r.data.choices?.[0]?.message?.content };
    if (companyId) {
      try {
        await pool.query(`INSERT INTO risks (company_id, severity, description, source, created_at) VALUES ($1,'medium',$2,'sec_filing',NOW())`, [companyId, JSON.stringify(out).slice(0, 4000)]);
      } catch {}
    }
    return res.json({ summary: out });
  } catch (e) {
    console.error('sec summarise error:', e.message);
    return res.status(500).json({ error: 'summarise failed' });
  }
});

module.exports = router;
