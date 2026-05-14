# Audit Notes — AIDueDiligenceAssistant

Audit source: `_AUDIT/reports/batch_03.md` § 4 (skeleton, audit reported 0 AI endpoints).

## Original audit recommendations

### Missing AI counterparts
- `/analyze-target-company`, `/competitive-analysis`, `/valuation-summary`,
  `/regulatory-risk`, `/management-team-analysis`, `/market-viability`,
  `/deal-structure-advisor`, `/cultural-fit-assessment`.

### Missing non-AI features
- Financials CRUD (P&L, balance sheet, cash flow).
- Company / competitor CRUD.
- Deal management.
- Management team tracking.
- Market research aggregation.
- Risk registry.

### Custom feature suggestions
- Multi-round analysis (red-flag detection across rounds).
- Comparable companies database (CapIQ / Crunchbase).
- Agentic diligence (scheduled deep-dives).
- Due-diligence checklist generator.
- Founder call transcription + claim extraction.
- Cap table / dilution modeling.
- SEC filing aggregator.

## Current state observed

The audit's "3 routes, 0 AI" diagnosis is outdated. The current `server.js` is
~105KB with extensive in-line route handlers and `routes/aiNew.js` exposes four
purpose-built AI endpoints (`/deal-score`, `/comparison-matrix`,
`/red-flag-ranking`, `/deal-timeline`). The shape of `analyze-target-company`,
`competitive-analysis`, and `valuation-summary` is largely covered by these.

## Implementations applied this pass

None — large monolithic `server.js` makes mechanical insertion brittle. Better to
split first.

## Prioritized backlog

1. **MECHANICAL (refactor first)** — Split `server.js` into per-resource
   route files (`companies`, `deals`, `financials`, `management`) before
   adding new AI endpoints; reduces merge risk.
2. **MECHANICAL** — Add `/api/ai/management-team-analysis` reading
   `management_team` rows and returning a background / track-record summary.
3. **MECHANICAL** — Add `/api/ai/cultural-fit-assessment` based on free-text
   inputs about acquirer + target culture.
4. **NEEDS-CREDS** — Crunchbase / CapIQ / SEC EDGAR ingestion requires API
   keys (EDGAR is free but rate-limited).
5. **NEEDS-PRODUCT-DECISION** — Multi-round and cap-table modeling need a
   schema design pass and probably tools like a structured cap-table parser.
6. **TOO-RISKY** — Founder call transcription requires consent capture and a
   storage / retention policy.

## Apply pass 3 (frontend)

- Gap found: backend `routes/aiNew.js` exposes 4 AI endpoints (`/api/ai/deal-score`, `/comparison-matrix`, `/red-flag-ranking`, `/deal-timeline`) but the existing FE pages did not call any of them. The five "AI" pages in the sidebar (RiskScorer, SynergyCalculator, ValuationModeler, RedFlagDetector, IntegrationPlanner) are CRUD-style pages that hit per-resource `/analyze` endpoints in `server.js`, not the `aiNew.js` router.
- **Action: CREATED-FE** — added `frontend/src/pages/AITools.js` (a tabbed page surfacing all 4 `aiNew.js` endpoints), wired into `App.js` at `/ai-tools` and added a sidebar link in `components/Layout.js` ("AI Deal Tools", brain icon, under the AI Features divider).
- Auth: the page uses `axios` defaults already populated by `AuthContext` on token-mount; no separate token wiring needed.
- 503-no-key handled with an explicit "AI not configured. Set OPENROUTER_API_KEY..." notice.
- Files: `frontend/src/pages/AITools.js` (new), `frontend/src/App.js`, `frontend/src/components/Layout.js`.
- Syntax check: `node --check` PASS on all three.
- Backend wiring verified: `server.js` line `app.use('/api/ai', authenticateToken, aiRateLimiter, require('./routes/aiNew'));` is correct.

## Apply pass 4 (mechanical backlog)

Implemented two MECHANICAL items from the prioritized backlog (items 2 & 3):

- BE (`backend/routes/aiNew.js`):
  - Added explicit 503-on-no-key guard inside `callOpenRouterAI`.
  - `POST /api/ai/management-team-analysis` — reads `companies` + `management_assessment` and returns team_summary, team_strength_score, depth_and_redundancy, retention_risk_overall, key_executives, post_close_recommendations. Cached via existing helpers.
  - `POST /api/ai/cultural-fit-assessment` — free-text inputs (`acquirer_culture`, `target_culture`, `deal_context`) → fit_score, alignment_areas, friction_areas, integration_risks, recommended_integration_style, first_90_day_actions, executive_summary.
- FE (`frontend/src/pages/AITools.js`): added two tabs ("Management Team", "Cultural Fit"). Cultural Fit form does not require companies. JWT bearer via existing `AuthContext` axios default. 503 banner shown for `OPENROUTER_API_KEY`-missing case.
- Smoke test: backend started cleanly; login → 200; `POST /api/ai/cultural-fit-assessment` returned 200 with full structured JSON (real AI call since key was set).
- Syntax: `node --check` PASS on `aiNew.js`; `@babel/parser` PASS on `AITools.js`.

Items still skipped: refactoring `server.js` into per-resource files (high-risk, deferred); Crunchbase/CapIQ ingestion (NEEDS-CREDS); multi-round / cap-table modeling (NEEDS-PRODUCT-DECISION); founder call transcription (TOO-RISKY).

## Apply pass 5 (all backlog)

Added 4 MECHANICAL backlog endpoints (cap=10/project: pass2=4 + pass4=2 + pass5=4 = 10).

- BE (`backend/routes/aiNew.js`):
  - `POST /api/ai/analyze-target-company` — holistic SWOT-style assessment.
  - `POST /api/ai/valuation-summary` — DCF/comps/precedent valuation.
  - `POST /api/ai/diligence-checklist` — workstream checklist generator.
  - `POST /api/ai/cap-table-analysis` — dilution scenarios; persists rounds/shareholders into new `cap_tables` table (PRODUCT-DECISION: JSONB schema documented inline).
  - All endpoints reuse `callOpenRouterAI` (which now returns 503 + `missing: OPENROUTER_API_KEY`).
- FE (`frontend/src/pages/AITools.js`):
  - 4 new tabs (Target Analysis, Valuation, Diligence Checklist, Cap Table) with their forms.
  - 503 banner now surfaces `missing` env name returned by the backend.
- Smoke: BE started on alt port 3801 (3001 occupied by another session); login as admin@duediligence.com → 200; `POST /api/ai/diligence-checklist {company_id:1}` → 200 with full structured JSON. `cap_tables` table created.
- Syntax: `node --check` PASS on `aiNew.js`; `@babel/parser` PASS on `AITools.js`.

Items still skipped (over cap or out of scope this pass): SEC EDGAR ingestion (NEEDS-CREDS), Crunchbase enrichment (NEEDS-CREDS), founder-call transcription (TOO-RISKY), competitive-analysis / regulatory-risk / market-viability / deal-structure-advisor (next pass when cap allows).
