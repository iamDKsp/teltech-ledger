import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useAuth } from "../lib/auth-context";
import { API } from "../lib/api";
import { AppContext } from "../TeltechLedger";
import {
  TrendingUp,
  TrendingDown,
  DollarSign,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  Clock,
  CreditCard,
  Plus,
  Download,
  Search,
  Building2,
  Users,
  BarChart3,
  PieChart,
  ArrowUpRight,
  ArrowDownRight,
  Receipt,
  ShieldCheck,
  Check,
  X,
  FileText,
  MessageSquare,
  Wallet,
  ChevronRight,
  ChevronLeft,
  Filter,
  Sparkles,
  Lock,
  Scale,
  Target,
  AlertCircle,
  Eye,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Send,
  Crown,
  AlertOctagon,
} from "lucide-react";
import { toast } from "sonner";

// ─── Types ────────────────────────────────────────────────────────────────────

type TxType = "inflow" | "outflow";
type TxStatus = "pending" | "paid" | "cancelled" | "overdue";
type CostType = "direct_cogs" | "fixed_operating" | "partner_withdrawal" | "tax" | "investment";
type ApprovalStatus = "not_required" | "pending_approval" | "approved" | "rejected";

interface Transaction {
  id: string;
  type: TxType;
  status: TxStatus;
  computedStatus: TxStatus;
  description: string;
  amount: number;
  dueDate: string;
  paidAt?: string;
  paymentMethod?: string;
  receiptUrl?: string;
  notes?: string;
  costType?: CostType;
  accountId?: string;
  accountName?: string;
  accountColor?: string;
  partnerId?: string;
  partnerName?: string;
  approvalStatus?: ApprovalStatus;
  rejectionReason?: string;
  categoryId?: string;
  categoryName?: string;
  categoryColor?: string;
  clientId?: string;
  clientName?: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
  isReimbursement?: boolean;
  reimbursementStatus?: string;
  isRecurring?: boolean;
  recurringInterval?: string;
  installmentNumber?: number;
  installmentsTotal?: number;
  createdAt: string;
}

interface BankAccount {
  id: string;
  name: string;
  type: "checking" | "credit_card" | "investment" | "cash";
  color: string;
  initialBalance: number;
  currentBalance: number;
  isActive: boolean;
}

interface Client {
  id: string;
  name: string;
  document?: string;
  email?: string;
  phone?: string;
  status: string;
  notes?: string;
}

interface Category {
  id: string;
  name: string;
  color: string;
  type: string;
  isDefault: boolean;
}

interface Project {
  id: string;
  name: string;
  color: string;
}

interface PartnerData {
  id: string;
  name: string;
  email: string;
  role: string;
  color: string;
  withdrawalsPaid: number;
  reimbursementsPending: number;
  reimbursementsPaid: number;
  transactionsCount: number;
}

interface BudgetData {
  id: string;
  department: string;
  amount: number;
  spent: number;
  percentage: number;
}

interface DREData {
  month: number;
  year: number;
  grossRevenue: number;
  taxDeductions: number;
  netRevenue: number;
  totalCOGS: number;
  cogsByProject: Array<{ name: string; color: string; cogs: number }>;
  unallocatedCOGS: number;
  grossProfit: number;
  fixedExpenses: number;
  partnerWithdrawals: number;
  netProfit: number;
  grossMarginPercent: number;
  netMarginPercent: number;
}

interface ProjectProfitability {
  id: string;
  name: string;
  color: string;
  revenue: number;
  cogs: number;
  margin: number;
  marginPercent: number;
}

interface DashboardData {
  mrr: number;
  monthInflow: number;
  monthInflowPending: number;
  monthOutflow: number;
  monthOutflowPending: number;
  monthBalance: number;
  overdueAmount: number;
  overdueCount: number;
  totalCash: number;
  emergencyReserveTarget: number;
  isBelowReserve: boolean;
  taxProvision: number;
  taxRatePercent: number;
  burnRate: number;
  runwayMonths: number | null;
  pendingApprovalsCount: number;
  pendingApprovalsList?: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    costType?: string;
    partnerName?: string | null;
  }>;
  overdueInflowsList?: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    clientId?: string;
    clientName: string;
    clientPhone?: string | null;
  }>;
  overdueOutflowsList?: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    costType?: string;
  }>;
  todayDueOutflowsList?: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
  }>;
  categoryDistribution: Array<{ name: string; color: string; amount: number; percentage: number }>;
  budgetProgress: BudgetData[];
  chartData: Array<{ month: string; inflow: number; outflow: number; balance: number }>;
  upcoming: Transaction[];
  selectedMonth: number;
  selectedYear: number;
}

type TabType =
  | "dashboard"
  | "transactions"
  | "clients"
  | "accounts"
  | "dre"
  | "budgets"
  | "approvals"
  | "partners";

// ─── Formatting Helpers (Strictly Guaranteed against NaN) ─────────────────────

function formatBRL(cents?: number | null): string {
  if (cents === null || cents === undefined || isNaN(cents)) return "R$ 0,00";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
}

function formatShortDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" });
}

function parseBRL(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  const num = parseFloat(cleaned || "0");
  return isNaN(num) ? 0 : Math.round(num * 100);
}

// ─── Semantic Badges ─────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  paid:              { label: "Liquidado / Pago", color: "#10B981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.3)"  },
  pending:           { label: "Pendente",         color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.3)"  },
  overdue:           { label: "Atrasado",         color: "#EF4444", bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.4)"   },
  cancelled:         { label: "Cancelado",        color: "#9CA3AF", bg: "rgba(156,163,175,0.12)", border: "rgba(156,163,175,0.25)" },
  pending_approval:  { label: "Aguardando Alçada", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)",  border: "rgba(139,92,246,0.35)" },
  rejected:          { label: "Reprovado",        color: "#EF4444", bg: "rgba(239,68,68,0.15)",   border: "rgba(239,68,68,0.35)" },
};

function StatusBadge({ status, approvalStatus }: { status: string; approvalStatus?: string }) {
  const effectiveKey = approvalStatus === "pending_approval" ? "pending_approval" : approvalStatus === "rejected" ? "rejected" : status;
  const cfg = STATUS_CONFIG[effectiveKey] ?? STATUS_CONFIG.pending;
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        padding: "3px 9px",
        borderRadius: 20,
        fontSize: 11,
        fontWeight: 600,
        color: cfg.color,
        background: cfg.bg,
        border: `1px solid ${cfg.border}`,
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
      {cfg.label}
    </span>
  );
}

const COST_LABELS: Record<string, { label: string; color: string }> = {
  direct_cogs:         { label: "CPV (Custo de Projeto)",     color: "#3B82F6" },
  fixed_operating:     { label: "Despesa Fixa Operacional",    color: "#F59E0B" },
  partner_withdrawal:  { label: "Pró-labore / Dividendos",    color: "#8B5CF6" },
  tax:                 { label: "Impostos / DAS Simples",     color: "#EC4899" },
  investment:          { label: "Investimento & Ativo",       color: "#10B981" },
};

function CostTypeBadge({ type }: { type?: string }) {
  if (!type) return null;
  const cfg = COST_LABELS[type] ?? { label: type, color: "#888" };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 600,
        padding: "2px 7px",
        borderRadius: 6,
        color: cfg.color,
        background: `${cfg.color}15`,
        border: `1px solid ${cfg.color}35`,
        whiteSpace: "nowrap",
      }}
    >
      {cfg.label}
    </span>
  );
}

// ─── Design System: Empty State Component ─────────────────────────────────────

function EmptyState({
  icon: Icon,
  title,
  description,
  primaryAction,
  secondaryAction,
  tip,
}: {
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  title: string;
  description: string;
  primaryAction?: { label: string; onClick: () => void; icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }> };
  secondaryAction?: { label: string; onClick: () => void };
  tip?: string;
}) {
  const PrimaryIcon = primaryAction?.icon;
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "48px 24px",
        textAlign: "center",
        background: "linear-gradient(135deg, rgba(26,26,30,0.6), rgba(20,20,24,0.6))",
        border: "1px dashed rgba(255,255,255,0.12)",
        borderRadius: 16,
        margin: "12px 0",
      }}
    >
      <div
        style={{
          width: 56,
          height: 56,
          borderRadius: "50%",
          background: "rgba(139,92,246,0.12)",
          border: "1px solid rgba(139,92,246,0.25)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#A78BFA",
          marginBottom: 16,
        }}
      >
        <Icon style={{ width: 26, height: 26 }} />
      </div>
      <h3 style={{ margin: "0 0 6px", fontSize: 16, fontWeight: 700, color: "#fafafa" }}>{title}</h3>
      <p style={{ margin: "0 0 20px", fontSize: 13, color: "#a1a1aa", maxWidth: 440, lineHeight: 1.5 }}>
        {description}
      </p>

      {(primaryAction || secondaryAction) && (
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", justifyContent: "center" }}>
          {primaryAction && (
            <button
              onClick={primaryAction.onClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "9px 18px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #8B5CF6, #7C3AED)",
                color: "#fff",
                border: "none",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
              }}
            >
              {PrimaryIcon && <PrimaryIcon style={{ width: 15, height: 15 }} />}
              {primaryAction.label}
            </button>
          )}
          {secondaryAction && (
            <button
              onClick={secondaryAction.onClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                padding: "9px 16px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e4e4e7",
                fontSize: 13,
                fontWeight: 500,
                cursor: "pointer",
              }}
            >
              {secondaryAction.label}
            </button>
          )}
        </div>
      )}

      {tip && (
        <div
          style={{
            marginTop: 20,
            fontSize: 11,
            color: "#71717a",
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            padding: "4px 10px",
            borderRadius: 20,
            background: "rgba(255,255,255,0.03)",
          }}
        >
          <Sparkles style={{ width: 12, height: 12, color: "#F59E0B" }} />
          <span>Dica: {tip}</span>
        </div>
      )}
    </div>
  );
}

// ─── Design System: Cockpit KPI Card ──────────────────────────────────────────

function CockpitKpiCard({
  title,
  value,
  subtitle,
  badge,
  icon: Icon,
  color = "#8B5CF6",
  alert = false,
}: {
  title: string;
  value: string;
  subtitle?: string;
  badge?: { label: string; color: string; bg: string };
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color?: string;
  alert?: boolean;
}) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 240,
        background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
        border: `1px solid ${alert ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14,
        padding: "20px 22px",
        position: "relative",
        overflow: "hidden",
        boxShadow: alert ? "0 8px 30px rgba(239,68,68,0.15)" : "0 8px 30px rgba(0,0,0,0.35)",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: -24,
          right: -24,
          width: 90,
          height: 90,
          borderRadius: "50%",
          background: `${color}15`,
          filter: "blur(20px)",
        }}
      />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {title}
        </span>
        <div
          style={{
            padding: 7,
            borderRadius: 10,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon style={{ width: 18, height: 18 }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 4 }}>
        <span style={{ fontSize: 26, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.02em" }}>
          {value}
        </span>
        {badge && (
          <span
            style={{
              fontSize: 10,
              fontWeight: 700,
              padding: "2px 7px",
              borderRadius: 20,
              color: badge.color,
              background: badge.bg,
              whiteSpace: "nowrap",
            }}
          >
            {badge.label}
          </span>
        )}
      </div>

      {subtitle && (
        <div style={{ fontSize: 12, color: alert ? "#EF4444" : "#71717a", fontWeight: 500, marginTop: 4 }}>
          {subtitle}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FINANCE MODULE PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function FinanceiroPage() {
  const { user } = useAuth();
  const { isMobile } = useContext(AppContext) as { isMobile?: boolean };

  // Routine Tabs
  const [activeTab, setActiveTab] = useState<TabType>("dashboard");

  // Selected Period
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Data States
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [dre, setDre] = useState<DREData | null>(null);
  const [profitability, setProfitability] = useState<ProjectProfitability[]>([]);
  const [partners, setPartners] = useState<PartnerData[]>([]);
  const [budgets, setBudgets] = useState<BudgetData[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<Transaction[]>([]);

  // Modals
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "inflow" | "outflow" | "pending" | "paid" | "overdue" | "approval">("all");

  // ─── Fetch All Data ──────────────────────────────────────────────────────────

  const loadAllData = useCallback(async () => {
    try {
      setLoading(true);
      const m = selectedMonth;
      const y = selectedYear;

      const [dashRes, txRes, catRes, accRes, clRes, dreRes, profRes, partRes, budRes, appRes, projRes] =
        await Promise.all([
          API.get(`/finance/dashboard?month=${m}&year=${y}`),
          API.get(`/finance/transactions?month=${m}&year=${y}`),
          API.get(`/finance/categories`),
          API.get(`/finance/accounts`),
          API.get(`/finance/clients`),
          API.get(`/finance/dre?month=${m}&year=${y}`),
          API.get(`/finance/project-profitability?month=${m}&year=${y}`),
          API.get(`/finance/partners?month=${m}&year=${y}`),
          API.get(`/finance/budgets?month=${m}&year=${y}`),
          API.get(`/finance/approvals`),
          API.get(`/projects`),
        ]);

      if (dashRes?.dashboard) setDashboard(dashRes.dashboard);
      if (txRes?.transactions) setTransactions(txRes.transactions);
      if (catRes?.categories) setCategories(catRes.categories);
      if (accRes?.accounts) setAccounts(accRes.accounts);
      if (clRes?.clients) setClients(clRes.clients);
      if (dreRes?.dre) setDre(dreRes.dre);
      if (profRes?.profitability) setProfitability(profRes.profitability);
      if (partRes?.partners) setPartners(partRes.partners);
      if (budRes?.budgets) setBudgets(budRes.budgets);
      if (appRes?.pending) setPendingApprovals(appRes.pending);
      if (projRes?.projects) setProjects(projRes.projects);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  // ─── Handlers ───────────────────────────────────────────────────────────────

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
    } else {
      setSelectedMonth(selectedMonth - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
    } else {
      setSelectedMonth(selectedMonth + 1);
    }
  };

  const handleExportCSV = () => {
    const token = localStorage.getItem("teltech_token") || localStorage.getItem("token") || "";
    const baseUrl = API.baseUrl || (import.meta.env.DEV ? "http://localhost:5000" : "");
    window.open(`${baseUrl}/api/finance/export?month=${selectedMonth}&year=${selectedYear}&token=${token}`, "_blank");
  };

  const handleApprove = async (id: string) => {
    try {
      await API.post(`/finance/approvals/${id}/approve`, {});
      toast.success("Despesa aprovada com sucesso.");
      await loadAllData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao aprovar despesa.");
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectingTxId) return;
    try {
      await API.post(`/finance/approvals/${rejectingTxId}/reject`, { reason: rejectionReason.trim() });
      setRejectingTxId(null);
      setRejectionReason("");
      toast.success("Despesa rejeitada.");
      await loadAllData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao rejeitar despesa.");
    }
  };

  const handleMarkPaid = async (tx: Transaction) => {
    try {
      await API.put(`/finance/transactions/${tx.id}`, {
        status: "paid",
        paidAt: new Date().toISOString(),
      });
      toast.success("Lançamento liquidado com sucesso.");
      await loadAllData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao liquidar lançamento.");
    }
  };

  const handleDeleteTx = async (id: string) => {
    if (!confirm("Tem certeza que deseja remover este lançamento financeiro?")) return;
    try {
      await API.delete(`/finance/transactions/${id}`);
      toast.success("Lançamento removido.");
      await loadAllData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir transação.");
    }
  };

  // WhatsApp Billing Link Generator with Teltech Pix Key
  const handleSendWhatsAppPix = (client: Client, tx?: Transaction) => {
    const phone = client.phone ? client.phone.replace(/\D/g, "") : "";
    if (!phone) {
      toast.error("Este cliente não possui telefone/WhatsApp cadastrado.");
      return;
    }
    const cleanPhone = phone.startsWith("55") ? phone : `55${phone}`;
    const amountStr = tx ? formatBRL(tx.amount) : "conforme acordado";
    const dueStr = tx ? formatDate(tx.dueDate) : "a combinar";
    const descStr = tx ? tx.description : "serviços prestados";

    const msg =
      `Olá, ${client.name}! Tudo bem?\n\n` +
      `Passando para enviar a fatura da Teltech referente a *${descStr}*:\n` +
      `💰 *Valor:* ${amountStr}\n` +
      `📅 *Vencimento:* ${dueStr}\n\n` +
      `🔑 *Chave Pix (CNPJ Teltech):* financeiro@teltech.com.br\n\n` +
      `Qualquer dúvida ficamos à disposição!`;

    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, "_blank");
  };

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        background: "#111113",
        color: "#fafafa",
        overflow: "hidden",
        fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
      }}
    >
      {/* ─── Top Executive Toolbar ────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 24px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "linear-gradient(180deg, #18181c 0%, #131316 100%)",
          flexWrap: "wrap",
          gap: 12,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "linear-gradient(135deg, #8B5CF6 0%, #4F2D8A 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: "0 4px 16px rgba(139,92,246,0.3)",
            }}
          >
            <Wallet style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <h1 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", letterSpacing: "-0.02em" }}>
                Gestão Financeira & Governança
              </h1>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 20,
                  background: "rgba(16,185,129,0.15)",
                  color: "#10B981",
                  border: "1px solid rgba(16,185,129,0.3)",
                }}
              >
                Mês Aberto
              </span>
            </div>
            <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa" }}>
              Teltech Software & Inteligência Artificial
            </p>
          </div>
        </div>

        {/* Period Selector & Global Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Month Stepper */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "3px 4px",
            }}
          >
            <button
              onClick={handlePrevMonth}
              style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer", padding: "4px 6px", borderRadius: 4 }}
              title="Mês anterior"
            >
              <ChevronLeft style={{ width: 16, height: 16 }} />
            </button>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff", padding: "0 10px", minWidth: 140, textAlign: "center" }}>
              {monthNames[selectedMonth - 1]} / {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              style={{ background: "transparent", border: "none", color: "#ccc", cursor: "pointer", padding: "4px 6px", borderRadius: 4 }}
              title="Próximo mês"
            >
              <ChevronRight style={{ width: 16, height: 16 }} />
            </button>
          </div>

          <button
            onClick={handleExportCSV}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#e4e4e7",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download style={{ width: 14, height: 14 }} />
            Exportar CSV
          </button>

          <button
            onClick={() => {
              setEditingTx(null);
              setShowTxModal(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 16px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
            }}
          >
            <Plus style={{ width: 15, height: 15 }} />
            Novo Lançamento
          </button>
        </div>
      </div>

      {/* ─── 8 Routine Navigation Tabs ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "#141417",
          padding: "0 16px",
          overflowX: "auto",
        }}
      >
        {[
          { key: "dashboard",    label: "Cockpit Executivo",     icon: BarChart3 },
          { key: "transactions", label: "Livro Caixa",           icon: FileText, badge: transactions.length },
          { key: "clients",      label: "Clientes & Cobranças",  icon: Users },
          { key: "accounts",     label: "Contas & Conciliação",  icon: Building2 },
          { key: "dre",          label: "DRE & Rentabilidade",   icon: Scale },
          { key: "budgets",      label: "Orçamentos & Metas",    icon: Target },
          { key: "approvals",    label: "Governança & Alçadas",  icon: ShieldCheck, badge: pendingApprovals.length, alert: pendingApprovals.length > 0 },
          { key: "partners",     label: "Sócios & Reembolsos",   icon: CreditCard },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "13px 16px",
                border: "none",
                background: "transparent",
                color: isActive ? "#fafafa" : "#71717a",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                borderBottom: isActive ? "2px solid #8B5CF6" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon style={{ width: 16, height: 16, color: isActive ? "#8B5CF6" : "#71717a" }} />
              <span>{tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    fontSize: 10,
                    fontWeight: 700,
                    padding: "1px 6px",
                    borderRadius: 10,
                    background: tab.alert ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.1)",
                    color: tab.alert ? "#EF4444" : "#ccc",
                    border: tab.alert ? "1px solid rgba(239,68,68,0.4)" : "none",
                  }}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ─── Content Body ─────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
        {loading && !dashboard ? (
          <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 12, color: "#a1a1aa", fontSize: 14 }}>
            <RefreshCw className="animate-spin" style={{ width: 20, height: 20, color: "#8B5CF6" }} />
            <span>Sincronizando livro financeiro da Teltech...</span>
          </div>
        ) : (
          <>
            {activeTab === "dashboard" && (
              <CockpitView
                dashboard={dashboard}
                onGoToTab={(t) => setActiveTab(t)}
                onNewTx={() => setShowTxModal(true)}
                onApprove={handleApprove}
                onReject={(id) => setRejectingTxId(id)}
                onSendWhatsApp={handleSendWhatsAppPix}
                onMarkPaid={handleMarkPaid}
              />
            )}

            {activeTab === "transactions" && (
              <TransactionsLedgerView
                transactions={transactions}
                accounts={accounts}
                projects={projects}
                filterQuery={filterQuery}
                setFilterQuery={setFilterQuery}
                quickFilter={quickFilter}
                setQuickFilter={setQuickFilter}
                onNewTx={() => {
                  setEditingTx(null);
                  setShowTxModal(true);
                }}
                onEditTx={(tx) => {
                  setEditingTx(tx);
                  setShowTxModal(true);
                }}
                onMarkPaid={handleMarkPaid}
                onDeleteTx={handleDeleteTx}
                onExportCSV={handleExportCSV}
              />
            )}

            {activeTab === "clients" && (
              <ClientsView
                clients={clients}
                transactions={transactions}
                onNewClient={() => setShowClientModal(true)}
                onSendWhatsApp={handleSendWhatsAppPix}
                onNewTxForClient={(clientId) => {
                  setEditingTx({ clientId } as unknown as Transaction);
                  setShowTxModal(true);
                }}
              />
            )}

            {activeTab === "accounts" && (
              <AccountsView
                accounts={accounts}
                transactions={transactions}
                onNewAccount={() => setShowAccountModal(true)}
                onNewTx={() => setShowTxModal(true)}
              />
            )}

            {activeTab === "dre" && (
              <DREView dre={dre} profitability={profitability} />
            )}

            {activeTab === "budgets" && (
              <BudgetsView
                budgets={dashboard?.budgetProgress ?? budgets}
                onNewBudget={() => setShowBudgetModal(true)}
              />
            )}

            {activeTab === "approvals" && (
              <ApprovalsGovernanceView
                pendingApprovals={pendingApprovals}
                onApprove={handleApprove}
                onReject={(id) => setRejectingTxId(id)}
                onNewTx={() => setShowTxModal(true)}
              />
            )}

            {activeTab === "partners" && (
              <PartnersView
                partners={partners}
                transactions={transactions}
                onNewTx={() => setShowTxModal(true)}
                onMarkPaid={handleMarkPaid}
              />
            )}
          </>
        )}
      </div>

      {/* ─── Modals ───────────────────────────────────────────────────────── */}

      {showTxModal && (
        <TransactionModal
          tx={editingTx}
          categories={categories}
          accounts={accounts}
          clients={clients}
          projects={projects}
          partners={partners}
          onClose={() => {
            setShowTxModal(false);
            setEditingTx(null);
          }}
          onSaved={() => {
            setShowTxModal(false);
            setEditingTx(null);
            loadAllData();
          }}
        />
      )}

      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
          onSaved={() => {
            setShowAccountModal(false);
            loadAllData();
          }}
        />
      )}

      {showBudgetModal && (
        <BudgetModal
          categories={categories}
          month={selectedMonth}
          year={selectedYear}
          onClose={() => setShowBudgetModal(false)}
          onSaved={() => {
            setShowBudgetModal(false);
            loadAllData();
          }}
        />
      )}

      {showClientModal && (
        <ClientModal
          onClose={() => setShowClientModal(false)}
          onSaved={() => {
            setShowClientModal(false);
            loadAllData();
          }}
        />
      )}

      {rejectingTxId && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.8)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 100,
            padding: 16,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "#18181c",
              border: "1px solid rgba(239,68,68,0.4)",
              borderRadius: 14,
              padding: 24,
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ padding: 8, borderRadius: 8, background: "rgba(239,68,68,0.15)", color: "#EF4444" }}>
                <AlertTriangle style={{ width: 20, height: 20 }} />
              </div>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                Reprovação de Despesa (Alçada)
              </h3>
            </div>
            <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.5 }}>
              Informe a justificativa corporativa para a reprovação desta solicitação. A razão será gravada na trilha de auditoria.
            </p>
            <textarea
              rows={3}
              placeholder="Ex: Cotação acima do teto estipulado / Aguardar fechamento do trimestre..."
              value={rejectionReason}
              onChange={(e) => setRejectionReason(e.target.value)}
              style={{
                width: "100%",
                background: "#111113",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 8,
                padding: "10px",
                color: "#fff",
                fontSize: 13,
                resize: "none",
                outline: "none",
                boxSizing: "border-box",
              }}
            />
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button
                onClick={() => {
                  setRejectingTxId(null);
                  setRejectionReason("");
                }}
                style={{
                  padding: "8px 14px",
                  borderRadius: 8,
                  background: "transparent",
                  border: "1px solid rgba(255,255,255,0.15)",
                  color: "#ccc",
                  fontSize: 12,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                style={{
                  padding: "8px 16px",
                  borderRadius: 8,
                  background: "#EF4444",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: rejectionReason.trim() ? "pointer" : "not-allowed",
                  opacity: rejectionReason.trim() ? 1 : 0.5,
                }}
              >
                Confirmar Reprovação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. COCKPIT VIEW (Redesigned Executive Cockpit)
// ─────────────────────────────────────────────────────────────────────────────

function CockpitView({
  dashboard,
  onGoToTab,
  onNewTx,
  onApprove,
  onReject,
  onSendWhatsApp,
  onMarkPaid,
}: {
  dashboard: DashboardData | null;
  onGoToTab: (t: TabType) => void;
  onNewTx: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSendWhatsApp: (client: Client, tx?: Transaction) => void;
  onMarkPaid: (tx: Transaction) => void;
}) {
  if (!dashboard) return null;

  // Runway Human Label
  let runwayText = "Sem queima no período";
  let runwaySub = "Nenhuma despesa operacional liquidada nos últimos meses";
  if (dashboard.runwayMonths !== null && dashboard.runwayMonths > 0) {
    runwayText = `${dashboard.runwayMonths} meses de autonomia`;
    runwaySub = `Queima média mensal: ${formatBRL(dashboard.burnRate)}`;
  }

  // Margin calculation
  const totalRevenue = dashboard.monthInflow || 0;
  const netResult = dashboard.monthBalance || 0;
  const netMarginPercent = totalRevenue > 0 ? Math.round((netResult / totalRevenue) * 100) : 0;

  // Pending items count
  const pendingApprovalsCount = dashboard.pendingApprovalsCount || 0;
  const overdueInflows = dashboard.overdueInflowsList || [];
  const overdueOutflows = dashboard.overdueOutflowsList || [];
  const todayDueOutflows = dashboard.todayDueOutflowsList || [];
  const totalUrgentIssues = pendingApprovalsCount + overdueInflows.length + overdueOutflows.length;

  return (
    <div style={{ padding: "24px", display: "flex", flexDirection: "column", gap: 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* ─── Row 1: The 4 Noble KPIs ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 16 }}>
        {/* 1. Caixa Disponível */}
        <CockpitKpiCard
          title="Caixa Disponível Consolidado"
          value={formatBRL(dashboard.totalCash)}
          subtitle={
            dashboard.isBelowReserve
              ? `Abaixo da Reserva de Emergência (${formatBRL(dashboard.emergencyReserveTarget)})`
              : `Reserva protegida (${formatBRL(dashboard.emergencyReserveTarget)})`
          }
          badge={{
            label: dashboard.isBelowReserve ? "Reserva Alerta" : "Reserva Segura",
            color: dashboard.isBelowReserve ? "#EF4444" : "#10B981",
            bg: dashboard.isBelowReserve ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
          }}
          icon={Wallet}
          color={dashboard.isBelowReserve ? "#EF4444" : "#10B981"}
          alert={dashboard.isBelowReserve}
        />

        {/* 2. Resultado Líquido do Mês */}
        <CockpitKpiCard
          title="Resultado Líquido do Mês"
          value={formatBRL(netResult)}
          subtitle={`Faturamento: ${formatBRL(dashboard.monthInflow)} | Custos: ${formatBRL(dashboard.monthOutflow)}`}
          badge={{
            label: netResult >= 0 ? `Margem ${netMarginPercent}%` : "Déficit no Mês",
            color: netResult >= 0 ? "#10B981" : "#EF4444",
            bg: netResult >= 0 ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
          }}
          icon={netResult >= 0 ? TrendingUp : TrendingDown}
          color={netResult >= 0 ? "#10B981" : "#EF4444"}
        />

        {/* 3. Previsão a Receber */}
        <CockpitKpiCard
          title="Previsão a Receber no Mês"
          value={formatBRL(dashboard.monthInflowPending)}
          subtitle={
            dashboard.overdueAmount > 0
              ? `${formatBRL(dashboard.overdueAmount)} em atraso (${dashboard.overdueCount} faturas)`
              : "Sem faturas em atraso"
          }
          badge={{
            label: dashboard.overdueAmount > 0 ? "Atrasos Detectados" : "Em Dia",
            color: dashboard.overdueAmount > 0 ? "#EF4444" : "#3B82F6",
            bg: dashboard.overdueAmount > 0 ? "rgba(239,68,68,0.15)" : "rgba(59,130,246,0.15)",
          }}
          icon={ArrowDownRight}
          color="#3B82F6"
          alert={dashboard.overdueAmount > 0}
        />

        {/* 4. Previsão a Pagar */}
        <CockpitKpiCard
          title="Previsão a Pagar no Mês"
          value={formatBRL(dashboard.monthOutflowPending)}
          subtitle={`Provisão tributária DAS (6%): ${formatBRL(dashboard.taxProvision)}`}
          badge={{
            label: pendingApprovalsCount > 0 ? `${pendingApprovalsCount} em Alçada` : "Aprovadas",
            color: pendingApprovalsCount > 0 ? "#8B5CF6" : "#A1A1AA",
            bg: pendingApprovalsCount > 0 ? "rgba(139,92,246,0.15)" : "rgba(255,255,255,0.06)",
          }}
          icon={ArrowUpRight}
          color="#F59E0B"
        />
      </div>

      {/* ─── Row 2: 2-Column Grid (Left: 2/3 Content, Right: 1/3 Pendencies) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: 20, alignItems: "start" }}>
        {/* LEFT COLUMN (2/3) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Cash Flow Evolution Chart */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  Evolução do Fluxo de Caixa (Semestre)
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#a1a1aa" }}>
                  Comparativo de entradas liquidadas vs saídas operacionais
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: 11, fontWeight: 600 }}>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#10B981" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#10B981" }} /> Entradas
                </span>
                <span style={{ display: "flex", alignItems: "center", gap: 6, color: "#EF4444" }}>
                  <span style={{ width: 8, height: 8, borderRadius: 2, background: "#EF4444" }} /> Saídas
                </span>
              </div>
            </div>

            {/* Bar Chart Visualization */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: 16, height: 160, paddingBottom: 10, borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {dashboard.chartData && dashboard.chartData.length > 0 ? (
                dashboard.chartData.map((d, i) => {
                  const maxVal = Math.max(...dashboard.chartData.map(c => Math.max(c.inflow, c.outflow)), 100000);
                  const inH = Math.max(Math.round((d.inflow / maxVal) * 120), 4);
                  const outH = Math.max(Math.round((d.outflow / maxVal) * 120), 4);
                  return (
                    <div key={i} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6, height: "100%", justifyContent: "flex-end" }}>
                      <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 130 }}>
                        <div
                          title={`Entradas: ${formatBRL(d.inflow)}`}
                          style={{
                            width: 14,
                            height: `${inH}px`,
                            background: "linear-gradient(180deg, #10B981 0%, rgba(16,185,129,0.4) 100%)",
                            borderRadius: "3px 3px 0 0",
                            transition: "height 0.3s ease",
                          }}
                        />
                        <div
                          title={`Saídas: ${formatBRL(d.outflow)}`}
                          style={{
                            width: 14,
                            height: `${outH}px`,
                            background: "linear-gradient(180deg, #EF4444 0%, rgba(239,68,68,0.4) 100%)",
                            borderRadius: "3px 3px 0 0",
                            transition: "height 0.3s ease",
                          }}
                        />
                      </div>
                      <span style={{ fontSize: 11, color: "#888", fontWeight: 600 }}>{d.month}</span>
                    </div>
                  );
                })
              ) : (
                <div style={{ width: "100%", textAlign: "center", color: "#666", fontSize: 12 }}>
                  Sem histórico suficiente nos últimos 6 meses.
                </div>
              )}
            </div>

            {/* Runway & Burn Rate Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 14, paddingTop: 6 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Clock style={{ width: 15, height: 15, color: "#A78BFA" }} />
                <span style={{ fontSize: 12, color: "#fafafa", fontWeight: 600 }}>{runwayText}</span>
              </div>
              <span style={{ fontSize: 11, color: "#71717a" }}>{runwaySub}</span>
            </div>
          </div>

          {/* DRE Sintética do Mês (Mini Cascade) */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  Demonstração do Resultado (DRE Sintética)
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#a1a1aa" }}>
                  Apuração de receitas, custos e resultado do período selecionado
                </p>
              </div>
              <button
                onClick={() => onGoToTab("dre")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8B5CF6",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Ver DRE Completa <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {[
                { label: "(+) Receita Bruta Operacional", val: dashboard.monthInflow, color: "#10B981", sign: "+" },
                { label: "(-) Provisão Tributária (Simples Nacional 6%)", val: dashboard.taxProvision, color: "#EC4899", sign: "-" },
                { label: "(=) Receita Líquida Operacional", val: Math.max(dashboard.monthInflow - dashboard.taxProvision, 0), color: "#fafafa", bold: true },
                { label: "(-) Custos Operacionais & Despesas Fixas", val: dashboard.monthOutflow, color: "#EF4444", sign: "-" },
                { label: "(=) Lucro / Resultado Líquido do Exercício", val: dashboard.monthBalance, color: dashboard.monthBalance >= 0 ? "#10B981" : "#EF4444", bold: true, highlight: true },
              ].map((row, idx) => (
                <div
                  key={idx}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: row.highlight ? "10px 14px" : "6px 0",
                    background: row.highlight ? "rgba(139,92,246,0.1)" : "transparent",
                    borderRadius: row.highlight ? 8 : 0,
                    borderTop: row.bold && !row.highlight ? "1px solid rgba(255,255,255,0.08)" : "none",
                  }}
                >
                  <span style={{ fontSize: 13, color: row.bold ? "#fafafa" : "#a1a1aa", fontWeight: row.bold ? 700 : 500 }}>
                    {row.label}
                  </span>
                  <span style={{ fontSize: 13, color: row.color, fontWeight: row.bold ? 800 : 600 }}>
                    {row.sign === "-" ? `- ${formatBRL(row.val)}` : formatBRL(row.val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Orçamentos Departamentais */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "22px 24px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                  Orçamentos por Área (Teto de Gastos)
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#a1a1aa" }}>
                  Consumo em tempo real em relação ao limite estipulado
                </p>
              </div>
              <button
                onClick={() => onGoToTab("budgets")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#8B5CF6",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                Gerenciar Tetos <ChevronRight style={{ width: 14, height: 14 }} />
              </button>
            </div>

            {dashboard.budgetProgress && dashboard.budgetProgress.length > 0 ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {dashboard.budgetProgress.map((b) => {
                  const isOver = b.percentage >= 90;
                  return (
                    <div key={b.id} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                        <span style={{ fontWeight: 600, color: "#fff", textTransform: "capitalize" }}>
                          {b.department}
                        </span>
                        <span style={{ color: isOver ? "#EF4444" : "#10B981", fontWeight: 700 }}>
                          {formatBRL(b.spent)} de {formatBRL(b.amount)} ({b.percentage}%)
                        </span>
                      </div>
                      <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                        <div
                          style={{
                            width: `${Math.min(b.percentage, 100)}%`,
                            height: "100%",
                            background: isOver ? "#EF4444" : b.percentage > 70 ? "#F59E0B" : "#10B981",
                            borderRadius: 3,
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                icon={Target}
                title="Nenhum orçamento cadastrado"
                description="Defina tetos de gastos mensais para Infraestrutura, Marketing e Operações."
                primaryAction={{ label: "Criar Primeiro Orçamento", onClick: () => onGoToTab("budgets") }}
              />
            )}
          </div>
        </div>

        {/* RIGHT COLUMN (1/3) — Central de Pendências Críticas ("O que eu faço agora?") */}
        <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(30,30,36,0.98), rgba(22,22,26,0.98))",
              border: totalUrgentIssues > 0 ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "22px 20px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck style={{ width: 18, height: 18, color: totalUrgentIssues > 0 ? "#F59E0B" : "#10B981" }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                  Central de Pendências
                </h3>
              </div>
              <span
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: totalUrgentIssues > 0 ? "rgba(245,158,11,0.15)" : "rgba(16,185,129,0.15)",
                  color: totalUrgentIssues > 0 ? "#F59E0B" : "#10B981",
                  border: `1px solid ${totalUrgentIssues > 0 ? "rgba(245,158,11,0.3)" : "rgba(16,185,129,0.3)"}`,
                }}
              >
                {totalUrgentIssues} pendências
              </span>
            </div>

            {/* 1. Alçadas Aguardando Aprovação */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#A78BFA", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <Scale size={13} /> Aprovações de Alçada ({dashboard.pendingApprovalsList?.length ?? 0})
                </span>
                {dashboard.pendingApprovalsList && dashboard.pendingApprovalsList.length > 0 && (
                  <button
                    onClick={() => onGoToTab("approvals")}
                    style={{ background: "transparent", border: "none", color: "#8B5CF6", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >
                    Ver todas
                  </button>
                )}
              </div>

              {dashboard.pendingApprovalsList && dashboard.pendingApprovalsList.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {dashboard.pendingApprovalsList.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(139,92,246,0.08)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{item.description}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#EF4444" }}>{formatBRL(item.amount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#888" }}>
                        <span>Por: {item.partnerName || "Membro"}</span>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button
                            onClick={() => onApprove(item.id)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 4,
                              background: "#10B981",
                              border: "none",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Aprovar
                          </button>
                          <button
                            onClick={() => onReject(item.id)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 4,
                              background: "rgba(239,68,68,0.2)",
                              border: "1px solid rgba(239,68,68,0.4)",
                              color: "#EF4444",
                              fontSize: 10,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            Reprovar
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 11, color: "#a1a1aa", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} style={{ color: "#10B981" }} /> Nenhuma solicitação de despesa aguardando alçada.
                </div>
              )}
            </div>

            {/* 2. Cobranças em Atraso (Clientes) */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: "#EF4444", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <AlertOctagon size={13} /> Faturas a Receber Vencidas ({overdueInflows.length})
                </span>
                {overdueInflows.length > 0 && (
                  <button
                    onClick={() => onGoToTab("clients")}
                    style={{ background: "transparent", border: "none", color: "#8B5CF6", fontSize: 11, fontWeight: 600, cursor: "pointer" }}
                  >
                    Ver carteira
                  </button>
                )}
              </div>

              {overdueInflows.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {overdueInflows.slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(239,68,68,0.08)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{item.clientName}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#10B981" }}>{formatBRL(item.amount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#888" }}>
                        <span>Vencido em {formatShortDate(item.dueDate)}</span>
                        {item.clientPhone ? (
                          <button
                            onClick={() => onSendWhatsApp({ id: item.clientId ?? "", name: item.clientName, phone: item.clientPhone ?? "" } as Client, item as unknown as Transaction)}
                            style={{
                              padding: "3px 8px",
                              borderRadius: 4,
                              background: "#25D366",
                              border: "none",
                              color: "#fff",
                              fontSize: 10,
                              fontWeight: 700,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 3,
                            }}
                          >
                            <Send style={{ width: 10, height: 10 }} /> Cobrar Pix
                          </button>
                        ) : (
                          <span style={{ color: "#777" }}>Sem WhatsApp</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 11, color: "#a1a1aa", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} style={{ color: "#10B981" }} /> Todos os clientes estão em dia neste período.
                </div>
              )}
            </div>

            {/* 3. Contas a Pagar Vencendo Hoje / Atrasadas */}
            <div>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase", display: "inline-flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <Calendar size={13} /> Contas a Pagar Críticas ({overdueOutflows.length + todayDueOutflows.length})
              </span>

              {overdueOutflows.length > 0 || todayDueOutflows.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {[...overdueOutflows, ...todayDueOutflows].slice(0, 3).map((item) => (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(245,158,11,0.08)",
                        border: "1px solid rgba(245,158,11,0.25)",
                        borderRadius: 10,
                        padding: "10px 12px",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{item.description}</span>
                        <span style={{ fontSize: 12, fontWeight: 800, color: "#EF4444" }}>{formatBRL(item.amount)}</span>
                      </div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#888" }}>
                        <span>Vencimento: {formatShortDate(item.dueDate)}</span>
                        <button
                          onClick={() => onMarkPaid(item as unknown as Transaction)}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 4,
                            background: "rgba(16,185,129,0.2)",
                            border: "1px solid rgba(16,185,129,0.4)",
                            color: "#10B981",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Dar Baixa
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{ padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 11, color: "#a1a1aa", display: "inline-flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={13} style={{ color: "#10B981" }} /> Nenhuma conta atrasada ou vencendo hoje.
                </div>
              )}
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "18px 20px",
            }}
          >
            <h4 style={{ margin: "0 0 12px", fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Ações Rápidas de Rotina
            </h4>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <button
                onClick={onNewTx}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "rgba(139,92,246,0.12)",
                  border: "1px solid rgba(139,92,246,0.3)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <span>+ Lançar Despesa ou Fatura</span>
                <Plus style={{ width: 14, height: 14, color: "#A78BFA" }} />
              </button>
              <button
                onClick={() => onGoToTab("accounts")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#ccc",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <span>Conciliar Contas Bancárias</span>
                <Building2 style={{ width: 14, height: 14 }} />
              </button>
              <button
                onClick={() => onGoToTab("partners")}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "9px 12px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  color: "#ccc",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <span>Reembolsos dos Sócios</span>
                <CreditCard style={{ width: 14, height: 14 }} />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. TRANSACTIONS LEDGER VIEW (Professional Accounting Table)
// ─────────────────────────────────────────────────────────────────────────────

function TransactionsLedgerView({
  transactions,
  accounts,
  projects,
  filterQuery,
  setFilterQuery,
  quickFilter,
  setQuickFilter,
  onNewTx,
  onEditTx,
  onMarkPaid,
  onDeleteTx,
  onExportCSV,
}: {
  transactions: Transaction[];
  accounts: BankAccount[];
  projects: Project[];
  filterQuery: string;
  setFilterQuery: (q: string) => void;
  quickFilter: "all" | "inflow" | "outflow" | "pending" | "paid" | "overdue" | "approval";
  setQuickFilter: (f: "all" | "inflow" | "outflow" | "pending" | "paid" | "overdue" | "approval") => void;
  onNewTx: () => void;
  onEditTx: (tx: Transaction) => void;
  onMarkPaid: (tx: Transaction) => void;
  onDeleteTx: (id: string) => void;
  onExportCSV: () => void;
}) {
  const [selectedAccountId, setSelectedAccountId] = useState<string>("all");
  const [selectedProjectId, setSelectedProjectId] = useState<string>("all");

  // Filtering
  const filtered = transactions.filter((t) => {
    // Quick filter
    if (quickFilter === "inflow" && t.type !== "inflow") return false;
    if (quickFilter === "outflow" && t.type !== "outflow") return false;
    if (quickFilter === "pending" && t.status !== "pending") return false;
    if (quickFilter === "paid" && t.status !== "paid") return false;
    if (quickFilter === "overdue" && t.computedStatus !== "overdue") return false;
    if (quickFilter === "approval" && t.approvalStatus !== "pending_approval") return false;

    // Account
    if (selectedAccountId !== "all" && t.accountId !== selectedAccountId) return false;

    // Project
    if (selectedProjectId !== "all" && t.projectId !== selectedProjectId) return false;

    // Text search
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      const desc = (t.description || "").toLowerCase();
      const client = (t.clientName || "").toLowerCase();
      const partner = (t.partnerName || "").toLowerCase();
      const cat = (t.categoryName || "").toLowerCase();
      const proj = (t.projectName || "").toLowerCase();
      return desc.includes(q) || client.includes(q) || partner.includes(q) || cat.includes(q) || proj.includes(q);
    }

    return true;
  });

  // Filter Totals
  const totalInflowFiltered = filtered.filter(t => t.type === "inflow").reduce((s, t) => s + t.amount, 0);
  const totalOutflowFiltered = filtered.filter(t => t.type === "outflow").reduce((s, t) => s + t.amount, 0);
  const balanceFiltered = totalInflowFiltered - totalOutflowFiltered;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", gap: 18, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* ─── Top Filter Metrics Ribbon ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: "#888", fontWeight: 600, textTransform: "uppercase" }}>Movimentações Filtradas</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#fff", marginTop: 2 }}>{filtered.length} lançamentos</div>
        </div>
        <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: "#10B981", fontWeight: 600, textTransform: "uppercase" }}>Entradas (Filtro)</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#10B981", marginTop: 2 }}>{formatBRL(totalInflowFiltered)}</div>
        </div>
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: "#EF4444", fontWeight: 600, textTransform: "uppercase" }}>Saídas (Filtro)</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: "#EF4444", marginTop: 2 }}>{formatBRL(totalOutflowFiltered)}</div>
        </div>
        <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, padding: "12px 16px" }}>
          <span style={{ fontSize: 11, color: "#A78BFA", fontWeight: 600, textTransform: "uppercase" }}>Saldo Resultante</span>
          <div style={{ fontSize: 20, fontWeight: 800, color: balanceFiltered >= 0 ? "#10B981" : "#EF4444", marginTop: 2 }}>
            {formatBRL(balanceFiltered)}
          </div>
        </div>
      </div>

      {/* ─── Quick View Tabs ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "all",      label: "Todas" },
            { id: "inflow",   label: "A Receber / Entradas" },
            { id: "outflow",  label: "A Pagar / Saídas" },
            { id: "overdue",  label: "Atrasadas / Urgentes", icon: <AlertTriangle size={12} style={{ color: "#EF4444" }} /> },
            { id: "paid",     label: "Liquidadas" },
            { id: "approval", label: "Em Alçada", icon: <Scale size={12} style={{ color: "#A78BFA" }} /> },
          ].map((qv) => (
            <button
              key={qv.id}
              onClick={() => setQuickFilter(qv.id as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 5,
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: quickFilter === qv.id ? 700 : 500,
                background: quickFilter === qv.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                border: quickFilter === qv.id ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.08)",
                color: quickFilter === qv.id ? "#fff" : "#a1a1aa",
                cursor: "pointer",
              }}
            >
              {qv.icon}
              {qv.label}
            </button>
          ))}
        </div>

        <div style={{ display: "flex", gap: 10 }}>
          <button
            onClick={onExportCSV}
            style={{
              padding: "7px 12px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              color: "#ccc",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Download style={{ width: 14, height: 14 }} /> Exportar
          </button>
          <button
            onClick={onNewTx}
            style={{
              padding: "7px 14px",
              borderRadius: 8,
              background: "#8B5CF6",
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus style={{ width: 14, height: 14 }} /> Novo Lançamento
          </button>
        </div>
      </div>

      {/* ─── Search & Dropdown Filters Bar ────────────────────────────────── */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: 260, position: "relative" }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#666" }} />
          <input
            type="text"
            placeholder="Pesquisar por descrição, cliente, sócio ou categoria..."
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "9px 12px 9px 36px",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{
            background: "#18181c",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "9px 12px",
            color: "#ccc",
            fontSize: 12,
            outline: "none",
          }}
        >
          <option value="all">Todas as Contas Bancárias</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>

        <select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{
            background: "#18181c",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "9px 12px",
            color: "#ccc",
            fontSize: 12,
            outline: "none",
          }}
        >
          <option value="all">Todos os Projetos</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </select>
      </div>

      {/* ─── Ledger Accounting Table ──────────────────────────────────────── */}
      {filtered.length > 0 ? (
        <div style={{ background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 12, overflow: "hidden" }}>
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 13 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.08)", color: "#888", fontSize: 11, fontWeight: 700, textTransform: "uppercase" }}>
                  <th style={{ padding: "12px 16px" }}>Vencimento</th>
                  <th style={{ padding: "12px 16px" }}>Descrição & Contrato</th>
                  <th style={{ padding: "12px 16px" }}>Projeto / Centro</th>
                  <th style={{ padding: "12px 16px" }}>Categoria / CPV</th>
                  <th style={{ padding: "12px 16px" }}>Conta</th>
                  <th style={{ padding: "12px 16px" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Valor</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Ações</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((tx) => {
                  const isInflow = tx.type === "inflow";
                  return (
                    <tr
                      key={tx.id}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        transition: "background 0.15s ease",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.02)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                    >
                      {/* Vencimento */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <div style={{ fontWeight: 600, color: "#fff" }}>{formatDate(tx.dueDate)}</div>
                        {tx.paidAt && (
                          <div style={{ fontSize: 11, color: "#10B981" }}>Pago em {formatDate(tx.paidAt)}</div>
                        )}
                      </td>

                      {/* Descrição & Tags */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontWeight: 700, color: "#fafafa" }}>{tx.description}</div>
                        <div style={{ display: "flex", gap: 6, marginTop: 4, alignItems: "center" }}>
                          {tx.clientName && (
                            <span style={{ fontSize: 11, color: "#3B82F6", fontWeight: 600 }}>
                              Cliente: {tx.clientName}
                            </span>
                          )}
                          {tx.partnerName && (
                            <span style={{ fontSize: 11, color: "#8B5CF6", fontWeight: 600 }}>
                              Sócio: {tx.partnerName}
                            </span>
                          )}
                          {tx.installmentsTotal && tx.installmentsTotal > 1 && (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#aaa" }}>
                              Parcela {tx.installmentNumber}/{tx.installmentsTotal}
                            </span>
                          )}
                          {tx.isRecurring && (
                            <span style={{ fontSize: 10, padding: "1px 6px", borderRadius: 4, background: "rgba(139,92,246,0.15)", color: "#A78BFA" }}>
                              Recorrente
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Projeto */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        {tx.projectName ? (
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 11, fontWeight: 600, color: tx.projectColor || "#ccc" }}>
                            <span style={{ width: 6, height: 6, borderRadius: "50%", background: tx.projectColor || "#888" }} />
                            {tx.projectName}
                          </span>
                        ) : (
                          <span style={{ fontSize: 11, color: "#666" }}>Geral Teltech</span>
                        )}
                      </td>

                      {/* Categoria & CPV */}
                      <td style={{ padding: "14px 16px" }}>
                        <div style={{ fontSize: 12, color: "#ddd", fontWeight: 500, marginBottom: 4 }}>
                          {tx.categoryName || "Sem categoria"}
                        </div>
                        <CostTypeBadge type={tx.costType} />
                      </td>

                      {/* Conta */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 12, color: "#aaa" }}>{tx.accountName || "Conta Geral"}</span>
                      </td>

                      {/* Status */}
                      <td style={{ padding: "14px 16px", whiteSpace: "nowrap" }}>
                        <StatusBadge status={tx.status} approvalStatus={tx.approvalStatus} />
                      </td>

                      {/* Valor */}
                      <td style={{ padding: "14px 16px", textAlign: "right", whiteSpace: "nowrap" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: isInflow ? "#10B981" : "#fafafa" }}>
                          {isInflow ? "+" : "-"} {formatBRL(tx.amount)}
                        </span>
                      </td>

                      {/* Ações */}
                      <td style={{ padding: "14px 16px", textAlign: "center", whiteSpace: "nowrap" }}>
                        <div style={{ display: "inline-flex", gap: 6 }}>
                          {tx.status !== "paid" && (
                            <button
                              onClick={() => onMarkPaid(tx)}
                              title="Dar baixa / Marcar como pago"
                              style={{
                                padding: "4px 8px",
                                borderRadius: 6,
                                background: "rgba(16,185,129,0.15)",
                                border: "1px solid rgba(16,185,129,0.3)",
                                color: "#10B981",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              Baixar
                            </button>
                          )}
                          <button
                            onClick={() => onEditTx(tx)}
                            title="Editar lançamento"
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.05)",
                              border: "1px solid rgba(255,255,255,0.1)",
                              color: "#ccc",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            Editar
                          </button>
                          <button
                            onClick={() => onDeleteTx(tx.id)}
                            title="Excluir lançamento"
                            style={{
                              padding: "4px 8px",
                              borderRadius: 6,
                              background: "rgba(239,68,68,0.1)",
                              border: "1px solid rgba(239,68,68,0.25)",
                              color: "#EF4444",
                              fontSize: 11,
                              cursor: "pointer",
                            }}
                          >
                            <X style={{ width: 12, height: 12 }} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <EmptyState
          icon={FileText}
          title="Nenhum lançamento financeiro encontrado"
          description="Não encontramos movimentações para os filtros ou período selecionado. Você pode cadastrar uma nova despesa ou faturamento."
          primaryAction={{ label: "Lançar Despesa ou Fatura", onClick: onNewTx }}
          secondaryAction={{ label: "Limpar Filtros", onClick: () => { setFilterQuery(""); setQuickFilter("all"); } }}
          tip="Você pode lançar compras parceladas em até 48x de uma única vez."
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. CLIENTS & BILLING VIEW (Accounts Receivable & Pix via WhatsApp)
// ─────────────────────────────────────────────────────────────────────────────

function ClientsView({
  clients,
  transactions,
  onNewClient,
  onSendWhatsApp,
  onNewTxForClient,
}: {
  clients: Client[];
  transactions: Transaction[];
  onNewClient: () => void;
  onSendWhatsApp: (client: Client, tx?: Transaction) => void;
  onNewTxForClient: (clientId: string) => void;
}) {
  const [searchClient, setSearchClient] = useState("");

  const filteredClients = clients.filter(c =>
    c.name.toLowerCase().includes(searchClient.toLowerCase()) ||
    (c.document || "").includes(searchClient)
  );

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
            Carteira de Clientes & Contas a Receber
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Gestão de contratos B2B, emissão de cobranças Pix via WhatsApp e histórico de pagamentos
          </p>
        </div>
        <button
          onClick={onNewClient}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#8B5CF6",
            border: "none",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus style={{ width: 15, height: 15 }} /> Novo Cliente
        </button>
      </div>

      <div style={{ maxWidth: 360, position: "relative" }}>
        <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 16, height: 16, color: "#666" }} />
        <input
          type="text"
          placeholder="Buscar cliente por nome ou CNPJ..."
          value={searchClient}
          onChange={(e) => setSearchClient(e.target.value)}
          style={{
            width: "100%",
            background: "rgba(255,255,255,0.04)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "9px 12px 9px 36px",
            color: "#fff",
            fontSize: 13,
            outline: "none",
            boxSizing: "border-box",
          }}
        />
      </div>

      {filteredClients.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {filteredClients.map((client) => {
            const clientTxs = transactions.filter(t => t.clientId === client.id && t.type === "inflow");
            const totalBilled = clientTxs.filter(t => t.status === "paid").reduce((s, t) => s + t.amount, 0);
            const pendingTxs = clientTxs.filter(t => t.status === "pending");
            const pendingAmount = pendingTxs.reduce((s, t) => s + t.amount, 0);
            const hasOverdue = pendingTxs.some(t => new Date(t.dueDate) < new Date());

            return (
              <div
                key={client.id}
                style={{
                  background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
                  border: `1px solid ${hasOverdue ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14,
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{client.name}</h4>
                    <span style={{ fontSize: 11, color: "#888" }}>{client.document || "Sem CNPJ/CPF"}</span>
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: hasOverdue ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                      color: hasOverdue ? "#EF4444" : "#10B981",
                      border: `1px solid ${hasOverdue ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                    }}
                  >
                    {hasOverdue ? "Inadimplente / Atrasado" : "Em Dia"}
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#777" }}>Total Faturado:</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>{formatBRL(totalBilled)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#777" }}>Em Aberto:</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: pendingAmount > 0 ? "#F59E0B" : "#aaa" }}>
                      {formatBRL(pendingAmount)}
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    onClick={() => onSendWhatsApp(client, pendingTxs[0])}
                    style={{
                      flex: 1,
                      padding: "8px 10px",
                      borderRadius: 8,
                      background: "#25D366",
                      border: "none",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: 6,
                    }}
                  >
                    <Send style={{ width: 13, height: 13 }} /> Cobrança WhatsApp
                  </button>
                  <button
                    onClick={() => onNewTxForClient(client.id)}
                    style={{
                      padding: "8px 12px",
                      borderRadius: 8,
                      background: "rgba(255,255,255,0.06)",
                      border: "1px solid rgba(255,255,255,0.12)",
                      color: "#ccc",
                      fontSize: 12,
                      cursor: "pointer",
                    }}
                  >
                    + Fatura
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title="Nenhum cliente cadastrado"
          description="Cadastre clientes para vincular faturamentos, controlar contas a receber e emitir cobranças Pix via WhatsApp."
          primaryAction={{ label: "Cadastrar Primeiro Cliente", onClick: onNewClient }}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ACCOUNTS & RECONCILIATION VIEW (Multi-bank Conciliation)
// ─────────────────────────────────────────────────────────────────────────────

function AccountsView({
  accounts,
  transactions,
  onNewAccount,
  onNewTx,
}: {
  accounts: BankAccount[];
  transactions: Transaction[];
  onNewAccount: () => void;
  onNewTx: () => void;
}) {
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
            Contas Bancárias & Conciliação
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Saldo consolidado em bancos parceiros (Inter, Cora e Caixa Reserva) com conciliação automática
          </p>
        </div>
        <button
          onClick={onNewAccount}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#8B5CF6",
            border: "none",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus style={{ width: 15, height: 15 }} /> Nova Conta
        </button>
      </div>

      <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(79,45,138,0.15))", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 14, padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#A78BFA", textTransform: "uppercase" }}>Patrimônio Líquido em Caixa</span>
          <div style={{ fontSize: 30, fontWeight: 900, color: "#fff", marginTop: 2 }}>{formatBRL(totalBalance)}</div>
        </div>
        <span style={{ fontSize: 12, color: "#ccc" }}>{accounts.length} contas bancárias ativas e conciliadas</span>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {accounts.map((acc) => {
          const accTxs = transactions.filter(t => t.accountId === acc.id);
          const pendingCount = accTxs.filter(t => t.status === "pending").length;

          return (
            <div
              key={acc.id}
              style={{
                background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
                border: `1px solid ${acc.color}40`,
                borderRadius: 14,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{ width: 12, height: 12, borderRadius: "50%", background: acc.color }} />
                  <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>{acc.name}</span>
                </div>
                <span style={{ fontSize: 10, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#aaa" }}>
                  {acc.type}
                </span>
              </div>

              <div>
                <span style={{ fontSize: 11, color: "#777" }}>Saldo Atual:</span>
                <div style={{ fontSize: 24, fontWeight: 800, color: "#10B981" }}>{formatBRL(acc.currentBalance)}</div>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                <span>Saldo Inicial: {formatBRL(acc.initialBalance)}</span>
                <span style={{ color: pendingCount > 0 ? "#F59E0B" : "#10B981" }}>
                  {pendingCount > 0 ? `${pendingCount} a conciliar` : <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={12} /> 100% Conciliado</span>}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. DRE & PROFITABILITY VIEW (Structured Accounting Statement)
// ─────────────────────────────────────────────────────────────────────────────

function DREView({
  dre,
  profitability,
}: {
  dre: DREData | null;
  profitability: ProjectProfitability[];
}) {
  if (!dre) return null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", gap: 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
          DRE Gerencial & Rentabilidade de Projetos
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
          Demonstração do Resultado do Exercício e margem de contribuição individual de cada produto Teltech
        </p>
      </div>

      {/* DRE Accounting Cascade Table */}
      <div style={{ background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Estrutura de Demonstração de Resultado</span>
          <span style={{ fontSize: 12, color: "#888" }}>Base: Competência Contábil</span>
        </div>

        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 2 }}>
          {[
            { label: "(+) RECEITA BRUTA OPERACIONAL", val: dre.grossRevenue, pct: 100, bold: true, color: "#10B981" },
            { label: "    (-) Provisão Tributária (Simples Nacional 6%)", val: dre.taxDeductions, pct: dre.grossRevenue > 0 ? (dre.taxDeductions / dre.grossRevenue) * 100 : 0, sign: "-", color: "#EC4899" },
            { label: "(=) RECEITA OPERACIONAL LÍQUIDA", val: dre.netRevenue, pct: dre.grossRevenue > 0 ? (dre.netRevenue / dre.grossRevenue) * 100 : 0, bold: true, color: "#fff", divider: true },
            { label: "    (-) Custos Diretos dos Serviços Prestados (CPV / COGS)", val: dre.totalCOGS, pct: dre.grossRevenue > 0 ? (dre.totalCOGS / dre.grossRevenue) * 100 : 0, sign: "-", color: "#3B82F6" },
            { label: "(=) MARGEM BRUTA OPERACIONAL", val: dre.grossProfit, pct: dre.grossMarginPercent, bold: true, color: "#3B82F6", highlight: true },
            { label: "    (-) Despesas Operacionais Fixas (Infra, Cloud, Software)", val: dre.fixedExpenses, pct: dre.grossRevenue > 0 ? (dre.fixedExpenses / dre.grossRevenue) * 100 : 0, sign: "-", color: "#F59E0B" },
            { label: "    (-) Retiradas de Sócios (Pró-labore & Dividendos)", val: dre.partnerWithdrawals, pct: dre.grossRevenue > 0 ? (dre.partnerWithdrawals / dre.grossRevenue) * 100 : 0, sign: "-", color: "#8B5CF6" },
            { label: "(=) RESULTADO LÍQUIDO DO EXERCÍCIO (LUCRO LÍQUIDO)", val: dre.netProfit, pct: dre.netMarginPercent, bold: true, color: dre.netProfit >= 0 ? "#10B981" : "#EF4444", final: true },
          ].map((row, i) => (
            <div
              key={i}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: row.final ? "14px 16px" : row.highlight ? "10px 14px" : "8px 0",
                background: row.final ? "rgba(16,185,129,0.12)" : row.highlight ? "rgba(59,130,246,0.1)" : "transparent",
                borderRadius: row.final || row.highlight ? 8 : 0,
                borderTop: row.divider ? "1px solid rgba(255,255,255,0.1)" : "none",
                marginTop: row.divider ? 4 : 0,
              }}
            >
              <span style={{ fontSize: row.final ? 14 : 13, fontWeight: row.bold ? 800 : 500, color: row.bold ? "#fafafa" : "#a1a1aa", fontFamily: "monospace" }}>
                {row.label}
              </span>
              <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                <span style={{ fontSize: 11, color: "#777", minWidth: 50, textAlign: "right" }}>
                  {row.pct ? `${row.pct.toFixed(1)}%` : "—"}
                </span>
                <span style={{ fontSize: row.final ? 16 : 13, fontWeight: 800, color: row.color, minWidth: 120, textAlign: "right" }}>
                  {row.sign === "-" ? `- ${formatBRL(row.val)}` : formatBRL(row.val)}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Rentabilidade por Projeto (Sofia, PDV, Ledger) */}
      <div>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#fff" }}>
          Rentabilidade por Produto / Frente de Negócio
        </h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
          {profitability.map((p) => {
            const isHealthy = p.marginPercent >= 40;
            return (
              <div
                key={p.id}
                style={{
                  background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
                  border: `1px solid ${p.color}40`,
                  borderRadius: 14,
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>{p.name}</span>
                  <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 10, background: `${p.color}20`, color: p.color }}>
                    Margem: {p.marginPercent}%
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: 8 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#777" }}>Receita:</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#10B981" }}>{formatBRL(p.revenue)}</div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#777" }}>CPV Direto:</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#EF4444" }}>{formatBRL(p.cogs)}</div>
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>Margem de Contribuição:</span>
                  <strong style={{ fontSize: 14, color: isHealthy ? "#10B981" : "#F59E0B" }}>{formatBRL(p.margin)}</strong>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. BUDGETS & TARGETS VIEW (Zero NaN Guaranteed)
// ─────────────────────────────────────────────────────────────────────────────

function BudgetsView({
  budgets,
  onNewBudget,
}: {
  budgets: BudgetData[];
  onNewBudget: () => void;
}) {
  const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", gap: 20, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
            Orçamentos & Metas Departamentais
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Tetos de gastos mensais por centro de custo para controle rigoroso de queima de caixa
          </p>
        </div>
        <button
          onClick={onNewBudget}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#8B5CF6",
            border: "none",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus style={{ width: 15, height: 15 }} /> Novo Teto Orçamentário
        </button>
      </div>

      {/* Global Progress */}
      <div style={{ background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Teto Global Consolidado da Teltech</span>
          <span style={{ fontSize: 14, fontWeight: 800, color: "#A78BFA" }}>
            {formatBRL(totalSpent)} de {formatBRL(totalBudget)}
          </span>
        </div>
        <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
          <div
            style={{
              width: `${totalBudget > 0 ? Math.min(Math.round((totalSpent / totalBudget) * 100), 100) : 0}%`,
              height: "100%",
              background: "#8B5CF6",
              borderRadius: 4,
            }}
          />
        </div>
      </div>

      {/* Department Cards Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {budgets.map((b) => {
          const isOver = (b.percentage || 0) >= 90;
          const remaining = Math.max((b.amount || 0) - (b.spent || 0), 0);

          return (
            <div
              key={b.id}
              style={{
                background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
                border: `1px solid ${isOver ? "rgba(239,68,68,0.4)" : "rgba(255,255,255,0.08)"}`,
                borderRadius: 14,
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 15, fontWeight: 800, color: "#fff", textTransform: "capitalize" }}>
                  Departamento {b.department}
                </span>
                <span style={{ fontSize: 11, fontWeight: 700, color: isOver ? "#EF4444" : "#10B981" }}>
                  {b.percentage || 0}% Consumido
                </span>
              </div>

              <div style={{ width: "100%", height: 7, background: "rgba(255,255,255,0.06)", borderRadius: 4, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${Math.min(b.percentage || 0, 100)}%`,
                    height: "100%",
                    background: isOver ? "#EF4444" : (b.percentage || 0) > 70 ? "#F59E0B" : "#10B981",
                    borderRadius: 4,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, background: "rgba(0,0,0,0.25)", padding: "10px", borderRadius: 8 }}>
                <div>
                  <span style={{ fontSize: 11, color: "#777" }}>Realizado:</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>{formatBRL(b.spent)}</div>
                </div>
                <div>
                  <span style={{ fontSize: 11, color: "#777" }}>Saldo Restante:</span>
                  <div style={{ fontSize: 13, fontWeight: 700, color: isOver ? "#EF4444" : "#10B981" }}>
                    {formatBRL(remaining)}
                  </div>
                </div>
              </div>

              <div style={{ fontSize: 11, color: "#888", textAlign: "right" }}>
                Teto Aprovado: <strong style={{ color: "#ccc" }}>{formatBRL(b.amount)}</strong>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. GOVERNANCE & APPROVALS VIEW (Matriz de Alçadas da Teltech)
// ─────────────────────────────────────────────────────────────────────────────

function ApprovalsGovernanceView({
  pendingApprovals,
  onApprove,
  onReject,
  onNewTx,
}: {
  pendingApprovals: Transaction[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onNewTx: () => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", gap: 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
          Governança Corporativa & Matriz de Alçadas
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
          Regras de validação de despesas, compliance de gastos e fila de deliberação executiva
        </p>
      </div>

      {/* Matriz Ativa de Governança (Cards Always Visible) */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
        <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.3)", borderRadius: 12, padding: "16px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>Faixa 1 — Operacional</span>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 4 }}>Até R$ 500,00</div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#a1a1aa", display: "flex", alignItems: "flex-start", gap: 6 }}>
            <CheckCircle2 size={13} style={{ color: "#10B981", flexShrink: 0, marginTop: 2 }} />
            <span><strong>Auto-aprovação</strong> imediata pelo sistema para micro-despesas rotineiras.</span>
          </p>
        </div>

        <div style={{ background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 12, padding: "16px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#3B82F6", textTransform: "uppercase" }}>Faixa 2 — Sócios Fundadores</span>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 4 }}>R$ 500,01 a R$ 3.000,00</div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#a1a1aa", display: "flex", alignItems: "flex-start", gap: 6 }}>
            <Scale size={13} style={{ color: "#3B82F6", flexShrink: 0, marginTop: 2 }} />
            <span>Aprovação direta por qualquer um dos sócios (<strong>Tarcísio Silva</strong> ou <strong>Lucas Andre</strong>).</span>
          </p>
        </div>

        <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 12, padding: "16px" }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#A78BFA", textTransform: "uppercase" }}>Faixa 3 — Alçada Plena & Paritária</span>
          <div style={{ fontSize: 16, fontWeight: 800, color: "#fff", marginTop: 4 }}>Acima de R$ 3.000,00</div>
          <p style={{ margin: "6px 0 0", fontSize: 12, color: "#a1a1aa", display: "flex", alignItems: "flex-start", gap: 6 }}>
            <Crown size={13} style={{ color: "#A78BFA", flexShrink: 0, marginTop: 2 }} />
            <span>Alçada plena igualitária: <strong>Tarcísio Silva</strong> ou <strong>Lucas Andre</strong> (mesmo peso e poder de voto 50/50).</span>
          </p>
        </div>
      </div>

      {/* Fila de Pendências */}
      <div>
        <h3 style={{ margin: "0 0 14px", fontSize: 16, fontWeight: 700, color: "#fff" }}>
          Fila de Deliberação ({pendingApprovals.length} pendentes)
        </h3>

        {pendingApprovals.length > 0 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {pendingApprovals.map((item) => (
              <div
                key={item.id}
                style={{
                  background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
                  border: "1px solid rgba(139,92,246,0.4)",
                  borderRadius: 14,
                  padding: "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 16,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>{item.description}</h4>
                    <CostTypeBadge type={item.costType} />
                  </div>
                  <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 12, color: "#a1a1aa" }}>
                    <span>Solicitante: <strong style={{ color: "#fff" }}>{item.partnerName || "Membro"}</strong></span>
                    <span>Vencimento: <strong style={{ color: "#fff" }}>{formatDate(item.dueDate)}</strong></span>
                    <span>Conta: <strong style={{ color: "#fff" }}>{item.accountName || "Geral"}</strong></span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                  <span style={{ fontSize: 20, fontWeight: 900, color: "#EF4444" }}>{formatBRL(item.amount)}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => onApprove(item.id)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "#10B981",
                        border: "none",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Aprovar Despesa
                    </button>
                    <button
                      onClick={() => onReject(item.id)}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "rgba(239,68,68,0.15)",
                        border: "1px solid rgba(239,68,68,0.3)",
                        color: "#EF4444",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Rejeitar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            icon={ShieldCheck}
            title="Nenhuma despesa aguardando aprovação"
            description="Todas as despesas lançadas estão em conformidade com as alçadas ou já foram aprovadas pela diretoria."
            primaryAction={{ label: "Lançar Nova Despesa", onClick: onNewTx }}
            tip="Governança Paritária: Tarcísio Silva e Lucas Andre possuem alçada igualitária de 50/50 para todas as aprovações da Teltech."
          />
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 8. PARTNERS & REIMBURSEMENTS VIEW
// ─────────────────────────────────────────────────────────────────────────────

function PartnersView({
  partners,
  transactions,
  onNewTx,
  onMarkPaid,
}: {
  partners: PartnerData[];
  transactions: Transaction[];
  onNewTx: () => void;
  onMarkPaid: (tx: Transaction) => void;
}) {
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "24px", gap: 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff" }}>
              Sócios Fundadores da Teltech
            </h2>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}>
              Quadro 100% Igualitário (50% / 50%)
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Gestão paritária de retiradas de pró-labore, distribuição e quitação de reembolsos corporativos
          </p>
        </div>
        <button
          onClick={onNewTx}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "#8B5CF6",
            border: "none",
            color: "#fff",
            fontSize: 13,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Plus style={{ width: 15, height: 15 }} /> Solicitar Reembolso / Pró-labore
        </button>
      </div>

      {/* Partner Executive Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {partners.map((p) => (
          <div
            key={p.id}
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
              border: `1px solid ${p.color}40`,
              borderRadius: 14,
              padding: "22px",
              display: "flex",
              flexDirection: "column",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 12,
                  background: `linear-gradient(135deg, ${p.color}, #4F2D8A)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 18,
                  fontWeight: 900,
                  color: "#fff",
                }}
              >
                {p.name[0]}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>{p.name}</h4>
                <span style={{ fontSize: 11, fontWeight: 700, color: p.color, textTransform: "uppercase" }}>
                  {p.role} Teltech
                </span>
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: 8, background: "rgba(0,0,0,0.25)", padding: "12px", borderRadius: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#777" }}>Pró-labore / Retiradas:</span>
                <strong style={{ color: "#10B981" }}>{formatBRL(p.withdrawalsPaid)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#777" }}>Reembolsos Pendentes:</span>
                <strong style={{ color: p.reimbursementsPending > 0 ? "#F59E0B" : "#888" }}>
                  {formatBRL(p.reimbursementsPending)}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#777" }}>Reembolsos Quitados:</span>
                <strong style={{ color: "#aaa" }}>{formatBRL(p.reimbursementsPaid)}</strong>
              </div>
            </div>

            <button
              onClick={onNewTx}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#ccc",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              + Novo Lançamento para {p.name.split(" ")[0]}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: TRANSACTION (With Batch Installments & Recurrence)
// ─────────────────────────────────────────────────────────────────────────────

function TransactionModal({
  tx,
  categories,
  accounts,
  clients,
  projects,
  partners,
  onClose,
  onSaved,
}: {
  tx: Transaction | null;
  categories: Category[];
  accounts: BankAccount[];
  clients: Client[];
  projects: Project[];
  partners: PartnerData[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [type, setType] = useState<TxType>(tx?.type || "outflow");
  const [description, setDescription] = useState(tx?.description || "");
  const [amountInput, setAmountInput] = useState(tx ? (tx.amount / 100).toFixed(2).replace(".", ",") : "");
  const [dueDate, setDueDate] = useState(tx ? tx.dueDate.split("T")[0] : new Date().toISOString().split("T")[0]);
  const [categoryId, setCategoryId] = useState(tx?.categoryId || "");
  const [accountId, setAccountId] = useState(tx?.accountId || (accounts[0]?.id ?? ""));
  const [projectId, setProjectId] = useState(tx?.projectId || "");
  const [clientId, setClientId] = useState(tx?.clientId || "");
  const [partnerId, setPartnerId] = useState(tx?.partnerId || "");
  const [costType, setCostType] = useState<CostType>(tx?.costType || "fixed_operating");
  const [status, setStatus] = useState<TxStatus>(tx?.status || "pending");
  const [notes, setNotes] = useState(tx?.notes || "");

  // Batch installments & recurrence
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(2);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("monthly");

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBRL(amountInput);
    if (!description.trim() || amount <= 0) {
      toast.error("Por favor, preencha a descrição e um valor válido.");
      return;
    }

    try {
      setSaving(true);
      const payload: Record<string, any> = {
        type,
        description: description.trim(),
        amount,
        dueDate: new Date(dueDate).toISOString(),
        categoryId: categoryId || null,
        accountId: accountId || null,
        projectId: projectId || null,
        clientId: clientId || null,
        partnerId: partnerId || null,
        costType: type === "outflow" ? costType : null,
        status,
        notes: notes.trim() || null,
      };

      if (!tx && isInstallment && installmentsCount > 1) {
        payload.installmentsTotal = installmentsCount;
      }

      if (!tx && isRecurring) {
        payload.isRecurring = true;
        payload.recurringInterval = recurringInterval;
      }

      if (tx?.id) {
        await API.put(`/finance/transactions/${tx.id}`, payload);
      } else {
        await API.post(`/finance/transactions`, payload);
      }

      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar lançamento financeiro.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 560, maxHeight: "90vh", overflowY: "auto", background: "#18181c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "24px", display: "flex", flexDirection: "column", gap: 18 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>
            {tx ? "Editar Lançamento" : "Novo Lançamento Financeiro"}
          </h3>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer" }}>
            <X style={{ width: 20, height: 20 }} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Type Selector */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <button
              type="button"
              onClick={() => setType("inflow")}
              style={{
                padding: "10px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                border: type === "inflow" ? "1px solid #10B981" : "1px solid rgba(255,255,255,0.1)",
                background: type === "inflow" ? "rgba(16,185,129,0.15)" : "rgba(255,255,255,0.03)",
                color: type === "inflow" ? "#10B981" : "#888",
                cursor: "pointer",
              }}
            >
              + Entrada / Receita
            </button>
            <button
              type="button"
              onClick={() => setType("outflow")}
              style={{
                padding: "10px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                border: type === "outflow" ? "1px solid #EF4444" : "1px solid rgba(255,255,255,0.1)",
                background: type === "outflow" ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.03)",
                color: type === "outflow" ? "#EF4444" : "#888",
                cursor: "pointer",
              }}
            >
              - Saída / Despesa
            </button>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Descrição *</label>
            <input
              type="text"
              required
              placeholder="Ex: Servidores AWS / Mensalidade Contrato Sofia..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Valor (R$) *</label>
              <input
                type="text"
                required
                placeholder="0,00"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Vencimento *</label>
              <input
                type="date"
                required
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Conta Bancária</label>
              <select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Status Inicial</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as TxStatus)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="pending">Pendente</option>
                <option value="paid">Liquidado / Pago</option>
              </select>
            </div>
          </div>

          {type === "outflow" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Tipo de Custo (DRE)</label>
              <select
                value={costType}
                onChange={(e) => setCostType(e.target.value as CostType)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="direct_cogs">Custo Direto de Projeto (CPV / COGS)</option>
                <option value="fixed_operating">Despesa Operacional Fixa</option>
                <option value="partner_withdrawal">Pró-labore / Retirada de Sócio</option>
                <option value="tax">Impostos / Simples Nacional</option>
                <option value="investment">Investimento / Expansão</option>
              </select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Projeto / Produto</label>
              <select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="">Geral Teltech</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Cliente ou Sócio</label>
              {type === "inflow" ? (
                <select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
                >
                  <option value="">Nenhum cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              ) : (
                <select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
                >
                  <option value="">Nenhum sócio específico</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role.toUpperCase()})</option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {!tx && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: 8 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>Gerar Parcelamento em Lote?</label>
                <input
                  type="checkbox"
                  checked={isInstallment}
                  onChange={(e) => setIsInstallment(e.target.checked)}
                />
              </div>
              {isInstallment && (
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 12, color: "#888" }}>Número de parcelas:</span>
                  <select
                    value={installmentsCount}
                    onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                    style={{ background: "#111113", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px", color: "#fff" }}
                  >
                    {[2, 3, 4, 5, 6, 10, 12, 24, 36, 48].map(n => (
                      <option key={n} value={n}>{n}x mensais</option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 10 }}>
            <button
              type="button"
              onClick={onClose}
              style={{ padding: "9px 16px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc", fontSize: 13, cursor: "pointer" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              style={{ padding: "9px 20px", borderRadius: 8, background: "#8B5CF6", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              {saving ? "Salvando..." : tx ? "Salvar Alterações" : "Concluir Lançamento"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: BANK ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

function AccountModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [type, setType] = useState("checking");
  const [balanceInput, setBalanceInput] = useState("");
  const [color, setColor] = useState("#8B5CF6");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      await API.post("/finance/accounts", {
        name: name.trim(),
        type,
        color,
        initialBalance: parseBRL(balanceInput),
      });
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar conta.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#18181c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>Nova Conta Bancária</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Nome da Conta *</label>
            <input
              type="text"
              required
              placeholder="Ex: Banco Inter PJ / Conta Cora..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Tipo</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="checking">Conta Corrente</option>
                <option value="cash">Caixa Reserva</option>
                <option value="investment">Investimentos</option>
                <option value="credit_card">Cartão Corporativo</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Saldo Inicial (R$)</label>
              <input
                type="text"
                placeholder="0,00"
                value={balanceInput}
                onChange={(e) => setBalanceInput(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc", fontSize: 12 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, background: "#8B5CF6", border: "none", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {saving ? "Salvando..." : "Salvar Conta"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: BUDGET
// ─────────────────────────────────────────────────────────────────────────────

function BudgetModal({
  categories,
  month,
  year,
  onClose,
  onSaved,
}: {
  categories: Category[];
  month: number;
  year: number;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [department, setDepartment] = useState("");
  const [amountInput, setAmountInput] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!department.trim()) return;
    try {
      setSaving(true);
      await API.post("/finance/budgets", {
        department: department.trim(),
        amount: parseBRL(amountInput),
        month,
        year,
        categoryId: categoryId || null,
      });
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao criar orçamento.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#18181c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>Novo Teto Orçamentário</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Área / Departamento *</label>
            <input
              type="text"
              required
              placeholder="Ex: Infraestrutura, Marketing, Operações..."
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Teto Mensal (R$) *</label>
            <input
              type="text"
              required
              placeholder="0,00"
              value={amountInput}
              onChange={(e) => setAmountInput(e.target.value)}
              style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc", fontSize: 12 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, background: "#8B5CF6", border: "none", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {saving ? "Salvando..." : "Salvar Teto"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: CLIENT
// ─────────────────────────────────────────────────────────────────────────────

function ClientModal({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [name, setName] = useState("");
  const [document, setDocument] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      await API.post("/finance/clients", {
        name: name.trim(),
        document: document.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
      });
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.85)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 110, padding: 16 }}>
      <div style={{ width: "100%", maxWidth: 440, background: "#18181c", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 16, padding: "24px", display: "flex", flexDirection: "column", gap: 16 }}>
        <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fff" }}>Novo Cliente Corporativo</h3>
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Razão Social / Nome *</label>
            <input
              type="text"
              required
              placeholder="Ex: StrataScratch Inc..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>CNPJ / CPF</label>
              <input
                type="text"
                placeholder="00.000.000/0001-00"
                value={document}
                onChange={(e) => setDocument(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>WhatsApp / Telefone</label>
              <input
                type="text"
                placeholder="(11) 99999-9999"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>E-mail Financeiro</label>
            <input
              type="email"
              placeholder="financeiro@empresa.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 8 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc", fontSize: 12 }}>
              Cancelar
            </button>
            <button type="submit" disabled={saving} style={{ padding: "8px 18px", borderRadius: 8, background: "#8B5CF6", border: "none", color: "#fff", fontSize: 12, fontWeight: 700 }}>
              {saving ? "Salvando..." : "Salvar Cliente"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
