-- Módulo de Equipe, Comissões e Metas de Carreira da Teltech
-- Idempotente: pode ser executado mais de uma vez com segurança.

CREATE TABLE IF NOT EXISTS team_members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  name text NOT NULL,
  email text,
  phone text,
  role text NOT NULL DEFAULT 'vendedor',
  role_title text NOT NULL DEFAULT 'Vendedor',
  base_salary integer NOT NULL DEFAULT 0,
  commission_type text NOT NULL DEFAULT 'first_installment',
  project_percentage integer NOT NULL DEFAULT 0,
  target_clients integer NOT NULL DEFAULT 4,
  target_bonus integer NOT NULL DEFAULT 80000,
  career_level integer NOT NULL DEFAULT 1,
  consecutive_target_months integer NOT NULL DEFAULT 0,
  pix_key text,
  status text NOT NULL DEFAULT 'active',
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS team_commissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  member_id uuid NOT NULL REFERENCES team_members(id) ON DELETE CASCADE,
  sale_id uuid REFERENCES client_sales(id) ON DELETE SET NULL,
  sale_item_id uuid REFERENCES sale_items(id) ON DELETE SET NULL,
  client_id uuid REFERENCES clients(id) ON DELETE SET NULL,
  project_id uuid REFERENCES projects(id) ON DELETE SET NULL,
  type text NOT NULL,
  reference_month text NOT NULL,
  amount integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'pending',
  transaction_id uuid REFERENCES financial_transactions(id) ON DELETE SET NULL,
  paid_at timestamp,
  notes text,
  created_at timestamp NOT NULL DEFAULT now(),
  updated_at timestamp NOT NULL DEFAULT now()
);

-- Vínculo de vendedor (Closer) e prospector (Hunter) na Venda
ALTER TABLE client_sales ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
ALTER TABLE client_sales ADD COLUMN IF NOT EXISTS hunter_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

-- Vínculo de colaborador na Transação do Livro Caixa
ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

-- Índices de performance
CREATE INDEX IF NOT EXISTS idx_team_members_ws ON team_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_commissions_ws ON team_commissions(workspace_id);
CREATE INDEX IF NOT EXISTS idx_team_commissions_member ON team_commissions(member_id);
CREATE INDEX IF NOT EXISTS idx_team_commissions_ref_month ON team_commissions(reference_month);
CREATE INDEX IF NOT EXISTS idx_client_sales_seller ON client_sales(seller_id);
CREATE INDEX IF NOT EXISTS idx_client_sales_hunter ON client_sales(hunter_id);
CREATE INDEX IF NOT EXISTS idx_fin_tx_team_member ON financial_transactions(team_member_id);
