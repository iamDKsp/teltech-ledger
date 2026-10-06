-- Migração para suporte ao Módulo de Monitoramento e Chat de Cobranças do WhatsApp Nexus
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound';
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_phone TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;

-- Índices para consultas rápidas no monitoramento
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages (direction);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client_id ON whatsapp_messages (client_id);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient ON whatsapp_messages (recipient);
CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_phone ON whatsapp_messages (sender_phone);
