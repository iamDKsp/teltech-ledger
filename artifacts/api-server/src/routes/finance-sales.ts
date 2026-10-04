import { Router, type IRouter, type Request, type Response } from "express";
import {
  db,
  clientsTable,
  clientSalesTable,
  saleItemsTable,
  saleModulesTable,
  saasModulesTable,
  projectsTable,
  workspaceMembersTable,
  financialTransactionsTable,
} from "@workspace/db";
import { and, eq, gte, inArray, desc } from "drizzle-orm";
import { requireAuth } from "../middlewares/auth";
import type { AuthenticatedRequest } from "../middlewares/auth";
import {
  generateSubscriptionCharges,
  insertEntryTransactions,
  recalcPendingCharges,
  syncAllSubscriptions,
} from "../services/sales-billing";
import {
  START_MODES,
  buildEntrySchedule,
  listSubscriptionDueDates,
  parseDay,
  resolveSubscriptionStart,
  subscriptionAmountAt,
  todayNoonUTC,
  type EntryMode,
  type EntryParcel,
  type StartMode,
} from "../services/sales-schedule";

const router: IRouter = Router();

// ─── Helpers ──────────────────────────────────────────────────────────────────

class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

function handleError(res: Response, err: unknown) {
  if (err instanceof HttpError) {
    res.status(err.status).json({ error: err.message });
    return;
  }
  console.error(err);
  res.status(500).json({ error: "Internal server error" });
}

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

function toCents(value: unknown, field: string): number {
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n) || n < 0) throw new HttpError(400, `${field} inválido`);
  return Math.round(n);
}

function toDay(value: unknown, field: string): Date {
  const d = parseDay(value);
  if (!d) throw new HttpError(400, `${field} inválida (use AAAA-MM-DD)`);
  return d;
}

function isUuid(v: unknown): v is string {
  return typeof v === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
}

// ─── Normalização / plano da venda (usado no preview e na criação) ───────────

interface NormalizedSale {
  clientId: string;
  projectId: string | null;
  title: string | null;
  notes: string | null;
  entry: null | {
    label: string;
    mode: EntryMode;
    totalAmount: number;
    installmentsCount: number;
    firstDueDate: Date;
    milestones: Array<{ label: string; amount: number; dueDate: Date }>;
  };
  subscription: null | {
    label: string;
    startMode: StartMode;
    billingDay: number;
    fixedDate: Date | null;
    endDate: Date | null;
    modules: Array<{ moduleId: string; price: number }>;
    fixedAmount: number | null;
  };
}

function normalizeSaleInput(body: any): NormalizedSale {
  if (!body || typeof body !== "object") throw new HttpError(400, "Corpo inválido");
  if (!isUuid(body.clientId)) throw new HttpError(400, "Selecione um cliente");
  if (body.projectId != null && body.projectId !== "" && !isUuid(body.projectId)) {
    throw new HttpError(400, "Projeto inválido");
  }
  if (!body.entry && !body.subscription) {
    throw new HttpError(400, "Informe ao menos a entrada/projeto ou a mensalidade");
  }

  let entry: NormalizedSale["entry"] = null;
  if (body.entry) {
    const e = body.entry;
    const mode: EntryMode = e.mode === "milestones" ? "milestones" : "installments";
    const label = typeof e.label === "string" && e.label.trim() ? e.label.trim() : "Entrada";
    if (mode === "installments") {
      const totalAmount = toCents(e.totalAmount, "Valor da entrada");
      if (totalAmount <= 0) throw new HttpError(400, "Valor da entrada deve ser maior que zero");
      const installmentsCount = Math.trunc(Number(e.installmentsCount ?? 1));
      if (!Number.isFinite(installmentsCount) || installmentsCount < 1 || installmentsCount > 60) {
        throw new HttpError(400, "Número de parcelas deve estar entre 1 e 60");
      }
      entry = {
        label,
        mode,
        totalAmount,
        installmentsCount,
        firstDueDate: toDay(e.firstDueDate, "Data do 1º vencimento"),
        milestones: [],
      };
    } else {
      if (!Array.isArray(e.milestones) || e.milestones.length === 0) {
        throw new HttpError(400, "Informe ao menos um marco de pagamento");
      }
      if (e.milestones.length > 36) throw new HttpError(400, "Máximo de 36 marcos");
      const milestones = e.milestones.map((m: any, i: number) => {
        const amount = toCents(m?.amount, `Valor do marco ${i + 1}`);
        if (amount <= 0) throw new HttpError(400, `Valor do marco ${i + 1} deve ser maior que zero`);
        return {
          label: typeof m?.label === "string" && m.label.trim() ? m.label.trim() : `Marco ${i + 1}`,
          amount,
          dueDate: toDay(m?.dueDate, `Data do marco ${i + 1}`),
        };
      });
      const sorted = [...milestones].sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime());
      entry = {
        label,
        mode,
        totalAmount: milestones.reduce((s: number, m: { amount: number }) => s + m.amount, 0),
        installmentsCount: milestones.length,
        firstDueDate: sorted[0].dueDate,
        milestones,
      };
    }
  }

  let subscription: NormalizedSale["subscription"] = null;
  if (body.subscription) {
    const s = body.subscription;
    if (!START_MODES.includes(s.startMode)) throw new HttpError(400, "Escolha quando a mensalidade começa");
    const startMode: StartMode = s.startMode;
    if ((startMode === "with_entry" || startMode === "after_entry") && !entry) {
      throw new HttpError(400, "Para iniciar junto/após a entrada, informe a entrada");
    }
    const fixedDate = startMode === "fixed_date" ? toDay(s.fixedDate, "Data de início da mensalidade") : null;

    let billingDay = Math.trunc(Number(s.billingDay ?? 1));
    if (startMode === "fixed_date" && fixedDate) billingDay = fixedDate.getUTCDate();
    if (startMode === "after_delivery" && !Number.isFinite(billingDay)) billingDay = 1;
    if (!Number.isFinite(billingDay) || billingDay < 1 || billingDay > 31) {
      throw new HttpError(400, "Dia de vencimento inválido");
    }
    if (startMode !== "fixed_date" && billingDay > 28) {
      throw new HttpError(400, "Dia de vencimento deve ser de 1 a 28");
    }

    const modules: Array<{ moduleId: string; price: number }> = [];
    if (Array.isArray(s.modules)) {
      const seen = new Set<string>();
      for (const m of s.modules) {
        if (!isUuid(m?.moduleId)) throw new HttpError(400, "Módulo inválido");
        if (seen.has(m.moduleId)) throw new HttpError(400, "Módulo repetido");
        seen.add(m.moduleId);
        modules.push({ moduleId: m.moduleId, price: toCents(m.price, "Preço do módulo") });
      }
    }
    const fixedAmount = s.fixedAmount != null && s.fixedAmount !== "" ? toCents(s.fixedAmount, "Valor da mensalidade") : null;
    const monthly = modules.length > 0 ? modules.reduce((sum, m) => sum + m.price, 0) : fixedAmount ?? 0;
    if (monthly <= 0) throw new HttpError(400, "Selecione módulos ou informe o valor da mensalidade");

    const endDate = s.endDate ? toDay(s.endDate, "Data de término") : null;

    subscription = {
      label: typeof s.label === "string" && s.label.trim() ? s.label.trim() : "Mensalidade",
      startMode,
      billingDay,
      fixedDate,
      endDate,
      modules,
      fixedAmount: modules.length > 0 ? null : fixedAmount,
    };
  }

  return {
    clientId: body.clientId,
    projectId: isUuid(body.projectId) ? body.projectId : null,
    title: typeof body.title === "string" && body.title.trim() ? body.title.trim() : null,
    notes: typeof body.notes === "string" && body.notes.trim() ? body.notes.trim() : null,
    entry,
    subscription,
  };
}

function planSale(n: NormalizedSale) {
  const entryParcels: EntryParcel[] = n.entry
    ? buildEntrySchedule({
        mode: n.entry.mode,
        label: n.entry.label,
        totalAmount: n.entry.totalAmount,
        installmentsCount: n.entry.installmentsCount,
        firstDueDate: n.entry.firstDueDate,
        milestones: n.entry.milestones,
      })
    : [];

  let subscriptionStart: Date | null = null;
  let monthly = 0;
  if (n.subscription) {
    subscriptionStart = resolveSubscriptionStart({
      startMode: n.subscription.startMode,
      billingDay: n.subscription.billingDay,
      entry: entryParcels.length ? entryParcels : null,
      fixedDate: n.subscription.fixedDate,
    });
    monthly = n.subscription.modules.length > 0
      ? n.subscription.modules.reduce((s, m) => s + m.price, 0)
      : n.subscription.fixedAmount ?? 0;

    if (subscriptionStart && n.subscription.endDate && n.subscription.endDate.getTime() < subscriptionStart.getTime()) {
      throw new HttpError(400, "A data de término é anterior ao início da mensalidade");
    }
  }
  return { entryParcels, subscriptionStart, monthly };
}

function defaultTitle(n: NormalizedSale, clientName: string): string {
  const parts: string[] = [];
  if (n.entry) parts.push("Projeto");
  if (n.subscription) parts.push("Mensalidade");
  return n.title ?? `${clientName} — ${parts.join(" + ")}`;
}

// ─── Módulos do SaaS (catálogo) ───────────────────────────────────────────────

router.get("/modules", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const modules = await db
      .select()
      .from(saasModulesTable)
      .where(eq(saasModulesTable.workspaceId, workspaceId))
      .orderBy(saasModulesTable.name);
    res.json({ modules });
  } catch (err) { handleError(res, err); }
});

router.post("/modules", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const name = typeof req.body?.name === "string" ? req.body.name.trim() : "";
    if (!name) throw new HttpError(400, "Informe o nome do módulo");
    const [module] = await db
      .insert(saasModulesTable)
      .values({
        workspaceId,
        name,
        description: typeof req.body?.description === "string" ? req.body.description.trim() || null : null,
        defaultPrice: toCents(req.body?.defaultPrice ?? 0, "Preço"),
      })
      .returning();
    res.status(201).json({ module });
  } catch (err) { handleError(res, err); }
});

router.put("/modules/:id", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;
    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (req.body?.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) throw new HttpError(400, "Informe o nome do módulo");
      patch.name = name;
    }
    if (req.body?.description !== undefined) patch.description = String(req.body.description).trim() || null;
    if (req.body?.defaultPrice !== undefined) patch.defaultPrice = toCents(req.body.defaultPrice, "Preço");
    if (req.body?.isActive !== undefined) patch.isActive = Boolean(req.body.isActive);

    const [module] = await db
      .update(saasModulesTable)
      .set(patch)
      .where(and(eq(saasModulesTable.id, id), eq(saasModulesTable.workspaceId, workspaceId)))
      .returning();
    if (!module) throw new HttpError(404, "Módulo não encontrado");
    res.json({ module });
  } catch (err) { handleError(res, err); }
});

// ─── Preview do cronograma (sem gravar nada) ──────────────────────────────────

router.post("/sales/preview", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const normalized = normalizeSaleInput(req.body);
    const plan = planSale(normalized);
    const today = todayNoonUTC();

    const entry = plan.entryParcels.map((p) => ({
      label: p.label,
      amount: p.amount,
      dueDate: p.dueDate.toISOString(),
    }));
    const entryTotal = plan.entryParcels.reduce((s, p) => s + p.amount, 0);

    let subscription: null | {
      awaitingStart: boolean;
      firstDueDate: string | null;
      monthlyAmount: number;
      charges: Array<{ referenceMonth: string; dueDate: string; amount: number }>;
    } = null;
    const warnings: string[] = [];

    if (normalized.subscription) {
      const charges = plan.subscriptionStart
        ? listSubscriptionDueDates({
            startDate: plan.subscriptionStart,
            endDate: normalized.subscription.endDate,
            generatedThrough: null,
            horizonEnd: new Date(Date.UTC(3000, 0, 1)),
            maxCount: 6,
          }).map((c) => ({
            referenceMonth: c.referenceMonth,
            dueDate: c.dueDate.toISOString(),
            amount: plan.monthly,
          }))
        : [];
      subscription = {
        awaitingStart: !plan.subscriptionStart,
        firstDueDate: plan.subscriptionStart ? plan.subscriptionStart.toISOString() : null,
        monthlyAmount: plan.monthly,
        charges,
      };
      if (plan.subscriptionStart && plan.subscriptionStart.getTime() < today.getTime()) {
        warnings.push("O início da mensalidade está no passado: as cobranças em atraso serão geradas como pendentes.");
      }
    }
    if (plan.entryParcels.some((p) => p.dueDate.getTime() < today.getTime())) {
      warnings.push("Há parcelas de entrada com vencimento no passado.");
    }

    res.json({
      preview: {
        entry,
        entryTotal,
        subscription,
        firstYearTotal: entryTotal + (subscription && !subscription.awaitingStart ? plan.monthly * 12 : 0),
        warnings,
      },
    });
  } catch (err) { handleError(res, err); }
});

// ─── Criar venda ──────────────────────────────────────────────────────────────

router.post("/sales", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    const n = normalizeSaleInput(req.body);
    const plan = planSale(n);

    const [client] = await db
      .select({ id: clientsTable.id, name: clientsTable.name, status: clientsTable.status })
      .from(clientsTable)
      .where(and(eq(clientsTable.id, n.clientId), eq(clientsTable.workspaceId, workspaceId)))
      .limit(1);
    if (!client) throw new HttpError(404, "Cliente não encontrado");
    if (client.status === "inactive") throw new HttpError(400, "Cliente inativo. Reative-o antes de criar uma venda.");

    if (n.projectId) {
      const [project] = await db
        .select({ id: projectsTable.id })
        .from(projectsTable)
        .where(and(eq(projectsTable.id, n.projectId), eq(projectsTable.workspaceId, workspaceId)))
        .limit(1);
      if (!project) throw new HttpError(404, "Projeto não encontrado");
    }

    if (n.subscription && n.subscription.modules.length > 0) {
      const ids = n.subscription.modules.map((m) => m.moduleId);
      const found = await db
        .select({ id: saasModulesTable.id })
        .from(saasModulesTable)
        .where(and(inArray(saasModulesTable.id, ids), eq(saasModulesTable.workspaceId, workspaceId), eq(saasModulesTable.isActive, true)));
      if (found.length !== ids.length) throw new HttpError(400, "Algum módulo selecionado não existe ou está inativo");
    }

    const result = await db.transaction(async (tx) => {
      const [sale] = await tx
        .insert(clientSalesTable)
        .values({
          workspaceId,
          clientId: client.id,
          projectId: n.projectId,
          title: defaultTitle(n, client.name),
          notes: n.notes,
        })
        .returning();

      const ctx = {
        workspaceId,
        saleId: sale.id,
        clientId: client.id,
        clientName: client.name,
        projectId: n.projectId,
      };

      let createdTx = 0;

      if (n.entry) {
        const [entryItem] = await tx
          .insert(saleItemsTable)
          .values({
            workspaceId,
            saleId: sale.id,
            kind: "project",
            label: n.entry.label,
            totalAmount: plan.entryParcels.reduce((s, p) => s + p.amount, 0),
            installmentsCount: plan.entryParcels.length,
            firstDueDate: plan.entryParcels[0]?.dueDate ?? null,
            paymentMode: n.entry.mode,
          })
          .returning();
        const rows = await insertEntryTransactions(tx, ctx, entryItem.id, plan.entryParcels);
        createdTx += rows.length;
      }

      if (n.subscription) {
        const [subItem] = await tx
          .insert(saleItemsTable)
          .values({
            workspaceId,
            saleId: sale.id,
            kind: "subscription",
            label: n.subscription.label,
            startMode: n.subscription.startMode,
            billingDay: n.subscription.billingDay,
            startDate: plan.subscriptionStart,
            endDate: n.subscription.endDate,
            fixedAmount: n.subscription.fixedAmount,
            status: plan.subscriptionStart ? "active" : "awaiting_start",
          })
          .returning();

        if (n.subscription.modules.length > 0) {
          await tx.insert(saleModulesTable).values(
            n.subscription.modules.map((m) => ({
              workspaceId,
              saleItemId: subItem.id,
              moduleId: m.moduleId,
              price: m.price,
              startDate: plan.subscriptionStart ?? todayNoonUTC(),
            })),
          );
        }

        createdTx += await generateSubscriptionCharges(tx, subItem, ctx);
      }

      // Garante o vínculo cliente → projeto (mesmo comportamento do contrato legado)
      if (n.projectId) {
        await tx.update(clientsTable).set({ projectId: n.projectId, updatedAt: new Date() }).where(eq(clientsTable.id, client.id));
      }

      return { sale, createdTx };
    });

    res.status(201).json({ sale: result.sale, transactionsCreated: result.createdTx });
  } catch (err) { handleError(res, err); }
});

// ─── Listar vendas (com itens, módulos e totais) ──────────────────────────────

router.get("/sales", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }

    // Geração contínua "preguiçosa": garante que as próximas mensalidades existam.
    try { await syncAllSubscriptions(workspaceId); } catch (e) { console.error("sync mensalidades:", e); }

    const clientFilter = typeof req.query.clientId === "string" && isUuid(req.query.clientId) ? req.query.clientId : null;

    const sales = await db
      .select({
        sale: clientSalesTable,
        clientName: clientsTable.name,
        projectName: projectsTable.name,
      })
      .from(clientSalesTable)
      .innerJoin(clientsTable, eq(clientSalesTable.clientId, clientsTable.id))
      .leftJoin(projectsTable, eq(clientSalesTable.projectId, projectsTable.id))
      .where(and(eq(clientSalesTable.workspaceId, workspaceId), clientFilter ? eq(clientSalesTable.clientId, clientFilter) : undefined))
      .orderBy(desc(clientSalesTable.createdAt));

    if (sales.length === 0) { res.json({ sales: [] }); return; }
    const saleIds = sales.map((s) => s.sale.id);

    const [items, modules, txs] = await Promise.all([
      db.select().from(saleItemsTable).where(inArray(saleItemsTable.saleId, saleIds)),
      db
        .select({
          row: saleModulesTable,
          name: saasModulesTable.name,
          itemSaleId: saleItemsTable.saleId,
        })
        .from(saleModulesTable)
        .innerJoin(saasModulesTable, eq(saleModulesTable.moduleId, saasModulesTable.id))
        .innerJoin(saleItemsTable, eq(saleModulesTable.saleItemId, saleItemsTable.id))
        .where(inArray(saleItemsTable.saleId, saleIds)),
      db
        .select({
          saleItemId: financialTransactionsTable.saleItemId,
          status: financialTransactionsTable.status,
          amount: financialTransactionsTable.amount,
          dueDate: financialTransactionsTable.dueDate,
        })
        .from(financialTransactionsTable)
        .where(and(eq(financialTransactionsTable.workspaceId, workspaceId), inArray(financialTransactionsTable.saleId, saleIds))),
    ]);

    const now = new Date();
    const today = todayNoonUTC(now);

    const payload = sales.map(({ sale, clientName, projectName }) => ({
      id: sale.id,
      clientId: sale.clientId,
      clientName,
      projectId: sale.projectId,
      projectName,
      title: sale.title,
      status: sale.status,
      notes: sale.notes,
      createdAt: sale.createdAt,
      items: items
        .filter((i) => i.saleId === sale.id)
        .map((item) => {
          const itemModules = modules.filter((m) => m.row.saleItemId === item.id);
          const windows = itemModules.map((m) => ({
            price: m.row.price,
            startDate: new Date(m.row.startDate),
            endDate: m.row.endDate ? new Date(m.row.endDate) : null,
          }));
          const itemTxs = txs.filter((t) => t.saleItemId === item.id);
          const paid = itemTxs.filter((t) => t.status === "paid").reduce((s, t) => s + t.amount, 0);
          const pendingTxs = itemTxs.filter((t) => t.status === "pending");
          const pending = pendingTxs.reduce((s, t) => s + t.amount, 0);
          const overdue = pendingTxs.filter((t) => new Date(t.dueDate) < now).reduce((s, t) => s + t.amount, 0);
          const next = pendingTxs
            .filter((t) => new Date(t.dueDate) >= today)
            .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime())[0];

          return {
            id: item.id,
            kind: item.kind,
            label: item.label,
            status: item.status,
            totalAmount: item.totalAmount,
            installmentsCount: item.installmentsCount,
            paymentMode: item.paymentMode,
            firstDueDate: item.firstDueDate,
            startMode: item.startMode,
            billingDay: item.billingDay,
            startDate: item.startDate,
            endDate: item.endDate,
            fixedAmount: item.fixedAmount,
            currentMonthly: item.kind === "subscription" ? subscriptionAmountAt(today, windows, item.fixedAmount) : 0,
            modules: itemModules.map((m) => ({
              id: m.row.id,
              moduleId: m.row.moduleId,
              name: m.name,
              price: m.row.price,
              startDate: m.row.startDate,
              endDate: m.row.endDate,
              active: m.row.endDate === null || new Date(m.row.endDate) >= today,
            })),
            paid,
            pending,
            overdue,
            nextDueDate: next?.dueDate ?? null,
            nextDueAmount: next?.amount ?? null,
          };
        }),
    }));

    res.json({ sales: payload });
  } catch (err) { handleError(res, err); }
});

// ─── Iniciar mensalidade "após a entrega" ─────────────────────────────────────

router.post("/sales/items/:itemId/start", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const itemId = req.params.itemId as string;
    const firstDueDate = toDay(req.body?.firstDueDate, "Data do 1º vencimento");

    const [row] = await db
      .select({ item: saleItemsTable, sale: clientSalesTable, clientName: clientsTable.name })
      .from(saleItemsTable)
      .innerJoin(clientSalesTable, eq(saleItemsTable.saleId, clientSalesTable.id))
      .innerJoin(clientsTable, eq(clientSalesTable.clientId, clientsTable.id))
      .where(and(eq(saleItemsTable.id, itemId), eq(saleItemsTable.workspaceId, workspaceId)))
      .limit(1);
    if (!row) throw new HttpError(404, "Item não encontrado");
    if (row.item.kind !== "subscription" || row.item.status !== "awaiting_start") {
      throw new HttpError(400, "Esta mensalidade não está aguardando início");
    }
    if (row.sale.status !== "active") throw new HttpError(400, "A venda não está ativa");
    if (row.item.endDate && new Date(row.item.endDate).getTime() < firstDueDate.getTime()) {
      throw new HttpError(400, "A data de término é anterior ao início informado");
    }

    const created = await db.transaction(async (tx) => {
      const [item] = await tx
        .update(saleItemsTable)
        .set({ startDate: firstDueDate, billingDay: firstDueDate.getUTCDate(), status: "active", updatedAt: new Date() })
        .where(eq(saleItemsTable.id, itemId))
        .returning();

      // Os módulos passam a valer desde o primeiro vencimento
      const mods = await tx.select().from(saleModulesTable).where(eq(saleModulesTable.saleItemId, itemId));
      for (const m of mods) {
        if (new Date(m.startDate).getTime() > firstDueDate.getTime()) {
          await tx.update(saleModulesTable).set({ startDate: firstDueDate }).where(eq(saleModulesTable.id, m.id));
        }
      }

      return generateSubscriptionCharges(tx, item, {
        workspaceId,
        saleId: row.sale.id,
        clientId: row.sale.clientId,
        clientName: row.clientName,
        projectId: row.sale.projectId,
      });
    });

    res.json({ ok: true, transactionsCreated: created });
  } catch (err) { handleError(res, err); }
});

// ─── Trocar módulos / valor (com data de vigência, sem reajuste automático) ───

router.put("/sales/items/:itemId/modules", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const itemId = req.params.itemId as string;
    const effective = req.body?.effectiveDate ? toDay(req.body.effectiveDate, "Data de vigência") : todayNoonUTC();

    const incoming: Array<{ moduleId: string; price: number }> = [];
    if (Array.isArray(req.body?.modules)) {
      const seen = new Set<string>();
      for (const m of req.body.modules) {
        if (!isUuid(m?.moduleId)) throw new HttpError(400, "Módulo inválido");
        if (seen.has(m.moduleId)) throw new HttpError(400, "Módulo repetido");
        seen.add(m.moduleId);
        incoming.push({ moduleId: m.moduleId, price: toCents(m.price, "Preço do módulo") });
      }
    }
    const fixedAmount = req.body?.fixedAmount != null && req.body.fixedAmount !== "" ? toCents(req.body.fixedAmount, "Valor da mensalidade") : null;
    if (incoming.length === 0 && (fixedAmount ?? 0) <= 0) {
      throw new HttpError(400, "Selecione módulos ou informe o valor da mensalidade");
    }

    const [item] = await db
      .select()
      .from(saleItemsTable)
      .where(and(eq(saleItemsTable.id, itemId), eq(saleItemsTable.workspaceId, workspaceId)))
      .limit(1);
    if (!item || item.kind !== "subscription") throw new HttpError(404, "Mensalidade não encontrada");
    if (item.status === "cancelled") throw new HttpError(400, "Mensalidade cancelada");

    if (incoming.length > 0) {
      const found = await db
        .select({ id: saasModulesTable.id })
        .from(saasModulesTable)
        .where(and(inArray(saasModulesTable.id, incoming.map((m) => m.moduleId)), eq(saasModulesTable.workspaceId, workspaceId), eq(saasModulesTable.isActive, true)));
      if (found.length !== incoming.length) throw new HttpError(400, "Algum módulo selecionado não existe ou está inativo");
    }

    const dayBefore = new Date(effective.getTime() - 24 * 60 * 60 * 1000);

    const updated = await db.transaction(async (tx) => {
      const open = await tx
        .select()
        .from(saleModulesTable)
        .where(and(eq(saleModulesTable.saleItemId, itemId)));
      const openRows = open.filter((r) => r.endDate === null);

      const close = async (row: (typeof openRows)[number]) => {
        if (new Date(row.startDate).getTime() >= effective.getTime()) {
          await tx.delete(saleModulesTable).where(eq(saleModulesTable.id, row.id));
        } else {
          await tx.update(saleModulesTable).set({ endDate: dayBefore }).where(eq(saleModulesTable.id, row.id));
        }
      };

      for (const row of openRows) {
        const next = incoming.find((m) => m.moduleId === row.moduleId);
        if (!next || next.price !== row.price) await close(row);
      }
      for (const m of incoming) {
        const same = openRows.find((r) => r.moduleId === m.moduleId && r.price === m.price);
        if (!same) {
          await tx.insert(saleModulesTable).values({
            workspaceId,
            saleItemId: itemId,
            moduleId: m.moduleId,
            price: m.price,
            startDate: effective,
          });
        }
      }

      const [fresh] = await tx
        .update(saleItemsTable)
        .set({ fixedAmount: incoming.length > 0 ? null : fixedAmount, updatedAt: new Date() })
        .where(eq(saleItemsTable.id, itemId))
        .returning();

      return recalcPendingCharges(tx, fresh, effective);
    });

    res.json({ ok: true, chargesUpdated: updated });
  } catch (err) { handleError(res, err); }
});

// ─── Pausar / reativar / cancelar venda ───────────────────────────────────────

router.put("/sales/:id/status", requireAuth, async (req: Request, res: Response) => {
  try {
    const workspaceId = await getWorkspaceId(req);
    if (!workspaceId) { res.status(403).json({ error: "No workspace" }); return; }
    const id = req.params.id as string;
    const status = req.body?.status;
    if (!["active", "paused", "cancelled"].includes(status)) throw new HttpError(400, "Status inválido");

    const [sale] = await db
      .select()
      .from(clientSalesTable)
      .where(and(eq(clientSalesTable.id, id), eq(clientSalesTable.workspaceId, workspaceId)))
      .limit(1);
    if (!sale) throw new HttpError(404, "Venda não encontrada");
    if (sale.status === "cancelled") throw new HttpError(400, "Venda já cancelada");

    const result = await db.transaction(async (tx) => {
      await tx.update(clientSalesTable).set({ status, updatedAt: new Date() }).where(eq(clientSalesTable.id, id));
      const items = await tx.select().from(saleItemsTable).where(eq(saleItemsTable.saleId, id));

      let cancelledCharges = 0;
      for (const item of items) {
        let itemStatus: string;
        if (status === "cancelled") itemStatus = "cancelled";
        else if (status === "paused") itemStatus = item.kind === "subscription" ? "paused" : item.status;
        else itemStatus = item.kind === "subscription" && !item.startDate ? "awaiting_start" : "active";
        await tx.update(saleItemsTable).set({ status: itemStatus, updatedAt: new Date() }).where(eq(saleItemsTable.id, item.id));
      }

      if (status === "cancelled") {
        // Cancela apenas o que ainda não venceu; o que já está em aberto/atrasado permanece para cobrança.
        const cancelled = await tx
          .update(financialTransactionsTable)
          .set({ status: "cancelled", updatedAt: new Date() })
          .where(
            and(
              eq(financialTransactionsTable.saleId, id),
              eq(financialTransactionsTable.status, "pending"),
              gte(financialTransactionsTable.dueDate, todayNoonUTC()),
            ),
          )
          .returning({ id: financialTransactionsTable.id });
        cancelledCharges = cancelled.length;
      }
      return cancelledCharges;
    });

    res.json({ ok: true, cancelledCharges: result });
  } catch (err) { handleError(res, err); }
});

export default router;
