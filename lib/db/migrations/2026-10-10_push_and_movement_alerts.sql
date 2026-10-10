-- Notificações de movimentações, despesas e Web Push para celular / iPhone
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS expense_alerts_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS movement_alerts_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS client_message_push_enabled BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS vapid_public_key TEXT;
ALTER TABLE whatsapp_settings ADD COLUMN IF NOT EXISTS vapid_private_key TEXT;

ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS notify_expenses BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE whatsapp_contacts ADD COLUMN IF NOT EXISTS notify_movements BOOLEAN NOT NULL DEFAULT true;

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_push_subscriptions_workspace ON push_subscriptions (workspace_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user ON push_subscriptions (user_id);
