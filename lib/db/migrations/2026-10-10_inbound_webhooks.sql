-- Aditiva e idempotente; não remove clientes, cobranças ou saldos.
BEGIN;
ALTER TABLE sale_items ADD COLUMN IF NOT EXISTS billing_source text NOT NULL DEFAULT 'ledger';

CREATE TABLE IF NOT EXISTS inbound_webhook_entities (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source text NOT NULL,
  kind text NOT NULL,
  external_id text NOT NULL,
  internal_id uuid NOT NULL,
  parent_external_id text,
  version integer NOT NULL,
  payload_hash text NOT NULL,
  updated_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inbound_webhook_entity_identity_uq
  ON inbound_webhook_entities(workspace_id, source, kind, external_id);

CREATE TABLE IF NOT EXISTS inbound_webhook_events (
  id serial PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  source text NOT NULL,
  event_id text NOT NULL,
  event_type text NOT NULL,
  payload_hash text NOT NULL,
  result jsonb NOT NULL,
  processed_at timestamp NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS inbound_webhook_event_identity_uq
  ON inbound_webhook_events(workspace_id, source, event_id);
COMMIT;
