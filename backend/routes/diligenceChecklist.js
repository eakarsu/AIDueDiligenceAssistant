// Auto-generated checklists: industry/stage-aware diligence checklists.
const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { parseAIJson } = require('../middleware/parseAIJson');
const router = express.Router();

const TEMPLATES = {
  saas_seed: ['Founders background', 'Product demo', 'ARR + churn', 'Cap table', 'Customer references'],
  saas_series_a: ['CAC/LTV', 'Net revenue retention', 'Pipeline coverage', 'Customer concentration', 'Tech debt review', 'Hiring plan'],
  marketplace: ['Liquidity ratio', 'Take rate', 'Both-side acquisition cost', 'Trust & safety', 'Cohort retention'],
  fintech: ['Regulatory licences', 'Compliance program', 'Risk capital', 'Fraud rate', 'Charge-off ratio'],
  healthcare: ['HIPAA stance', 'Clinical evidence', 'Regulatory pathway', 'Payer relationships', 'Adverse events'],
};

// POST /api/diligence-checklist/generate { industry, stage, companyId? }
router.post('/generate', async (req, res) => {
  try {
    const { industry, stage, companyId } = req.body || {};
    if (!industry || !stage) return res.status(400).json({ error: 'industry and stage required' });
    const key = `${industry}_${stage}`.toLowerCase();
    let items = TEMPLATES[key] || TEMPLATES[`${industry}_seed`.toLowerCase()] || [];

    // Enrich with LLM if configured.
    const apiKey = process.env.OPENROUTER_API_KEY; // TODO: configure credentials
    if (apiKey) {
      try {
        const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
          model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
          messages: [
            { role: 'system', content: 'Produce a diligence checklist tailored to industry+stage. Output JSON {"items":["..."]}. Include 12-20 items.' },
            { role: 'user', content: `Industry: ${industry}\nStage: ${stage}` },
          ],
        }, { headers: { Authorization: `Bearer ${apiKey}` } });
        const parsed = parseAIJson(r.data.choices?.[0]?.message?.content) || {};
        if (Array.isArray(parsed.items)) items = parsed.items;
      } catch (e) {
        // fall back to template
      }
    }

    if (companyId) {
      try {
        await pool.query(`INSERT INTO integration_plans (company_id, plan_type, plan_data, created_at) VALUES ($1, 'diligence_checklist', $2, NOW())`, [companyId, JSON.stringify(items)]);
      } catch {}
    }
    return res.json({ industry, stage, count: items.length, checklist: items });
  } catch (e) {
    console.error('checklist error:', e);
    return res.status(500).json({ error: 'checklist failed' });
  }
});

module.exports = router;
