const bcrypt = require('bcryptjs');
require('dotenv').config({ path: '../.env' });
const { Pool } = require('pg');

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'duediligence_db',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
});

async function seedDatabase() {
  const client = await pool.connect();

  try {
    console.log('Starting database seeding...');

    // Drop existing tables
    await client.query(`
      DROP TABLE IF EXISTS integration_plans CASCADE;
      DROP TABLE IF EXISTS red_flag_detections CASCADE;
      DROP TABLE IF EXISTS valuation_models CASCADE;
      DROP TABLE IF EXISTS synergy_calculations CASCADE;
      DROP TABLE IF EXISTS risk_scores CASCADE;
      DROP TABLE IF EXISTS deal_pipeline CASCADE;
      DROP TABLE IF EXISTS management_assessment CASCADE;
      DROP TABLE IF EXISTS legal_compliance CASCADE;
      DROP TABLE IF EXISTS competitive_intelligence CASCADE;
      DROP TABLE IF EXISTS market_analysis CASCADE;
      DROP TABLE IF EXISTS red_flags CASCADE;
      DROP TABLE IF EXISTS risk_assessment CASCADE;
      DROP TABLE IF EXISTS news_monitoring CASCADE;
      DROP TABLE IF EXISTS financial_analysis CASCADE;
      DROP TABLE IF EXISTS companies CASCADE;
      DROP TABLE IF EXISTS users CASCADE;
    `);

    // Create tables
    await client.query(`
      CREATE TABLE users (
        id SERIAL PRIMARY KEY,
        email VARCHAR(255) UNIQUE NOT NULL,
        password VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'analyst',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE companies (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        industry VARCHAR(255),
        revenue DECIMAL(15,2),
        employees INTEGER,
        headquarters VARCHAR(255),
        website VARCHAR(255),
        description TEXT,
        status VARCHAR(50) DEFAULT 'Under Review',
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE financial_analysis (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        fiscal_year INTEGER,
        revenue DECIMAL(15,2),
        net_income DECIMAL(15,2),
        total_assets DECIMAL(15,2),
        total_liabilities DECIMAL(15,2),
        ebitda DECIMAL(15,2),
        gross_margin DECIMAL(5,2),
        operating_margin DECIMAL(5,2),
        debt_to_equity DECIMAL(5,2),
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE news_monitoring (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        title VARCHAR(500) NOT NULL,
        source VARCHAR(255),
        url VARCHAR(500),
        summary TEXT,
        sentiment VARCHAR(50) DEFAULT 'Neutral',
        published_date DATE,
        category VARCHAR(100),
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE risk_assessment (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        risk_type VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        severity VARCHAR(50),
        likelihood VARCHAR(50),
        impact VARCHAR(50),
        mitigation_strategy TEXT,
        status VARCHAR(50) DEFAULT 'Open',
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE red_flags (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        category VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        evidence TEXT,
        priority VARCHAR(50),
        recommendation TEXT,
        status VARCHAR(50) DEFAULT 'Active',
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE market_analysis (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        market_size DECIMAL(15,2),
        market_growth_rate DECIMAL(5,2),
        market_share DECIMAL(5,2),
        competitive_position VARCHAR(100),
        target_segments TEXT,
        geographic_presence TEXT,
        trends TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE competitive_intelligence (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        competitor_name VARCHAR(255) NOT NULL,
        market_share DECIMAL(5,2),
        strengths TEXT,
        weaknesses TEXT,
        strategy TEXT,
        threat_level VARCHAR(50),
        notes TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE legal_compliance (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        issue_type VARCHAR(100),
        title VARCHAR(255) NOT NULL,
        description TEXT,
        status VARCHAR(50) DEFAULT 'Open',
        severity VARCHAR(50),
        regulatory_body VARCHAR(255),
        deadline DATE,
        resolution TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE management_assessment (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        executive_name VARCHAR(255) NOT NULL,
        title VARCHAR(255),
        experience_years INTEGER,
        background TEXT,
        leadership_score INTEGER,
        retention_risk VARCHAR(50),
        key_strengths TEXT,
        concerns TEXT,
        recommendation TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE deal_pipeline (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        deal_name VARCHAR(255) NOT NULL,
        deal_type VARCHAR(100),
        stage VARCHAR(100) DEFAULT 'Initial Review',
        valuation DECIMAL(15,2),
        offer_price DECIMAL(15,2),
        expected_close_date DATE,
        lead_partner VARCHAR(255),
        deal_team TEXT,
        priority VARCHAR(50),
        notes TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      -- NEW AI FEATURES TABLES --

      CREATE TABLE risk_scores (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        deal_name VARCHAR(255) NOT NULL,
        financial_risk_score DECIMAL(3,1),
        operational_risk_score DECIMAL(3,1),
        market_risk_score DECIMAL(3,1),
        legal_risk_score DECIMAL(3,1),
        integration_risk_score DECIMAL(3,1),
        overall_risk_score DECIMAL(3,1),
        risk_category VARCHAR(50),
        key_risk_factors TEXT,
        risk_mitigation_suggestions TEXT,
        confidence_level DECIMAL(3,1),
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE synergy_calculations (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        deal_name VARCHAR(255) NOT NULL,
        acquirer_name VARCHAR(255),
        revenue_synergy DECIMAL(15,2),
        cost_synergy DECIMAL(15,2),
        tax_synergy DECIMAL(15,2),
        total_synergy DECIMAL(15,2),
        synergy_timeline_months INTEGER,
        probability_of_achievement DECIMAL(5,2),
        synergy_categories TEXT,
        implementation_costs DECIMAL(15,2),
        net_synergy_value DECIMAL(15,2),
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE valuation_models (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        deal_name VARCHAR(255) NOT NULL,
        dcf_valuation DECIMAL(15,2),
        comparable_companies_valuation DECIMAL(15,2),
        precedent_transactions_valuation DECIMAL(15,2),
        lbo_valuation DECIMAL(15,2),
        asset_based_valuation DECIMAL(15,2),
        weighted_average_valuation DECIMAL(15,2),
        valuation_range_low DECIMAL(15,2),
        valuation_range_high DECIMAL(15,2),
        implied_ev_ebitda_multiple DECIMAL(5,2),
        implied_ev_revenue_multiple DECIMAL(5,2),
        key_assumptions TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE red_flag_detections (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        deal_name VARCHAR(255) NOT NULL,
        flag_type VARCHAR(100),
        severity_level VARCHAR(50),
        flag_title VARCHAR(255) NOT NULL,
        flag_description TEXT,
        supporting_evidence TEXT,
        deal_breaker_potential BOOLEAN DEFAULT FALSE,
        recommended_action TEXT,
        investigation_status VARCHAR(50) DEFAULT 'Pending',
        resolution_notes TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE integration_plans (
        id SERIAL PRIMARY KEY,
        company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
        deal_name VARCHAR(255) NOT NULL,
        integration_approach VARCHAR(100),
        day_one_priorities TEXT,
        first_100_days_plan TEXT,
        organizational_structure TEXT,
        technology_integration TEXT,
        cultural_integration TEXT,
        key_milestones TEXT,
        estimated_integration_costs DECIMAL(15,2),
        integration_timeline_months INTEGER,
        risk_mitigation_plan TEXT,
        success_metrics TEXT,
        ai_analysis TEXT,
        ai_results JSONB DEFAULT '{}'::jsonb,
        ai_analyzed_at TIMESTAMP,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
      );
    `);

    console.log('Tables created successfully');

    // Seed Users (15+ items)
    const hashedPassword = await bcrypt.hash(process.env.DEMO_PASSWORD || 'Demo123!', 10);
    await client.query(`
      INSERT INTO users (email, password, name, role) VALUES
      ($1, $2, 'Admin User', 'admin'),
      ('analyst@duediligence.com', $2, 'John Analyst', 'analyst'),
      ('partner@duediligence.com', $2, 'Sarah Partner', 'partner'),
      ('admin2@duediligence.com', $2, 'Maria Admin', 'admin'),
      ('analyst2@duediligence.com', $2, 'David Chen', 'analyst'),
      ('analyst3@duediligence.com', $2, 'Emily Rodriguez', 'analyst'),
      ('analyst4@duediligence.com', $2, 'James Wilson', 'analyst'),
      ('analyst5@duediligence.com', $2, 'Lisa Thompson', 'analyst'),
      ('partner2@duediligence.com', $2, 'Robert Kim', 'partner'),
      ('partner3@duediligence.com', $2, 'Jennifer Park', 'partner'),
      ('partner4@duediligence.com', $2, 'Michael Brown', 'partner'),
      ('analyst6@duediligence.com', $2, 'Amanda Lee', 'analyst'),
      ('analyst7@duediligence.com', $2, 'Christopher Davis', 'analyst'),
      ('partner5@duediligence.com', $2, 'Jessica Martinez', 'partner'),
      ('analyst8@duediligence.com', $2, 'Andrew Taylor', 'analyst'),
      ('partner6@duediligence.com', $2, 'Samantha White', 'partner')
    `, [process.env.DEMO_EMAIL || 'admin@duediligence.com', hashedPassword]);

    console.log('Users seeded (16 users)');

    // Seed Companies (15+ items)
    await client.query(`
      INSERT INTO companies (name, industry, revenue, employees, headquarters, website, description, status) VALUES
      ('TechVenture Inc', 'Technology', 45000000, 250, 'San Francisco, CA', 'www.techventure.com', 'Cloud-based enterprise software solutions provider specializing in workflow automation.', 'Under Review'),
      ('HealthFirst Solutions', 'Healthcare', 120000000, 800, 'Boston, MA', 'www.healthfirst.com', 'Leading provider of healthcare management software and analytics platforms.', 'Active Due Diligence'),
      ('GreenEnergy Corp', 'Energy', 280000000, 1200, 'Austin, TX', 'www.greenenergy.com', 'Renewable energy company focused on solar and wind power generation.', 'Under Review'),
      ('DataStream Analytics', 'Technology', 35000000, 180, 'Seattle, WA', 'www.datastream.com', 'Big data analytics platform for enterprise customers.', 'Preliminary'),
      ('BioPharm Innovations', 'Pharmaceuticals', 500000000, 2500, 'San Diego, CA', 'www.biopharm.com', 'Biopharmaceutical company developing novel therapeutics.', 'Active Due Diligence'),
      ('FinServe Global', 'Financial Services', 89000000, 450, 'New York, NY', 'www.finserve.com', 'Digital payment and financial technology solutions.', 'Under Review'),
      ('RetailMax Holdings', 'Retail', 320000000, 3500, 'Chicago, IL', 'www.retailmax.com', 'E-commerce and retail technology platform.', 'Preliminary'),
      ('CloudSecure Systems', 'Cybersecurity', 67000000, 320, 'Denver, CO', 'www.cloudsecure.com', 'Enterprise cybersecurity and threat detection solutions.', 'Active Due Diligence'),
      ('AutoDrive Tech', 'Automotive', 150000000, 600, 'Detroit, MI', 'www.autodrive.com', 'Autonomous vehicle technology and ADAS systems.', 'Under Review'),
      ('FoodChain Logistics', 'Logistics', 95000000, 750, 'Atlanta, GA', 'www.foodchain.com', 'Cold chain logistics and food distribution network.', 'Preliminary'),
      ('EduTech Platforms', 'Education', 42000000, 200, 'Portland, OR', 'www.edutech.com', 'Online learning platform and educational content provider.', 'Under Review'),
      ('MediDevice Corp', 'Medical Devices', 175000000, 900, 'Minneapolis, MN', 'www.medidevice.com', 'Medical device manufacturer specializing in surgical instruments.', 'Active Due Diligence'),
      ('PropTech Solutions', 'Real Estate', 55000000, 280, 'Miami, FL', 'www.proptech.com', 'Property management and real estate technology platform.', 'Under Review'),
      ('AeroSpace Dynamics', 'Aerospace', 420000000, 1800, 'Phoenix, AZ', 'www.aerospace.com', 'Aerospace components and satellite systems manufacturer.', 'Preliminary'),
      ('CleanWater Systems', 'Environmental', 78000000, 400, 'Denver, CO', 'www.cleanwater.com', 'Water treatment and purification technology provider.', 'Under Review'),
      ('AgriTech Innovations', 'Agriculture', 62000000, 350, 'Des Moines, IA', 'www.agritech.com', 'Precision agriculture and farming technology solutions.', 'Active Due Diligence')
    `);

    console.log('Companies seeded');

    // Seed Financial Analysis (15+ items)
    await client.query(`
      INSERT INTO financial_analysis (company_id, fiscal_year, revenue, net_income, total_assets, total_liabilities, ebitda, gross_margin, operating_margin, debt_to_equity) VALUES
      (1, 2024, 45000000, 5400000, 32000000, 12000000, 8100000, 68.5, 15.2, 0.45),
      (1, 2023, 38000000, 4200000, 28000000, 10000000, 6840000, 65.2, 13.8, 0.42),
      (2, 2024, 120000000, 14400000, 95000000, 38000000, 21600000, 55.3, 16.5, 0.52),
      (2, 2023, 105000000, 11550000, 82000000, 32000000, 18900000, 52.8, 14.2, 0.48),
      (3, 2024, 280000000, 22400000, 420000000, 210000000, 50400000, 42.5, 12.8, 0.85),
      (4, 2024, 35000000, 3850000, 25000000, 8500000, 6300000, 72.1, 18.5, 0.38),
      (5, 2024, 500000000, 75000000, 680000000, 280000000, 100000000, 78.2, 22.5, 0.68),
      (6, 2024, 89000000, 10680000, 72000000, 28000000, 16020000, 58.4, 15.8, 0.45),
      (7, 2024, 320000000, 25600000, 280000000, 140000000, 48000000, 35.2, 10.5, 0.72),
      (8, 2024, 67000000, 8710000, 48000000, 16000000, 12060000, 75.5, 19.2, 0.35),
      (9, 2024, 150000000, 12000000, 180000000, 90000000, 27000000, 38.5, 11.2, 0.82),
      (10, 2024, 95000000, 7600000, 85000000, 42000000, 14250000, 28.5, 9.8, 0.65),
      (11, 2024, 42000000, 5460000, 30000000, 10000000, 7560000, 70.2, 17.5, 0.38),
      (12, 2024, 175000000, 19250000, 145000000, 58000000, 31500000, 62.8, 15.5, 0.52),
      (13, 2024, 55000000, 6050000, 42000000, 15000000, 9900000, 65.5, 14.8, 0.42),
      (14, 2024, 420000000, 42000000, 580000000, 290000000, 75600000, 35.8, 12.5, 0.78),
      (15, 2024, 78000000, 8580000, 62000000, 22000000, 14040000, 58.2, 14.5, 0.42)
    `);

    console.log('Financial Analysis seeded');

    // Seed News Monitoring (15+ items)
    await client.query(`
      INSERT INTO news_monitoring (company_id, title, source, url, summary, sentiment, published_date, category) VALUES
      (1, 'TechVenture Announces Major Cloud Partnership', 'TechCrunch', 'https://techcrunch.com/article1', 'TechVenture Inc has announced a strategic partnership with a major cloud provider to expand its enterprise offerings.', 'Positive', '2024-01-15', 'Partnership'),
      (2, 'HealthFirst Receives FDA Approval for New Platform', 'Healthcare Daily', 'https://healthcaredaily.com/article1', 'HealthFirst Solutions received FDA clearance for its new patient monitoring platform.', 'Positive', '2024-01-12', 'Regulatory'),
      (3, 'GreenEnergy Faces Regulatory Scrutiny', 'Energy News', 'https://energynews.com/article1', 'GreenEnergy Corp is under investigation by state regulators regarding environmental compliance.', 'Negative', '2024-01-10', 'Regulatory'),
      (4, 'DataStream Raises $50M Series C', 'VentureBeat', 'https://venturebeat.com/article1', 'DataStream Analytics completes Series C funding round led by top-tier VC firms.', 'Positive', '2024-01-08', 'Funding'),
      (5, 'BioPharm Drug Trial Shows Promise', 'BioPharma News', 'https://biopharma.com/article1', 'Phase 3 clinical trials for BioPharms lead drug candidate show positive results.', 'Positive', '2024-01-05', 'Clinical'),
      (6, 'FinServe Expands to European Markets', 'Financial Times', 'https://ft.com/article1', 'FinServe Global announces expansion plans into European payment markets.', 'Positive', '2024-01-03', 'Expansion'),
      (7, 'RetailMax Reports Strong Holiday Sales', 'Retail Week', 'https://retailweek.com/article1', 'RetailMax Holdings reports 25% increase in holiday season revenue.', 'Positive', '2024-01-02', 'Earnings'),
      (8, 'CloudSecure Discovers Major Vulnerability', 'Wired', 'https://wired.com/article1', 'CloudSecure researchers identify critical vulnerability affecting major cloud platforms.', 'Neutral', '2023-12-28', 'Security'),
      (9, 'AutoDrive Partners with Major Automaker', 'Automotive News', 'https://autonews.com/article1', 'AutoDrive Tech signs multi-year deal with leading automotive manufacturer.', 'Positive', '2023-12-22', 'Partnership'),
      (10, 'FoodChain Faces Supply Chain Disruptions', 'Logistics Today', 'https://logistics.com/article1', 'FoodChain Logistics reports challenges due to ongoing supply chain issues.', 'Negative', '2023-12-20', 'Operations'),
      (11, 'EduTech Platform Reaches 5M Users', 'EdWeek', 'https://edweek.com/article1', 'EduTech Platforms celebrates milestone of 5 million active users.', 'Positive', '2023-12-18', 'Growth'),
      (12, 'MediDevice Recalls Product Line', 'MedTech Dive', 'https://medtechdive.com/article1', 'MediDevice Corp issues voluntary recall for specific surgical instrument line.', 'Negative', '2023-12-15', 'Recall'),
      (13, 'PropTech Launches AI-Powered Features', 'PropTech Today', 'https://proptech.com/article1', 'PropTech Solutions introduces AI-driven property valuation tools.', 'Positive', '2023-12-12', 'Product'),
      (14, 'AeroSpace Wins Government Contract', 'Defense News', 'https://defensenews.com/article1', 'AeroSpace Dynamics secures $200M government defense contract.', 'Positive', '2023-12-10', 'Contract'),
      (15, 'CleanWater Expands Water Treatment Network', 'Environmental Tech', 'https://envtech.com/article1', 'CleanWater Systems announces expansion of treatment facilities across Southwest.', 'Positive', '2023-12-08', 'Expansion'),
      (16, 'AgriTech Partners with Major Farm Cooperative', 'Ag News', 'https://agnews.com/article1', 'AgriTech Innovations forms strategic partnership with national farming cooperative.', 'Positive', '2023-12-05', 'Partnership')
    `);

    console.log('News Monitoring seeded');

    // Seed Risk Assessment (15+ items)
    await client.query(`
      INSERT INTO risk_assessment (company_id, risk_type, title, description, severity, likelihood, impact, mitigation_strategy, status) VALUES
      (1, 'Technology', 'Legacy System Dependency', 'Critical business functions rely on outdated technology stack that may require significant investment to modernize.', 'Medium', 'High', 'Medium', 'Develop phased modernization plan with clear timelines and budget allocation.', 'Open'),
      (2, 'Regulatory', 'HIPAA Compliance Gaps', 'Recent audit identified potential gaps in HIPAA compliance procedures.', 'High', 'Medium', 'High', 'Engage compliance consultant and implement remediation plan within 90 days.', 'Open'),
      (3, 'Environmental', 'Carbon Emission Standards', 'New environmental regulations may impact operational costs significantly.', 'High', 'High', 'High', 'Accelerate transition to cleaner technologies and explore carbon offset programs.', 'Open'),
      (4, 'Market', 'Customer Concentration', 'Top 3 customers represent 65% of total revenue, creating dependency risk.', 'Medium', 'Medium', 'High', 'Implement customer diversification strategy and expand sales team.', 'Open'),
      (5, 'Clinical', 'Drug Trial Failure Risk', 'Key pipeline drug in Phase 3 trials with uncertain outcome.', 'Critical', 'Medium', 'Critical', 'Diversify pipeline and prepare contingency plans for trial outcomes.', 'Open'),
      (6, 'Compliance', 'International Payment Regulations', 'Expanding to new markets introduces complex regulatory requirements.', 'Medium', 'High', 'Medium', 'Hire local compliance experts in target markets.', 'Open'),
      (7, 'Operational', 'Supply Chain Vulnerability', 'Heavy reliance on single-source suppliers for key components.', 'High', 'Medium', 'High', 'Develop secondary supplier relationships and increase inventory buffers.', 'Open'),
      (8, 'Cyber', 'Ransomware Exposure', 'Growing threat of ransomware attacks on enterprise customers.', 'High', 'High', 'Critical', 'Enhance security protocols and implement zero-trust architecture.', 'Open'),
      (9, 'Technology', 'Autonomous Vehicle Liability', 'Unclear regulatory framework for autonomous vehicle liability.', 'High', 'Medium', 'High', 'Work with legal team to prepare for various liability scenarios.', 'Open'),
      (10, 'Operational', 'Labor Shortage', 'Difficulty recruiting and retaining qualified drivers and logistics staff.', 'Medium', 'High', 'Medium', 'Improve compensation packages and implement automation where possible.', 'Open'),
      (11, 'Competition', 'Market Saturation', 'Online education market becoming increasingly crowded.', 'Medium', 'High', 'Medium', 'Focus on differentiation through AI-powered personalization.', 'Open'),
      (12, 'Product', 'Quality Control Issues', 'Recent product recalls indicate potential manufacturing quality problems.', 'High', 'Medium', 'High', 'Implement enhanced QC procedures and third-party audits.', 'Open'),
      (13, 'Economic', 'Real Estate Market Downturn', 'Economic uncertainty could impact real estate technology demand.', 'Medium', 'Medium', 'Medium', 'Diversify product offerings to serve both growth and downturn scenarios.', 'Open'),
      (14, 'Political', 'Defense Budget Uncertainty', 'Government budget negotiations could impact contract pipeline.', 'High', 'Medium', 'High', 'Diversify customer base to include commercial aerospace sector.', 'Open'),
      (15, 'Environmental', 'Water Rights Issues', 'Potential disputes over water rights in expansion areas.', 'Medium', 'Low', 'High', 'Conduct thorough legal review of water rights in all operational areas.', 'Open'),
      (16, 'Climate', 'Weather-Related Crop Risks', 'Climate change increasing variability in agricultural conditions.', 'Medium', 'High', 'Medium', 'Develop climate-resilient technology solutions for farmers.', 'Open')
    `);

    console.log('Risk Assessment seeded');

    // Seed Red Flags (15+ items)
    await client.query(`
      INSERT INTO red_flags (company_id, category, title, description, evidence, priority, recommendation, status) VALUES
      (1, 'Financial', 'Unusual Revenue Recognition', 'Revenue recognition practices appear aggressive compared to industry standards.', 'Q3 financial statements show significant channel stuffing patterns.', 'High', 'Request detailed revenue recognition policy review and audit trail.', 'Active'),
      (2, 'Legal', 'Pending Litigation', 'Multiple lawsuits related to patient data breach from 2023.', 'Court filings indicate potential liability of $15M or more.', 'Critical', 'Engage legal counsel for detailed litigation exposure analysis.', 'Active'),
      (3, 'Environmental', 'EPA Investigation', 'Ongoing EPA investigation into emissions compliance.', 'EPA notice dated September 2023 requesting documentation.', 'High', 'Request all EPA correspondence and compliance documentation.', 'Active'),
      (4, 'Management', 'High Executive Turnover', 'Three C-suite executives departed in last 18 months.', 'LinkedIn profiles and press releases confirm departures.', 'Medium', 'Conduct thorough management interviews and reference checks.', 'Active'),
      (5, 'Regulatory', 'FDA Warning Letter', 'FDA issued warning letter regarding manufacturing practices.', 'Warning letter dated October 2023 on FDA website.', 'Critical', 'Review FDA response and remediation plan.', 'Active'),
      (6, 'Compliance', 'AML Concerns', 'Internal audit identified potential anti-money laundering control weaknesses.', 'Internal audit report from Q2 2023.', 'High', 'Request detailed AML compliance review and remediation status.', 'Active'),
      (7, 'Financial', 'Related Party Transactions', 'Significant transactions with entities controlled by founders.', 'Footnotes in audited financials show $8M in related party deals.', 'Medium', 'Request full disclosure of all related party relationships.', 'Active'),
      (8, 'Security', 'Previous Data Breach', 'Company experienced data breach affecting 50,000 customers in 2022.', 'Press release and SEC filing from March 2022.', 'High', 'Review post-breach security improvements and insurance coverage.', 'Active'),
      (9, 'Legal', 'Patent Infringement Claims', 'Competitor has filed patent infringement lawsuit.', 'Court filing from November 2023.', 'Medium', 'Assess validity of claims and potential settlement costs.', 'Active'),
      (10, 'Operational', 'Safety Violations', 'OSHA citations for workplace safety violations.', 'OSHA inspection reports from 2023.', 'High', 'Review safety record and remediation measures.', 'Active'),
      (11, 'Financial', 'Declining Margins', 'Gross margins have declined 15% over last three years.', 'Historical financial statements show trend.', 'Medium', 'Analyze cost structure and competitive positioning.', 'Active'),
      (12, 'Product', 'FDA 483 Observations', 'Multiple FDA 483 observations during recent inspection.', 'FDA inspection report from August 2023.', 'High', 'Review response to observations and CAPA status.', 'Active'),
      (13, 'Market', 'Customer Churn Increase', 'Customer churn rate increased from 8% to 15% year-over-year.', 'Internal metrics and customer data.', 'Medium', 'Analyze root causes and customer feedback.', 'Active'),
      (14, 'Compliance', 'ITAR Violations', 'Potential violations of international traffic in arms regulations.', 'Internal compliance memo from legal department.', 'Critical', 'Engage ITAR compliance specialists for review.', 'Active'),
      (15, 'Environmental', 'Contamination Liability', 'Historical contamination at manufacturing site.', 'Environmental site assessment from 2021.', 'High', 'Conduct Phase II environmental assessment.', 'Active'),
      (16, 'Financial', 'Inventory Obsolescence', 'Significant portion of inventory may be obsolete.', 'Inventory aging report shows 30% over 12 months old.', 'Medium', 'Request detailed inventory analysis and write-off history.', 'Active')
    `);

    console.log('Red Flags seeded');

    // Seed Market Analysis (15+ items)
    await client.query(`
      INSERT INTO market_analysis (company_id, market_size, market_growth_rate, market_share, competitive_position, target_segments, geographic_presence, trends) VALUES
      (1, 25000000000, 12.5, 0.18, 'Challenger', 'Mid-market enterprises, Technology companies', 'North America, Europe', 'Cloud adoption accelerating, AI integration becoming critical'),
      (2, 45000000000, 8.2, 0.27, 'Leader', 'Hospitals, Health systems, Clinics', 'North America', 'Telehealth growth, Value-based care adoption'),
      (3, 180000000000, 15.8, 0.16, 'Fast Follower', 'Utilities, Commercial buildings, Residential', 'United States, Canada', 'Government incentives increasing, Storage technology improving'),
      (4, 68000000000, 18.5, 0.05, 'Niche Player', 'Financial services, Healthcare, Retail', 'North America, Europe', 'Real-time analytics demand growing, Edge computing emerging'),
      (5, 320000000000, 6.5, 0.16, 'Leader', 'Oncology, Immunology, Rare diseases', 'Global', 'Precision medicine growing, Biosimilar competition increasing'),
      (6, 120000000000, 11.2, 0.07, 'Challenger', 'SMBs, Enterprise, Consumers', 'North America, expanding to EU', 'Digital payments accelerating, Cryptocurrency integration'),
      (7, 550000000000, 9.8, 0.06, 'Fast Follower', 'Fashion, Electronics, Home goods', 'United States', 'Mobile commerce growing, Same-day delivery expectations'),
      (8, 42000000000, 22.5, 0.16, 'Leader', 'Enterprise, Government, Critical infrastructure', 'North America, Europe, APAC', 'Zero trust adoption, Cloud security prioritization'),
      (9, 95000000000, 25.2, 0.16, 'Fast Follower', 'Automotive OEMs, Tier 1 suppliers', 'North America, expanding globally', 'Regulatory frameworks evolving, EV integration opportunities'),
      (10, 85000000000, 5.5, 1.12, 'Niche Player', 'Food manufacturers, Grocery chains, Restaurants', 'United States Southeast', 'Cold chain technology advancing, Sustainability focus'),
      (11, 35000000000, 14.5, 0.12, 'Challenger', 'K-12, Higher education, Corporate training', 'United States, Canada', 'AI tutoring emerging, Micro-credentials growing'),
      (12, 65000000000, 7.8, 0.27, 'Leader', 'Hospitals, Ambulatory surgery centers', 'North America, Europe', 'Robotic surgery growing, Single-use devices trending'),
      (13, 18000000000, 10.5, 0.31, 'Challenger', 'Property managers, Real estate investors, Brokers', 'United States', 'PropTech investment growing, Virtual tours standardizing'),
      (14, 420000000000, 4.2, 0.10, 'Leader', 'Defense, Commercial aerospace, Space', 'United States, Allies', 'Space commercialization, Hypersonic development'),
      (15, 28000000000, 8.8, 0.28, 'Fast Follower', 'Municipalities, Industrial, Agricultural', 'United States Southwest', 'Water scarcity driving demand, Smart water systems'),
      (16, 22000000000, 12.2, 0.28, 'Challenger', 'Large farms, Agricultural cooperatives', 'United States Midwest', 'Precision ag adoption accelerating, Climate adaptation needs')
    `);

    console.log('Market Analysis seeded');

    // Seed Competitive Intelligence (15+ items)
    await client.query(`
      INSERT INTO competitive_intelligence (company_id, competitor_name, market_share, strengths, weaknesses, strategy, threat_level, notes) VALUES
      (1, 'Salesforce', 25.5, 'Strong brand, Large ecosystem, Enterprise relationships', 'High pricing, Complex implementation', 'Platform expansion, AI integration', 'High', 'Direct competitor in enterprise workflow space'),
      (1, 'ServiceNow', 18.2, 'IT service management leader, Growing platform', 'IT-centric perception, Less SMB focus', 'Expanding beyond IT, Workflow automation', 'High', 'Increasingly competitive in workflow automation'),
      (2, 'Epic Systems', 32.5, 'Market leader in EHR, Deep integrations', 'High costs, Long implementations', 'Interoperability focus, Patient engagement', 'Critical', 'Primary competitor in healthcare software'),
      (2, 'Cerner', 22.8, 'Strong acute care presence, Government contracts', 'Integration challenges, Oracle acquisition uncertainty', 'Cloud migration, Population health', 'High', 'Oracle acquisition may change competitive dynamics'),
      (3, 'NextEra Energy', 28.5, 'Scale advantage, Low cost producer', 'Less technology focused', 'Aggressive capacity expansion', 'High', 'Largest renewable energy producer'),
      (4, 'Snowflake', 12.5, 'Cloud-native architecture, Developer friendly', 'Compute costs can escalate', 'Multi-cloud strategy, Data sharing', 'High', 'Strong competitor in cloud data analytics'),
      (5, 'Roche', 22.5, 'Diagnostics integration, Strong pipeline', 'Biosimilar exposure, Pricing pressure', 'Personalized medicine, Diagnostics synergy', 'High', 'Direct competitor in oncology therapeutics'),
      (6, 'Stripe', 18.5, 'Developer experience, Global coverage', 'Enterprise features maturing', 'Embedded finance, International expansion', 'Critical', 'Major competitor in payment processing'),
      (7, 'Amazon', 42.5, 'Scale, Logistics network, Prime ecosystem', 'Seller relationship tensions', 'AWS integration, Physical retail expansion', 'Critical', 'Dominant e-commerce platform'),
      (8, 'CrowdStrike', 22.5, 'Cloud-native platform, Strong detection', 'Limited legacy support', 'Platform expansion, Identity security', 'High', 'Leader in endpoint security'),
      (9, 'Waymo', 15.5, 'Technology leader, Google resources', 'Limited vehicle partnerships', 'Robotaxi focus, Technology licensing', 'Critical', 'Most advanced autonomous technology'),
      (10, 'Lineage Logistics', 28.5, 'Global network, Cold storage scale', 'Less technology focused', 'Automation investment, Acquisitions', 'High', 'Largest cold storage operator'),
      (11, 'Coursera', 22.5, 'University partnerships, Brand recognition', 'Completion rates, Monetization', 'Enterprise focus, Degree programs', 'High', 'Leading online learning platform'),
      (12, 'Medtronic', 35.5, 'Scale, Broad portfolio, Global reach', 'Growth challenges, Regulatory issues', 'Robotics investment, Diabetes focus', 'Critical', 'Largest medical device company'),
      (13, 'CoStar', 42.5, 'Data moat, Market leadership', 'High pricing, Residential expansion risk', 'LoopNet integration, Residential push', 'High', 'Dominant in commercial real estate data'),
      (14, 'Lockheed Martin', 28.5, 'Prime contractor status, F-35 program', 'Concentration risk', 'Hypersonics, Space systems', 'Critical', 'Largest defense contractor'),
      (15, 'Xylem', 22.5, 'Global presence, Smart water leadership', 'Growth slower than market', 'Digital solutions, Emerging markets', 'High', 'Leading water technology company')
    `);

    console.log('Competitive Intelligence seeded');

    // Seed Legal Compliance (15+ items)
    await client.query(`
      INSERT INTO legal_compliance (company_id, issue_type, title, description, status, severity, regulatory_body, deadline, resolution) VALUES
      (1, 'Data Privacy', 'GDPR Compliance Review', 'Comprehensive review of GDPR compliance following EU expansion.', 'In Progress', 'High', 'EU Data Protection Authorities', '2024-06-30', NULL),
      (2, 'Healthcare', 'HIPAA Audit Findings', 'Addressing findings from recent HIPAA compliance audit.', 'Open', 'Critical', 'HHS OCR', '2024-03-15', NULL),
      (3, 'Environmental', 'EPA Emissions Compliance', 'Responding to EPA inquiry regarding emissions reporting.', 'Open', 'High', 'Environmental Protection Agency', '2024-04-30', NULL),
      (4, 'Securities', 'SEC Disclosure Review', 'Review of disclosure practices following capital raise.', 'Resolved', 'Medium', 'SEC', '2024-01-15', 'Updated disclosure procedures implemented'),
      (5, 'FDA', 'cGMP Compliance', 'Addressing FDA observations on manufacturing practices.', 'In Progress', 'Critical', 'FDA', '2024-05-30', NULL),
      (6, 'Financial', 'BSA/AML Compliance', 'Enhanced monitoring program implementation required.', 'Open', 'High', 'FinCEN', '2024-04-15', NULL),
      (7, 'Consumer', 'FTC Investigation', 'FTC inquiry into marketing practices and disclosures.', 'Open', 'Medium', 'Federal Trade Commission', '2024-06-30', NULL),
      (8, 'Cybersecurity', 'NIST Compliance', 'Implementing NIST cybersecurity framework requirements for government contracts.', 'In Progress', 'High', 'NIST/DoD', '2024-03-31', NULL),
      (9, 'Safety', 'NHTSA Safety Standards', 'Compliance with autonomous vehicle safety requirements.', 'Open', 'High', 'NHTSA', '2024-12-31', NULL),
      (10, 'Labor', 'DOL Wage Investigation', 'DOL investigation into overtime practices for drivers.', 'Open', 'Medium', 'Department of Labor', '2024-04-30', NULL),
      (11, 'Education', 'FERPA Compliance', 'Review of student data protection practices.', 'Resolved', 'Medium', 'Department of Education', '2024-02-28', 'Privacy policy updated and staff trained'),
      (12, 'Medical Device', 'MDR Compliance', 'EU Medical Device Regulation compliance for European market.', 'In Progress', 'Critical', 'EU Notified Bodies', '2024-05-26', NULL),
      (13, 'Real Estate', 'Fair Housing Compliance', 'Review of AI-based tenant screening for fair housing compliance.', 'Open', 'Medium', 'HUD', '2024-06-30', NULL),
      (14, 'Export', 'ITAR Compliance Review', 'Comprehensive ITAR compliance review following self-disclosure.', 'In Progress', 'Critical', 'State Department DDTC', '2024-04-15', NULL),
      (15, 'Environmental', 'Clean Water Act', 'Water discharge permit compliance review.', 'Resolved', 'Medium', 'EPA', '2024-01-31', 'Discharge monitoring program enhanced'),
      (16, 'Agriculture', 'EPA Pesticide Regulations', 'Compliance with EPA pesticide application requirements.', 'Open', 'Low', 'EPA', '2024-08-31', NULL)
    `);

    console.log('Legal Compliance seeded');

    // Seed Management Assessment (15+ items)
    await client.query(`
      INSERT INTO management_assessment (company_id, executive_name, title, experience_years, background, leadership_score, retention_risk, key_strengths, concerns, recommendation) VALUES
      (1, 'Michael Chen', 'CEO', 18, 'Former VP at Oracle, Stanford MBA, Founded two previous startups', 9, 'Low', 'Strategic vision, Industry relationships, Fundraising ability', 'Micromanagement tendencies', 'Retain with equity incentive'),
      (1, 'Sarah Johnson', 'CTO', 15, 'Former Google engineer, MIT PhD in Computer Science', 8, 'Medium', 'Technical expertise, Innovation culture, Team building', 'Limited M&A experience', 'Retain with technical leadership role'),
      (2, 'Dr. Robert Williams', 'CEO', 25, 'Former hospital administrator, MD from Johns Hopkins, Healthcare policy expert', 9, 'Low', 'Healthcare domain expertise, Regulatory relationships, Clinical credibility', 'Conservative growth approach', 'Essential for regulatory navigation'),
      (2, 'Jennifer Martinez', 'CFO', 20, 'Former Big Four partner, CPA, Healthcare finance specialist', 8, 'Low', 'Financial controls, M&A experience, Investor relations', 'None significant', 'Key integration resource'),
      (3, 'Thomas Green', 'CEO', 22, 'Former oil & gas executive, Transitioned to renewables 10 years ago', 7, 'Medium', 'Industry transformation experience, Government relationships', 'Oil & gas mindset may persist', 'Evaluate post-close'),
      (4, 'Amanda Lee', 'CEO', 12, 'Former data scientist at Facebook, Wharton MBA', 8, 'Medium', 'Technical credibility, Growth mindset, Recruiting ability', 'Limited public company experience', 'Provide board mentorship'),
      (5, 'Dr. James Wilson', 'CEO', 28, 'Former Pfizer executive, PhD in Biochemistry', 9, 'Low', 'Scientific leadership, FDA relationships, Pipeline development', 'Age (approaching retirement)', 'Develop succession plan'),
      (6, 'David Park', 'CEO', 14, 'Former PayPal executive, Fintech serial entrepreneur', 8, 'Medium', 'Product vision, Fintech expertise, International expansion', 'Regulatory inexperience in new markets', 'Pair with compliance advisors'),
      (7, 'Lisa Thompson', 'CEO', 20, 'Former Amazon VP, Retail operations expert', 8, 'Low', 'E-commerce expertise, Operational excellence, Vendor relationships', 'Amazon-centric approach', 'Retain for operations knowledge'),
      (8, 'Kevin Zhang', 'CEO', 16, 'Former NSA cybersecurity officer, Founded company 8 years ago', 9, 'Low', 'Security expertise, Government clearances, Technical vision', 'Limited commercial focus', 'Critical for government contracts'),
      (9, 'Patricia Moore', 'CEO', 18, 'Former Tesla engineering director, Automotive veteran', 8, 'Medium', 'Autonomous systems expertise, OEM relationships', 'Tesla culture may not translate', 'Key technical asset'),
      (10, 'Richard Brown', 'CEO', 30, 'Third-generation family business leader, Built company from regional to national', 7, 'High', 'Industry relationships, Operational knowledge', 'Family succession concerns, Change resistance', 'Critical early discussions needed'),
      (11, 'Emily Davis', 'CEO', 10, 'Former education technology executive, EdTech entrepreneur', 8, 'Medium', 'Product innovation, User experience focus', 'Limited enterprise sales experience', 'Strengthen with enterprise sales leadership'),
      (12, 'Dr. Mark Anderson', 'CEO', 24, 'Former J&J medical device executive, Surgeon background', 8, 'Low', 'Clinical credibility, Regulatory expertise, Quality focus', 'Conservative innovation approach', 'Valuable for regulatory matters'),
      (13, 'Jessica Miller', 'CEO', 12, 'Former real estate developer, PropTech pioneer', 8, 'Medium', 'Industry relationships, Product vision', 'Scaling experience limited', 'Support with experienced operators'),
      (14, 'General (Ret.) John Smith', 'CEO', 35, 'Former Air Force general, Defense industry veteran', 9, 'Low', 'Government relationships, Security clearances, Leadership', 'Commercial market unfamiliarity', 'Essential for defense contracts'),
      (15, 'Christopher Taylor', 'CEO', 18, 'Environmental engineer, Built company from startup', 8, 'Medium', 'Technical expertise, Sustainability vision', 'Founder fatigue signs', 'Address motivation and role post-close')
    `);

    console.log('Management Assessment seeded');

    // Seed Deal Pipeline (15+ items)
    await client.query(`
      INSERT INTO deal_pipeline (company_id, deal_name, deal_type, stage, valuation, offer_price, expected_close_date, lead_partner, deal_team, priority, notes) VALUES
      (1, 'Project Atlas', 'Acquisition', 'Due Diligence', 180000000, 165000000, '2024-06-30', 'John Smith', 'Smith, Johnson, Lee, Williams', 'High', 'Strategic acquisition for cloud capabilities. Strong cultural fit.'),
      (2, 'Project Horizon', 'Acquisition', 'LOI Signed', 520000000, 480000000, '2024-08-15', 'Sarah Williams', 'Williams, Chen, Davis', 'Critical', 'Healthcare platform play. Regulatory approval expected Q2.'),
      (3, 'Project Green', 'Acquisition', 'Initial Review', 1200000000, NULL, '2024-12-31', 'Michael Johnson', 'Johnson, Brown, Miller', 'Medium', 'Renewable energy expansion. Significant ESG value.'),
      (4, 'Project Insight', 'Majority Stake', 'Term Sheet', 140000000, 85000000, '2024-05-15', 'Emily Chen', 'Chen, Park, Anderson', 'High', 'Data analytics bolt-on. Synergies with existing portfolio.'),
      (5, 'Project Biotech', 'Acquisition', 'Due Diligence', 2800000000, 2500000000, '2024-09-30', 'Dr. Lisa Park', 'Park, Wilson, Thompson', 'Critical', 'Pipeline acquisition. Phase 3 data due Q1.'),
      (6, 'Project Fintech', 'Acquisition', 'Initial Review', 350000000, NULL, '2024-10-31', 'David Lee', 'Lee, Martinez, Garcia', 'Medium', 'Payment technology expansion into Europe.'),
      (7, 'Project Retail', 'Majority Stake', 'LOI Signed', 1100000000, 950000000, '2024-07-31', 'Jennifer Garcia', 'Garcia, White, Taylor', 'High', 'E-commerce platform. Integration with existing retail holdings.'),
      (8, 'Project Shield', 'Acquisition', 'Due Diligence', 280000000, 260000000, '2024-05-30', 'Kevin Zhang', 'Zhang, Moore, Harris', 'Critical', 'Cybersecurity platform. Government contract synergies.'),
      (9, 'Project Auto', 'Strategic Investment', 'Term Sheet', 600000000, 150000000, '2024-06-15', 'Robert Thompson', 'Thompson, Clark, Lewis', 'High', 'Autonomous technology stake. Partnership potential with portfolio.'),
      (10, 'Project Cold', 'Acquisition', 'Initial Review', 380000000, NULL, '2024-11-30', 'Michelle Davis', 'Davis, Robinson, Hall', 'Medium', 'Cold chain logistics expansion. Southeast footprint.'),
      (11, 'Project Learn', 'Acquisition', 'Term Sheet', 168000000, 155000000, '2024-04-30', 'Amanda Wilson', 'Wilson, Young, King', 'Medium', 'EdTech platform acquisition. Enterprise training synergies.'),
      (12, 'Project Med', 'Acquisition', 'Due Diligence', 720000000, 680000000, '2024-07-15', 'Dr. James Harris', 'Harris, Scott, Green', 'High', 'Medical device consolidation. Strong margin profile.'),
      (13, 'Project Property', 'Majority Stake', 'LOI Signed', 220000000, 195000000, '2024-05-31', 'Christopher Adams', 'Adams, Baker, Nelson', 'Medium', 'PropTech investment. AI-driven valuation technology.'),
      (14, 'Project Aero', 'Strategic Investment', 'Initial Review', 1800000000, NULL, '2024-12-31', 'General (Ret.) John Collins', 'Collins, Wright, Mitchell', 'High', 'Defense technology stake. Space systems capability.'),
      (15, 'Project Water', 'Acquisition', 'Term Sheet', 312000000, 290000000, '2024-06-30', 'Thomas Green', 'Green, Hill, Campbell', 'Medium', 'Water technology platform. Infrastructure play.'),
      (16, 'Project Farm', 'Acquisition', 'Due Diligence', 248000000, 230000000, '2024-05-15', 'Patricia Moore', 'Moore, Phillips, Turner', 'High', 'AgTech consolidation. Precision agriculture leader.')
    `);

    console.log('Deal Pipeline seeded');

    // ===== NEW AI FEATURES DATA =====

    // Seed Risk Scores (15+ items)
    await client.query(`
      INSERT INTO risk_scores (company_id, deal_name, financial_risk_score, operational_risk_score, market_risk_score, legal_risk_score, integration_risk_score, overall_risk_score, risk_category, key_risk_factors, risk_mitigation_suggestions, confidence_level) VALUES
      (1, 'Project Atlas', 6.2, 5.8, 4.5, 3.2, 5.5, 5.0, 'Medium', 'Legacy technology debt, Customer concentration in tech sector', 'Implement technology modernization roadmap, Diversify customer base post-acquisition', 85.0),
      (2, 'Project Horizon', 4.5, 5.2, 3.8, 7.5, 6.2, 5.4, 'Medium', 'HIPAA compliance gaps, Regulatory approval timeline uncertainty', 'Engage specialized healthcare compliance consultants, Build regulatory contingency into timeline', 82.0),
      (3, 'Project Green', 7.8, 6.5, 5.2, 8.2, 7.0, 6.9, 'High', 'EPA investigation ongoing, High capital intensity, Policy uncertainty', 'Complete environmental due diligence, Structure deal with regulatory contingencies', 75.0),
      (4, 'Project Insight', 4.2, 4.5, 5.8, 2.8, 4.0, 4.3, 'Low', 'Limited customer diversification, Competitive market dynamics', 'Accelerate sales team expansion post-close, Focus on enterprise segment growth', 88.0),
      (5, 'Project Biotech', 8.5, 5.5, 6.2, 7.8, 6.8, 6.9, 'High', 'Phase 3 trial uncertainty, FDA regulatory pathway complexity, High R&D burn rate', 'Structure milestone-based earnout, Obtain FDA pre-submission feedback before close', 70.0),
      (6, 'Project Fintech', 5.5, 4.8, 6.5, 6.8, 5.2, 5.8, 'Medium', 'International regulatory complexity, AML compliance requirements', 'Hire local compliance teams in target markets, Phase market entry approach', 80.0),
      (7, 'Project Retail', 6.8, 7.2, 7.5, 4.2, 7.8, 6.7, 'High', 'Amazon competitive pressure, Supply chain vulnerability, Integration complexity', 'Develop differentiated value proposition, Build supplier redundancy, Extended integration planning', 78.0),
      (8, 'Project Shield', 3.8, 4.2, 4.5, 5.5, 4.8, 4.6, 'Low', 'Government contract concentration, Security clearance requirements', 'Expand commercial customer base, Ensure clearance continuity during transition', 85.0),
      (9, 'Project Auto', 7.5, 6.8, 8.2, 7.2, 6.5, 7.2, 'High', 'Autonomous vehicle liability uncertainty, Technology validation requirements, OEM dependency', 'Structure as minority stake to limit exposure, Negotiate protective provisions', 72.0),
      (10, 'Project Cold', 5.8, 6.5, 4.8, 5.2, 6.2, 5.7, 'Medium', 'Labor market challenges, Fuel cost exposure, Regional concentration', 'Invest in automation, Hedge fuel costs, Expand geographic footprint', 80.0),
      (11, 'Project Learn', 4.5, 4.2, 6.8, 3.5, 4.5, 4.7, 'Low', 'Market competition increasing, Monetization model evolution', 'Focus on B2B enterprise segment, Develop AI-powered differentiation', 85.0),
      (12, 'Project Med', 5.2, 6.5, 4.5, 7.5, 5.8, 5.9, 'Medium', 'FDA 483 observations, Product recall history, EU MDR compliance', 'Conduct thorough quality system review, Budget for MDR compliance costs', 78.0),
      (13, 'Project Property', 5.5, 4.5, 7.2, 4.8, 4.2, 5.2, 'Medium', 'Real estate market cyclicality, Fair housing AI concerns', 'Develop counter-cyclical features, Conduct AI bias audit', 82.0),
      (14, 'Project Aero', 6.2, 5.5, 4.2, 8.5, 6.8, 6.2, 'Medium', 'ITAR compliance complexity, Defense budget uncertainty, Classified program exposure', 'Structure with CFIUS considerations, Diversify commercial aerospace focus', 75.0),
      (15, 'Project Water', 4.8, 5.2, 4.5, 5.5, 4.8, 4.9, 'Low', 'Water rights complexity, Municipal contract concentration', 'Conduct water rights legal review, Diversify customer mix', 85.0),
      (16, 'Project Farm', 5.5, 6.2, 5.8, 4.2, 5.5, 5.4, 'Medium', 'Climate exposure, Commodity price correlation, Technology adoption curve', 'Develop climate risk mitigation features, Build recurring revenue model', 80.0)
    `);

    console.log('Risk Scores seeded');

    // Seed Synergy Calculations (15+ items)
    await client.query(`
      INSERT INTO synergy_calculations (company_id, deal_name, acquirer_name, revenue_synergy, cost_synergy, tax_synergy, total_synergy, synergy_timeline_months, probability_of_achievement, synergy_categories, implementation_costs, net_synergy_value) VALUES
      (1, 'Project Atlas', 'TechGiant Corp', 12500000, 8200000, 2100000, 22800000, 36, 75.0, 'Cross-selling to enterprise customers, Consolidate cloud infrastructure, Eliminate duplicate R&D', 4500000, 18300000),
      (2, 'Project Horizon', 'HealthCare Partners', 28000000, 18500000, 5200000, 51700000, 48, 70.0, 'Integrated care management platform, Shared administrative services, Combined payer negotiations', 12000000, 39700000),
      (3, 'Project Green', 'Energy Holdings Inc', 45000000, 32000000, 8500000, 85500000, 60, 65.0, 'Combined power purchase agreements, Shared maintenance operations, Tax credit optimization', 22000000, 63500000),
      (4, 'Project Insight', 'DataCorp Global', 8500000, 5200000, 1200000, 14900000, 24, 80.0, 'Analytics platform integration, Shared data science team, Combined enterprise sales', 2800000, 12100000),
      (5, 'Project Biotech', 'Pharma Global Inc', 125000000, 45000000, 18000000, 188000000, 60, 55.0, 'Combined R&D capabilities, Shared manufacturing, Global distribution leverage', 35000000, 153000000),
      (6, 'Project Fintech', 'BankTech Holdings', 18500000, 12200000, 3500000, 34200000, 36, 72.0, 'Cross-border payment integration, Shared compliance infrastructure, Combined merchant network', 8500000, 25700000),
      (7, 'Project Retail', 'Commerce Partners', 52000000, 38000000, 9500000, 99500000, 48, 68.0, 'Combined marketplace, Shared fulfillment network, Unified customer data platform', 28000000, 71500000),
      (8, 'Project Shield', 'CyberDefense Corp', 15200000, 9800000, 2800000, 27800000, 30, 78.0, 'Integrated security platform, Shared SOC operations, Combined government contracts', 5500000, 22300000),
      (9, 'Project Auto', 'AutoMotive Holdings', 32000000, 18000000, 4500000, 54500000, 48, 60.0, 'Shared ADAS development, Combined testing infrastructure, Joint OEM negotiations', 15000000, 39500000),
      (10, 'Project Cold', 'Logistics Partners LLC', 22000000, 15500000, 3800000, 41300000, 36, 72.0, 'Network optimization, Fleet consolidation, Shared cold storage facilities', 9500000, 31800000),
      (11, 'Project Learn', 'EduGlobal Inc', 9800000, 6500000, 1800000, 18100000, 30, 75.0, 'Combined content library, Shared LMS platform, Unified corporate sales', 3500000, 14600000),
      (12, 'Project Med', 'MedTech Holdings', 38000000, 25000000, 6200000, 69200000, 42, 70.0, 'Combined surgical portfolio, Shared manufacturing, Unified regulatory affairs', 15500000, 53700000),
      (13, 'Project Property', 'RealEstate Tech Corp', 12500000, 8800000, 2200000, 23500000, 30, 75.0, 'Integrated property management, Shared data analytics, Combined broker network', 5200000, 18300000),
      (14, 'Project Aero', 'DefenseTech Inc', 65000000, 42000000, 12000000, 119000000, 60, 62.0, 'Combined satellite capabilities, Shared classified facilities, Integrated supply chain', 32000000, 87000000),
      (15, 'Project Water', 'Infrastructure Partners', 18000000, 12500000, 3200000, 33700000, 36, 72.0, 'Combined treatment networks, Shared engineering resources, Municipal contract leverage', 7800000, 25900000),
      (16, 'Project Farm', 'AgriHoldings Corp', 14500000, 9200000, 2500000, 26200000, 36, 70.0, 'Integrated precision ag platform, Shared distribution, Combined farmer network', 6200000, 20000000)
    `);

    console.log('Synergy Calculations seeded');

    // Seed Valuation Models (15+ items)
    await client.query(`
      INSERT INTO valuation_models (company_id, deal_name, dcf_valuation, comparable_companies_valuation, precedent_transactions_valuation, lbo_valuation, asset_based_valuation, weighted_average_valuation, valuation_range_low, valuation_range_high, implied_ev_ebitda_multiple, implied_ev_revenue_multiple, key_assumptions) VALUES
      (1, 'Project Atlas', 165000000, 185000000, 195000000, 145000000, 125000000, 175000000, 155000000, 195000000, 21.5, 3.9, 'WACC 12%, Terminal growth 3%, Revenue growth 18% CAGR over 5 years'),
      (2, 'Project Horizon', 485000000, 520000000, 545000000, 420000000, 380000000, 505000000, 460000000, 545000000, 23.4, 4.2, 'WACC 10%, Terminal growth 2.5%, Healthcare sector premium applied'),
      (3, 'Project Green', 1150000000, 1250000000, 1320000000, 980000000, 1450000000, 1180000000, 1050000000, 1350000000, 23.4, 4.2, 'WACC 9%, Green premium 15%, Government incentive assumptions'),
      (4, 'Project Insight', 125000000, 145000000, 155000000, 105000000, 85000000, 138000000, 115000000, 160000000, 21.9, 3.9, 'WACC 14%, High growth SaaS multiples, Revenue growth 25% CAGR'),
      (5, 'Project Biotech', 2450000000, 2850000000, 3100000000, 1800000000, 2200000000, 2680000000, 2200000000, 3200000000, 26.8, 5.4, 'Risk-adjusted NPV for pipeline, Phase 3 success probability 65%'),
      (6, 'Project Fintech', 320000000, 365000000, 385000000, 280000000, 245000000, 345000000, 300000000, 400000000, 21.5, 3.9, 'WACC 13%, Fintech growth premium, International expansion potential'),
      (7, 'Project Retail', 980000000, 1120000000, 1180000000, 850000000, 920000000, 1050000000, 920000000, 1200000000, 21.9, 3.3, 'WACC 11%, E-commerce multiple compression considered'),
      (8, 'Project Shield', 245000000, 285000000, 305000000, 215000000, 185000000, 268000000, 235000000, 310000000, 22.2, 4.0, 'WACC 12%, Government contract pipeline valued separately'),
      (9, 'Project Auto', 550000000, 620000000, 680000000, 420000000, 480000000, 580000000, 500000000, 700000000, 21.5, 3.9, 'WACC 15%, Technology validation discount, OEM contract value'),
      (10, 'Project Cold', 350000000, 395000000, 420000000, 310000000, 380000000, 375000000, 330000000, 430000000, 26.3, 3.9, 'WACC 10%, Asset-intensive business, Real estate value included'),
      (11, 'Project Learn', 155000000, 175000000, 185000000, 135000000, 105000000, 168000000, 145000000, 190000000, 22.2, 4.0, 'WACC 13%, EdTech market multiples, User growth assumptions'),
      (12, 'Project Med', 650000000, 720000000, 780000000, 580000000, 620000000, 695000000, 620000000, 800000000, 22.1, 4.0, 'WACC 11%, Medical device sector multiples, FDA approval assumptions'),
      (13, 'Project Property', 195000000, 225000000, 245000000, 165000000, 175000000, 212000000, 185000000, 250000000, 21.4, 3.9, 'WACC 12%, PropTech premium, Real estate cycle considerations'),
      (14, 'Project Aero', 1650000000, 1850000000, 1980000000, 1400000000, 1550000000, 1780000000, 1550000000, 2050000000, 23.5, 4.2, 'WACC 10%, Defense premium, Contract backlog valued'),
      (15, 'Project Water', 285000000, 320000000, 345000000, 250000000, 275000000, 305000000, 270000000, 355000000, 21.7, 3.9, 'WACC 10%, Infrastructure premium, Municipal contract stability'),
      (16, 'Project Farm', 225000000, 255000000, 275000000, 195000000, 185000000, 245000000, 210000000, 285000000, 22.6, 4.0, 'WACC 12%, AgTech growth premium, Climate adaptation value')
    `);

    console.log('Valuation Models seeded');

    // Seed Red Flag Detections (15+ items)
    await client.query(`
      INSERT INTO red_flag_detections (company_id, deal_name, flag_type, severity_level, flag_title, flag_description, supporting_evidence, deal_breaker_potential, recommended_action, investigation_status) VALUES
      (1, 'Project Atlas', 'Financial', 'Medium', 'Aggressive Revenue Recognition', 'Revenue recognition timing appears aggressive with significant Q4 loading pattern.', 'Financial statements show 45% of annual revenue in Q4, channel stuffing indicators present', FALSE, 'Conduct detailed revenue recognition audit, review customer contracts for return provisions', 'In Progress'),
      (2, 'Project Horizon', 'Regulatory', 'High', 'HIPAA Compliance Deficiencies', 'Internal audit revealed gaps in HIPAA security controls and breach notification procedures.', 'Internal audit report Q3 2023, HHS inquiry letter dated October 2023', FALSE, 'Engage healthcare compliance specialist, develop remediation roadmap with timeline', 'In Progress'),
      (3, 'Project Green', 'Legal', 'Critical', 'Active EPA Investigation', 'Ongoing EPA investigation into emissions reporting accuracy and permit violations.', 'EPA Notice of Violation dated September 2023, internal environmental audit findings', TRUE, 'Assess potential penalties and remediation costs, consider deal structure modifications', 'Pending'),
      (4, 'Project Insight', 'Operational', 'Low', 'Key Person Dependency', 'Significant reliance on two co-founders for customer relationships and product direction.', 'Customer interviews indicate founder relationships critical, limited management depth', FALSE, 'Structure retention packages, develop management succession plan', 'Resolved'),
      (5, 'Project Biotech', 'Regulatory', 'Critical', 'FDA Warning Letter Outstanding', 'Unresolved FDA warning letter regarding manufacturing facility GMP compliance.', 'FDA Warning Letter dated August 2023, company response pending review', TRUE, 'Require FDA clearance as closing condition, assess manufacturing remediation timeline', 'In Progress'),
      (6, 'Project Fintech', 'Compliance', 'High', 'AML Control Weaknesses', 'BSA/AML audit identified material weaknesses in transaction monitoring and SAR filing.', 'FinCEN examination report Q2 2023, consent order potential', FALSE, 'Engage AML remediation specialists, budget for enhanced compliance infrastructure', 'In Progress'),
      (7, 'Project Retail', 'Financial', 'Medium', 'Related Party Transactions', 'Significant vendor relationships with entities controlled by founding family members.', 'Audited financial statement footnotes, $12M annual related party purchases', FALSE, 'Conduct transfer pricing review, negotiate arm length terms post-close', 'In Progress'),
      (8, 'Project Shield', 'Security', 'Medium', 'Prior Security Incident', 'Customer data exposure incident in 2022 affecting 50,000 records, remediation completed.', 'Press release March 2022, insurance claim documentation, post-incident audit report', FALSE, 'Verify remediation effectiveness, review cyber insurance coverage adequacy', 'Resolved'),
      (9, 'Project Auto', 'Legal', 'High', 'Patent Litigation Exposure', 'Competitor patent infringement lawsuit with damages claim of $50M.', 'Federal court filing November 2023, preliminary injunction hearing scheduled', FALSE, 'Obtain litigation risk assessment, consider indemnification provisions', 'Pending'),
      (10, 'Project Cold', 'Operational', 'High', 'OSHA Safety Violations', 'Multiple OSHA citations for workplace safety violations at distribution facilities.', 'OSHA inspection reports 2023, $850K in proposed penalties', FALSE, 'Review safety program, budget for facility upgrades, assess insurance implications', 'In Progress'),
      (11, 'Project Learn', 'Market', 'Medium', 'Increasing Customer Churn', 'Annual customer churn rate increased from 8% to 15% over past two years.', 'Internal customer analytics, exit survey data, competitor win-back analysis', FALSE, 'Analyze churn drivers, develop retention improvement plan', 'In Progress'),
      (12, 'Project Med', 'Regulatory', 'High', 'FDA 483 Observations', 'Recent FDA inspection resulted in multiple 483 observations regarding quality systems.', 'FDA Form 483 dated August 2023, 12 observations across 3 facilities', FALSE, 'Review CAPA responses, assess quality system remediation timeline and cost', 'In Progress'),
      (13, 'Project Property', 'Legal', 'Medium', 'Fair Housing AI Concerns', 'Tenant screening algorithm may have disparate impact on protected classes.', 'Internal audit flagged potential issues, no regulatory action to date', FALSE, 'Conduct algorithm bias audit, engage fair housing legal counsel', 'Pending'),
      (14, 'Project Aero', 'Compliance', 'Critical', 'ITAR Self-Disclosure', 'Company self-disclosed potential ITAR violations to State Department DDTC.', 'Self-disclosure letter October 2023, internal investigation report', TRUE, 'Assess penalty exposure, require resolution as closing condition', 'In Progress'),
      (15, 'Project Water', 'Environmental', 'Medium', 'Historical Site Contamination', 'Phase I environmental assessment identified historical contamination at primary facility.', 'Phase I ESA report 2023, contamination predates company ownership', FALSE, 'Conduct Phase II assessment, negotiate environmental indemnification', 'In Progress'),
      (16, 'Project Farm', 'Financial', 'Medium', 'Inventory Obsolescence Risk', 'Significant aging inventory with 30% of stock over 12 months old.', 'Inventory aging reports, slow-moving SKU analysis', FALSE, 'Negotiate inventory adjustment mechanism, review write-off history', 'Resolved')
    `);

    console.log('Red Flag Detections seeded');

    // Seed Integration Plans (15+ items)
    await client.query(`
      INSERT INTO integration_plans (company_id, deal_name, integration_approach, day_one_priorities, first_100_days_plan, organizational_structure, technology_integration, cultural_integration, key_milestones, estimated_integration_costs, integration_timeline_months, risk_mitigation_plan, success_metrics) VALUES
      (1, 'Project Atlas', 'Bolt-on Integration', 'Announce deal to employees, Secure key talent, Establish integration PMO, Communicate to customers', 'Integrate sales teams, Begin technology assessment, Align product roadmaps, Consolidate vendor contracts', 'CEO reports to Group CTO, Maintain separate engineering teams initially, Integrate sales under unified leadership', 'Migrate to shared cloud infrastructure within 12 months, Integrate authentication systems by day 30, API unification within 6 months', 'Joint leadership offsites, Mixed team projects, Unified company events, Transparent communication channels', 'Day 1: Deal announcement, Day 30: Integration plan finalized, Day 60: First revenue synergy, Day 90: Technology integration kickoff, Month 12: Full operational integration', 4500000, 18, 'Retention packages for key employees, Customer communication plan, Technology contingency backup, Dedicated integration team', 'Employee retention >90%, Customer retention >95%, Revenue synergy achievement 75%+, Integration on timeline'),
      (2, 'Project Horizon', 'Strategic Merger', 'Leadership alignment meeting, Regulatory notification, Patient care continuity plan, Provider communication', 'Integrate clinical systems, Align compliance programs, Unify payer contracting, Consolidate administrative functions', 'Merged leadership team, Combined clinical operations, Unified technology organization, Integrated compliance function', 'EHR integration within 24 months, Shared clinical data warehouse by month 12, Unified patient portal by month 18', 'Clinical culture preservation, Value-based care alignment, Quality-first integration approach, Joint clinical committees', 'Day 1: Joint leadership announcement, Day 90: Clinical integration plan, Month 6: Compliance alignment, Month 12: Administrative consolidation, Month 24: Full system integration', 12000000, 30, 'Clinical continuity protocols, Regulatory compliance monitoring, Provider retention program, Patient communication strategy', 'Quality metrics maintained, Provider satisfaction >85%, Patient NPS stable, Regulatory compliance 100%'),
      (3, 'Project Green', 'Holding Company Model', 'Operational continuity confirmation, Regulatory stakeholder notification, Employee town halls, Safety protocols review', 'Maintain operational independence, Share best practices, Begin procurement consolidation, Align safety standards', 'Maintain separate operating companies initially, Shared services for finance and HR, Coordinated regulatory affairs, Joint capital planning', 'Shared operational monitoring systems, Unified financial reporting, Common procurement platform, Coordinated maintenance scheduling', 'Safety-first culture alignment, Environmental stewardship focus, Innovation sharing program, Cross-facility learning', 'Day 1: Operational continuity, Day 30: Shared services planning, Day 90: Procurement integration, Month 12: Operational optimization, Month 24: Full integration assessment', 22000000, 36, 'Operational redundancy protocols, Regulatory compliance continuity, Environmental monitoring enhancement, Safety audit schedule', 'Safety record improvement, Environmental compliance 100%, Cost synergy achievement, Operational efficiency gains'),
      (4, 'Project Insight', 'Full Integration', 'Welcome announcement, Technology access provisioning, Customer communication, Sales team alignment', 'Integrate analytics platforms, Unify customer success, Consolidate engineering teams, Align go-to-market', 'Absorbed into Data Analytics division, Founders in advisory roles, Engineering reports to CTO, Sales integrated with enterprise team', 'Platform integration within 6 months, Unified data architecture, Shared analytics infrastructure, Common tool stack', 'Start-up energy preservation, Innovation culture maintenance, Agile methodology alignment, Product-focused values', 'Day 1: Team welcome, Day 30: Platform integration planning, Day 60: First product integration, Day 90: Sales alignment complete, Month 6: Full technical integration', 2800000, 12, 'Founder retention agreements, Customer migration support, Technology rollback plan, Team morale monitoring', 'Product integration success, Customer satisfaction maintained, Engineering velocity preserved, Revenue growth acceleration'),
      (5, 'Project Biotech', 'R&D Partnership Model', 'Scientific leadership alignment, Regulatory notification, Pipeline prioritization discussion, Employee communication', 'Maintain R&D independence, Integrate clinical operations, Align regulatory strategy, Share manufacturing capacity', 'Independent R&D organization, Combined regulatory affairs, Shared manufacturing, Coordinated commercial planning', 'Shared laboratory information systems, Integrated clinical trial management, Common manufacturing execution systems, Unified quality systems', 'Scientific freedom preservation, Innovation culture protection, Research collaboration promotion, Publication policy alignment', 'Day 1: Scientific leadership meeting, Day 90: Pipeline prioritization, Month 6: Manufacturing integration, Month 12: Regulatory alignment, Month 24: Commercial preparation', 35000000, 48, 'Key scientist retention, Clinical trial continuity, Manufacturing quality maintenance, IP protection protocols', 'Pipeline advancement milestones, Clinical trial success rates, Manufacturing quality metrics, Regulatory approval timeline'),
      (6, 'Project Fintech', 'Platform Integration', 'Leadership announcement, Customer communication, Regulatory notification, Employee alignment', 'Integrate payment platforms, Unify compliance systems, Align product roadmaps, Consolidate operations', 'Combined technology leadership, Unified compliance organization, Integrated product teams, Shared operations center', 'Payment system integration within 12 months, Unified customer authentication, Shared fraud detection, Common reporting', 'Innovation mindset preservation, Customer-focus alignment, Compliance culture embedding, Agile team structures', 'Day 1: Joint announcement, Day 30: Integration planning, Day 90: Compliance alignment, Month 6: Platform integration start, Month 12: Full payment integration', 8500000, 18, 'Customer migration planning, Regulatory compliance continuity, Payment system redundancy, Fraud prevention maintenance', 'Payment volume growth, Customer satisfaction, Compliance metrics, Fraud rate maintenance'),
      (7, 'Project Retail', 'Marketplace Merger', 'Seller communication, Customer notification, Operations continuity, Leadership alignment', 'Integrate marketplaces, Unify fulfillment, Align customer experience, Consolidate vendor relationships', 'Combined marketplace leadership, Unified operations, Integrated technology, Shared customer service', 'Marketplace platform merger within 18 months, Unified inventory management, Shared fulfillment network, Common customer platform', 'Seller relationship focus, Customer experience priority, Operational excellence alignment, Innovation culture merger', 'Day 1: Seller announcement, Day 30: Fulfillment planning, Day 90: Technology assessment, Month 6: Marketplace integration start, Month 18: Full platform merger', 28000000, 24, 'Seller retention program, Customer experience maintenance, Fulfillment continuity, Technology migration testing', 'Seller retention >90%, Customer satisfaction maintained, Fulfillment SLA maintenance, GMV growth'),
      (8, 'Project Shield', 'Capability Integration', 'Security clearance coordination, Customer notification, Employee clearance verification, Leadership alignment', 'Integrate security platforms, Combine SOC operations, Align government contracts, Unify commercial sales', 'Combined security leadership, Unified SOC organization, Integrated sales team, Shared engineering', 'Security platform integration within 12 months, Unified threat intelligence, Shared SOC infrastructure, Common tools', 'Security-first culture, Government contract focus, Commercial growth mindset, Innovation preservation', 'Day 1: Leadership alignment, Day 30: Security integration planning, Day 60: SOC consolidation start, Day 90: Platform roadmap, Month 12: Full integration', 5500000, 15, 'Clearance continuity protocols, Customer contract maintenance, Security platform redundancy, Talent retention', 'Contract retention 100%, Security metrics improvement, Revenue growth, Employee retention >95%'),
      (9, 'Project Auto', 'Technology Partnership', 'Technology leadership meeting, OEM notification, IP protection protocols, Employee communication', 'Maintain technology independence, Share development resources, Coordinate OEM relationships, Align regulatory approach', 'Independent technology unit, Shared testing facilities, Coordinated OEM engagement, Joint regulatory affairs', 'Shared simulation infrastructure, Common testing platforms, Coordinated data sharing, Aligned development tools', 'Innovation culture preservation, Engineering excellence focus, Safety-first mentality, Collaborative development', 'Day 1: Partnership announcement, Day 30: Technology roadmap alignment, Day 90: Testing facility sharing, Month 6: Development coordination, Month 12: Joint product planning', 15000000, 24, 'IP protection protocols, OEM relationship management, Technology validation maintenance, Safety testing continuity', 'Technology milestones achieved, OEM contract maintenance, Safety validation progress, Development velocity'),
      (10, 'Project Cold', 'Operations Integration', 'Employee town halls, Customer notification, Fleet assessment, Facility evaluation', 'Integrate logistics networks, Optimize fleet utilization, Align temperature protocols, Consolidate facilities', 'Combined operations leadership, Unified fleet management, Integrated facility network, Shared customer service', 'Fleet management system integration, Unified temperature monitoring, Shared facility management, Common customer platform', 'Safety culture alignment, Service excellence focus, Operational efficiency priority, Employee value proposition', 'Day 1: Operations announcement, Day 30: Network optimization planning, Day 60: Fleet integration start, Day 90: Facility assessment, Month 12: Full network integration', 9500000, 18, 'Service continuity protocols, Temperature monitoring redundancy, Fleet maintenance continuity, Customer communication plan', 'Service level maintenance, Temperature compliance 100%, Fleet utilization improvement, Customer retention >95%'),
      (11, 'Project Learn', 'Product Integration', 'User communication, Educator notification, Content preservation plan, Team alignment', 'Integrate learning platforms, Unify content libraries, Align product vision, Consolidate engineering', 'Combined product leadership, Unified content organization, Integrated engineering, Shared customer success', 'Platform integration within 9 months, Unified content management, Shared learning analytics, Common authoring tools', 'Learner-first culture, Educational quality focus, Innovation preservation, Instructor community engagement', 'Day 1: User announcement, Day 30: Platform assessment, Day 60: Content migration planning, Day 90: Engineering alignment, Month 9: Full platform integration', 3500000, 12, 'User experience continuity, Content migration validation, Educator communication, Feature parity maintenance', 'User engagement maintained, Course completion rates, Educator satisfaction, Platform performance'),
      (12, 'Project Med', 'Quality-First Integration', 'FDA notification, Customer communication, Quality system assessment, Employee alignment', 'Maintain quality independence initially, Assess manufacturing synergies, Align regulatory strategy, Plan facility optimization', 'Combined regulatory leadership, Separate quality organizations initially, Coordinated manufacturing, Unified commercial', 'Quality system harmonization within 24 months, Shared manufacturing execution, Unified regulatory submissions, Common complaint handling', 'Quality culture preservation, Patient safety priority, Regulatory excellence focus, Innovation encouragement', 'Day 1: Regulatory notification, Day 30: Quality assessment, Day 90: Manufacturing evaluation, Month 12: Quality harmonization start, Month 24: Full quality integration', 15500000, 30, 'Quality system continuity, Manufacturing validation, Regulatory compliance maintenance, Customer complaint handling', 'Quality metrics maintained, FDA compliance 100%, Customer satisfaction, Manufacturing efficiency'),
      (13, 'Project Property', 'Technology Integration', 'Customer communication, Broker notification, Data migration planning, Team alignment', 'Integrate property platforms, Unify data systems, Align product roadmaps, Consolidate customer success', 'Combined product leadership, Unified technology organization, Integrated sales, Shared customer support', 'Platform integration within 9 months, Unified property database, Shared analytics engine, Common customer interface', 'Customer-centric culture, Data quality focus, Innovation mindset, Real estate expertise preservation', 'Day 1: Customer announcement, Day 30: Data assessment, Day 60: Platform planning, Day 90: Integration kickoff, Month 9: Full platform integration', 5200000, 12, 'Customer data migration, Platform performance maintenance, Broker relationship management, Feature transition plan', 'Customer retention >95%, Data quality maintained, Platform performance, Revenue growth'),
      (14, 'Project Aero', 'Defense Program Continuity', 'Security coordination, Government notification, Clearance verification, Employee communication', 'Maintain program separation, Coordinate cleared facilities, Align ITAR compliance, Plan commercial synergies', 'Separate defense organization, Unified commercial aerospace, Coordinated security, Shared corporate functions', 'Classified system separation, Commercial integration, Shared corporate systems, Coordinated R&D tools', 'Security-first culture, Mission focus preservation, Commercial innovation encouragement, Engineering excellence', 'Day 1: Government notification, Day 30: Security assessment, Day 90: Commercial planning, Month 12: Commercial integration, Month 24: Full organizational alignment', 32000000, 36, 'Security clearance protocols, Program continuity, ITAR compliance maintenance, Government relationship management', 'Contract performance maintained, Security compliance 100%, Commercial revenue growth, Employee retention'),
      (15, 'Project Water', 'Municipal Partnership Model', 'Municipal customer notification, Regulatory coordination, Operations continuity, Employee alignment', 'Maintain municipal relationships, Integrate treatment operations, Align engineering capabilities, Consolidate support', 'Combined operations leadership, Unified engineering, Integrated customer service, Shared corporate functions', 'Operations monitoring integration, Unified SCADA systems, Shared engineering tools, Common customer platform', 'Public service culture, Environmental stewardship, Operational excellence, Community partnership focus', 'Day 1: Municipal notification, Day 30: Operations assessment, Day 60: Engineering alignment, Day 90: Service integration, Month 12: Full operations integration', 7800000, 15, 'Service continuity protocols, Water quality maintenance, Municipal relationship management, Environmental compliance', 'Service reliability maintained, Water quality metrics, Customer satisfaction, Environmental compliance 100%'),
      (16, 'Project Farm', 'AgTech Integration', 'Farmer communication, Dealer notification, Technology assessment, Team alignment', 'Integrate precision ag platforms, Unify farmer services, Align product development, Consolidate support', 'Combined product leadership, Unified field services, Integrated technology, Shared customer success', 'Platform integration within 12 months, Unified farm data systems, Shared IoT infrastructure, Common analytics', 'Farmer-first culture, Agricultural expertise preservation, Technology innovation focus, Sustainability commitment', 'Day 1: Farmer announcement, Day 30: Technology assessment, Day 60: Field service planning, Day 90: Platform roadmap, Month 12: Full platform integration', 6200000, 15, 'Planting season continuity, Farmer relationship management, Data migration validation, Service coverage maintenance', 'Farmer satisfaction maintained, Platform adoption growth, Service coverage, Yield improvement metrics')
    `);

    console.log('Integration Plans seeded');

    console.log('Database seeding completed successfully!');

  } catch (error) {
    console.error('Error seeding database:', error);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

seedDatabase().catch(console.error);
