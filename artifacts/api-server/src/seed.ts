import { db, usersTable, workspacesTable, workspaceMembersTable, projectsTable, columnsTable, financialCategoriesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/auth";

const SEED_USERS = [
  { name: "Tarcísio", email: "tarcisio@teltech.com.br", password: "123" },
  { name: "Lucas", email: "lucas@teltech.com.br", password: "123" },
];

const SEED_PROJECTS = [
  { name: "StrataScratch", color: "#14B8A6", columns: ["Sem Título", "A Fazer", "Em Andamento", "Revisão", "Concluído"] },
  { name: "AlertSec", color: "#3B82F6", columns: ["Backlog", "A Fazer", "Em Andamento", "Concluído"] },
  { name: "Apvision", color: "#6366F1", columns: ["A Fazer", "Em Andamento", "Revisão", "Concluído"] },
];

export async function seedUsers() {
  console.log("🌱 Checking seed users...");

  // Check if workspace exists
  const existingWorkspaces = await db
    .select()
    .from(workspacesTable)
    .where(eq(workspacesTable.slug, "teltech"))
    .limit(1);

  let workspaceId: string;

  if (existingWorkspaces.length === 0) {
    let firstUserId: string | null = null;

    for (const u of SEED_USERS) {
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, u.email))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ✓ ${u.name} already exists`);
        if (!firstUserId) firstUserId = existing[0].id;
        continue;
      }

      const passwordHash = await hashPassword(u.password);
      const [user] = await db
        .insert(usersTable)
        .values({ name: u.name, email: u.email, passwordHash })
        .returning({ id: usersTable.id });

      console.log(`  ✅ Created user: ${u.name} (${u.email})`);
      if (!firstUserId) firstUserId = user.id;
    }

    const [workspace] = await db
      .insert(workspacesTable)
      .values({ name: "Teltech", slug: "teltech", ownerId: firstUserId! })
      .returning({ id: workspacesTable.id });
    workspaceId = workspace.id;
    console.log(`  ✅ Created workspace: Teltech`);
  } else {
    workspaceId = existingWorkspaces[0].id;
    console.log(`  ✓ Workspace Teltech already exists`);

    for (const u of SEED_USERS) {
      const existing = await db
        .select({ id: usersTable.id })
        .from(usersTable)
        .where(eq(usersTable.email, u.email))
        .limit(1);

      if (existing.length > 0) {
        console.log(`  ✓ ${u.name} already exists`);
        continue;
      }

      const passwordHash = await hashPassword(u.password);
      await db
        .insert(usersTable)
        .values({ name: u.name, email: u.email, passwordHash });
      console.log(`  ✅ Created user: ${u.name} (${u.email})`);
    }
  }

  // Ensure all users are workspace members with specific executive roles
  const PARTNER_ROLES: Record<string, "ceo" | "cto"> = {
    "tarcisio@teltech.com.br": "ceo",
    "lucas@teltech.com.br": "cto",
  };

  const allUsers = await db.select({ id: usersTable.id, email: usersTable.email }).from(usersTable);
  for (const user of allUsers) {
    const desiredRole = PARTNER_ROLES[user.email] ?? "member";
    const existingMember = await db
      .select({ id: workspaceMembersTable.id, role: workspaceMembersTable.role })
      .from(workspaceMembersTable)
      .where(eq(workspaceMembersTable.userId, user.id))
      .limit(1);

    if (existingMember.length === 0) {
      await db.insert(workspaceMembersTable).values({ workspaceId, userId: user.id, role: desiredRole });
      console.log(`  ✅ Added ${user.email} as ${desiredRole}`);
    } else if (existingMember[0].role !== desiredRole && PARTNER_ROLES[user.email]) {
      await db
        .update(workspaceMembersTable)
        .set({ role: desiredRole })
        .where(eq(workspaceMembersTable.id, existingMember[0].id));
      console.log(`  ✅ Updated ${user.email} role to ${desiredRole}`);
    }
  }

  // Seed projects
  const firstUser = allUsers.find(u => u.email === "tarcisio@teltech.com.br") ?? allUsers[0];
  const existingProjects = await db.select({ id: projectsTable.id }).from(projectsTable).limit(1);

  if (existingProjects.length === 0 && firstUser) {
    for (const p of SEED_PROJECTS) {
      const [project] = await db
        .insert(projectsTable)
        .values({ workspaceId, name: p.name, color: p.color, createdBy: firstUser.id })
        .returning({ id: projectsTable.id });

      await db.insert(columnsTable).values(
        p.columns.map((title, i) => ({ projectId: project.id, title, position: i }))
      );
      console.log(`  ✅ Created project: ${p.name} (${p.columns.length} columns)`);
    }
  }

  // Seed default financial categories
  const existingCategories = await db.select({ id: financialCategoriesTable.id }).from(financialCategoriesTable).limit(1);
  if (existingCategories.length === 0) {
    const DEFAULT_CATEGORIES = [
      { name: "Receita SaaS",     color: "#7C5AC2", type: "inflow" },
      { name: "Projeto",           color: "#3B82F6", type: "inflow" },
      { name: "Consultoria",       color: "#10B981", type: "inflow" },
      { name: "Infraestrutura",    color: "#F59E0B", type: "outflow" },
      { name: "Marketing",         color: "#EC4899", type: "outflow" },
      { name: "Pró-labore",        color: "#8B5CF6", type: "outflow" },
      { name: "Ferramentas/SaaS",  color: "#14B8A6", type: "outflow" },
      { name: "Outros",            color: "#6B7280", type: "both" },
    ];
    await db.insert(financialCategoriesTable).values(
      DEFAULT_CATEGORIES.map(c => ({ ...c, workspaceId, isDefault: true }))
    );
    console.log(`  ✅ Seeded ${DEFAULT_CATEGORIES.length} default financial categories`);
  }

  // Seed default bank accounts
  const { financialAccountsTable, financialApprovalRulesTable, financialSettingsTable, financialBudgetsTable, clientsTable } = await import("@workspace/db");
  const existingAccounts = await db.select({ id: financialAccountsTable.id }).from(financialAccountsTable).limit(1);
  if (existingAccounts.length === 0) {
    await db.insert(financialAccountsTable).values([
      { workspaceId, name: "Banco Inter PJ", type: "checking", color: "#FF7A00", initialBalance: 2500000, currentBalance: 2500000 },
      { workspaceId, name: "Conta Cora PJ", type: "checking", color: "#FE3E6D", initialBalance: 1500000, currentBalance: 1500000 },
      { workspaceId, name: "Caixa Reserva Teltech", type: "cash", color: "#10B981", initialBalance: 1000000, currentBalance: 1000000 },
    ]);
    console.log("  ✅ Seeded default bank accounts");
  }

  // Seed approval rules
  const existingRules = await db.select({ id: financialApprovalRulesTable.id }).from(financialApprovalRulesTable).limit(1);
  if (existingRules.length === 0) {
    await db.insert(financialApprovalRulesTable).values({
      workspaceId,
      maxAutoApprovalAmount: 50000, // R$ 500
      ceoThresholdAmount: 300000,   // R$ 3.000
    });
    console.log("  ✅ Seeded default approval rules");
  }

  // Seed financial settings
  const existingSettings = await db.select({ id: financialSettingsTable.id }).from(financialSettingsTable).limit(1);
  if (existingSettings.length === 0) {
    await db.insert(financialSettingsTable).values({
      workspaceId,
      taxRatePercent: 600, // 6%
      emergencyReserveTarget: 5000000, // R$ 50.000
    });
    console.log("  ✅ Seeded financial settings");
  }

  // Seed monthly budgets
  const existingBudgets = await db.select({ id: financialBudgetsTable.id }).from(financialBudgetsTable).limit(1);
  if (existingBudgets.length === 0) {
    const curMonth = new Date().getMonth() + 1;
    const curYear = new Date().getFullYear();
    await db.insert(financialBudgetsTable).values([
      { workspaceId, department: "tech", month: curMonth, year: curYear, amount: 800000 }, // R$ 8.000
      { workspaceId, department: "marketing", month: curMonth, year: curYear, amount: 600000 }, // R$ 6.000
      { workspaceId, department: "operations", month: curMonth, year: curYear, amount: 400000 }, // R$ 4.000
    ]);
    console.log("  ✅ Seeded default budgets");
  }

  // Seed default clients
  const existingClients = await db.select({ id: clientsTable.id }).from(clientsTable).limit(1);
  if (existingClients.length === 0) {
    await db.insert(clientsTable).values([
      { workspaceId, name: "StrataScratch Inc", document: "12.345.678/0001-90", email: "finance@stratascratch.com", phone: "(11) 98765-4321", notes: "Contrato SaaS mensal recorrente" },
      { workspaceId, name: "AlertSec Cloud Ltd", document: "98.765.432/0001-10", email: "billing@alertsec.io", phone: "(11) 97654-3210", notes: "Projeto e suporte de cibersegurança" },
    ]);
    console.log("  ✅ Seeded default clients");
  }

  console.log("🌱 Seed complete!");
}

