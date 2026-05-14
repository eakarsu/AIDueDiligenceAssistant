// Cap-table modelling: parse cap tables and simulate dilution scenarios.
const express = require('express');
const router = express.Router();

// POST /api/cap-table/simulate
// body: { current: [{holder, shares}], new_round: { amount, premoney_valuation, option_pool_pct? } }
router.post('/simulate', async (req, res) => {
  try {
    const { current = [], new_round } = req.body || {};
    if (!Array.isArray(current) || current.length === 0) return res.status(400).json({ error: 'current[] required' });
    if (!new_round || !new_round.amount || !new_round.premoney_valuation) {
      return res.status(400).json({ error: 'new_round.amount + premoney_valuation required' });
    }

    const totalCurrentShares = current.reduce((a, b) => a + Number(b.shares || 0), 0);
    if (totalCurrentShares <= 0) return res.status(400).json({ error: 'shares must sum > 0' });
    const pricePerShare = Number(new_round.premoney_valuation) / totalCurrentShares;
    const newShares = Number(new_round.amount) / pricePerShare;

    // Option pool top-up (pre-money)
    let optionShares = 0;
    if (new_round.option_pool_pct) {
      // target option pool of N% of postmoney
      const targetPct = Number(new_round.option_pool_pct);
      const total = totalCurrentShares + newShares;
      optionShares = Math.max(0, (total * targetPct) / (1 - targetPct));
    }
    const postTotal = totalCurrentShares + newShares + optionShares;

    const dilution = current.map(h => ({
      holder: h.holder,
      pre_pct: Math.round((Number(h.shares) / totalCurrentShares) * 10000) / 100,
      post_pct: Math.round((Number(h.shares) / postTotal) * 10000) / 100,
      dilution_pct: Math.round(((Number(h.shares) / totalCurrentShares) - (Number(h.shares) / postTotal)) * 10000) / 100,
    }));

    return res.json({
      summary: {
        price_per_share: Math.round(pricePerShare * 10000) / 10000,
        new_shares_issued: Math.round(newShares),
        option_pool_shares: Math.round(optionShares),
        post_money_valuation: Math.round(pricePerShare * postTotal),
        total_post_shares: Math.round(postTotal),
      },
      dilution,
      new_investor_post_pct: Math.round((newShares / postTotal) * 10000) / 100,
    });
  } catch (e) {
    console.error('cap-table error:', e);
    return res.status(500).json({ error: 'simulation failed', detail: e.message });
  }
});

module.exports = router;
