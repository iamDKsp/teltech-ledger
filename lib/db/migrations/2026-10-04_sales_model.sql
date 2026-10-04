-- Modelo comercial: módulos SaaS, vendas, itens de cobrança e vínculo na transação.
-- Idempotente: pode ser executado mais de uma vez.

CREATE TABLE IF NOT EXISTS saas_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  default_price integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS client_sales (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  client_id uuid NOT NULL REFERENCES clients(id) ON DELETE CASCADE,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  title text NOT NULL,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sale_id uuid NOT NULL REFERENCES client_sales(id) ON DELETE CASCADE,
  kind text NOT NULL,
  label text NOT NULL,
  total_amount integer NOT NULL DEFAULT 0,
  installments_count integer NOT NULL DEFAULT 1,
  first_due_date timestamp,
  payment_mode text NOT NULL DEFAULT 'installments',
  start_mode text,
  billing_day integer NOT NULL DEFAULT 1,
  start_date timestamp,
  end_date timestamp,
  fixed_amount integer,
  generated_through text,
  status text NOT NULL DEFAULT 'active',
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS sale_modules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  sale_item_id uuid NOT NULL REFERENCES sale_items(id) ON DELETE CASCADE,
  module_id uuid NOT NULL REFERENCES saas_modules(id) ON DELETE RESTRICT,
  price integer NOT NULL DEFAULT 0,
  start_date timestamp NOT NULL DEFAULT now(),
  end_date timestamp,
  created_at timestamp NOT NULL DEFAULT now()
);

ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS sale_id uuid REFERENCES client_sales(id) ON DELETE SET NULL;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS sale_item_id uuid REFERENCES sale_items(id) ON DELETE SET NULL;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS revenue_type text;
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS reference_month text;

CREATE INDEX IF NOT EXISTS idx_client_sales_client ON client_sales(client_id);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON sale_items(sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_modules_item ON sale_modules(sale_item_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_sale_item ON financial_transactions(sale_item_id);
