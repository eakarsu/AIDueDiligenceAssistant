BEGIN;
CREATE TABLE IF NOT EXISTS users (
  id BIGSERIAL PRIMARY KEY,email TEXT NOT NULL UNIQUE,password TEXT NOT NULL,name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'analyst',created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS diligence_workspaces (
  id UUID PRIMARY KEY,name TEXT NOT NULL,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS diligence_memberships (
  workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,user_id BIGINT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('matter_partner','reviewer','analyst','viewer')),PRIMARY KEY(workspace_id,user_id)
);
CREATE TABLE IF NOT EXISTS diligence_matters (
  id UUID PRIMARY KEY,workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,matter_reference TEXT NOT NULL,authorization_basis TEXT NOT NULL,retention_until DATE,
  status TEXT NOT NULL DEFAULT 'intake' CHECK(status IN ('intake','review','signoff_ready','signed_off','closed')),
  created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(workspace_id,matter_reference)
);
CREATE TABLE IF NOT EXISTS diligence_evidence (
  id UUID PRIMARY KEY,matter_id UUID NOT NULL REFERENCES diligence_matters(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,
  storage_ref TEXT NOT NULL,sha256 CHAR(64) NOT NULL,source_name TEXT NOT NULL,source_uri TEXT,authorization_basis TEXT NOT NULL,
  received_at TIMESTAMPTZ NOT NULL,source_effective_date DATE,classification TEXT NOT NULL CHECK(classification IN ('confidential','privileged','public','restricted')),
  processing_status TEXT NOT NULL DEFAULT 'registered' CHECK(processing_status IN ('registered','extracted','failed','quarantined')),
  failure_code TEXT,uploaded_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(matter_id,sha256)
);
CREATE TABLE IF NOT EXISTS diligence_entities (
  id UUID PRIMARY KEY,matter_id UUID NOT NULL REFERENCES diligence_matters(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,entity_type TEXT NOT NULL,canonical_name TEXT NOT NULL,
  external_identifiers JSONB NOT NULL DEFAULT '{}'::jsonb,resolution_status TEXT NOT NULL CHECK(resolution_status IN ('unreviewed','confirmed','rejected')),
  reviewed_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS diligence_claims (
  id UUID PRIMARY KEY,matter_id UUID NOT NULL REFERENCES diligence_matters(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,entity_id UUID REFERENCES diligence_entities(id) ON DELETE SET NULL,
  entity_key TEXT NOT NULL,claim_key TEXT NOT NULL,claim_value JSONB NOT NULL,citations JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'unreviewed' CHECK(status IN ('unreviewed','confirmed','disputed','superseded')),
  created_by BIGINT NOT NULL,reviewed_by BIGINT,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS diligence_requests (
  id UUID PRIMARY KEY,matter_id UUID NOT NULL REFERENCES diligence_matters(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,request_key TEXT NOT NULL,description TEXT NOT NULL,
  owner TEXT,due_date DATE,status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','received','satisfied','exception','waived')),
  exception_reason TEXT,approved_by BIGINT,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),UNIQUE(matter_id,request_key)
);
CREATE TABLE IF NOT EXISTS diligence_decisions (
  id UUID PRIMARY KEY,matter_id UUID NOT NULL UNIQUE REFERENCES diligence_matters(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,decision TEXT NOT NULL CHECK(decision IN ('proceed','proceed_with_conditions','do_not_proceed','insufficient_evidence')),
  rationale TEXT NOT NULL,conditions JSONB NOT NULL DEFAULT '[]'::jsonb,signed_off_by BIGINT NOT NULL,signed_off_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS diligence_integration_jobs (
  id UUID PRIMARY KEY,workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,matter_id UUID REFERENCES diligence_matters(id) ON DELETE CASCADE,
  provider TEXT NOT NULL,operation TEXT NOT NULL,idempotency_key TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('queued','succeeded','failed','quarantined','cancelled')),
  failure_code TEXT,failure_detail TEXT,records_received INTEGER NOT NULL DEFAULT 0,created_by BIGINT NOT NULL,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id,provider,idempotency_key)
);
CREATE TABLE IF NOT EXISTS diligence_audit_events (
  id BIGSERIAL PRIMARY KEY,workspace_id UUID NOT NULL REFERENCES diligence_workspaces(id) ON DELETE CASCADE,actor_user_id BIGINT NOT NULL,
  action TEXT NOT NULL,entity_type TEXT NOT NULL,entity_id TEXT NOT NULL,reason TEXT,metadata JSONB NOT NULL DEFAULT '{}'::jsonb,created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_diligence_matter_workspace ON diligence_matters(workspace_id,status);
CREATE INDEX IF NOT EXISTS idx_diligence_claim_matter ON diligence_claims(matter_id,status);
CREATE INDEX IF NOT EXISTS idx_diligence_request_matter ON diligence_requests(matter_id,status);
COMMIT;
