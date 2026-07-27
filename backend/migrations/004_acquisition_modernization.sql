CREATE TABLE IF NOT EXISTS acquisition_modernization_initiatives(
 id BIGSERIAL PRIMARY KEY,initiative_ref TEXT NOT NULL UNIQUE,business_name TEXT NOT NULL,industry TEXT NOT NULL,
 workflow_name TEXT NOT NULL,current_system TEXT NOT NULL,annual_labor_cost NUMERIC(14,2) NOT NULL,
 automation_feasibility_pct NUMERIC(5,2) NOT NULL,implementation_cost NUMERIC(14,2) NOT NULL,
 annual_value_potential NUMERIC(14,2) NOT NULL,payback_months NUMERIC(7,2) NOT NULL,
 workforce_plan JSONB NOT NULL DEFAULT '{}'::jsonb,control_plan JSONB NOT NULL DEFAULT '{}'::jsonb,
 owner TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN('diligence','design','pilot','scale','verified')),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO acquisition_modernization_initiatives(initiative_ref,business_name,industry,workflow_name,current_system,annual_labor_cost,automation_feasibility_pct,implementation_cost,annual_value_potential,payback_months,workforce_plan,control_plan,owner,status)
SELECT 'MOD-'||LPAD(g::text,3,'0'),
 (ARRAY['Northstar HVAC Services','Harbor Title Services','Metro Lab Supply','Summit Property Inspections','Evergreen Claims Administration'])[((g-1)%5)+1]||' · Unit '||CEIL(g/5.0)::int,
 (ARRAY['Field services','Title and escrow','Laboratory distribution','Property inspection','Claims administration'])[((g-1)%5)+1],
 (ARRAY['Dispatch and technician scheduling','Document intake and exception review','Purchase-order reconciliation','Inspection report preparation','Claim document classification'])[((g-1)%5)+1],
 (ARRAY['Whiteboards and phone calls','Email and desktop folders','Spreadsheet and legacy ERP','Paper forms and shared drive','Email queues and manual indexing'])[((g-1)%5)+1],
 180000+g*22000,48+(g%8)*6,55000+g*7500,130000+g*31000,4+(g%7)*1.4,
 jsonb_build_object('rolesAffected',3+(g%8),'redeploymentRole',(ARRAY['customer success lead','exception reviewer','vendor performance analyst','quality supervisor','claims resolution specialist'])[((g-1)%5)+1],'layoffAssumption',false),
 jsonb_build_object('humanApproval','Required for consequential actions','rollback','Documented pilot rollback','successMetric','Cycle time, quality, and customer outcome'),
 (ARRAY['Operating Partner','Portfolio CTO','Transformation Lead'])[((g-1)%3)+1],
 (ARRAY['diligence','design','pilot','scale','verified'])[((g-1)%5)+1]
FROM generate_series(1,15) g ON CONFLICT(initiative_ref) DO NOTHING;
