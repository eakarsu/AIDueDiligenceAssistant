// Multi-round comparison: diff financials across rounds, flag ARR decline /
// churn. Aggregates financial snapshots per round for a target company.
const express = require('express');
const router = express.Router();
const pool = require('../db');

function pctChange(prev, curr) {
  if (prev == null || prev === 0) return null;
  return Math.round(((curr - prev) / prev) * 10000) / 100;
}

// GET /api/multi-round-compare/:companyId
router.get('/:companyId', async (req, res) => {
  try {
    const { companyId } = req.params;
    const r = await pool.query(
      `SELECT * FROM financials WHERE company_id = $1 ORDER BY reporting_date ASC LIMIT 50`,
      [companyId]
    );
    const snaps = r.rows;
    if (snaps.length < 2) {
      return res.json({ company_id: companyId, rounds: snaps, deltas: [], flags: ['insufficient_data'] });
    }
    const deltas = [];
    const flags = [];
    for (let i = 1; i < snaps.length; i++) {
      const prev = snaps[i - 1];
      const curr = snaps[i];
      const arrChange = pctChange(Number(prev.arr || prev.revenue), Number(curr.arr || curr.revenue));
      const burnChange = pctChange(Number(prev.burn_rate), Number(curr.burn_rate));
      const churnDelta = (Number(curr.churn_rate) || 0) - (Number(prev.churn_rate) || 0);
      deltas.push({
        round_from: prev.id,
        round_to: curr.id,
        date_from: prev.reporting_date,
        date_to: curr.reporting_date,
        arr_change_pct: arrChange,
        burn_change_pct: burnChange,
        churn_delta: Math.round(churnDelta * 10000) / 100,
      });
      if (arrChange !== null && arrChange < -10) flags.push(`ARR_decline_${prev.reporting_date}_to_${curr.reporting_date}`);
      if (churnDelta > 0.05) flags.push(`Churn_spike_${prev.reporting_date}_to_${curr.reporting_date}`);
      if (burnChange !== null && burnChange > 25) flags.push(`Burn_spike_${prev.reporting_date}_to_${curr.reporting_date}`);
    }
    return res.json({ company_id: companyId, round_count: snaps.length, deltas, flags });
  } catch (e) {
    console.error('multi-round-compare error:', e);
    return res.status(500).json({ error: 'comparison failed', detail: e.message });
  }
});

module.exports = router;
