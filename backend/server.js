const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const axios = require('axios');
require('dotenv').config({ path: '../.env' });
const pool = require('./db');
const { validateRuntime } = require('./config/runtime');

validateRuntime();

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const { aiRateLimiter } = require('./middleware/rateLimiter');
const { parseAIJson } = require('./middleware/parseAIJson');

// Security headers
app.use(helmet({ contentSecurityPolicy: false }));

// Env-driven CORS allowlist
const corsOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
app.use(cors({
  origin: (origin, cb) => {
    if (!origin) return cb(null, true);
    if (corsOrigins.includes('*') || corsOrigins.includes(origin)) return cb(null, true);
    return cb(new Error(`CORS blocked for origin: ${origin}`));
  },
  credentials: true,
}));
app.use(express.json({ limit: '1mb' }));

// Quarantine the generated cross-matter/model endpoints by default. Only the
// governed matter workflow and hardened identity endpoints are supported.
app.use('/api', (req, res, next) => {
  const alwaysAllowed = ['/auth/login','/auth/register','/auth/request-reset','/auth/reset-password','/auth/change-password','/auth/profile','/governed-diligence','/ai','/health'];
  if (alwaysAllowed.some(prefix => req.path.startsWith(prefix))) return next();
  if (process.env.ENABLE_GENERATED_AI_SURFACES === 'true' && process.env.NODE_ENV !== 'production') return next();
  return res.status(404).json({ error: 'Legacy generated endpoint is outside the supported product boundary' });
});

// JWT Middleware
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied' });
  }

  jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid token' });
    }
    req.user = user;
    next();
  });
};

// Role-based Authorization Middleware
const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
};

// Backend Validation Helpers
const validateRequired = (fields, body) => {
  const errors = {};
  fields.forEach(f => {
    if (!body[f.name] || (typeof body[f.name] === 'string' && !body[f.name].trim())) {
      errors[f.name] = f.message || `${f.name} is required`;
    }
  });
  return errors;
};

const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
const validatePassword = (pw) => pw && pw.length >= 12 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw);

// OpenRouter AI Service - Updated to use configured model
const callOpenRouterAI = async (prompt, systemPrompt = '') => {
  if (process.env.ENABLE_GENERATED_AI_SURFACES !== 'true' || process.env.NODE_ENV === 'production') {
    throw new Error('Generated AI analysis is quarantined; use the governed cited-evidence workflow');
  }
  try {
    const model = process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022';
    const response = await axios.post(
      `${process.env.OPENROUTER_BASE_URL || 'https://openrouter.ai/api/v1'}/chat/completions`,
      {
        model: model,
        messages: [
          { role: 'system', content: systemPrompt || 'You are an expert M&A due diligence analyst. Provide detailed, professional analysis with clear sections and actionable insights. Format your response with clear headers and bullet points where appropriate.' },
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
  } catch (error) {
    console.error('OpenRouter AI Error:', error.response?.data || error.message);
    throw new Error('AI service unavailable');
  }
};

// ==================== AUTH ROUTES ====================

// Login
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password);

    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Register
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password } = req.body;
    const errors = {};
    if (!name || name.trim().length < 2) errors.name = 'Name must be at least 2 characters';
    if (!email || !validateEmail(email)) errors.email = 'Valid email is required';
    if (!password || !validatePassword(password)) errors.password = 'Password must be 12+ chars with uppercase, lowercase, and number';
    if (Object.keys(errors).length > 0) return res.status(400).json({ error: Object.values(errors)[0], errors });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already registered' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const validRole = 'analyst';
    const result = await pool.query(
      'INSERT INTO users (email, password, name, role) VALUES ($1, $2, $3, $4) RETURNING id, email, name, role',
      [email, hashedPassword, name, validRole]
    );
    res.status(201).json({ user: result.rows[0], message: 'Registration successful' });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Request Password Reset
app.post('/api/auth/request-reset', async (req, res) => {
  res.status(503).json({ error: 'Password reset delivery is not configured. Contact an authorized administrator without sending credentials over email.' });
});

// The legacy direct-by-email reset was an account-takeover vulnerability.
app.post('/api/auth/reset-password', async (req, res) => {
  res.status(410).json({ error: 'Direct password reset is disabled. Use authenticated password change or an administrator-approved recovery process.' });
});

// Change Password
app.put('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ error: 'Current and new password required' });
    if (!validatePassword(newPassword)) return res.status(400).json({ error: 'Password must be 12+ chars with uppercase, lowercase, and number' });

    const user = await pool.query('SELECT * FROM users WHERE id = $1', [req.user.id]);
    if (user.rows.length === 0) return res.status(404).json({ error: 'User not found' });

    const valid = await bcrypt.compare(currentPassword, user.rows[0].password);
    if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password = $1, updated_at = NOW() WHERE id = $2', [hashedPassword, req.user.id]);
    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get Profile
app.get('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, created_at FROM users WHERE id = $1', [req.user.id]);
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// Update Profile
app.put('/api/auth/profile', authenticateToken, async (req, res) => {
  try {
    const { name, email } = req.body;
    if (!name || name.trim().length < 2) return res.status(400).json({ error: 'Name must be at least 2 characters' });
    if (!email || !validateEmail(email)) return res.status(400).json({ error: 'Valid email is required' });

    const existing = await pool.query('SELECT id FROM users WHERE email = $1 AND id != $2', [email, req.user.id]);
    if (existing.rows.length > 0) return res.status(409).json({ error: 'Email already in use' });

    const result = await pool.query(
      'UPDATE users SET name = $1, email = $2, updated_at = NOW() WHERE id = $3 RETURNING id, email, name, role',
      [name, email, req.user.id]
    );
    res.json({ user: result.rows[0], message: 'Profile updated' });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== COMPANIES ROUTES ====================

// Get all companies (paginated)
app.get('/api/companies', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [dataRes, countRes] = await Promise.all([
      pool.query('SELECT * FROM companies ORDER BY created_at DESC LIMIT $1 OFFSET $2', [limit, offset]),
      pool.query('SELECT COUNT(*) FROM companies')
    ]);
    const total = parseInt(countRes.rows[0].count);
    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching companies:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get single company
app.get('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching company:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Create company
app.post('/api/companies', authenticateToken, async (req, res) => {
  try {
    const { name, industry, revenue, employees, headquarters, website, description, status } = req.body;
    const errors = {};
    if (!name || (typeof name === 'string' && !name.trim())) errors.name = 'name is required';
    if (!industry || (typeof industry === 'string' && !industry.trim())) errors.industry = 'industry is required';
    if (Object.keys(errors).length > 0) return res.status(400).json({ error: 'Validation failed', errors });
    const result = await pool.query(
      `INSERT INTO companies (name, industry, revenue, employees, headquarters, website, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name.trim(), industry.trim(), revenue, employees, headquarters, website, description, status || 'Under Review']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating company:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Update company
app.put('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const { name, industry, revenue, employees, headquarters, website, description, status } = req.body;
    const result = await pool.query(
      `UPDATE companies SET name = $1, industry = $2, revenue = $3, employees = $4,
       headquarters = $5, website = $6, description = $7, status = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [name, industry, revenue, employees, headquarters, website, description, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating company:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete company
app.delete('/api/companies/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM companies WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }
    res.json({ message: 'Company deleted successfully' });
  } catch (error) {
    console.error('Error deleting company:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI: Analyze company
app.post('/api/companies/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const company = await pool.query('SELECT * FROM companies WHERE id = $1', [req.params.id]);
    if (company.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const c = company.rows[0];
    const prompt = `Analyze this company for M&A due diligence:
    Name: ${c.name}
    Industry: ${c.industry}
    Revenue: ${c.revenue}
    Employees: ${c.employees}
    Headquarters: ${c.headquarters}
    Description: ${c.description}

    Provide a comprehensive analysis including:
    1. Market Position Assessment
    2. Growth Potential Analysis
    3. Key Considerations for Acquisition
    4. Potential Synergies
    5. Risk Factors
    6. Recommended Next Steps`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE companies SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing company:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== FINANCIAL ANALYSIS ROUTES ====================

app.get('/api/financials', authenticateToken, async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));
    const offset = (page - 1) * limit;
    const [dataRes, countRes] = await Promise.all([
      pool.query(`
        SELECT f.*, c.name as company_name
        FROM financial_analysis f
        LEFT JOIN companies c ON f.company_id = c.id
        ORDER BY f.created_at DESC LIMIT $1 OFFSET $2
      `, [limit, offset]),
      pool.query('SELECT COUNT(*) FROM financial_analysis')
    ]);
    const total = parseInt(countRes.rows[0].count);
    res.json({
      data: dataRes.rows,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) }
    });
  } catch (error) {
    console.error('Error fetching financials:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/financials/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, c.name as company_name
      FROM financial_analysis f
      LEFT JOIN companies c ON f.company_id = c.id
      WHERE f.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching financial:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/financials', authenticateToken, async (req, res) => {
  try {
    const { company_id, fiscal_year, revenue, net_income, total_assets, total_liabilities, ebitda, gross_margin, operating_margin, debt_to_equity } = req.body;
    const result = await pool.query(
      `INSERT INTO financial_analysis (company_id, fiscal_year, revenue, net_income, total_assets, total_liabilities, ebitda, gross_margin, operating_margin, debt_to_equity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [company_id, fiscal_year, revenue, net_income, total_assets, total_liabilities, ebitda, gross_margin, operating_margin, debt_to_equity]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating financial:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/financials/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, fiscal_year, revenue, net_income, total_assets, total_liabilities, ebitda, gross_margin, operating_margin, debt_to_equity } = req.body;
    const result = await pool.query(
      `UPDATE financial_analysis SET company_id = $1, fiscal_year = $2, revenue = $3, net_income = $4,
       total_assets = $5, total_liabilities = $6, ebitda = $7, gross_margin = $8, operating_margin = $9,
       debt_to_equity = $10, updated_at = NOW() WHERE id = $11 RETURNING *`,
      [company_id, fiscal_year, revenue, net_income, total_assets, total_liabilities, ebitda, gross_margin, operating_margin, debt_to_equity, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating financial:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/financials/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM financial_analysis WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }
    res.json({ message: 'Financial record deleted successfully' });
  } catch (error) {
    console.error('Error deleting financial:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/financials/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT f.*, c.name as company_name
      FROM financial_analysis f
      LEFT JOIN companies c ON f.company_id = c.id
      WHERE f.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Financial record not found' });
    }

    const f = result.rows[0];
    const prompt = `Analyze these financial metrics for M&A due diligence:
    Company: ${f.company_name}
    Fiscal Year: ${f.fiscal_year}
    Revenue: $${f.revenue}
    Net Income: $${f.net_income}
    Total Assets: $${f.total_assets}
    Total Liabilities: $${f.total_liabilities}
    EBITDA: $${f.ebitda}
    Gross Margin: ${f.gross_margin}%
    Operating Margin: ${f.operating_margin}%
    Debt to Equity: ${f.debt_to_equity}

    Provide comprehensive financial analysis including:
    1. Financial Health Assessment
    2. Profitability Analysis
    3. Leverage and Liquidity Review
    4. Valuation Considerations
    5. Key Financial Risks
    6. Recommendations`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE financial_analysis SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing financials:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== NEWS MONITORING ROUTES ====================

app.get('/api/news', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, c.name as company_name
      FROM news_monitoring n
      LEFT JOIN companies c ON n.company_id = c.id
      ORDER BY n.published_date DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/news/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, c.name as company_name
      FROM news_monitoring n
      LEFT JOIN companies c ON n.company_id = c.id
      WHERE n.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/news', authenticateToken, async (req, res) => {
  try {
    const { company_id, title, source, url, summary, sentiment, published_date, category } = req.body;
    const result = await pool.query(
      `INSERT INTO news_monitoring (company_id, title, source, url, summary, sentiment, published_date, category)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [company_id, title, source, url, summary, sentiment || 'Neutral', published_date, category]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/news/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, title, source, url, summary, sentiment, published_date, category } = req.body;
    const result = await pool.query(
      `UPDATE news_monitoring SET company_id = $1, title = $2, source = $3, url = $4,
       summary = $5, sentiment = $6, published_date = $7, category = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [company_id, title, source, url, summary, sentiment, published_date, category, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/news/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM news_monitoring WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }
    res.json({ message: 'News article deleted successfully' });
  } catch (error) {
    console.error('Error deleting news:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/news/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT n.*, c.name as company_name
      FROM news_monitoring n
      LEFT JOIN companies c ON n.company_id = c.id
      WHERE n.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'News article not found' });
    }

    const n = result.rows[0];
    const prompt = `Analyze this news article for M&A due diligence implications:
    Company: ${n.company_name}
    Title: ${n.title}
    Source: ${n.source}
    Category: ${n.category}
    Summary: ${n.summary}

    Provide comprehensive analysis including:
    1. Sentiment Analysis
    2. Potential Impact on Deal Valuation
    3. Market Perception Implications
    4. Risk Assessment
    5. Recommended Actions`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE news_monitoring SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing news:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== RISK ASSESSMENT ROUTES ====================

app.get('/api/risks', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, c.name as company_name
      FROM risk_assessment r
      LEFT JOIN companies c ON r.company_id = c.id
      ORDER BY r.severity DESC, r.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching risks:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/risks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, c.name as company_name
      FROM risk_assessment r
      LEFT JOIN companies c ON r.company_id = c.id
      WHERE r.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching risk:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/risks', authenticateToken, async (req, res) => {
  try {
    const { company_id, risk_type, title, description, severity, likelihood, impact, mitigation_strategy, status } = req.body;
    const result = await pool.query(
      `INSERT INTO risk_assessment (company_id, risk_type, title, description, severity, likelihood, impact, mitigation_strategy, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [company_id, risk_type, title, description, severity, likelihood, impact, mitigation_strategy, status || 'Open']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating risk:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/risks/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, risk_type, title, description, severity, likelihood, impact, mitigation_strategy, status } = req.body;
    const result = await pool.query(
      `UPDATE risk_assessment SET company_id = $1, risk_type = $2, title = $3, description = $4,
       severity = $5, likelihood = $6, impact = $7, mitigation_strategy = $8, status = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [company_id, risk_type, title, description, severity, likelihood, impact, mitigation_strategy, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating risk:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/risks/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM risk_assessment WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }
    res.json({ message: 'Risk deleted successfully' });
  } catch (error) {
    console.error('Error deleting risk:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/risks/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, c.name as company_name
      FROM risk_assessment r
      LEFT JOIN companies c ON r.company_id = c.id
      WHERE r.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk not found' });
    }

    const r = result.rows[0];
    const prompt = `Analyze this risk for M&A due diligence:
    Company: ${r.company_name}
    Risk Type: ${r.risk_type}
    Title: ${r.title}
    Description: ${r.description}
    Severity: ${r.severity}
    Likelihood: ${r.likelihood}
    Impact: ${r.impact}
    Current Mitigation: ${r.mitigation_strategy}

    Provide comprehensive risk analysis including:
    1. Detailed Risk Assessment
    2. Potential Deal Impact
    3. Financial Exposure Estimate
    4. Enhanced Mitigation Strategies
    5. Monitoring Recommendations
    6. Deal Structuring Considerations`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE risk_assessment SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing risk:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== RED FLAGS ROUTES ====================

app.get('/api/redflags', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rf.*, c.name as company_name
      FROM red_flags rf
      LEFT JOIN companies c ON rf.company_id = c.id
      ORDER BY rf.priority DESC, rf.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching red flags:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/redflags/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rf.*, c.name as company_name
      FROM red_flags rf
      LEFT JOIN companies c ON rf.company_id = c.id
      WHERE rf.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching red flag:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/redflags', authenticateToken, async (req, res) => {
  try {
    const { company_id, category, title, description, evidence, priority, recommendation, status } = req.body;
    const result = await pool.query(
      `INSERT INTO red_flags (company_id, category, title, description, evidence, priority, recommendation, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [company_id, category, title, description, evidence, priority, recommendation, status || 'Active']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating red flag:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/redflags/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, category, title, description, evidence, priority, recommendation, status } = req.body;
    const result = await pool.query(
      `UPDATE red_flags SET company_id = $1, category = $2, title = $3, description = $4,
       evidence = $5, priority = $6, recommendation = $7, status = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [company_id, category, title, description, evidence, priority, recommendation, status, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating red flag:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/redflags/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM red_flags WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag not found' });
    }
    res.json({ message: 'Red flag deleted successfully' });
  } catch (error) {
    console.error('Error deleting red flag:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/redflags/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rf.*, c.name as company_name
      FROM red_flags rf
      LEFT JOIN companies c ON rf.company_id = c.id
      WHERE rf.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag not found' });
    }

    const rf = result.rows[0];
    const prompt = `Analyze this red flag for M&A due diligence:
    Company: ${rf.company_name}
    Category: ${rf.category}
    Title: ${rf.title}
    Description: ${rf.description}
    Evidence: ${rf.evidence}
    Priority: ${rf.priority}

    Provide comprehensive analysis including:
    1. Severity Assessment
    2. Deal-Breaker Potential
    3. Financial Impact Estimate
    4. Investigation Recommendations
    5. Mitigation Options
    6. Deal Structuring Implications`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE red_flags SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing red flag:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== MARKET ANALYSIS ROUTES ====================

app.get('/api/market', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, c.name as company_name
      FROM market_analysis m
      LEFT JOIN companies c ON m.company_id = c.id
      ORDER BY m.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching market analysis:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/market/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, c.name as company_name
      FROM market_analysis m
      LEFT JOIN companies c ON m.company_id = c.id
      WHERE m.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market analysis not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching market analysis:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/market', authenticateToken, async (req, res) => {
  try {
    const { company_id, market_size, market_growth_rate, market_share, competitive_position, target_segments, geographic_presence, trends } = req.body;
    const result = await pool.query(
      `INSERT INTO market_analysis (company_id, market_size, market_growth_rate, market_share, competitive_position, target_segments, geographic_presence, trends)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [company_id, market_size, market_growth_rate, market_share, competitive_position, target_segments, geographic_presence, trends]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating market analysis:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/market/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, market_size, market_growth_rate, market_share, competitive_position, target_segments, geographic_presence, trends } = req.body;
    const result = await pool.query(
      `UPDATE market_analysis SET company_id = $1, market_size = $2, market_growth_rate = $3,
       market_share = $4, competitive_position = $5, target_segments = $6, geographic_presence = $7,
       trends = $8, updated_at = NOW() WHERE id = $9 RETURNING *`,
      [company_id, market_size, market_growth_rate, market_share, competitive_position, target_segments, geographic_presence, trends, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market analysis not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating market analysis:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/market/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM market_analysis WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market analysis not found' });
    }
    res.json({ message: 'Market analysis deleted successfully' });
  } catch (error) {
    console.error('Error deleting market analysis:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/market/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT m.*, c.name as company_name
      FROM market_analysis m
      LEFT JOIN companies c ON m.company_id = c.id
      WHERE m.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Market analysis not found' });
    }

    const m = result.rows[0];
    const prompt = `Analyze this market data for M&A due diligence:
    Company: ${m.company_name}
    Market Size: $${m.market_size}
    Growth Rate: ${m.market_growth_rate}%
    Market Share: ${m.market_share}%
    Competitive Position: ${m.competitive_position}
    Target Segments: ${m.target_segments}
    Geographic Presence: ${m.geographic_presence}
    Trends: ${m.trends}

    Provide comprehensive market analysis including:
    1. Market Opportunity Assessment
    2. Growth Potential Analysis
    3. Competitive Landscape Review
    4. Strategic Fit Evaluation
    5. Market Entry/Expansion Recommendations
    6. Key Success Factors`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE market_analysis SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing market:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== COMPETITIVE INTELLIGENCE ROUTES ====================

app.get('/api/competitors', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.*, c.name as company_name
      FROM competitive_intelligence ci
      LEFT JOIN companies c ON ci.company_id = c.id
      ORDER BY ci.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching competitors:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.*, c.name as company_name
      FROM competitive_intelligence ci
      LEFT JOIN companies c ON ci.company_id = c.id
      WHERE ci.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/competitors', authenticateToken, async (req, res) => {
  try {
    const { company_id, competitor_name, market_share, strengths, weaknesses, strategy, threat_level, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO competitive_intelligence (company_id, competitor_name, market_share, strengths, weaknesses, strategy, threat_level, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [company_id, competitor_name, market_share, strengths, weaknesses, strategy, threat_level, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, competitor_name, market_share, strengths, weaknesses, strategy, threat_level, notes } = req.body;
    const result = await pool.query(
      `UPDATE competitive_intelligence SET company_id = $1, competitor_name = $2, market_share = $3,
       strengths = $4, weaknesses = $5, strategy = $6, threat_level = $7, notes = $8, updated_at = NOW()
       WHERE id = $9 RETURNING *`,
      [company_id, competitor_name, market_share, strengths, weaknesses, strategy, threat_level, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/competitors/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM competitive_intelligence WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }
    res.json({ message: 'Competitor deleted successfully' });
  } catch (error) {
    console.error('Error deleting competitor:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/competitors/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.*, c.name as company_name
      FROM competitive_intelligence ci
      LEFT JOIN companies c ON ci.company_id = c.id
      WHERE ci.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Competitor not found' });
    }

    const ci = result.rows[0];
    const prompt = `Analyze this competitive intelligence for M&A due diligence:
    Target Company: ${ci.company_name}
    Competitor: ${ci.competitor_name}
    Competitor Market Share: ${ci.market_share}%
    Strengths: ${ci.strengths}
    Weaknesses: ${ci.weaknesses}
    Strategy: ${ci.strategy}
    Threat Level: ${ci.threat_level}

    Provide comprehensive competitive analysis including:
    1. Competitive Landscape Assessment
    2. Synergy Opportunities
    3. Post-Merger Positioning
    4. Competitive Response Scenarios
    5. Market Share Implications
    6. Strategic Recommendations`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE competitive_intelligence SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing competitor:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== LEGAL COMPLIANCE ROUTES ====================

app.get('/api/legal', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, c.name as company_name
      FROM legal_compliance l
      LEFT JOIN companies c ON l.company_id = c.id
      ORDER BY l.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching legal records:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/legal/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, c.name as company_name
      FROM legal_compliance l
      LEFT JOIN companies c ON l.company_id = c.id
      WHERE l.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Legal record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching legal record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/legal', authenticateToken, async (req, res) => {
  try {
    const { company_id, issue_type, title, description, status, severity, regulatory_body, deadline, resolution } = req.body;
    const result = await pool.query(
      `INSERT INTO legal_compliance (company_id, issue_type, title, description, status, severity, regulatory_body, deadline, resolution)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [company_id, issue_type, title, description, status || 'Open', severity, regulatory_body, deadline, resolution]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating legal record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/legal/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, issue_type, title, description, status, severity, regulatory_body, deadline, resolution } = req.body;
    const result = await pool.query(
      `UPDATE legal_compliance SET company_id = $1, issue_type = $2, title = $3, description = $4,
       status = $5, severity = $6, regulatory_body = $7, deadline = $8, resolution = $9, updated_at = NOW()
       WHERE id = $10 RETURNING *`,
      [company_id, issue_type, title, description, status, severity, regulatory_body, deadline, resolution, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Legal record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating legal record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/legal/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM legal_compliance WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Legal record not found' });
    }
    res.json({ message: 'Legal record deleted successfully' });
  } catch (error) {
    console.error('Error deleting legal record:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/legal/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, c.name as company_name
      FROM legal_compliance l
      LEFT JOIN companies c ON l.company_id = c.id
      WHERE l.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Legal record not found' });
    }

    const l = result.rows[0];
    const prompt = `Analyze this legal/compliance issue for M&A due diligence:
    Company: ${l.company_name}
    Issue Type: ${l.issue_type}
    Title: ${l.title}
    Description: ${l.description}
    Severity: ${l.severity}
    Regulatory Body: ${l.regulatory_body}
    Deadline: ${l.deadline}

    Provide comprehensive legal analysis including:
    1. Legal Exposure Assessment
    2. Potential Liability Estimate
    3. Deal Impact Analysis
    4. Compliance Recommendations
    5. Risk Mitigation Strategies
    6. Deal Structuring Considerations`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE legal_compliance SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing legal issue:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== MANAGEMENT ASSESSMENT ROUTES ====================

app.get('/api/management', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ma.*, c.name as company_name
      FROM management_assessment ma
      LEFT JOIN companies c ON ma.company_id = c.id
      ORDER BY ma.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching management:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/management/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ma.*, c.name as company_name
      FROM management_assessment ma
      LEFT JOIN companies c ON ma.company_id = c.id
      WHERE ma.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Management record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching management:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/management', authenticateToken, async (req, res) => {
  try {
    const { company_id, executive_name, title, experience_years, background, leadership_score, retention_risk, key_strengths, concerns, recommendation } = req.body;
    const result = await pool.query(
      `INSERT INTO management_assessment (company_id, executive_name, title, experience_years, background, leadership_score, retention_risk, key_strengths, concerns, recommendation)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [company_id, executive_name, title, experience_years, background, leadership_score, retention_risk, key_strengths, concerns, recommendation]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating management:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/management/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, executive_name, title, experience_years, background, leadership_score, retention_risk, key_strengths, concerns, recommendation } = req.body;
    const result = await pool.query(
      `UPDATE management_assessment SET company_id = $1, executive_name = $2, title = $3,
       experience_years = $4, background = $5, leadership_score = $6, retention_risk = $7,
       key_strengths = $8, concerns = $9, recommendation = $10, updated_at = NOW()
       WHERE id = $11 RETURNING *`,
      [company_id, executive_name, title, experience_years, background, leadership_score, retention_risk, key_strengths, concerns, recommendation, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Management record not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating management:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/management/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM management_assessment WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Management record not found' });
    }
    res.json({ message: 'Management record deleted successfully' });
  } catch (error) {
    console.error('Error deleting management:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/management/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ma.*, c.name as company_name
      FROM management_assessment ma
      LEFT JOIN companies c ON ma.company_id = c.id
      WHERE ma.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Management record not found' });
    }

    const ma = result.rows[0];
    const prompt = `Analyze this executive for M&A due diligence:
    Company: ${ma.company_name}
    Name: ${ma.executive_name}
    Title: ${ma.title}
    Experience: ${ma.experience_years} years
    Background: ${ma.background}
    Leadership Score: ${ma.leadership_score}/10
    Retention Risk: ${ma.retention_risk}
    Key Strengths: ${ma.key_strengths}
    Concerns: ${ma.concerns}

    Provide comprehensive leadership analysis including:
    1. Leadership Assessment
    2. Retention Recommendations
    3. Post-Merger Role Considerations
    4. Integration Fit Analysis
    5. Development Recommendations
    6. Succession Planning Implications`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE management_assessment SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, saved: true });
  } catch (error) {
    console.error('Error analyzing management:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== DEAL PIPELINE ROUTES ====================

app.get('/api/deals', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, c.name as company_name
      FROM deal_pipeline d
      LEFT JOIN companies c ON d.company_id = c.id
      ORDER BY d.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching deals:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/deals/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, c.name as company_name
      FROM deal_pipeline d
      LEFT JOIN companies c ON d.company_id = c.id
      WHERE d.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching deal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/deals', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, deal_type, stage, valuation, offer_price, expected_close_date, lead_partner, deal_team, priority, notes } = req.body;
    const result = await pool.query(
      `INSERT INTO deal_pipeline (company_id, deal_name, deal_type, stage, valuation, offer_price, expected_close_date, lead_partner, deal_team, priority, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [company_id, deal_name, deal_type, stage || 'Initial Review', valuation, offer_price, expected_close_date, lead_partner, deal_team, priority, notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating deal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/deals/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, deal_type, stage, valuation, offer_price, expected_close_date, lead_partner, deal_team, priority, notes } = req.body;
    const result = await pool.query(
      `UPDATE deal_pipeline SET company_id = $1, deal_name = $2, deal_type = $3, stage = $4,
       valuation = $5, offer_price = $6, expected_close_date = $7, lead_partner = $8,
       deal_team = $9, priority = $10, notes = $11, updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [company_id, deal_name, deal_type, stage, valuation, offer_price, expected_close_date, lead_partner, deal_team, priority, notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating deal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/deals/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM deal_pipeline WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }
    res.json({ message: 'Deal deleted successfully' });
  } catch (error) {
    console.error('Error deleting deal:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/deals/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT d.*, c.name as company_name
      FROM deal_pipeline d
      LEFT JOIN companies c ON d.company_id = c.id
      WHERE d.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Deal not found' });
    }

    const d = result.rows[0];
    const prompt = `Analyze this M&A deal:
    Target Company: ${d.company_name}
    Deal Name: ${d.deal_name}
    Deal Type: ${d.deal_type}
    Stage: ${d.stage}
    Valuation: $${d.valuation}
    Offer Price: $${d.offer_price}
    Expected Close: ${d.expected_close_date}
    Priority: ${d.priority}
    Notes: ${d.notes}

    Provide comprehensive deal analysis including:
    1. Deal Assessment
    2. Valuation Opinion
    3. Key Risk Factors
    4. Due Diligence Priorities
    5. Deal Structuring Recommendations
    6. Recommended Next Steps`;

    const analysis = await callOpenRouterAI(prompt);
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE deal_pipeline SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing deal:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== AI RISK SCORER ROUTES ====================

app.get('/api/risk-scores', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, c.name as company_name
      FROM risk_scores rs
      LEFT JOIN companies c ON rs.company_id = c.id
      ORDER BY rs.overall_risk_score DESC, rs.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching risk scores:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/risk-scores/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, c.name as company_name
      FROM risk_scores rs
      LEFT JOIN companies c ON rs.company_id = c.id
      WHERE rs.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk score not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching risk score:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/risk-scores', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, financial_risk_score, operational_risk_score, market_risk_score, legal_risk_score, integration_risk_score, overall_risk_score, risk_category, key_risk_factors, risk_mitigation_suggestions, confidence_level } = req.body;
    const result = await pool.query(
      `INSERT INTO risk_scores (company_id, deal_name, financial_risk_score, operational_risk_score, market_risk_score, legal_risk_score, integration_risk_score, overall_risk_score, risk_category, key_risk_factors, risk_mitigation_suggestions, confidence_level)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [company_id, deal_name, financial_risk_score, operational_risk_score, market_risk_score, legal_risk_score, integration_risk_score, overall_risk_score, risk_category, key_risk_factors, risk_mitigation_suggestions, confidence_level]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating risk score:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/risk-scores/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, financial_risk_score, operational_risk_score, market_risk_score, legal_risk_score, integration_risk_score, overall_risk_score, risk_category, key_risk_factors, risk_mitigation_suggestions, confidence_level } = req.body;
    const result = await pool.query(
      `UPDATE risk_scores SET company_id = $1, deal_name = $2, financial_risk_score = $3, operational_risk_score = $4, market_risk_score = $5, legal_risk_score = $6, integration_risk_score = $7, overall_risk_score = $8, risk_category = $9, key_risk_factors = $10, risk_mitigation_suggestions = $11, confidence_level = $12, updated_at = NOW()
       WHERE id = $13 RETURNING *`,
      [company_id, deal_name, financial_risk_score, operational_risk_score, market_risk_score, legal_risk_score, integration_risk_score, overall_risk_score, risk_category, key_risk_factors, risk_mitigation_suggestions, confidence_level, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk score not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating risk score:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/risk-scores/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM risk_scores WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk score not found' });
    }
    res.json({ message: 'Risk score deleted successfully' });
  } catch (error) {
    console.error('Error deleting risk score:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI: Generate Risk Score Analysis
app.post('/api/risk-scores/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rs.*, c.name as company_name
      FROM risk_scores rs
      LEFT JOIN companies c ON rs.company_id = c.id
      WHERE rs.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Risk score not found' });
    }

    const rs = result.rows[0];
    const prompt = `As an expert M&A risk analyst, provide a comprehensive risk assessment for this deal:

DEAL INFORMATION:
- Company: ${rs.company_name}
- Deal Name: ${rs.deal_name}

CURRENT RISK SCORES (1-10 scale, higher = more risk):
- Financial Risk: ${rs.financial_risk_score}/10
- Operational Risk: ${rs.operational_risk_score}/10
- Market Risk: ${rs.market_risk_score}/10
- Legal Risk: ${rs.legal_risk_score}/10
- Integration Risk: ${rs.integration_risk_score}/10
- Overall Risk Score: ${rs.overall_risk_score}/10
- Risk Category: ${rs.risk_category}
- Confidence Level: ${rs.confidence_level}%

IDENTIFIED KEY RISK FACTORS:
${rs.key_risk_factors}

CURRENT MITIGATION SUGGESTIONS:
${rs.risk_mitigation_suggestions}

Please provide:

## EXECUTIVE RISK SUMMARY
Brief overview of the deal's risk profile and key takeaways.

## RISK SCORE ANALYSIS
### Financial Risk Assessment
Analysis of the financial risk score and underlying factors.

### Operational Risk Assessment
Analysis of operational risk factors and business continuity concerns.

### Market Risk Assessment
Market dynamics, competitive threats, and industry risks.

### Legal & Regulatory Risk Assessment
Compliance, litigation, and regulatory exposure analysis.

### Integration Risk Assessment
Post-merger integration challenges and complexity factors.

## RISK-ADJUSTED RECOMMENDATIONS
### Deal Structuring Considerations
How to structure the deal to mitigate identified risks.

### Due Diligence Priorities
Critical areas requiring deeper investigation.

### Mitigation Strategies
Specific actions to reduce risk exposure.

### Go/No-Go Recommendation
Overall assessment with confidence level.`;

    const analysis = await callOpenRouterAI(prompt, 'You are an expert M&A risk analyst specializing in quantitative risk assessment and deal structuring. Provide detailed, actionable analysis with clear recommendations.');
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE risk_scores SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing risk score:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== AI SYNERGY CALCULATOR ROUTES ====================

app.get('/api/synergies', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sc.*, c.name as company_name
      FROM synergy_calculations sc
      LEFT JOIN companies c ON sc.company_id = c.id
      ORDER BY sc.total_synergy DESC, sc.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching synergies:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/synergies/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sc.*, c.name as company_name
      FROM synergy_calculations sc
      LEFT JOIN companies c ON sc.company_id = c.id
      WHERE sc.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Synergy calculation not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching synergy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/synergies', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, acquirer_name, revenue_synergy, cost_synergy, tax_synergy, total_synergy, synergy_timeline_months, probability_of_achievement, synergy_categories, implementation_costs, net_synergy_value } = req.body;
    const result = await pool.query(
      `INSERT INTO synergy_calculations (company_id, deal_name, acquirer_name, revenue_synergy, cost_synergy, tax_synergy, total_synergy, synergy_timeline_months, probability_of_achievement, synergy_categories, implementation_costs, net_synergy_value)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING *`,
      [company_id, deal_name, acquirer_name, revenue_synergy, cost_synergy, tax_synergy, total_synergy, synergy_timeline_months, probability_of_achievement, synergy_categories, implementation_costs, net_synergy_value]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating synergy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/synergies/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, acquirer_name, revenue_synergy, cost_synergy, tax_synergy, total_synergy, synergy_timeline_months, probability_of_achievement, synergy_categories, implementation_costs, net_synergy_value } = req.body;
    const result = await pool.query(
      `UPDATE synergy_calculations SET company_id = $1, deal_name = $2, acquirer_name = $3, revenue_synergy = $4, cost_synergy = $5, tax_synergy = $6, total_synergy = $7, synergy_timeline_months = $8, probability_of_achievement = $9, synergy_categories = $10, implementation_costs = $11, net_synergy_value = $12, updated_at = NOW()
       WHERE id = $13 RETURNING *`,
      [company_id, deal_name, acquirer_name, revenue_synergy, cost_synergy, tax_synergy, total_synergy, synergy_timeline_months, probability_of_achievement, synergy_categories, implementation_costs, net_synergy_value, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Synergy calculation not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating synergy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/synergies/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM synergy_calculations WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Synergy calculation not found' });
    }
    res.json({ message: 'Synergy calculation deleted successfully' });
  } catch (error) {
    console.error('Error deleting synergy:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI: Generate Synergy Analysis
app.post('/api/synergies/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT sc.*, c.name as company_name
      FROM synergy_calculations sc
      LEFT JOIN companies c ON sc.company_id = c.id
      WHERE sc.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Synergy calculation not found' });
    }

    const sc = result.rows[0];
    const prompt = `As an expert M&A synergy analyst, provide a comprehensive synergy assessment for this merger:

DEAL INFORMATION:
- Target Company: ${sc.company_name}
- Acquirer: ${sc.acquirer_name}
- Deal Name: ${sc.deal_name}

SYNERGY ESTIMATES:
- Revenue Synergies: $${(sc.revenue_synergy / 1000000).toFixed(1)}M
- Cost Synergies: $${(sc.cost_synergy / 1000000).toFixed(1)}M
- Tax Synergies: $${(sc.tax_synergy / 1000000).toFixed(1)}M
- Total Gross Synergies: $${(sc.total_synergy / 1000000).toFixed(1)}M
- Implementation Costs: $${(sc.implementation_costs / 1000000).toFixed(1)}M
- Net Synergy Value: $${(sc.net_synergy_value / 1000000).toFixed(1)}M

TIMELINE & PROBABILITY:
- Achievement Timeline: ${sc.synergy_timeline_months} months
- Probability of Achievement: ${sc.probability_of_achievement}%

SYNERGY CATEGORIES:
${sc.synergy_categories}

Please provide:

## EXECUTIVE SYNERGY SUMMARY
High-level overview of synergy potential and value creation opportunity.

## REVENUE SYNERGY ANALYSIS
### Cross-Selling Opportunities
Potential to sell existing products to new customer base.

### Market Expansion
Geographic and segment expansion possibilities.

### Pricing Power
Combined market position impact on pricing.

## COST SYNERGY ANALYSIS
### Operational Efficiencies
Manufacturing, logistics, and process improvements.

### Administrative Consolidation
Shared services and overhead reduction.

### Procurement Savings
Combined purchasing power and vendor negotiations.

## TAX SYNERGY ANALYSIS
Tax optimization opportunities and structure considerations.

## IMPLEMENTATION ROADMAP
### Quick Wins (0-6 months)
Immediately achievable synergies.

### Medium-Term (6-18 months)
Synergies requiring moderate integration effort.

### Long-Term (18-36 months)
Complex synergies requiring full integration.

## RISK FACTORS
Key risks that could impact synergy realization.

## PROBABILITY-WEIGHTED VALUATION
Expected value calculation with risk adjustments.`;

    const analysis = await callOpenRouterAI(prompt, 'You are an expert M&A synergy analyst specializing in merger integration and value creation. Provide detailed, realistic synergy assessments with implementation roadmaps.');
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE synergy_calculations SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing synergy:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== AI VALUATION MODELER ROUTES ====================

app.get('/api/valuations', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vm.*, c.name as company_name
      FROM valuation_models vm
      LEFT JOIN companies c ON vm.company_id = c.id
      ORDER BY vm.weighted_average_valuation DESC, vm.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching valuations:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/valuations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vm.*, c.name as company_name
      FROM valuation_models vm
      LEFT JOIN companies c ON vm.company_id = c.id
      WHERE vm.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valuation model not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching valuation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/valuations', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, dcf_valuation, comparable_companies_valuation, precedent_transactions_valuation, lbo_valuation, asset_based_valuation, weighted_average_valuation, valuation_range_low, valuation_range_high, implied_ev_ebitda_multiple, implied_ev_revenue_multiple, key_assumptions } = req.body;
    const result = await pool.query(
      `INSERT INTO valuation_models (company_id, deal_name, dcf_valuation, comparable_companies_valuation, precedent_transactions_valuation, lbo_valuation, asset_based_valuation, weighted_average_valuation, valuation_range_low, valuation_range_high, implied_ev_ebitda_multiple, implied_ev_revenue_multiple, key_assumptions)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [company_id, deal_name, dcf_valuation, comparable_companies_valuation, precedent_transactions_valuation, lbo_valuation, asset_based_valuation, weighted_average_valuation, valuation_range_low, valuation_range_high, implied_ev_ebitda_multiple, implied_ev_revenue_multiple, key_assumptions]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating valuation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/valuations/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, dcf_valuation, comparable_companies_valuation, precedent_transactions_valuation, lbo_valuation, asset_based_valuation, weighted_average_valuation, valuation_range_low, valuation_range_high, implied_ev_ebitda_multiple, implied_ev_revenue_multiple, key_assumptions } = req.body;
    const result = await pool.query(
      `UPDATE valuation_models SET company_id = $1, deal_name = $2, dcf_valuation = $3, comparable_companies_valuation = $4, precedent_transactions_valuation = $5, lbo_valuation = $6, asset_based_valuation = $7, weighted_average_valuation = $8, valuation_range_low = $9, valuation_range_high = $10, implied_ev_ebitda_multiple = $11, implied_ev_revenue_multiple = $12, key_assumptions = $13, updated_at = NOW()
       WHERE id = $14 RETURNING *`,
      [company_id, deal_name, dcf_valuation, comparable_companies_valuation, precedent_transactions_valuation, lbo_valuation, asset_based_valuation, weighted_average_valuation, valuation_range_low, valuation_range_high, implied_ev_ebitda_multiple, implied_ev_revenue_multiple, key_assumptions, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valuation model not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating valuation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/valuations/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM valuation_models WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valuation model not found' });
    }
    res.json({ message: 'Valuation model deleted successfully' });
  } catch (error) {
    console.error('Error deleting valuation:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI: Generate Valuation Analysis
app.post('/api/valuations/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT vm.*, c.name as company_name
      FROM valuation_models vm
      LEFT JOIN companies c ON vm.company_id = c.id
      WHERE vm.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Valuation model not found' });
    }

    const vm = result.rows[0];
    const prompt = `As an expert M&A valuation specialist, provide a comprehensive valuation analysis for this deal:

DEAL INFORMATION:
- Company: ${vm.company_name}
- Deal Name: ${vm.deal_name}

VALUATION METHODS RESULTS:
- DCF Valuation: $${(vm.dcf_valuation / 1000000).toFixed(1)}M
- Comparable Companies: $${(vm.comparable_companies_valuation / 1000000).toFixed(1)}M
- Precedent Transactions: $${(vm.precedent_transactions_valuation / 1000000).toFixed(1)}M
- LBO Analysis: $${(vm.lbo_valuation / 1000000).toFixed(1)}M
- Asset-Based: $${(vm.asset_based_valuation / 1000000).toFixed(1)}M

SUMMARY METRICS:
- Weighted Average Valuation: $${(vm.weighted_average_valuation / 1000000).toFixed(1)}M
- Valuation Range: $${(vm.valuation_range_low / 1000000).toFixed(1)}M - $${(vm.valuation_range_high / 1000000).toFixed(1)}M
- Implied EV/EBITDA Multiple: ${vm.implied_ev_ebitda_multiple}x
- Implied EV/Revenue Multiple: ${vm.implied_ev_revenue_multiple}x

KEY ASSUMPTIONS:
${vm.key_assumptions}

Please provide:

## EXECUTIVE VALUATION SUMMARY
Overview of valuation conclusion and key considerations.

## DCF ANALYSIS REVIEW
### Model Assessment
Evaluation of DCF methodology and assumptions.

### Sensitivity Analysis Insights
Key drivers and their impact on valuation.

### Terminal Value Considerations
Long-term growth and exit multiple assumptions.

## COMPARABLE COMPANIES ANALYSIS
### Peer Selection Assessment
Appropriateness of comparable company selection.

### Multiple Analysis
EV/EBITDA, EV/Revenue, and P/E multiple comparisons.

### Premium/Discount Factors
Adjustments for size, growth, and risk differences.

## PRECEDENT TRANSACTIONS ANALYSIS
### Transaction Selection Review
Relevance of selected precedent deals.

### Control Premium Analysis
Historical control premiums and applicability.

### Market Conditions Adjustment
Current vs. historical market environment.

## LBO PERSPECTIVE
### Sponsor Return Analysis
IRR expectations and capital structure.

### Debt Capacity Assessment
Leverage and coverage ratio analysis.

## VALUATION CONCLUSION
### Recommended Valuation Range
Supported price range with confidence level.

### Negotiation Strategy
Entry price vs. walk-away threshold.

### Key Value Drivers
Factors that could move valuation up or down.`;

    const analysis = await callOpenRouterAI(prompt, 'You are an expert M&A valuation specialist with deep experience in DCF modeling, comparable analysis, and deal structuring. Provide detailed, well-supported valuation opinions.');
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE valuation_models SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, saved: true });
  } catch (error) {
    console.error('Error analyzing valuation:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== AI RED FLAG DETECTOR ROUTES ====================

app.get('/api/red-flag-detections', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rfd.*, c.name as company_name
      FROM red_flag_detections rfd
      LEFT JOIN companies c ON rfd.company_id = c.id
      ORDER BY rfd.deal_breaker_potential DESC, rfd.severity_level DESC, rfd.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching red flag detections:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/red-flag-detections/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rfd.*, c.name as company_name
      FROM red_flag_detections rfd
      LEFT JOIN companies c ON rfd.company_id = c.id
      WHERE rfd.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag detection not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching red flag detection:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/red-flag-detections', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, flag_type, severity_level, flag_title, flag_description, supporting_evidence, deal_breaker_potential, recommended_action, investigation_status, resolution_notes } = req.body;
    const result = await pool.query(
      `INSERT INTO red_flag_detections (company_id, deal_name, flag_type, severity_level, flag_title, flag_description, supporting_evidence, deal_breaker_potential, recommended_action, investigation_status, resolution_notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
      [company_id, deal_name, flag_type, severity_level, flag_title, flag_description, supporting_evidence, deal_breaker_potential || false, recommended_action, investigation_status || 'Pending', resolution_notes]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating red flag detection:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/red-flag-detections/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, flag_type, severity_level, flag_title, flag_description, supporting_evidence, deal_breaker_potential, recommended_action, investigation_status, resolution_notes } = req.body;
    const result = await pool.query(
      `UPDATE red_flag_detections SET company_id = $1, deal_name = $2, flag_type = $3, severity_level = $4, flag_title = $5, flag_description = $6, supporting_evidence = $7, deal_breaker_potential = $8, recommended_action = $9, investigation_status = $10, resolution_notes = $11, updated_at = NOW()
       WHERE id = $12 RETURNING *`,
      [company_id, deal_name, flag_type, severity_level, flag_title, flag_description, supporting_evidence, deal_breaker_potential, recommended_action, investigation_status, resolution_notes, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag detection not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating red flag detection:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/red-flag-detections/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM red_flag_detections WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag detection not found' });
    }
    res.json({ message: 'Red flag detection deleted successfully' });
  } catch (error) {
    console.error('Error deleting red flag detection:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI: Generate Red Flag Analysis
app.post('/api/red-flag-detections/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT rfd.*, c.name as company_name
      FROM red_flag_detections rfd
      LEFT JOIN companies c ON rfd.company_id = c.id
      WHERE rfd.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Red flag detection not found' });
    }

    const rfd = result.rows[0];
    const prompt = `As an expert M&A due diligence specialist, provide a comprehensive analysis of this identified red flag:

DEAL INFORMATION:
- Company: ${rfd.company_name}
- Deal Name: ${rfd.deal_name}

RED FLAG DETAILS:
- Type: ${rfd.flag_type}
- Severity Level: ${rfd.severity_level}
- Title: ${rfd.flag_title}
- Description: ${rfd.flag_description}
- Deal Breaker Potential: ${rfd.deal_breaker_potential ? 'YES' : 'NO'}
- Investigation Status: ${rfd.investigation_status}

SUPPORTING EVIDENCE:
${rfd.supporting_evidence}

CURRENT RECOMMENDED ACTION:
${rfd.recommended_action}

Please provide:

## EXECUTIVE SUMMARY
Critical assessment of the red flag and its deal implications.

## SEVERITY ASSESSMENT
### Impact Analysis
Potential financial and operational impact.

### Probability Assessment
Likelihood of worst-case scenario materializing.

### Deal-Breaker Evaluation
Whether this should be a go/no-go factor.

## ROOT CAUSE ANALYSIS
### Underlying Issues
What systemic problems does this red flag indicate?

### Pattern Recognition
Is this an isolated issue or part of a broader pattern?

## INVESTIGATION RECOMMENDATIONS
### Immediate Actions
Steps to take in the next 48-72 hours.

### Deep Dive Requirements
Areas requiring thorough investigation.

### External Expert Needs
Specialists that should be engaged.

## MITIGATION STRATEGIES
### Deal Structure Options
How to structure the deal to protect against this risk.

### Contractual Protections
Representations, warranties, and indemnifications needed.

### Price Adjustment Considerations
Potential valuation impact and negotiation leverage.

## RESOLUTION PATH
### Timeline for Resolution
Expected timeframe to resolve or understand the issue.

### Success Criteria
What would need to happen to clear this red flag.

### Escalation Triggers
When to escalate to deal committee or board.`;

    const analysis = await callOpenRouterAI(prompt, 'You are an expert M&A due diligence specialist with deep experience in identifying and assessing deal risks. Provide thorough, actionable analysis of potential deal-breakers.');
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE red_flag_detections SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, saved: true });
  } catch (error) {
    console.error('Error analyzing red flag detection:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== AI INTEGRATION PLANNER ROUTES ====================

app.get('/api/integration-plans', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ip.*, c.name as company_name
      FROM integration_plans ip
      LEFT JOIN companies c ON ip.company_id = c.id
      ORDER BY ip.created_at DESC
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching integration plans:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.get('/api/integration-plans/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ip.*, c.name as company_name
      FROM integration_plans ip
      LEFT JOIN companies c ON ip.company_id = c.id
      WHERE ip.id = $1
    `, [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration plan not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error fetching integration plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.post('/api/integration-plans', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, integration_approach, day_one_priorities, first_100_days_plan, organizational_structure, technology_integration, cultural_integration, key_milestones, estimated_integration_costs, integration_timeline_months, risk_mitigation_plan, success_metrics } = req.body;
    const result = await pool.query(
      `INSERT INTO integration_plans (company_id, deal_name, integration_approach, day_one_priorities, first_100_days_plan, organizational_structure, technology_integration, cultural_integration, key_milestones, estimated_integration_costs, integration_timeline_months, risk_mitigation_plan, success_metrics)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING *`,
      [company_id, deal_name, integration_approach, day_one_priorities, first_100_days_plan, organizational_structure, technology_integration, cultural_integration, key_milestones, estimated_integration_costs, integration_timeline_months, risk_mitigation_plan, success_metrics]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Error creating integration plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/integration-plans/:id', authenticateToken, async (req, res) => {
  try {
    const { company_id, deal_name, integration_approach, day_one_priorities, first_100_days_plan, organizational_structure, technology_integration, cultural_integration, key_milestones, estimated_integration_costs, integration_timeline_months, risk_mitigation_plan, success_metrics } = req.body;
    const result = await pool.query(
      `UPDATE integration_plans SET company_id = $1, deal_name = $2, integration_approach = $3, day_one_priorities = $4, first_100_days_plan = $5, organizational_structure = $6, technology_integration = $7, cultural_integration = $8, key_milestones = $9, estimated_integration_costs = $10, integration_timeline_months = $11, risk_mitigation_plan = $12, success_metrics = $13, updated_at = NOW()
       WHERE id = $14 RETURNING *`,
      [company_id, deal_name, integration_approach, day_one_priorities, first_100_days_plan, organizational_structure, technology_integration, cultural_integration, key_milestones, estimated_integration_costs, integration_timeline_months, risk_mitigation_plan, success_metrics, req.params.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration plan not found' });
    }
    res.json(result.rows[0]);
  } catch (error) {
    console.error('Error updating integration plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

app.delete('/api/integration-plans/:id', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM integration_plans WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration plan not found' });
    }
    res.json({ message: 'Integration plan deleted successfully' });
  } catch (error) {
    console.error('Error deleting integration plan:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// AI: Generate Integration Plan Analysis
app.post('/api/integration-plans/:id/analyze', authenticateToken, aiRateLimiter, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ip.*, c.name as company_name
      FROM integration_plans ip
      LEFT JOIN companies c ON ip.company_id = c.id
      WHERE ip.id = $1
    `, [req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Integration plan not found' });
    }

    const ip = result.rows[0];
    const prompt = `As an expert post-merger integration specialist, provide a comprehensive analysis and recommendations for this integration plan:

DEAL INFORMATION:
- Target Company: ${ip.company_name}
- Deal Name: ${ip.deal_name}

INTEGRATION OVERVIEW:
- Integration Approach: ${ip.integration_approach}
- Timeline: ${ip.integration_timeline_months} months
- Estimated Costs: $${(ip.estimated_integration_costs / 1000000).toFixed(1)}M

DAY ONE PRIORITIES:
${ip.day_one_priorities}

FIRST 100 DAYS PLAN:
${ip.first_100_days_plan}

ORGANIZATIONAL STRUCTURE:
${ip.organizational_structure}

TECHNOLOGY INTEGRATION:
${ip.technology_integration}

CULTURAL INTEGRATION:
${ip.cultural_integration}

KEY MILESTONES:
${ip.key_milestones}

RISK MITIGATION PLAN:
${ip.risk_mitigation_plan}

SUCCESS METRICS:
${ip.success_metrics}

Please provide:

## EXECUTIVE INTEGRATION SUMMARY
Overview of integration strategy and key success factors.

## DAY ONE READINESS
### Critical Actions
Must-do activities on announcement/close.

### Communication Plan
Stakeholder messaging strategy.

### Quick Wins Identification
Early successes to build momentum.

## FIRST 100 DAYS EXECUTION
### Detailed Roadmap
Week-by-week action plan.

### Resource Requirements
Team structure and external support needs.

### Decision Points
Key decisions and governance approach.

## ORGANIZATIONAL INTEGRATION
### Structure Recommendations
Optimal organizational design.

### Key Talent Retention
Critical personnel and retention strategies.

### Change Management Approach
Employee engagement and communication.

## TECHNOLOGY INTEGRATION
### System Architecture
Target state and migration approach.

### Data Integration
Data harmonization and quality.

### IT Risk Mitigation
System continuity and security.

## CULTURAL INTEGRATION
### Culture Assessment
Gap analysis and alignment opportunities.

### Integration Activities
Programs to build unified culture.

### Leadership Alignment
Executive team integration approach.

## MILESTONE VALIDATION
### Timeline Assessment
Realistic evaluation of proposed milestones.

### Dependency Mapping
Critical path and interdependencies.

### Contingency Planning
Backup plans for key risks.

## SUCCESS METRICS ENHANCEMENT
### KPI Recommendations
Additional metrics to track.

### Measurement Framework
How to track and report progress.

### Early Warning Indicators
Signs of integration challenges.`;

    const analysis = await callOpenRouterAI(prompt, 'You are an expert post-merger integration specialist with extensive experience leading complex integrations. Provide practical, actionable guidance for successful integration execution.');
    const parsedJson = parseAIJson(analysis);

    await pool.query(
      'UPDATE integration_plans SET ai_analysis = $1, ai_results = $2, ai_analyzed_at = NOW() WHERE id = $3',
      [analysis, JSON.stringify({ raw: analysis, parsed: parsedJson }), req.params.id]
    );

    res.json({ analysis, ai_json: parsedJson, saved: true });
  } catch (error) {
    console.error('Error analyzing integration plan:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

// ==================== BULK OPERATIONS ====================

// Generic bulk delete helper
const createBulkDelete = (tableName, resourceName) => {
  return async (req, res) => {
    try {
      const { ids } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Array of IDs is required' });
      }
      const placeholders = ids.map((_, i) => `$${i + 1}`).join(',');
      const result = await pool.query(`DELETE FROM ${tableName} WHERE id IN (${placeholders}) RETURNING id`, ids);
      res.json({ message: `${result.rowCount} ${resourceName}(s) deleted`, deletedCount: result.rowCount });
    } catch (error) {
      console.error(`Error bulk deleting ${resourceName}:`, error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

// Generic bulk update helper
const createBulkUpdate = (tableName, resourceName, statusField = 'status') => {
  return async (req, res) => {
    try {
      const { ids, updates } = req.body;
      if (!ids || !Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Array of IDs is required' });
      }
      if (!updates || typeof updates !== 'object') {
        return res.status(400).json({ error: 'Updates object is required' });
      }
      const setClauses = [];
      const values = [];
      let paramIndex = 1;
      for (const [key, value] of Object.entries(updates)) {
        setClauses.push(`${key} = $${paramIndex}`);
        values.push(value);
        paramIndex++;
      }
      setClauses.push(`updated_at = NOW()`);
      const placeholders = ids.map((_, i) => `$${paramIndex + i}`).join(',');
      values.push(...ids);
      const result = await pool.query(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id IN (${placeholders}) RETURNING *`,
        values
      );
      res.json({ message: `${result.rowCount} ${resourceName}(s) updated`, updatedCount: result.rowCount, data: result.rows });
    } catch (error) {
      console.error(`Error bulk updating ${resourceName}:`, error);
      res.status(500).json({ error: 'Server error' });
    }
  };
};

// Companies bulk
app.post('/api/companies/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('companies', 'company'));
app.post('/api/companies/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('companies', 'company'));

// Financials bulk
app.post('/api/financials/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('financial_analysis', 'financial record'));
app.post('/api/financials/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('financial_analysis', 'financial record'));

// News bulk
app.post('/api/news/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('news_monitoring', 'news article'));
app.post('/api/news/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('news_monitoring', 'news article'));

// Risks bulk
app.post('/api/risks/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('risk_assessment', 'risk'));
app.post('/api/risks/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('risk_assessment', 'risk'));

// Red Flags bulk
app.post('/api/redflags/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('red_flags', 'red flag'));
app.post('/api/redflags/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('red_flags', 'red flag'));

// Market bulk
app.post('/api/market/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('market_analysis', 'market analysis'));
app.post('/api/market/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('market_analysis', 'market analysis'));

// Competitors bulk
app.post('/api/competitors/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('competitive_intelligence', 'competitor'));
app.post('/api/competitors/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('competitive_intelligence', 'competitor'));

// Legal bulk
app.post('/api/legal/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('legal_compliance', 'legal issue'));
app.post('/api/legal/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('legal_compliance', 'legal issue'));

// Management bulk
app.post('/api/management/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('management_assessment', 'executive'));
app.post('/api/management/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('management_assessment', 'executive'));

// Deals bulk
app.post('/api/deals/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('deal_pipeline', 'deal'));
app.post('/api/deals/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('deal_pipeline', 'deal'));

// Risk Scores bulk
app.post('/api/risk-scores/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('risk_scores', 'risk score'));
app.post('/api/risk-scores/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('risk_scores', 'risk score'));

// Synergies bulk
app.post('/api/synergies/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('synergy_calculations', 'synergy'));
app.post('/api/synergies/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('synergy_calculations', 'synergy'));

// Valuations bulk
app.post('/api/valuations/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('valuation_models', 'valuation'));
app.post('/api/valuations/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('valuation_models', 'valuation'));

// Red Flag Detections bulk
app.post('/api/red-flag-detections/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('red_flag_detections', 'detection'));
app.post('/api/red-flag-detections/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('red_flag_detections', 'detection'));

// Integration Plans bulk
app.post('/api/integration-plans/bulk-delete', authenticateToken, authorize('admin'), createBulkDelete('integration_plans', 'plan'));
app.post('/api/integration-plans/bulk-update', authenticateToken, authorize('admin'), createBulkUpdate('integration_plans', 'plan'));

// ==================== BACKEND VALIDATION FOR POST/PUT ====================

// Add validation to company creation
app.post('/api/companies/validated', authenticateToken, authorize('admin', 'analyst'), async (req, res) => {
  try {
    const { name, industry, revenue, employees, headquarters, website, description, status } = req.body;
    const errors = {};
    if (!name || name.trim().length < 2) errors.name = 'Company name must be at least 2 characters';
    if (revenue && isNaN(Number(revenue))) errors.revenue = 'Revenue must be a valid number';
    if (employees && isNaN(Number(employees))) errors.employees = 'Employees must be a valid number';
    if (Object.keys(errors).length > 0) return res.status(400).json({ error: 'Validation failed', errors });

    const result = await pool.query(
      `INSERT INTO companies (name, industry, revenue, employees, headquarters, website, description, status)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [name, industry, revenue, employees, headquarters, website, description, status || 'Under Review']
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== USER MANAGEMENT (Admin) ====================

app.get('/api/users', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, email, name, role, created_at, updated_at FROM users ORDER BY created_at DESC');
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

app.put('/api/users/:id/role', authenticateToken, authorize('admin'), async (req, res) => {
  try {
    const { role } = req.body;
    if (!['admin', 'analyst', 'partner'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
    const result = await pool.query(
      'UPDATE users SET role = $1, updated_at = NOW() WHERE id = $2 RETURNING id, email, name, role',
      [role, req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'User not found' });
    res.json(result.rows[0]);
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== DASHBOARD STATS ====================

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  try {
    const [companies, deals, risks, redflags, riskScores, synergies, valuations, redFlagDetections, integrationPlans, financials, news, marketAnalysis, competitors, legalIssues, executives] = await Promise.all([
      pool.query('SELECT COUNT(*) as count FROM companies'),
      pool.query('SELECT COUNT(*) as count FROM deal_pipeline'),
      pool.query("SELECT COUNT(*) as count FROM risk_assessment WHERE status = 'Open'"),
      pool.query("SELECT COUNT(*) as count FROM red_flags WHERE status = 'Active'"),
      pool.query('SELECT COUNT(*) as count FROM risk_scores'),
      pool.query('SELECT COUNT(*) as count FROM synergy_calculations'),
      pool.query('SELECT COUNT(*) as count FROM valuation_models'),
      pool.query("SELECT COUNT(*) as count FROM red_flag_detections WHERE investigation_status != 'Resolved'"),
      pool.query('SELECT COUNT(*) as count FROM integration_plans'),
      pool.query('SELECT COUNT(*) as count FROM financial_analysis'),
      pool.query('SELECT COUNT(*) as count FROM news_monitoring'),
      pool.query('SELECT COUNT(*) as count FROM market_analysis'),
      pool.query('SELECT COUNT(*) as count FROM competitive_intelligence'),
      pool.query('SELECT COUNT(*) as count FROM legal_compliance'),
      pool.query('SELECT COUNT(*) as count FROM management_assessment')
    ]);

    res.json({
      totalCompanies: parseInt(companies.rows[0].count),
      activeDeals: parseInt(deals.rows[0].count),
      openRisks: parseInt(risks.rows[0].count),
      activeRedFlags: parseInt(redflags.rows[0].count),
      riskScores: parseInt(riskScores.rows[0].count),
      synergyCalculations: parseInt(synergies.rows[0].count),
      valuationModels: parseInt(valuations.rows[0].count),
      redFlagDetections: parseInt(redFlagDetections.rows[0].count),
      integrationPlans: parseInt(integrationPlans.rows[0].count),
      financials: parseInt(financials.rows[0].count),
      news: parseInt(news.rows[0].count),
      marketAnalysis: parseInt(marketAnalysis.rows[0].count),
      competitors: parseInt(competitors.rows[0].count),
      legalIssues: parseInt(legalIssues.rows[0].count),
      executives: parseInt(executives.rows[0].count)
    });
  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// ==================== NEW AI + EXPORT ROUTES ====================
app.use('/api/ai', authenticateToken, aiRateLimiter, require('./routes/aiNew'));
app.use('/api/export', authenticateToken, require('./routes/export'));
app.use('/api/watchlist', authenticateToken, require('./routes/watchlist'));
app.use('/api/multi-round-compare', authenticateToken, require('./routes/multiRoundCompare'));
app.use('/api/agentic-diligence', authenticateToken, aiRateLimiter, require('./routes/agenticDiligence'));
app.use('/api/founder-call-analysis', authenticateToken, aiRateLimiter, require('./routes/founderCallAnalysis'));
app.use('/api/cap-table', authenticateToken, require('./routes/capTableModel'));
app.use('/api/diligence-checklist', authenticateToken, require('./routes/diligenceChecklist'));
app.use('/api/sec-filings', authenticateToken, require('./routes/secFilings'));
app.use('/api/key-person-risk-map', authenticateToken, require('./routes/keyPersonRiskMap'));

// Start server

// === Batch 03 Gaps & Frontend Mounts ===
try {
  const _batch03 = require('./routes/batch03Gaps');
  if (typeof authenticateToken === 'function') app.use('/api', authenticateToken, _batch03);
  else app.use('/api', _batch03);
} catch (_e) { /* batch03 gap routes optional */ }

// Custom Views (VIZ + NON-VIZ) - mounted BEFORE 404 / listen
app.use('/api/custom-views', authenticateToken, require('./routes/customViews'));
app.use('/api/governed-diligence', authenticateToken, require('./routes/governedDiligence')());
app.get('/api/health', (req,res) => res.json({status:'ok',supportedBoundary:'governed-diligence',timestamp:new Date().toISOString()}));

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Using AI model: ${process.env.OPENROUTER_MODEL || 'anthropic/claude-3-5-sonnet-20241022'}`);
});
