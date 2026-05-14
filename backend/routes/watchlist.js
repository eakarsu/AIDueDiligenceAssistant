const express = require('express');
const router = express.Router();
const pool = require('../db');

// One-time idempotent table creation for the watchlist feature
let _ensured = false;
async function ensureTables() {
  if (_ensured) return;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS watchlists (
      id SERIAL PRIMARY KEY,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
      name VARCHAR(255) NOT NULL,
      criteria JSONB DEFAULT '{}'::jsonb,
      notify_email BOOLEAN DEFAULT TRUE,
      severity_threshold VARCHAR(20) DEFAULT 'medium',
      ai_results JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMP DEFAULT NOW(),
      updated_at TIMESTAMP DEFAULT NOW(),
      UNIQUE(user_id, company_id)
    );
    CREATE TABLE IF NOT EXISTS watchlist_alerts (
      id SERIAL PRIMARY KEY,
      watchlist_id INTEGER REFERENCES watchlists(id) ON DELETE CASCADE,
      alert_type VARCHAR(64) NOT NULL,
      severity VARCHAR(20) DEFAULT 'medium',
      title VARCHAR(512) NOT NULL,
      details TEXT,
      ai_results JSONB DEFAULT '{}'::jsonb,
      acknowledged BOOLEAN DEFAULT FALSE,
      created_at TIMESTAMP DEFAULT NOW()
    );
  `);
  _ensured = true;
}

// GET /api/watchlist - paginated list of my watchlist entries
router.get('/', async (req, res) => {
  try {
    await ensureTables();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const countRes = await pool.query('SELECT COUNT(*) FROM watchlists WHERE user_id = $1', [req.user.id]);
    const total = parseInt(countRes.rows[0].count);
    const result = await pool.query(`
      SELECT w.*, c.name AS company_name, c.industry,
        (SELECT COUNT(*) FROM watchlist_alerts WHERE watchlist_id = w.id AND acknowledged = FALSE) AS unread_count
      FROM watchlists w
      JOIN companies c ON w.company_id = c.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
      LIMIT $2 OFFSET $3
    `, [req.user.id, limit, offset]);
    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/watchlist - add a company to watchlist
router.post('/', async (req, res) => {
  try {
    await ensureTables();
    const { company_id, name, criteria, notify_email = true, severity_threshold = 'medium' } = req.body;
    if (!company_id) return res.status(400).json({ error: 'company_id is required' });
    if (!name || typeof name !== 'string' || !name.trim()) return res.status(400).json({ error: 'name is required' });
    const result = await pool.query(`
      INSERT INTO watchlists (user_id, company_id, name, criteria, notify_email, severity_threshold)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (user_id, company_id) DO UPDATE
        SET name = EXCLUDED.name, criteria = EXCLUDED.criteria,
            notify_email = EXCLUDED.notify_email, severity_threshold = EXCLUDED.severity_threshold,
            updated_at = NOW()
      RETURNING *
    `, [req.user.id, company_id, name.trim(), criteria || {}, !!notify_email, severity_threshold]);
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/watchlist/:id - remove
router.delete('/:id', async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query(
      'DELETE FROM watchlists WHERE id = $1 AND user_id = $2 RETURNING *',
      [req.params.id, req.user.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Watchlist entry not found' });
    res.json({ message: 'Removed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/watchlist/:id/alerts - paginated alerts for a watchlist
router.get('/:id/alerts', async (req, res) => {
  try {
    await ensureTables();
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    // Make sure watchlist belongs to user
    const own = await pool.query('SELECT id FROM watchlists WHERE id = $1 AND user_id = $2', [req.params.id, req.user.id]);
    if (own.rows.length === 0) return res.status(404).json({ error: 'Watchlist not found' });

    const countRes = await pool.query('SELECT COUNT(*) FROM watchlist_alerts WHERE watchlist_id = $1', [req.params.id]);
    const total = parseInt(countRes.rows[0].count);
    const result = await pool.query(
      'SELECT * FROM watchlist_alerts WHERE watchlist_id = $1 ORDER BY created_at DESC LIMIT $2 OFFSET $3',
      [req.params.id, limit, offset]
    );
    res.json({
      data: result.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/watchlist/:id/scan - manually trigger a scan that pulls active red flags + risks
// from the watched company and creates alerts for any matching the user's threshold.
router.post('/:id/scan', async (req, res) => {
  try {
    await ensureTables();
    const own = await pool.query(
      'SELECT w.*, c.name AS company_name FROM watchlists w JOIN companies c ON w.company_id = c.id WHERE w.id = $1 AND w.user_id = $2',
      [req.params.id, req.user.id]
    );
    if (own.rows.length === 0) return res.status(404).json({ error: 'Watchlist not found' });
    const w = own.rows[0];

    const sevOrder = { low: 1, medium: 2, high: 3, critical: 4 };
    const minSev = sevOrder[(w.severity_threshold || 'medium').toLowerCase()] || 2;

    const [risksRes, flagsRes] = await Promise.all([
      pool.query("SELECT * FROM risk_assessment WHERE company_id = $1", [w.company_id]),
      pool.query("SELECT * FROM red_flags WHERE company_id = $1 AND status = 'Active'", [w.company_id])
    ]);

    let created = 0;
    for (const r of risksRes.rows) {
      const sev = sevOrder[String(r.severity || '').toLowerCase()] || 2;
      if (sev >= minSev) {
        const exists = await pool.query(
          "SELECT id FROM watchlist_alerts WHERE watchlist_id = $1 AND alert_type = 'risk' AND title = $2",
          [w.id, r.title || `Risk #${r.id}`]
        );
        if (exists.rows.length === 0) {
          await pool.query(
            `INSERT INTO watchlist_alerts (watchlist_id, alert_type, severity, title, details, ai_results)
             VALUES ($1, 'risk', $2, $3, $4, $5)`,
            [w.id, r.severity || 'medium', r.title || `Risk #${r.id}`, r.description || '', JSON.stringify({ source: 'risk_assessment', source_id: r.id })]
          );
          created++;
        }
      }
    }
    for (const f of flagsRes.rows) {
      const sev = sevOrder[String(f.priority || f.severity || 'medium').toLowerCase()] || 2;
      if (sev >= minSev) {
        const exists = await pool.query(
          "SELECT id FROM watchlist_alerts WHERE watchlist_id = $1 AND alert_type = 'red_flag' AND title = $2",
          [w.id, f.title || `Red flag #${f.id}`]
        );
        if (exists.rows.length === 0) {
          await pool.query(
            `INSERT INTO watchlist_alerts (watchlist_id, alert_type, severity, title, details, ai_results)
             VALUES ($1, 'red_flag', $2, $3, $4, $5)`,
            [w.id, f.priority || 'medium', f.title || `Red flag #${f.id}`, f.description || '', JSON.stringify({ source: 'red_flags', source_id: f.id })]
          );
          created++;
        }
      }
    }

    res.json({ scanned: true, created, company_name: w.company_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/watchlist/alerts/:id/ack - acknowledge an alert
router.patch('/alerts/:id/ack', async (req, res) => {
  try {
    await ensureTables();
    const result = await pool.query(`
      UPDATE watchlist_alerts SET acknowledged = TRUE
      WHERE id = $1 AND watchlist_id IN (SELECT id FROM watchlists WHERE user_id = $2)
      RETURNING *
    `, [req.params.id, req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'Alert not found' });
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
