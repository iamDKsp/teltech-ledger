-- Cópia persistente da foto do cliente; migração aditiva e idempotente.
BEGIN;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url text;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_version integer NOT NULL DEFAULT 0;
ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_source text;
COMMIT;
