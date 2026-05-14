const express = require('express');
const router = express.Router();
const axios = require('axios');
const pool = require('../db');
const { parseAIJson } = require('../middleware/parseAIJson');

// In-memory AI result cache: key -> { result, expiresAt }
const aiCache = new Map();
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

function getCached(key) {
  const entry = aiCache.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    aiCache.delete(key);
    return null;
  }
  return entry.result;
}

function setCache(key, result) {
  aiCache.set(key, { result, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCache(key) {
  aiCache.delete(key);
}

// Export cache helpers so server.js can use them
module.exports.getCached = getCached;
module.exports.setCache = setCache;
module.exports.invalidateCache = invalidateCache;

const callOpenRouterAI = async (prompt, systemPrompt = '') => {
  if (!process.env.OPENROUTER_API_KEY) {
    const err = new Error('AI not configured. Set OPENROUTER_API_KEY to enable AI features.');
    err.status = 503;
    throw err;
  }
  const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
  const response = await axios.post(
    `${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`,
    {
      model,
      messages: [
        {
          role: 'system',
          content: systemPrompt || 'You are an expert M&A due diligence analyst. Provide detailed, professional analysis with clear sections and actionable insights.'
        },
        { role: 'user', content: prompt }
      ],
      max_tokens: 2000,
      temperature: 0.7
    },
    {
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000',
        'X-Title': 'AI Due Diligence Assistant'
      }
    }
  );
  return response.data.choices[0].message.content;
};

// POST /api/ai/deal-score - compute acquisition score for a company
router.post('/deal-score', async (req, res) => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }

    const cacheKey = `deal-score:${company_id}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ ...cached, cached: true });
    }

    // Fetch all related data
    const [companyRes, financialsRes, risksRes, redFlagsRes] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [company_id]),
      pool.query('SELECT * FROM financial_analysis WHERE company_id = $1 ORDER BY fiscal_year DESC LIMIT 3', [company_id]),
      pool.query('SELECT * FROM risk_assessment WHERE company_id = $1', [company_id]),
      pool.query('SELECT * FROM red_flags WHERE company_id = $1', [company_id])
    ]);

    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyRes.rows[0];
    const financials = financialsRes.rows;
    const risks = risksRes.rows;
    const redFlags = redFlagsRes.rows;

    const prompt = `You are scoring a company for M&A acquisition suitability on a 0-100 scale.

Company: ${company.name}
Industry: ${company.industry}
Revenue: $${company.revenue}
Employees: ${company.employees}
Status: ${company.status}
Description: ${company.description}

Financial Data (recent years):
${financials.map(f => `FY${f.fiscal_year}: Revenue $${f.revenue}, Net Income $${f.net_income}, EBITDA $${f.ebitda}, Gross Margin ${f.gross_margin}%, D/E Ratio ${f.debt_to_equity}`).join('\n') || 'No financial data available'}

Risks (${risks.length} total):
${risks.map(r => `- ${r.title} [${r.risk_type}] Severity: ${r.severity}, Likelihood: ${r.likelihood}`).join('\n') || 'No risks recorded'}

Red Flags (${redFlags.length} total):
${redFlags.map(rf => `- ${rf.title} [${rf.category}] Priority: ${rf.priority}, Status: ${rf.status}`).join('\n') || 'No red flags recorded'}

Compute a weighted acquisition score (0-100) across these dimensions:
1. Financial Health (weight: 30%) - profitability, revenue growth, margins, debt levels
2. Market Position (weight: 25%) - industry standing, competitive advantage, market share
3. Risk Profile (weight: 25%) - number and severity of identified risks
4. Red Flag Severity (weight: 20%) - deal-blocking issues, compliance concerns

Return a JSON object with this exact structure:
{
  "overall_score": <number 0-100>,
  "recommendation": "<Buy|Watch|Pass>",
  "dimensions": {
    "financial_health": { "score": <0-100>, "weight": 0.30, "weighted_score": <number>, "notes": "<string>" },
    "market_position": { "score": <0-100>, "weight": 0.25, "weighted_score": <number>, "notes": "<string>" },
    "risk_profile": { "score": <0-100>, "weight": 0.25, "weighted_score": <number>, "notes": "<string>" },
    "red_flag_severity": { "score": <0-100>, "weight": 0.20, "weighted_score": <number>, "notes": "<string>" }
  },
  "key_strengths": ["<string>", ...],
  "key_concerns": ["<string>", ...],
  "summary": "<2-3 sentence executive summary>"
}`;

    const aiResponse = await callOpenRouterAI(prompt, 'You are an expert M&A analyst. Always respond with valid JSON only, no markdown.');

    const scoreData = parseAIJson(aiResponse);
    if (!scoreData) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    }

    setCache(cacheKey, { company_id, company_name: company.name, ...scoreData });
    res.json({ company_id, company_name: company.name, ...scoreData, cached: false });
  } catch (error) {
    console.error('Deal score error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST /api/ai/comparison-matrix - side-by-side comparison of multiple companies
router.post('/comparison-matrix', async (req, res) => {
  try {
    const { company_ids } = req.body;
    if (!Array.isArray(company_ids) || company_ids.length < 2) {
      return res.status(400).json({ error: 'company_ids must be an array of at least 2 IDs' });
    }
    if (company_ids.length > 5) {
      return res.status(400).json({ error: 'Maximum 5 companies can be compared at once' });
    }

    const cacheKey = `comparison-matrix:${company_ids.sort().join(',')}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    // Fetch all companies with their financial and risk data
    const companiesData = await Promise.all(company_ids.map(async (id) => {
      const [companyRes, financialsRes, risksRes, marketRes] = await Promise.all([
        pool.query('SELECT * FROM companies WHERE id = $1', [id]),
        pool.query('SELECT * FROM financial_analysis WHERE company_id = $1 ORDER BY fiscal_year DESC LIMIT 1', [id]),
        pool.query('SELECT COUNT(*) as count, AVG(severity) as avg_severity FROM risk_assessment WHERE company_id = $1', [id]),
        pool.query('SELECT * FROM market_analysis WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1', [id])
      ]);

      if (companyRes.rows.length === 0) return null;
      return {
        company: companyRes.rows[0],
        latestFinancial: financialsRes.rows[0] || null,
        riskSummary: risksRes.rows[0],
        marketData: marketRes.rows[0] || null
      };
    }));

    const validCompanies = companiesData.filter(Boolean);
    if (validCompanies.length === 0) {
      return res.status(404).json({ error: 'No valid companies found' });
    }

    const companyDescriptions = validCompanies.map(cd => {
      const c = cd.company;
      const f = cd.latestFinancial;
      const m = cd.marketData;
      return `
Company: ${c.name} (ID: ${c.id})
Industry: ${c.industry} | Revenue: $${c.revenue} | Employees: ${c.employees}
${f ? `Financials: Net Income $${f.net_income}, EBITDA $${f.ebitda}, Gross Margin ${f.gross_margin}%, D/E ${f.debt_to_equity}` : 'No financial data'}
${m ? `Market: Size $${m.market_size}, Growth ${m.market_growth_rate}%, Share ${m.market_share}%, Position: ${m.competitive_position}` : 'No market data'}
Risks: ${cd.riskSummary.count} identified`;
    }).join('\n---\n');

    const prompt = `Compare the following companies across 15 financial and strategic metrics for M&A due diligence:

${companyDescriptions}

Generate a comprehensive side-by-side comparison matrix. Return a JSON object with this structure:
{
  "companies": [{ "id": <id>, "name": "<name>" }, ...],
  "metrics": [
    {
      "metric": "<metric name>",
      "category": "<Financial|Strategic|Operational|Risk>",
      "values": { "<company_name>": "<value or rating>" },
      "winner": "<company_name or 'Tie'>",
      "notes": "<brief comparison note>"
    }
  ],
  "overall_ranking": [{ "rank": 1, "company": "<name>", "rationale": "<string>" }, ...],
  "recommendation": "<string - which company is best acquisition target and why>"
}

Include these 15 metrics: Revenue Size, Revenue Growth Potential, Profit Margins, EBITDA Quality, Debt Levels, Market Share, Market Growth Rate, Competitive Position, Risk Score, Operational Efficiency, Geographic Presence, Management Quality, Integration Complexity, Strategic Fit, Deal Attractiveness.`;

    const aiResponse = await callOpenRouterAI(prompt, 'You are an expert M&A analyst. Always respond with valid JSON only, no markdown.');

    const matrixData = parseAIJson(aiResponse);
    if (!matrixData) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    }

    setCache(cacheKey, matrixData);
    res.json({ ...matrixData, cached: false });
  } catch (error) {
    console.error('Comparison matrix error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST /api/ai/red-flag-ranking - rank red flags by acquisition-blocking severity
router.post('/red-flag-ranking', async (req, res) => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }

    const cacheKey = `red-flag-ranking:${company_id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const [companyRes, redFlagsRes] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [company_id]),
      pool.query('SELECT * FROM red_flags WHERE company_id = $1 ORDER BY priority DESC', [company_id])
    ]);

    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyRes.rows[0];
    const redFlags = redFlagsRes.rows;

    if (redFlags.length === 0) {
      return res.json({
        company_id,
        company_name: company.name,
        red_flags: [],
        summary: 'No red flags identified for this company.',
        deal_viability: 'Green',
        cached: false
      });
    }

    const prompt = `You are an M&A deal advisor. Rank the following red flags for ${company.name} by their potential to block or severely impair an acquisition deal.

Red Flags to Rank:
${redFlags.map((rf, i) => `${i + 1}. [${rf.category}] ${rf.title}
   Description: ${rf.description}
   Evidence: ${rf.evidence || 'None provided'}
   Priority: ${rf.priority} | Status: ${rf.status}
   Recommendation: ${rf.recommendation || 'None'}`).join('\n\n')}

Return a JSON object:
{
  "ranked_flags": [
    {
      "original_id": <red_flag_id>,
      "title": "<string>",
      "category": "<string>",
      "acquisition_blocking_score": <1-10, where 10 = absolute deal killer>,
      "severity_label": "<Deal Killer|Critical|Major|Moderate|Minor>",
      "deal_impact": "<string - specific impact on deal>",
      "mitigation_recommendations": ["<string>", ...],
      "timeline_to_resolve": "<string e.g. 3-6 months>"
    }
  ],
  "deal_viability": "<Red|Yellow|Green>",
  "blocking_count": <number of deal-killer flags>,
  "summary": "<string - overall assessment>"
}`;

    const aiResponse = await callOpenRouterAI(prompt, 'You are an expert M&A risk analyst. Always respond with valid JSON only, no markdown.');

    const rankingData = parseAIJson(aiResponse);
    if (!rankingData) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    }

    const result = { company_id, company_name: company.name, ...rankingData };
    setCache(cacheKey, result);
    res.json({ ...result, cached: false });
  } catch (error) {
    console.error('Red flag ranking error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST /api/ai/deal-timeline - generate integration milestone timeline
router.post('/deal-timeline', async (req, res) => {
  try {
    const { company_id, deal_type, deal_size_usd } = req.body;
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }

    const cacheKey = `deal-timeline:${company_id}:${deal_type}:${deal_size_usd}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const [companyRes, risksRes, redFlagsRes] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [company_id]),
      pool.query("SELECT COUNT(*) as count FROM risk_assessment WHERE company_id = $1 AND severity >= 3", [company_id]),
      pool.query("SELECT COUNT(*) as count FROM red_flags WHERE company_id = $1 AND status = 'Active'", [company_id])
    ]);

    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyRes.rows[0];

    const prompt = `Generate a detailed M&A deal timeline for acquiring ${company.name}.

Deal Parameters:
- Company: ${company.name} (${company.industry})
- Deal Type: ${deal_type || 'Full Acquisition'}
- Deal Size: ${deal_size_usd ? `$${Number(deal_size_usd).toLocaleString()}` : 'Not specified'}
- Revenue: $${company.revenue}
- Employees: ${company.employees}
- High-Priority Risks: ${risksRes.rows[0].count}
- Active Red Flags: ${redFlagsRes.rows[0].count}

Generate a comprehensive milestone timeline with pre-close, close, and post-close phases. Return JSON:
{
  "deal_summary": {
    "company": "<name>",
    "deal_type": "<string>",
    "estimated_total_duration_months": <number>,
    "complexity": "<Low|Medium|High>"
  },
  "phases": [
    {
      "phase": "<Pre-Close|Close|Post-Close>",
      "phase_duration_weeks": <number>,
      "milestones": [
        {
          "week": <number from deal start>,
          "milestone": "<string>",
          "description": "<string>",
          "owner": "<string e.g. Legal, Finance, HR>",
          "dependencies": ["<string>"],
          "risk_level": "<Low|Medium|High>",
          "estimated_cost_usd": <number or null>
        }
      ]
    }
  ],
  "critical_path": ["<milestone name>", ...],
  "key_risks": ["<string>", ...],
  "success_metrics": ["<string>", ...]
}`;

    const aiResponse = await callOpenRouterAI(prompt, 'You are an expert M&A integration specialist. Always respond with valid JSON only, no markdown.');

    const timelineData = parseAIJson(aiResponse);
    if (!timelineData) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    }

    const result = { company_id, ...timelineData };
    setCache(cacheKey, result);
    res.json({ ...result, cached: false });
  } catch (error) {
    console.error('Deal timeline error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST /api/ai/management-team-analysis - background / track-record summary
router.post('/management-team-analysis', async (req, res) => {
  try {
    const { company_id } = req.body;
    if (!company_id) {
      return res.status(400).json({ error: 'company_id is required' });
    }

    const cacheKey = `management-team-analysis:${company_id}`;
    const cached = getCached(cacheKey);
    if (cached) return res.json({ ...cached, cached: true });

    const [companyRes, mgmtRes] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [company_id]),
      pool.query('SELECT * FROM management_assessment WHERE company_id = $1', [company_id])
    ]);

    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    const company = companyRes.rows[0];
    const mgmt = mgmtRes.rows;

    const prompt = `You are an M&A management-quality analyst. Analyze the executive team of ${company.name} (${company.industry}) for acquisition diligence.

Executives (${mgmt.length}):
${mgmt.map(m => `- ${m.executive_name}, ${m.title} | Experience: ${m.experience_years} yrs | Leadership Score: ${m.leadership_score} | Retention Risk: ${m.retention_risk}
  Background: ${m.background || 'N/A'}
  Strengths: ${m.key_strengths || 'N/A'} | Concerns: ${m.concerns || 'N/A'}`).join('\n') || 'No management data on file.'}

Return a JSON object with this exact structure:
{
  "team_summary": "<2-3 sentence overall description>",
  "team_strength_score": <0-100>,
  "track_record_assessment": "<string>",
  "depth_and_redundancy": "<string - bench strength / single-point-of-failure analysis>",
  "retention_risk_overall": "<Low|Medium|High>",
  "key_executives": [
    {
      "name": "<string>",
      "title": "<string>",
      "highlights": ["<string>", ...],
      "concerns": ["<string>", ...]
    }
  ],
  "post_close_recommendations": ["<string>", ...]
}`;

    const aiResponse = await callOpenRouterAI(prompt, 'You are an expert M&A management analyst. Always respond with valid JSON only, no markdown.');
    const data = parseAIJson(aiResponse);
    if (!data) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    }
    const result = { company_id, company_name: company.name, ...data };
    setCache(cacheKey, result);
    res.json({ ...result, cached: false });
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ error: error.message });
    console.error('Management team analysis error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// POST /api/ai/cultural-fit-assessment - free-text culture comparison
router.post('/cultural-fit-assessment', async (req, res) => {
  try {
    const { acquirer_culture, target_culture, deal_context } = req.body;
    if (!acquirer_culture || !target_culture) {
      return res.status(400).json({ error: 'acquirer_culture and target_culture are required' });
    }

    const prompt = `You are an M&A integration consultant. Assess cultural fit between an acquirer and target.

Acquirer culture description:
${acquirer_culture}

Target culture description:
${target_culture}

${deal_context ? `Deal context: ${deal_context}` : ''}

Return a JSON object with this exact structure:
{
  "fit_score": <0-100>,
  "fit_label": "<Strong Fit|Moderate Fit|Notable Gaps|Poor Fit>",
  "alignment_areas": ["<string>", ...],
  "friction_areas": ["<string>", ...],
  "integration_risks": [
    { "risk": "<string>", "severity": "<Low|Medium|High>", "mitigation": "<string>" }
  ],
  "recommended_integration_style": "<Preserve|Symbiotic|Holding|Absorb>",
  "first_90_day_actions": ["<string>", ...],
  "executive_summary": "<2-3 sentence summary>"
}`;

    const aiResponse = await callOpenRouterAI(prompt, 'You are an expert M&A culture analyst. Always respond with valid JSON only, no markdown.');
    const data = parseAIJson(aiResponse);
    if (!data) {
      return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    }
    res.json(data);
  } catch (error) {
    if (error.status === 503) return res.status(503).json({ error: error.message });
    console.error('Cultural fit assessment error:', error.response?.data || error.message);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// =====================================================================
// Apply pass 5: backlog endpoints (cap=10/project; pass2=4 + pass4=2 + pass5=4)
// Required env vars:
//   OPENROUTER_API_KEY - already used by callOpenRouterAI; AI endpoints 503 if missing
// PRODUCT-DECISION:
//   - Cap-table & multi-round are stored in a single JSONB blob in a new
//     `cap_tables` table; full editable UI deferred. We accept structured input
//     and return AI dilution analysis without prescribing a schema beyond
//     `rounds[]` and `shareholders[]`.
//   - SEC EDGAR / Crunchbase enrichment and founder-call transcription are
//     intentionally NOT included in this pass because they exceed the
//     per-project feature cap; they remain backlog items.
// =====================================================================

async function loadCompanyOr404(company_id, res) {
  try {
    const r = await pool.query('SELECT * FROM companies WHERE id = $1', [company_id]);
    if (r.rows.length === 0) {
      res.status(404).json({ error: 'Company not found' });
      return null;
    }
    return r.rows[0];
  } catch (e) {
    res.status(500).json({ error: 'Database error', details: e.message });
    return null;
  }
}

function aiErrorHandler(error, res, label) {
  if (error.status === 503) return res.status(503).json({ error: error.message, missing: 'OPENROUTER_API_KEY' });
  console.error(`${label} error:`, error.response?.data || error.message);
  return res.status(500).json({ error: error.message || 'Server error' });
}

// POST /api/ai/analyze-target-company - holistic target company assessment
router.post('/analyze-target-company', async (req, res) => {
  try {
    const { company_id } = req.body || {};
    if (!company_id) return res.status(400).json({ error: 'company_id is required' });
    const company = await loadCompanyOr404(company_id, res);
    if (!company) return;
    const prompt = `Provide a comprehensive acquisition-target assessment for ${company.name} (${company.industry || 'N/A'}). Use any company attributes provided: ${JSON.stringify(company)}.\n\nReturn JSON: {"executive_summary":"<string>","strategic_rationale":["<string>"],"swot":{"strengths":["<string>"],"weaknesses":["<string>"],"opportunities":["<string>"],"threats":["<string>"]},"key_risks":["<string>"],"recommended_diligence_focus":["<string>"],"overall_attractiveness_score":<0-100>}`;
    const aiResponse = await callOpenRouterAI(prompt, 'You are an M&A target-screening analyst. Always reply with valid JSON only.');
    const data = parseAIJson(aiResponse);
    if (!data) return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    res.json({ company_id, company_name: company.name, ...data });
  } catch (error) { return aiErrorHandler(error, res, 'analyze-target-company'); }
});

// POST /api/ai/valuation-summary
router.post('/valuation-summary', async (req, res) => {
  try {
    const { company_id, deal_context } = req.body || {};
    if (!company_id) return res.status(400).json({ error: 'company_id is required' });
    const company = await loadCompanyOr404(company_id, res);
    if (!company) return;
    const prompt = `Summarise an indicative valuation for ${company.name} (${company.industry || 'N/A'}).\nCompany attributes: ${JSON.stringify(company)}\nDeal context (free text, optional): ${deal_context || 'N/A'}\n\nReturn JSON: {"valuation_range":{"low":"<string>","mid":"<string>","high":"<string>"},"approach_used":["DCF","Comparable Company","Precedent Transaction"],"key_assumptions":["<string>"],"sensitivities":["<string>"],"deal_breakers":["<string>"],"recommended_offer_band":"<string>"}`;
    const aiResponse = await callOpenRouterAI(prompt, 'You are a valuation analyst. Always reply with valid JSON only.');
    const data = parseAIJson(aiResponse);
    if (!data) return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    res.json({ company_id, ...data });
  } catch (error) { return aiErrorHandler(error, res, 'valuation-summary'); }
});

// POST /api/ai/diligence-checklist - generate due diligence checklist
router.post('/diligence-checklist', async (req, res) => {
  try {
    const { company_id, focus_areas } = req.body || {};
    if (!company_id) return res.status(400).json({ error: 'company_id is required' });
    const company = await loadCompanyOr404(company_id, res);
    if (!company) return;
    const prompt = `Produce a structured due-diligence checklist for ${company.name} (${company.industry || 'N/A'}). Focus areas (optional): ${focus_areas || 'all standard pillars'}.\n\nReturn JSON: {"workstreams":[{"name":"Financial|Legal|Tax|HR|Tech|Commercial|Ops","owner":"<string>","items":[{"title":"<string>","priority":"P0|P1|P2","description":"<string>"}]}],"timeline_weeks":<number>,"top_risks_uncovered_first":["<string>"]}`;
    const aiResponse = await callOpenRouterAI(prompt, 'You are an M&A diligence project manager. Always reply with valid JSON only.');
    const data = parseAIJson(aiResponse);
    if (!data) return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    res.json({ company_id, ...data });
  } catch (error) { return aiErrorHandler(error, res, 'diligence-checklist'); }
});

// POST /api/ai/cap-table-analysis - PRODUCT-DECISION simple JSON model
router.post('/cap-table-analysis', async (req, res) => {
  try {
    const { company_id, rounds, shareholders, proposed_offer } = req.body || {};
    if (!company_id) return res.status(400).json({ error: 'company_id is required' });
    const company = await loadCompanyOr404(company_id, res);
    if (!company) return;

    // Persist additive: never alters existing schema
    await pool.query(`
      CREATE TABLE IF NOT EXISTS cap_tables (
        id SERIAL PRIMARY KEY,
        company_id INTEGER NOT NULL,
        rounds JSONB,
        shareholders JSONB,
        created_at TIMESTAMP NOT NULL DEFAULT NOW()
      )
    `);
    if (rounds || shareholders) {
      await pool.query(
        `INSERT INTO cap_tables (company_id, rounds, shareholders) VALUES ($1, $2, $3)`,
        [company_id, JSON.stringify(rounds || []), JSON.stringify(shareholders || [])]
      );
    }

    const prompt = `Analyse this cap table and dilution scenario for ${company.name}.\nRounds: ${JSON.stringify(rounds || [])}\nShareholders: ${JSON.stringify(shareholders || [])}\nProposed offer (free text): ${proposed_offer || 'N/A'}\n\nReturn JSON: {"summary":"<string>","fully_diluted_implications":"<string>","liquidation_preference_concerns":["<string>"],"dilution_by_scenario":[{"scenario":"<string>","founder_pct_after":"<string>","major_holder_pct_after":"<string>"}],"red_flags":["<string>"],"recommendations":["<string>"]}`;
    const aiResponse = await callOpenRouterAI(prompt, 'You are a venture-finance / cap-table specialist. Always reply with valid JSON only.');
    const data = parseAIJson(aiResponse);
    if (!data) return res.status(500).json({ error: 'Failed to parse AI response', raw: aiResponse });
    res.json({ company_id, ...data });
  } catch (error) { return aiErrorHandler(error, res, 'cap-table-analysis'); }
});

module.exports = router;
