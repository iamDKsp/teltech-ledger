-- Additive migration for Demo Leads & Multi-Product WhatsApp Cadence Engine
CREATE TABLE IF NOT EXISTS demo_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  source TEXT NOT NULL,
  source_label TEXT NOT NULL DEFAULT 'Sistema',
  external_id TEXT NOT NULL,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  access_count INTEGER NOT NULL DEFAULT 1,
  first_access_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_access_at TIMESTAMP NOT NULL DEFAULT NOW(),
  status TEXT NOT NULL DEFAULT 'active_cadence',
  pause_reason TEXT,
  current_step INTEGER NOT NULL DEFAULT 0,
  next_step_order INTEGER,
  next_step_at TIMESTAMP,
  sent_count INTEGER NOT NULL DEFAULT 0,
  last_sent_at TIMESTAMP,
  replied_at TIMESTAMP,
  last_reaccess_sent_at TIMESTAMP,
  converted_client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  notes TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS demo_leads_workspace_source_external_uq
  ON demo_leads (workspace_id, source, external_id);

CREATE INDEX IF NOT EXISTS idx_demo_leads_workspace_phone
  ON demo_leads (workspace_id, phone);

CREATE INDEX IF NOT EXISTS idx_demo_leads_due_cadence
  ON demo_leads (status, next_step_at);

CREATE TABLE IF NOT EXISTS lead_cadence_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source TEXT NOT NULL,
  product_label TEXT NOT NULL DEFAULT 'PDV Lojista',
  step_kind TEXT NOT NULL DEFAULT 'sequence',
  step_order INTEGER NOT NULL,
  title TEXT NOT NULL,
  delay_minutes INTEGER NOT NULL DEFAULT 2,
  respect_business_hours BOOLEAN NOT NULL DEFAULT TRUE,
  business_start_hour INTEGER NOT NULL DEFAULT 9,
  business_end_hour INTEGER NOT NULL DEFAULT 20,
  body_template TEXT NOT NULL,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS lead_cadence_steps_workspace_source_kind_order_uq
  ON lead_cadence_steps (workspace_id, source, step_kind, step_order);

ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS demo_lead_id UUID REFERENCES demo_leads(id) ON DELETE SET NULL;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS cadence_step INTEGER;
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_demo_lead_id ON whatsapp_messages (demo_lead_id);
