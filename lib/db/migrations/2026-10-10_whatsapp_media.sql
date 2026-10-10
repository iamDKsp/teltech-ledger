-- Suporte a arquivos e mídias no WhatsApp (Áudio, Vídeo, Foto, PDF, Documentos)
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_size INTEGER;
ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER;

CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_media_type ON whatsapp_messages (media_type);
