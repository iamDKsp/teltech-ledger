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
  } catch (err) {
    console.error("  ❌ [Migrations] Falha ao verificar/aplicar schema upgrades de whatsapp_messages:", err);
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


