const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/export/company-report/:id - generate company PDF report
// Uses pdfkit if available, otherwise returns JSON report data
router.get('/company-report/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Fetch all company-related data
    const [companyRes, financialsRes, risksRes, redFlagsRes, newsRes, marketRes] = await Promise.all([
      pool.query('SELECT * FROM companies WHERE id = $1', [id]),
      pool.query('SELECT * FROM financial_analysis WHERE company_id = $1 ORDER BY fiscal_year DESC', [id]),
      pool.query('SELECT * FROM risk_assessment WHERE company_id = $1 ORDER BY severity DESC', [id]),
      pool.query('SELECT * FROM red_flags WHERE company_id = $1 ORDER BY priority DESC', [id]),
      pool.query('SELECT * FROM news_monitoring WHERE company_id = $1 ORDER BY published_date DESC LIMIT 10', [id]),
      pool.query('SELECT * FROM market_analysis WHERE company_id = $1 ORDER BY created_at DESC LIMIT 1', [id])
    ]);

    if (companyRes.rows.length === 0) {
      return res.status(404).json({ error: 'Company not found' });
    }

    const company = companyRes.rows[0];
    const reportData = {
      generated_at: new Date().toISOString(),
      company,
      financials: financialsRes.rows,
      risks: risksRes.rows,
      red_flags: redFlagsRes.rows,
      recent_news: newsRes.rows,
      market_analysis: marketRes.rows[0] || null,
      summary: {
        total_financials: financialsRes.rows.length,
        total_risks: risksRes.rows.length,
        high_priority_risks: risksRes.rows.filter(r => r.severity >= 4).length,
        active_red_flags: redFlagsRes.rows.filter(rf => rf.status === 'Active').length,
        ai_analysis_available: !!company.ai_analysis
      }
    };

    // Try to use pdfkit if installed
    let PDFDocument;
    try {
      PDFDocument = require('pdfkit');
    } catch {
      // pdfkit not installed - return JSON report
      res.setHeader('Content-Type', 'application/json');
      res.setHeader('Content-Disposition', `attachment; filename="company-report-${id}.json"`);
      return res.json(reportData);
    }

    // Generate PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="company-report-${company.name.replace(/[^a-z0-9]/gi, '-')}-${id}.pdf"`);

    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(res);

    // Title
    doc.fontSize(24).font('Helvetica-Bold').text('Due Diligence Report', { align: 'center' });
    doc.fontSize(18).font('Helvetica').text(company.name, { align: 'center' });
    doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`, { align: 'center' });
    doc.moveDown(2);

    // Company Overview
    doc.fontSize(16).font('Helvetica-Bold').text('Company Overview');
    doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
    doc.moveDown(0.5);
    doc.fontSize(11).font('Helvetica');
    doc.text(`Industry: ${company.industry || 'N/A'}`);
    doc.text(`Revenue: $${company.revenue ? Number(company.revenue).toLocaleString() : 'N/A'}`);
    doc.text(`Employees: ${company.employees ? Number(company.employees).toLocaleString() : 'N/A'}`);
    doc.text(`Headquarters: ${company.headquarters || 'N/A'}`);
    doc.text(`Status: ${company.status || 'N/A'}`);
    if (company.description) {
      doc.moveDown(0.5);
      doc.text(`Description: ${company.description}`);
    }
    doc.moveDown(1.5);

    // AI Analysis
    if (company.ai_analysis) {
      doc.fontSize(16).font('Helvetica-Bold').text('AI Analysis');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica').text(company.ai_analysis, { width: 500 });
      doc.moveDown(1.5);
    }

    // Financial Summary
    if (financialsRes.rows.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text('Financial Summary');
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(11).font('Helvetica');
      financialsRes.rows.forEach(f => {
        doc.font('Helvetica-Bold').text(`FY${f.fiscal_year}`, { continued: true });
        doc.font('Helvetica').text(` | Revenue: $${Number(f.revenue || 0).toLocaleString()} | Net Income: $${Number(f.net_income || 0).toLocaleString()} | EBITDA: $${Number(f.ebitda || 0).toLocaleString()}`);
      });
      doc.moveDown(1.5);
    }

    // Risks
    if (risksRes.rows.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text(`Risk Assessment (${risksRes.rows.length} total)`);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      risksRes.rows.slice(0, 10).forEach(r => {
        doc.font('Helvetica-Bold').text(`[${r.risk_type}] ${r.title}`, { continued: true });
        doc.font('Helvetica').text(` — Severity: ${r.severity}/5`);
        if (r.description) doc.text(`  ${r.description}`, { width: 480, indent: 10 });
      });
      doc.moveDown(1.5);
    }

    // Red Flags
    if (redFlagsRes.rows.length > 0) {
      doc.fontSize(16).font('Helvetica-Bold').text(`Red Flags (${redFlagsRes.rows.length} total)`);
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.5);
      doc.fontSize(10).font('Helvetica');
      redFlagsRes.rows.forEach(rf => {
        doc.font('Helvetica-Bold').text(`[${rf.category}] ${rf.title}`, { continued: true });
        doc.font('Helvetica').text(` — Priority: ${rf.priority} | Status: ${rf.status}`);
        if (rf.description) doc.text(`  ${rf.description}`, { width: 480, indent: 10 });
      });
      doc.moveDown(1.5);
    }

    doc.fontSize(9).fillColor('gray').text('This report was generated by AI Due Diligence Assistant. For informational purposes only.', { align: 'center' });

    doc.end();
  } catch (error) {
    console.error('Export report error:', error);
    res.status(500).json({ error: error.message || 'Server error' });
  }
});

module.exports = router;
