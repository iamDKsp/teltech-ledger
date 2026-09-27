import { db, usersTable, workspacesTable, workspaceMembersTable, financialCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

export async function bootstrapWorkspace() {
  console.log("🌱 Checking workspace bootstrap...");

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

  // Only run demo data seed if explicitly enabled in non-production
  if (process.env.NODE_ENV !== "production" && process.env.SEED_DEMO_DATA === "true" && workspaceId) {
    await seedDemoData(workspaceId);
  }

  console.log("🌱 Workspace bootstrap complete.");
}

async function seedDemoData(workspaceId: string) {
  if (process.env.NODE_ENV === "production") return;

  const { financialAccountsTable, financialApprovalRulesTable, financialSettingsTable, financialBudgetsTable, clientsTable } = await import("@workspace/db");

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

  // Bank accounts (DEV ONLY)
  const existingAccounts = await db.select({ id: financialAccountsTable.id }).from(financialAccountsTable).where(eq(financialAccountsTable.workspaceId, workspaceId)).limit(1);
  if (existingAccounts.length === 0) {
    await db.insert(financialAccountsTable).values([
      { workspaceId, name: "Banco Inter PJ", type: "checking", color: "#FF7A00", initialBalance: 2500000, currentBalance: 2500000 },
      { workspaceId, name: "Conta Cora PJ", type: "checking", color: "#FE3E6D", initialBalance: 1500000, currentBalance: 1500000 },
      { workspaceId, name: "Caixa Reserva Teltech", type: "cash", color: "#10B981", initialBalance: 1000000, currentBalance: 1000000 },
    ]);
  }

  // Monthly budgets (DEV ONLY)
  const existingBudgets = await db.select({ id: financialBudgetsTable.id }).from(financialBudgetsTable).where(eq(financialBudgetsTable.workspaceId, workspaceId)).limit(1);
  if (existingBudgets.length === 0) {
    const curMonth = new Date().getMonth() + 1;
    const curYear = new Date().getFullYear();
    await db.insert(financialBudgetsTable).values([
      { workspaceId, department: "tech", month: curMonth, year: curYear, amount: 800000 },
      { workspaceId, department: "marketing", month: curMonth, year: curYear, amount: 600000 },
      { workspaceId, department: "operations", month: curMonth, year: curYear, amount: 400000 },
    ]);
  }

  // Clients (DEV ONLY)
  const existingClients = await db.select({ id: clientsTable.id }).from(clientsTable).where(eq(clientsTable.workspaceId, workspaceId)).limit(1);
  if (existingClients.length === 0) {
    await db.insert(clientsTable).values([
      { workspaceId, name: "StrataScratch Inc", document: "12.345.678/0001-90", email: "finance@stratascratch.com", phone: "(11) 98765-4321", notes: "Contrato SaaS mensal recorrente" },
      { workspaceId, name: "AlertSec Cloud Ltd", document: "98.765.432/0001-10", email: "billing@alertsec.io", phone: "(11) 97654-3210", notes: "Projeto e suporte de cibersegurança" },
    ]);
  }

  console.log("  ✅ [Demo Seed] Seeded development accounts, budgets, and clients");
}

// Backward compatibility export
export const seedUsers = bootstrapWorkspace;


