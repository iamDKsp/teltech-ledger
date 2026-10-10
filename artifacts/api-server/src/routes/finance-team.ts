import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  teamMembersTable,
  teamCommissionsTable,
  clientSalesTable,
  saleItemsTable,
  clientsTable,
  projectsTable,
  financialTransactionsTable,
  financialCategoriesTable,
  workspaceMembersTable,
  usersTable,
  financialAccountsTable,
} from "@workspace/db";
import { eq, and, or, sql, inArray, desc, gte, lte } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import type { AuthenticatedRequest } from "../middlewares/auth";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getWorkspaceId(req: Request): Promise<string | null> {
  const userId = (req as AuthenticatedRequest).user?.userId;
  if (!userId) return null;
  const requestedWsId = req.headers["x-workspace-id"] as string | undefined;
  if (requestedWsId) {
    const [member] = await db
      .select({ workspaceId: workspaceMembersTable.workspaceId })
      .from(workspaceMembersTable)
      .where(and(eq(workspaceMembersTable.userId, userId), eq(workspaceMembersTable.workspaceId, requestedWsId)))
      .limit(1);
    if (member) return member.workspaceId;
  }
  const [member] = await db
    .select({ workspaceId: workspaceMembersTable.workspaceId })
    .from(workspaceMembersTable)
    .where(eq(workspaceMembersTable.userId, userId))
    .limit(1);
  return member?.workspaceId ?? null;
}

function handleError(res: Response, err: unknown) {
  console.error("Finance Team Route Error:", err);
  const msg = err instanceof Error ? err.message : "Erro interno no servidor";
  res.status(500).json({ error: msg });
}

// ─── 1. Listar Colaboradores ──────────────────────────────────────────────────

router.get("/team/members", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const members = await db
      .select()
      .from(teamMembersTable)
      .where(eq(teamMembersTable.workspaceId, workspaceId))
      .orderBy(desc(teamMembersTable.createdAt));

    res.json({ members });
  } catch (err) { handleError(res, err); }
});

// ─── 2. Criar Colaborador ─────────────────────────────────────────────────────

router.post("/team/members", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const {
      name,
      email,
      phone,
      role = "vendedor",
      roleTitle,
      baseSalary = 0,
      commissionType = "first_installment",
      projectPercentage = 0,
      targetClients = 4,
      targetBonus = 80000,
      careerLevel = 1,
      pixKey,
      notes,
    } = req.body;

    if (!name || typeof name !== "string" || !name.trim()) {
      res.status(400).json({ error: "Nome é obrigatório" });
      return;
    }

    // Role title padrão conforme o cargo
    let defaultTitle = roleTitle;
    if (!defaultTitle) {
      if (role === "pos_venda") defaultTitle = "Pós-Venda / CS";
      else if (role === "vendedor") defaultTitle = "Vendedor / Closer";
      else if (role === "hunter") defaultTitle = "Hunter / SDR";
      else if (role === "personnalite") defaultTitle = "Executivo Personnalité";
      else defaultTitle = "Colaborador";
    }

    const [created] = await db
      .insert(teamMembersTable)
      .values({
        workspaceId,
        name: name.trim(),
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        role,
        roleTitle: defaultTitle,
        baseSalary: Number(baseSalary) || 0,
        commissionType,
        projectPercentage: Number(projectPercentage) || 0,
        targetClients: Number(targetClients) || 4,
        targetBonus: Number(targetBonus) || 80000,
        careerLevel: Number(careerLevel) || 1,
        consecutiveTargetMonths: 0,
        pixKey: pixKey?.trim() || null,
        notes: notes?.trim() || null,
      })
      .returning();

    res.status(201).json({ member: created });
  } catch (err) { handleError(res, err); }
});

// ─── 3. Atualizar Colaborador ─────────────────────────────────────────────────

router.put("/team/members/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = String(req.params.id);

    const {
      name,
      email,
      phone,
      role,
      roleTitle,
      baseSalary,
      commissionType,
      projectPercentage,
      targetClients,
      targetBonus,
      careerLevel,
      consecutiveTargetMonths,
      pixKey,
      status,
      notes,
    } = req.body;

    const updateData: Record<string, any> = { updatedAt: new Date() };
    if (name !== undefined) updateData.name = name.trim();
    if (email !== undefined) updateData.email = email?.trim() || null;
    if (phone !== undefined) updateData.phone = phone?.trim() || null;
    if (role !== undefined) updateData.role = role;
    if (roleTitle !== undefined) updateData.roleTitle = roleTitle;
    if (baseSalary !== undefined) updateData.baseSalary = Number(baseSalary);
    if (commissionType !== undefined) updateData.commissionType = commissionType;
    if (projectPercentage !== undefined) updateData.projectPercentage = Number(projectPercentage);
    if (targetClients !== undefined) updateData.targetClients = Number(targetClients);
    if (targetBonus !== undefined) updateData.targetBonus = Number(targetBonus);
    if (careerLevel !== undefined) updateData.careerLevel = Number(careerLevel);
    if (consecutiveTargetMonths !== undefined) updateData.consecutiveTargetMonths = Number(consecutiveTargetMonths);
    if (pixKey !== undefined) updateData.pixKey = pixKey?.trim() || null;
    if (status !== undefined) updateData.status = status;
    if (notes !== undefined) updateData.notes = notes?.trim() || null;

    const [updated] = await db
      .update(teamMembersTable)
      .set(updateData)
      .where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.workspaceId, workspaceId)))
      .returning();

    if (!updated) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }
    res.json({ member: updated });
  } catch (err) { handleError(res, err); }
});

// ─── 4. Inativar / Excluir Colaborador ────────────────────────────────────────

router.delete("/team/members/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = String(req.params.id);

    // Verificar se possui vendas ou comissões vinculadas
    const [salesCount] = await db
      .select({ count: sql<number>`count(*)::int` })
      .from(clientSalesTable)
      .where(or(eq(clientSalesTable.sellerId, id), eq(clientSalesTable.hunterId, id)));

    if ((salesCount?.count || 0) > 0) {
      // Soft-delete (inativa)
      const [updated] = await db
        .update(teamMembersTable)
        .set({ status: "inactive", updatedAt: new Date() })
        .where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.workspaceId, workspaceId)))
        .returning();
      res.json({ message: "Colaborador inativado com sucesso (possui histórico de vendas)", member: updated });
      return;
    }

    await db
      .delete(teamMembersTable)
      .where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.workspaceId, workspaceId)));

    res.json({ success: true, message: "Colaborador removido com sucesso" });
  } catch (err) { handleError(res, err); }
});

// ─── 5. Desempenho do Mês, Metas e Comissões (Motor de Cálculo) ──────────────

router.get("/team/performance", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const now = new Date();
    const reqMonth = req.query.month ? parseInt(req.query.month as string) : now.getMonth() + 1;
    const reqYear = req.query.year ? parseInt(req.query.year as string) : now.getFullYear();
    const referenceMonth = `${reqYear}-${String(reqMonth).padStart(2, "0")}`;

    const startDate = new Date(Date.UTC(reqYear, reqMonth - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(reqYear, reqMonth, 0, 23, 59, 59));

    // Carregar membros ativos, vendas do período, transações geradas para folha e contas bancárias ativas
    const [members, sales, existingPayoutTxs, accounts] = await Promise.all([
      db
        .select()
        .from(teamMembersTable)
        .where(and(eq(teamMembersTable.workspaceId, workspaceId), eq(teamMembersTable.status, "active")))
        .orderBy(teamMembersTable.name),
      db
        .select({
          sale: clientSalesTable,
          clientName: clientsTable.name,
          projectName: projectsTable.name,
        })
        .from(clientSalesTable)
        .leftJoin(clientsTable, eq(clientSalesTable.clientId, clientsTable.id))
        .leftJoin(projectsTable, eq(clientSalesTable.projectId, projectsTable.id))
        .where(
          and(
            eq(clientSalesTable.workspaceId, workspaceId),
            gte(clientSalesTable.createdAt, startDate),
            lte(clientSalesTable.createdAt, endDate)
          )
        ),
      db
        .select()
        .from(financialTransactionsTable)
        .where(
          and(
            eq(financialTransactionsTable.workspaceId, workspaceId),
            eq(financialTransactionsTable.referenceMonth, referenceMonth),
            eq(financialTransactionsTable.type, "outflow")
          )
        ),
      db
        .select()
        .from(financialAccountsTable)
        .where(and(eq(financialAccountsTable.workspaceId, workspaceId), eq(financialAccountsTable.isActive, true))),
    ]);

    // Carregar itens das vendas do mês para calcular as 1ªs parcelas e valores de projeto
    const saleIds = sales.map((s) => s.sale.id);
    let saleItems: Array<typeof saleItemsTable.$inferSelect> = [];
    if (saleIds.length > 0) {
      saleItems = await db
        .select()
        .from(saleItemsTable)
        .where(and(eq(saleItemsTable.workspaceId, workspaceId), inArray(saleItemsTable.saleId, saleIds)));
    }

    // Mapa de itens por venda
    const itemsBySaleId = new Map<string, typeof saleItemsTable.$inferSelect[]>();
    for (const item of saleItems) {
      const list = itemsBySaleId.get(item.saleId) || [];
      list.push(item);
      itemsBySaleId.set(item.saleId, list);
    }

    // Processar métricas por colaborador
    let totalFixedSalaries = 0;
    let totalFirstInstallmentCommissions = 0;
    let totalProjectCommissions = 0;
    let totalTargetBonusesUnlocked = 0;
    let totalTargetBonusesAtRisk = 0;
    let totalClientsClosed = 0;
    let membersHittingTargetCount = 0;

    const performanceList = members.map((member) => {
      // Vendas fechadas como Closer
      const memberSalesAsSeller = sales.filter((s) => s.sale.sellerId === member.id);
      // Vendas prospectadas como Hunter
      const memberSalesAsHunter = sales.filter((s) => s.sale.hunterId === member.id);

      // Quantidade de clientes fechados
      const clientsClosedCount = memberSalesAsSeller.length;
      totalClientsClosed += clientsClosedCount;

      // Calcular o valor das 1ªs parcelas de cada venda
      let firstInstallmentsSum = 0;
      let projectAmountSum = 0;

      const salesDetails = memberSalesAsSeller.map((s) => {
        const items = itemsBySaleId.get(s.sale.id) || [];
        let firstInstallmentCents = 0;
        let totalSaleCents = 0;

        for (const item of items) {
          if (item.kind === "project") {
            totalSaleCents += item.totalAmount;
            const singleInstallment = item.installmentsCount > 0 ? Math.round(item.totalAmount / item.installmentsCount) : item.totalAmount;
            firstInstallmentCents += singleInstallment;
          } else if (item.kind === "subscription") {
            const monthly = item.fixedAmount || 0;
            totalSaleCents += monthly;
            if (firstInstallmentCents === 0) {
              firstInstallmentCents = monthly;
            }
          }
        }

        firstInstallmentsSum += firstInstallmentCents;
        projectAmountSum += totalSaleCents;

        return {
          saleId: s.sale.id,
          title: s.sale.title,
          clientName: s.clientName || "Cliente",
          projectName: s.projectName || null,
          totalAmount: totalSaleCents,
          firstInstallmentAmount: firstInstallmentCents,
          createdAt: s.sale.createdAt,
        };
      });

      // Avaliação de Meta de Clientes (Regra: 4 clientes por mês)
      const targetClients = member.targetClients || 4;
      const targetAchieved = clientsClosedCount >= targetClients;
      const progressPercent = Math.min(Math.round((clientsClosedCount / targetClients) * 100), 100);
      const missingClients = Math.max(0, targetClients - clientsClosedCount);

      if (targetAchieved) {
        membersHittingTargetCount++;
      }

      // Cálculo do Bônus de Meta conforme o Nível de Carreira
      // Nível 1: R$ 800 | Nível 2: R$ 1.200 | Nível 3: R$ 1.600...
      const currentLevelBonus = member.targetBonus || 80000;
      let bonusEarned = 0;
      let bonusAtRisk = 0;

      if (targetAchieved) {
        bonusEarned = currentLevelBonus;
        totalTargetBonusesUnlocked += bonusEarned;
      } else {
        bonusAtRisk = currentLevelBonus;
        totalTargetBonusesAtRisk += bonusAtRisk;
      }

      // Comissão Personnalité (25% do projeto)
      let projectCommissionEarned = 0;
      if (member.role === "personnalite" || member.commissionType === "project_percentage") {
        const rate = (member.projectPercentage || 2500) / 10000; // 2500 basis points = 25%
        projectCommissionEarned = Math.round(projectAmountSum * rate);
      }

      // Comissão de 1ª Parcela
      let firstInstallmentCommissionEarned = 0;
      if (member.commissionType === "first_installment" || member.commissionType === "both" || member.role === "vendedor" || member.role === "hunter") {
        firstInstallmentCommissionEarned = firstInstallmentsSum;
      }

      const baseSalary = member.baseSalary || 0;
      totalFixedSalaries += baseSalary;
      totalFirstInstallmentCommissions += firstInstallmentCommissionEarned;
      totalProjectCommissions += projectCommissionEarned;

      // Total a Receber no Mês
      const totalPayable = baseSalary + firstInstallmentCommissionEarned + projectCommissionEarned + bonusEarned;

      // Verificar se já possui lançamento de pagamento gerado no Livro Caixa para este mês
      const existingTx = existingPayoutTxs.find((t) => t.teamMemberId === member.id);

      return {
        member: {
          id: member.id,
          name: member.name,
          email: member.email,
          phone: member.phone,
          role: member.role,
          roleTitle: member.roleTitle,
          baseSalary: member.baseSalary,
          commissionType: member.commissionType,
          projectPercentage: member.projectPercentage,
          targetClients: member.targetClients,
          targetBonus: member.targetBonus,
          careerLevel: member.careerLevel,
          consecutiveTargetMonths: member.consecutiveTargetMonths,
          pixKey: member.pixKey,
        },
        metrics: {
          clientsClosedCount,
          targetClients,
          targetAchieved,
          progressPercent,
          missingClients,
          careerLevel: member.careerLevel,
          consecutiveMonths: member.consecutiveTargetMonths,
          salesDetails,
          hunterSalesCount: memberSalesAsHunter.length,
        },
        financials: {
          baseSalary,
          firstInstallmentCommission: firstInstallmentCommissionEarned,
          projectCommission: projectCommissionEarned,
          bonusEarned,
          bonusAtRisk,
          totalPayable,
          hasPaidOrPendingTx: !!existingTx,
          txId: existingTx?.id || null,
          txStatus: existingTx?.status || null,
        },
      };
    });

    const totalRealizedPayroll = totalFixedSalaries + totalFirstInstallmentCommissions + totalProjectCommissions + totalTargetBonusesUnlocked;
    const totalMaxProjectedPayroll = totalRealizedPayroll + totalTargetBonusesAtRisk;

    // Métricas de Caixa vs. Provisão Máxima
    const currentCash = accounts.reduce((acc, a) => acc + (a.currentBalance || 0), 0);
    const cashAfterMaxPayroll = currentCash - totalMaxProjectedPayroll;
    const cashCoverageRatio = totalMaxProjectedPayroll > 0 ? Number((currentCash / totalMaxProjectedPayroll).toFixed(2)) : null;
    const cashCommitmentPercent = currentCash > 0 ? Math.min(100, Math.round((totalMaxProjectedPayroll / currentCash) * 100)) : (totalMaxProjectedPayroll > 0 ? 100 : 0);
    const accountsBreakdown = accounts.map((a) => ({
      id: a.id,
      name: a.name,
      type: a.type,
      color: a.color,
      currentBalance: a.currentBalance,
    }));

    res.json({
      period: {
        month: reqMonth,
        year: reqYear,
        referenceMonth,
      },
      summary: {
        totalFixedSalaries,
        totalFirstInstallmentCommissions,
        totalProjectCommissions,
        totalTargetBonusesUnlocked,
        totalTargetBonusesAtRisk,
        totalRealizedPayroll,
        totalMaxProjectedPayroll,
        totalClientsClosed,
        activeMembersCount: members.length,
        membersHittingTargetCount,
        currentCash,
        cashAfterMaxPayroll,
        cashCoverageRatio,
        cashCommitmentPercent,
        accountsBreakdown,
      },
      performance: performanceList,
    });
  } catch (err) { handleError(res, err); }
});

// ─── 6. Fechar Folha de Pagamento & Lançar no Livro Caixa ──────────────────────

router.post("/team/close-payroll", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const { month, year, paymentDueDate, autoApprove = false } = req.body;
    if (!month || !year) {
      res.status(400).json({ error: "Mês e ano são obrigatórios" });
      return;
    }

    const referenceMonth = `${year}-${String(month).padStart(2, "0")}`;
    const dueDate = paymentDueDate ? new Date(paymentDueDate) : new Date(year, month, 5); // 5º dia do mês seguinte por padrão

    // Buscar ou criar a categoria financeira "Folha de Pagamento & Comissões"
    let [category] = await db
      .select()
      .from(financialCategoriesTable)
      .where(and(eq(financialCategoriesTable.workspaceId, workspaceId), eq(financialCategoriesTable.name, "Folha & Comissões de Equipe")))
      .limit(1);

    if (!category) {
      const [newCat] = await db
        .insert(financialCategoriesTable)
        .values({
          workspaceId,
          name: "Folha & Comissões de Equipe",
          color: "#8B5CF6",
          type: "outflow",
          isDefault: false,
        })
        .returning();
      category = newCat;
    }

    // Carregar membros ativos e vendas do período
    const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
    const endDate = new Date(Date.UTC(year, month, 0, 23, 59, 59));

    const [members, sales, existingTxs] = await Promise.all([
      db
        .select()
        .from(teamMembersTable)
        .where(and(eq(teamMembersTable.workspaceId, workspaceId), eq(teamMembersTable.status, "active"))),
      db
        .select()
        .from(clientSalesTable)
        .where(
          and(
            eq(clientSalesTable.workspaceId, workspaceId),
            gte(clientSalesTable.createdAt, startDate),
            lte(clientSalesTable.createdAt, endDate)
          )
        ),
      db
        .select()
        .from(financialTransactionsTable)
        .where(
          and(
            eq(financialTransactionsTable.workspaceId, workspaceId),
            eq(financialTransactionsTable.referenceMonth, referenceMonth),
            eq(financialTransactionsTable.type, "outflow")
          )
        ),
    ]);

    const saleIds = sales.map((s) => s.id);
    let saleItems: Array<typeof saleItemsTable.$inferSelect> = [];
    if (saleIds.length > 0) {
      saleItems = await db
        .select()
        .from(saleItemsTable)
        .where(and(eq(saleItemsTable.workspaceId, workspaceId), inArray(saleItemsTable.saleId, saleIds)));
    }

    const itemsBySaleId = new Map<string, typeof saleItemsTable.$inferSelect[]>();
    for (const item of saleItems) {
      const list = itemsBySaleId.get(item.saleId) || [];
      list.push(item);
      itemsBySaleId.set(item.saleId, list);
    }

    const createdTransactions: Array<typeof financialTransactionsTable.$inferSelect> = [];
    const promotedMembers: Array<{ name: string; newLevel: number; newBonus: number }> = [];

    await db.transaction(async (tx) => {
      for (const member of members) {
        // Verificar se já existe transação gerada para este membro nesta competência
        const alreadyGenerated = existingTxs.some((t) => t.teamMemberId === member.id);
        if (alreadyGenerated) continue;

        const memberSales = sales.filter((s) => s.sellerId === member.id);
        const clientsCount = memberSales.length;

        let firstInstallmentTotal = 0;
        let projectAmountTotal = 0;

        for (const s of memberSales) {
          const items = itemsBySaleId.get(s.id) || [];
          for (const item of items) {
            if (item.kind === "project") {
              projectAmountTotal += item.totalAmount;
              const single = item.installmentsCount > 0 ? Math.round(item.totalAmount / item.installmentsCount) : item.totalAmount;
              firstInstallmentTotal += single;
            } else if (item.kind === "subscription") {
              const monthly = item.fixedAmount || 0;
              projectAmountTotal += monthly;
              if (firstInstallmentTotal === 0) firstInstallmentTotal = monthly;
            }
          }
        }

        const targetClients = member.targetClients || 4;
        const targetAchieved = clientsCount >= targetClients;

        const bonus = targetAchieved ? (member.targetBonus || 80000) : 0;
        const base = member.baseSalary || 0;
        const commissions = member.commissionType !== "none" ? firstInstallmentTotal : 0;
        let projectComm = 0;
        if (member.role === "personnalite" || member.commissionType === "project_percentage") {
          projectComm = Math.round(projectAmountTotal * ((member.projectPercentage || 2500) / 10000));
        }

        const totalPayable = base + commissions + projectComm + bonus;
        if (totalPayable <= 0) continue;

        const desc = `Folha ${String(month).padStart(2, "0")}/${year} - ${member.name} (${member.roleTitle})`;
        const notes = [
          `Base Salarial: R$ ${(base / 100).toFixed(2)}`,
          `Comissões Vendas: R$ ${(commissions / 100).toFixed(2)} (${clientsCount} clientes)`,
          projectComm > 0 ? `Comissão Personnalité: R$ ${(projectComm / 100).toFixed(2)}` : null,
          bonus > 0 ? `Bônus Meta (${clientsCount}/${targetClients} clientes): R$ ${(bonus / 100).toFixed(2)}` : `Meta não batida (${clientsCount}/${targetClients})`,
          member.pixKey ? `Chave Pix: ${member.pixKey}` : null,
        ]
          .filter(Boolean)
          .join(" | ");

        // Tipo de custo: comissões diretas = direct_cogs; salário fixo e bônus = fixed_operating
        const costType = base > 0 && commissions === 0 ? "fixed_operating" : "direct_cogs";

        const [txRow] = await tx
          .insert(financialTransactionsTable)
          .values({
            workspaceId,
            type: "outflow",
            status: "pending",
            description: desc,
            amount: totalPayable,
            notes,
            dueDate,
            categoryId: category.id,
            costType,
            teamMemberId: member.id,
            referenceMonth,
            approvalStatus: autoApprove ? "approved" : "pending_approval",
          })
          .returning();

        createdTransactions.push(txRow);

        // Progressão de Carreira: se bateu a meta este mês
        let consecutive = member.consecutiveTargetMonths || 0;
        let newLevel = member.careerLevel || 1;
        let newBonus = member.targetBonus || 80000;

        if (targetAchieved) {
          consecutive += 1;
          // Regra Teltech: 3 meses batendo a meta -> sobe para Nível 2 (R$ 1.200)
          if (consecutive >= 3 && newLevel === 1) {
            newLevel = 2;
            newBonus = 120000; // R$ 1.200,00
            promotedMembers.push({ name: member.name, newLevel, newBonus });
          } else if (consecutive >= 6 && newLevel === 2) {
            newLevel = 3;
            newBonus = 160000; // R$ 1.600,00
            promotedMembers.push({ name: member.name, newLevel, newBonus });
          }
        } else {
          // Não bateu meta: zera sequência de consistência para o próximo level-up
          consecutive = 0;
        }

        await tx
          .update(teamMembersTable)
          .set({
            consecutiveTargetMonths: consecutive,
            careerLevel: newLevel,
            targetBonus: newBonus,
            updatedAt: new Date(),
          })
          .where(eq(teamMembersTable.id, member.id));
      }
    });

    res.json({
      success: true,
      referenceMonth,
      createdTransactionsCount: createdTransactions.length,
      promotedMembers,
      transactions: createdTransactions,
    });
  } catch (err) { handleError(res, err); }
});

// ─── 7. Promover Colaborador Manualmente ───────────────────────────────────────

router.post("/team/members/:id/promote", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = String(req.params.id);

    const [member] = await db
      .select()
      .from(teamMembersTable)
      .where(and(eq(teamMembersTable.id, id), eq(teamMembersTable.workspaceId, workspaceId)))
      .limit(1);

    if (!member) { res.status(404).json({ error: "Colaborador não encontrado" }); return; }

    const nextLevel = (member.careerLevel || 1) + 1;
    // Escalonamento do bônus: Nível 1 = R$ 800, Nível 2 = R$ 1.200, Nível 3 = R$ 1.600...
    const nextBonus = 80000 + (nextLevel - 1) * 40000;

    const [updated] = await db
      .update(teamMembersTable)
      .set({
        careerLevel: nextLevel,
        targetBonus: nextBonus,
        consecutiveTargetMonths: 0,
        updatedAt: new Date(),
      })
      .where(eq(teamMembersTable.id, id))
      .returning();

    res.json({
      success: true,
      message: `${member.name} promovido para o Nível ${nextLevel}! Novo bônus de meta: R$ ${(nextBonus / 100).toFixed(2)}`,
      member: updated,
    });
  } catch (err) { handleError(res, err); }
});

// ─── 8. Seed Inicial da Equipe Teltech (Convenience Setup) ─────────────────────

router.post("/team/seed-default", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const existing = await db
      .select({ id: teamMembersTable.id })
      .from(teamMembersTable)
      .where(eq(teamMembersTable.workspaceId, workspaceId))
      .limit(1);

    if (existing.length > 0) {
      res.status(400).json({ error: "Já existem colaboradores cadastrados no workspace." });
      return;
    }

    const defaultTeam = [
      {
        workspaceId,
        name: "Especialista Pós-Venda",
        role: "pos_venda",
        roleTitle: "Pós-Venda / Customer Success",
        baseSalary: 151800, // 1 Salário Mínimo nacional
        commissionType: "none",
        targetClients: 0,
        targetBonus: 0,
        careerLevel: 1,
        notes: "Responsável pelo onboarding, suporte contínuo e retenção de clientes ativos.",
      },
      {
        workspaceId,
        name: "Vendedor Closer 01",
        role: "vendedor",
        roleTitle: "Executivo de Vendas / Closer",
        baseSalary: 0,
        commissionType: "first_installment",
        targetClients: 4,
        targetBonus: 80000, // R$ 800 no nível 1
        careerLevel: 1,
        notes: "Ganha a 1ª parcela de cada sistema. Bônus de R$ 800 se fechar 4 clientes no mês (sobe para R$ 1.200 em 3 meses).",
      },
      {
        workspaceId,
        name: "Hunter Prospecção 01",
        role: "hunter",
        roleTitle: "SDR / Hunter Comercial",
        baseSalary: 0,
        commissionType: "first_installment",
        targetClients: 4,
        targetBonus: 80000, // R$ 800 no nível 1
        careerLevel: 1,
        notes: "Prospecção ativa e qualificação. Meta de 4 fechamentos para liberar bônus de carreira.",
      },
      {
        workspaceId,
        name: "Executivo Personnalité",
        role: "personnalite",
        roleTitle: "Parceiro Personnalité",
        baseSalary: 0,
        commissionType: "project_percentage",
        projectPercentage: 2500, // 25.00%
        targetClients: 0,
        targetBonus: 0,
        careerLevel: 1,
        notes: "Comissionamento de 25% sobre o valor bruto de cada projeto fechado.",
      },
    ];

    const inserted = await db.insert(teamMembersTable).values(defaultTeam).returning();
    res.status(201).json({ success: true, count: inserted.length, members: inserted });
  } catch (err) { handleError(res, err); }
});

export default router;
