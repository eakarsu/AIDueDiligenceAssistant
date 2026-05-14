// Founder-call analysis: transcribe pitch calls and extract claims vs. data.
// Accepts base64 audio or transcript text; emits structured claim list.
const express = require('express');
const axios = require('axios');
const pool = require('../db');
const { parseAIJson } = require('../middleware/parseAIJson');
const router = express.Router();

async function whisper(base64, mimeType = 'audio/webm') {
  // TODO: configure credentials — OPENAI_API_KEY
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;
  const buf = Buffer.from(base64, 'base64');
  const form = new FormData();
  form.append('file', new Blob([buf], { type: mimeType }), 'call.webm');
  form.append('model', 'whisper-1');
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}` },
    body: form,
  });
  if (!r.ok) return null;
  const j = await r.json();
  return j.text || null;
}

async function callOpenRouter(prompt, systemPrompt) {
  const key = process.env.OPENROUTER_API_KEY; // TODO: configure credentials
  if (!key) throw new Error('OPENROUTER_API_KEY missing');
  const r = await axios.post('https://openrouter.ai/api/v1/chat/completions', {
    model: process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ],
    max_tokens: 1500,
  }, { headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' } });
  return r.data.choices?.[0]?.message?.content;
}

// POST /api/founder-call-analysis/analyze { companyId?, audio_base64?, transcript? }
router.post('/analyze', async (req, res) => {
  try {
    const { companyId, audio_base64, transcript, mimeType } = req.body || {};
    let text = transcript;
    if (!text && audio_base64) {
      text = await whisper(audio_base64, mimeType);
      if (!text) return res.status(503).json({ error: 'Whisper not configured' });
    }
    if (!text) return res.status(400).json({ error: 'audio_base64 or transcript required' });

    let financials = null;
    if (companyId) {
      try {
        const r = await pool.query(`SELECT * FROM financials WHERE company_id = $1 ORDER BY reporting_date DESC LIMIT 5`, [companyId]);
        financials = r.rows;
      } catch {}
    }

    const system = 'Extract claims from a founder call. Categorise each claim as verifiable/non-verifiable. If data is provided, mark contradictions. Output JSON: {"claims":[{"text":"...","category":"...","verifiable":bool,"contradicts_data":bool}],"summary":"..."}.';
    const prompt = `Transcript:\n${text.slice(0, 8000)}\n\nKnown data: ${JSON.stringify(financials || []).slice(0, 2000)}`;
    const raw = await callOpenRouter(prompt, system);
    const out = parseAIJson(raw) || { raw };

    return res.json({ companyId: companyId || null, transcript_excerpt: text.slice(0, 400), analysis: out });
  } catch (e) {
    console.error('founder-call error:', e);
    return res.status(500).json({ error: 'analysis failed', detail: e.message });
  }
});

module.exports = router;
