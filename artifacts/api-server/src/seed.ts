import { db, pool, usersTable, workspacesTable, workspaceMembersTable, financialCategoriesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

export async function runOneTimeFinancialReset() {
  const migrationId = "2026-10-05_reset_financial_module_v4";
  try {
    // 1. Garantir que a tabela de migrações do sistema existe
    await pool.query(`
      CREATE TABLE IF NOT EXISTS system_migrations (
        id TEXT PRIMARY KEY,
        executed_at TIMESTAMP NOT NULL DEFAULT NOW()
      );
    `);

    // 2. Verificar se este reset específico já foi executado
    const { rows } = await pool.query(
      "SELECT id FROM system_migrations WHERE id = $1 LIMIT 1;",
      [migrationId]
    );

    if (rows.length > 0) {
      console.log(`  ℹ️ [Migrations] ${migrationId} já executado anteriormente. Ignorando.`);
      return;
    }

    console.log(`  🚀 [Migrations] Executando reset completo do módulo financeiro (${migrationId})...`);

    const client = await pool.connect();
    try {
      await client.query("BEGIN;");

      // 1. Desvincular clientes das tarefas do Kanban
      await client.query("UPDATE tasks SET client_id = NULL WHERE client_id IS NOT NULL;");

      // 2. Limpar mensagens de cobrança e clientes no WhatsApp
      await client.query("DELETE FROM whatsapp_messages WHERE transaction_id IS NOT NULL OR client_id IS NOT NULL;");

      // 3. Limpar logs de auditoria financeira
      await client.query("DELETE FROM financial_audit_logs;");

      // 4. Limpar todas as transações (cobranças, receitas, despesas, retiradas, reembolsos)
      await client.query("DELETE FROM financial_transactions;");

      // 5. Limpar módulos contratados, itens de vendas e vendas comerciais
      await client.query("DELETE FROM team_commissions;");
      await client.query("DELETE FROM sale_modules;");
      await client.query("DELETE FROM sale_items;");
      await client.query("DELETE FROM client_sales;");

      // 6. Limpar contratos antigos
      await client.query("DELETE FROM client_contracts;");

      // 7. Limpar todos os clientes
      await client.query("DELETE FROM clients;");

      // 8. Limpar orçamentos departamentais
      await client.query("DELETE FROM financial_budgets;");

      // 9. Zerar saldos das contas bancárias
      await client.query("UPDATE financial_accounts SET current_balance = 0;");

      // 10. Registrar que esta migração one-off foi executada com sucesso
      await client.query(
        "INSERT INTO system_migrations (id, executed_at) VALUES ($1, NOW());",
        [migrationId]
      );

      await client.query("COMMIT;");
      console.log(`  🎉 [Migrations] ${migrationId} executado com sucesso! Módulo financeiro zerado para novo ciclo.`);
    } catch (err) {
      await client.query("ROLLBACK;");
      console.error(`  ❌ [Migrations] Erro ao executar ${migrationId}:`, err);
    } finally {
      client.release();
    }
  } catch (err) {
    console.error("  ❌ [Migrations] Falha ao verificar/executar tabela system_migrations:", err);
  }
}

export async function ensureSchemaUpgrades() {
  try {
    // 1. WhatsApp monitoring upgrades
    await pool.query(`
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS direction TEXT NOT NULL DEFAULT 'outbound';
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_phone TEXT;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS sender_name TEXT;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT false;
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_direction ON whatsapp_messages (direction);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_client_id ON whatsapp_messages (client_id);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_recipient ON whatsapp_messages (recipient);
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_sender_phone ON whatsapp_messages (sender_phone);
    `);

    // 2. Client contract columns upgrade
    await pool.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS monthly_amount integer;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS billing_day integer;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_status text DEFAULT 'active';
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_start_date timestamp;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_end_date timestamp;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS total_installments integer;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS contract_notes text;
    `);

    // 3. Sales model upgrades (saas_modules, client_sales, sale_items, sale_modules)
    await pool.query(`
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
    `);

    // 4. Team & Commissions upgrades (team_members, team_commissions, seller_id, hunter_id, team_member_id)
    await pool.query(`
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

      ALTER TABLE client_sales ADD COLUMN IF NOT EXISTS seller_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
      ALTER TABLE client_sales ADD COLUMN IF NOT EXISTS hunter_id uuid REFERENCES team_members(id) ON DELETE SET NULL;
      ALTER TABLE financial_transactions ADD COLUMN IF NOT EXISTS team_member_id uuid REFERENCES team_members(id) ON DELETE SET NULL;

      CREATE INDEX IF NOT EXISTS idx_team_members_ws ON team_members(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_team_commissions_ws ON team_commissions(workspace_id);
      CREATE INDEX IF NOT EXISTS idx_team_commissions_member ON team_commissions(member_id);
      CREATE INDEX IF NOT EXISTS idx_team_commissions_ref_month ON team_commissions(reference_month);
      CREATE INDEX IF NOT EXISTS idx_client_sales_seller ON client_sales(seller_id);
      CREATE INDEX IF NOT EXISTS idx_client_sales_hunter ON client_sales(hunter_id);
      CREATE INDEX IF NOT EXISTS idx_fin_tx_team_member ON financial_transactions(team_member_id);
    `);

    // 5. WhatsApp media columns upgrade
    await pool.query(`
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_type TEXT;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_url TEXT;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_mime_type TEXT;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_filename TEXT;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_size INTEGER;
      ALTER TABLE whatsapp_messages ADD COLUMN IF NOT EXISTS media_duration INTEGER;
      CREATE INDEX IF NOT EXISTS idx_whatsapp_messages_media_type ON whatsapp_messages (media_type);
    `);

    // 6. Inbound Webhooks & Client Photos upgrades
    await pool.query(`
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_url text;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_version integer NOT NULL DEFAULT 0;
      ALTER TABLE clients ADD COLUMN IF NOT EXISTS photo_source text;
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
    `);

    console.log("  ✅ [Migrations] Schema upgrades aplicados com sucesso.");
  } catch (err) {
    console.error("  ❌ [Migrations] Falha ao verificar/aplicar schema upgrades:", err);
  }
}

export async function bootstrapWorkspace() {
  console.log("🌱 Checking workspace bootstrap...");
  await ensureSchemaUpgrades();

  // Check if workspace exists
  const [existingWs] = await db
    .select({ id: workspacesTable.id })
    .from(workspacesTable)
    .where(eq(workspacesTable.slug, "teltech"))
    .limit(1);

  let workspaceId = existingWs?.id;

  // Check if any users exist
  const existingUsers = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable).limit(5);

  if (!existingWs) {
    // If no users exist, create initial root users
    let ownerId: string;

    if (existingUsers.length === 0) {
      if (process.env.NODE_ENV === "production") {
        const adminEmail = process.env.INITIAL_ADMIN_EMAIL || "admin@teltech.com.br";
        const adminPassword = process.env.INITIAL_ADMIN_PASSWORD;

        if (!adminPassword || adminPassword.length < 8) {
          console.warn("⚠️ [Bootstrap] Production detected with 0 users. Set INITIAL_ADMIN_PASSWORD to initialize root admin.");
          return;
        }

        const passwordHash = await hashPassword(adminPassword);
        const [adminUser] = await db
          .insert(usersTable)
          .values({
            name: "Administrador Teltech",
            email: adminEmail,
            passwordHash,
            mustChangePassword: true,
          })
          .returning({ id: usersTable.id });

        ownerId = adminUser.id;
        console.log(`  ✅ [Bootstrap] Created root admin: ${adminEmail} (troca de senha obrigatória)`);
      } else {
        // Development initial founders with mustChangePassword = true
        const passwordHash = await hashPassword("teltech2026");
        const [tarcisio] = await db
          .insert(usersTable)
          .values({ name: "Tarcísio", email: "tarcisio@teltech.com.br", passwordHash, mustChangePassword: true })
          .returning({ id: usersTable.id });

        const [lucas] = await db
          .insert(usersTable)
          .values({ name: "Lucas", email: "lucas@teltech.com.br", passwordHash, mustChangePassword: true })
          .returning({ id: usersTable.id });

        ownerId = tarcisio.id;
        console.log(`  ✅ [Bootstrap] Created dev founders (tarcisio, lucas)`);
      }
    } else {
      ownerId = existingUsers[0].id;
    }

    const [ws] = await db
      .insert(workspacesTable)
      .values({ name: "Teltech", slug: "teltech", ownerId })
      .returning({ id: workspacesTable.id });

    workspaceId = ws.id;
    console.log(`  ✅ [Bootstrap] Created Teltech workspace`);
  }

  // Ensure initial founders are members if workspace was newly created
  if (!existingWs && workspaceId) {
    const users = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
    for (const u of users) {
      const role = u.email === "tarcisio@teltech.com.br" ? "ceo" : u.email === "lucas@teltech.com.br" ? "cto" : "admin";
      await db.insert(workspaceMembersTable).values({
        workspaceId,
        userId: u.id,
        role,
      }).onConflictDoNothing();
    }
  }

  // Seed default financial categories (taxonomy, no financial balances)
  if (workspaceId) {
    const existingCategories = await db
      .select({ id: financialCategoriesTable.id })
      .from(financialCategoriesTable)
      .where(eq(financialCategoriesTable.workspaceId, workspaceId))
      .limit(1);

    if (existingCategories.length === 0) {
      const DEFAULT_CATEGORIES = [
        { name: "Receita SaaS",     color: "#7C5AC2", type: "inflow" as const },
        { name: "Projeto",          color: "#3B82F6", type: "inflow" as const },
        { name: "Consultoria",      color: "#10B981", type: "inflow" as const },
        { name: "Infraestrutura",   color: "#F59E0B", type: "outflow" as const },
        { name: "Marketing",        color: "#EC4899", type: "outflow" as const },
        { name: "Pró-labore",       color: "#8B5CF6", type: "outflow" as const },
        { name: "Ferramentas/SaaS", color: "#14B8A6", type: "outflow" as const },
        { name: "Outros",           color: "#6B7280", type: "both" as const },
      ];
      await db.insert(financialCategoriesTable).values(
        DEFAULT_CATEGORIES.map(c => ({ ...c, workspaceId: workspaceId!, isDefault: true }))
      );
      console.log(`  ✅ [Bootstrap] Initialized ${DEFAULT_CATEGORIES.length} financial categories`);
    }
  }

  // One-time financial reset migration (executa apenas uma vez no deploy)
  await runOneTimeFinancialReset();

  // Only run demo data seed if explicitly enabled in non-production
  if (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_DATA === "true" && workspaceId) {
    await seedDemoData(workspaceId);
  }

  console.log("🌱 Workspace bootstrap complete.");
}

async function seedDemoData(workspaceId: string) {
  if (process.env.NODE_ENV === "production") return;

  const { financialAccountsTable, financialApprovalRulesTable, financialSettingsTable } = await import("@workspace/db");

  // Approval rules default
  const existingRules = await db.select({ id: financialApprovalRulesTable.id }).from(financialApprovalRulesTable).where(eq(financialApprovalRulesTable.workspaceId, workspaceId)).limit(1);
  if (existingRules.length === 0) {
    await db.insert(financialApprovalRulesTable).values({
      workspaceId,
      maxAutoApprovalAmount: 50000, // R$ 500
      ceoThresholdAmount: 300000,   // R$ 3.000
    });
  }

  // Financial settings default
  const existingSettings = await db.select({ id: financialSettingsTable.id }).from(financialSettingsTable).where(eq(financialSettingsTable.workspaceId, workspaceId)).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(financialSettingsTable).values({
      workspaceId,
      taxRatePercent: 600, // 6%
      emergencyReserveTarget: 5000000, // R$ 50.000
    });
  }

  console.log("  ✅ [Demo Seed] Configurações de desenvolvimento verificadas");
}

// Backward compatibility export
export const seedUsers = bootstrapWorkspace;


