import { useState, useEffect, useContext, useCallback, useRef } from "react";
import { useAuth } from "../lib/auth-context";
import { useIsMobile } from "../hooks/use-mobile";
import { API } from "../lib/api";
import { ClientAvatar } from "../components/ClientAvatar";
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
  ChevronDown,
  Filter,
  Sparkles,
  Lock,
  Scale,
  Target,
  AlertCircle,
  Eye,
  EyeOff,
  RefreshCw,
  SlidersHorizontal,
  Layers,
  Send,
  Crown,
  AlertOctagon,
  Trash2,
  FolderOpen,
  Repeat2,
  Coins,
  Trophy,
  Maximize2,
  CalendarDays,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import { Drawer, Select, Checkbox, DateInput, Tip, FinanceUiRoot, drawerBtn, confirmDialog } from "../components/finance-ui";
import {
  SalesWizardModal,
  ModulesCatalogModal,
  SaleManageModal,
  ClientSalesSummary,
  type SaleView,
} from "./finance/SalesModule";
import { TeamModule } from "./finance/TeamModule";

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
  pauseBilling?: boolean;
  saleId?: string | null;
  saleItemId?: string | null;
  revenueType?: "recurring" | "one_time" | null;
  referenceMonth?: string | null;
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
  photoUrl?: string | null;
  whatsappOptIn: boolean;
  status: string;
  notes?: string;
  projectId?: string;
  projectName?: string;
  projectColor?: string;
}

interface ClientContract {
  id: string;
  clientId: string;
  projectId: string;
  monthlyAmount: number;        // em centavos
  billingDay: number;
  billingCycleMonths: number;
  contractStartDate?: string;
  contractEndDate?: string;
  totalInstallments?: number;
  installmentsPaid: number;
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
  recurringRevenue?: number;
  oneTimeRevenue?: number;
  otherRevenue?: number;
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

export interface ProductMacroMonth {
  key: string;       // "YYYY-MM"
  label: string;     // "mai/26"
  shortLabel: string;// "Mai"
  year: number;
  month: number;
  isCurrent: boolean;
  isPast: boolean;
  isFuture: boolean;
}

export interface ProductMonthlyAmount {
  paid: number;
  pending: number;
  total: number;
  recurring: number;
  oneTime: number;
  txCount: number;
}

export interface ProductMacroRow {
  productId: string;
  productName: string;
  productColor: string;
  productIcon: string | null;
  status?: string;
  activeClientsCount: number;
  months: Record<string, ProductMonthlyAmount>;
  totalPeriod: ProductMonthlyAmount;
  averageMonthly: number;
  sharePercent: number;
}

export interface ProductMacroReport {
  months: ProductMacroMonth[];
  products: ProductMacroRow[];
  totalsByMonth: Record<string, ProductMonthlyAmount>;
  grandTotal: ProductMonthlyAmount;
}

interface DashboardData {
  mrr: number;
  oneTimeContracted?: number;
  contractedReceivable?: number;
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
    daysOverdue?: number;
    clientId?: string;
    clientName: string;
    clientPhone?: string | null;
    whatsappOptIn?: boolean;
    clientStatus?: string;
    isRecurring?: boolean;
    installmentNumber?: number | null;
    installmentsTotal?: number | null;
    pauseBilling?: boolean;
  }>;
  todayDueInflowsList?: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    isToday?: boolean;
    clientId?: string;
    clientName: string;
    clientPhone?: string | null;
    whatsappOptIn?: boolean;
    clientStatus?: string;
    isRecurring?: boolean;
    installmentNumber?: number | null;
    installmentsTotal?: number | null;
    pauseBilling?: boolean;
  }>;
  upcomingInflowsList?: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    isToday?: boolean;
    diffDays?: number;
    clientId?: string;
    clientName: string;
    clientPhone?: string | null;
    whatsappOptIn?: boolean;
    clientStatus?: string;
    isRecurring?: boolean;
    installmentNumber?: number | null;
    installmentsTotal?: number | null;
    pauseBilling?: boolean;
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
    costType?: string;
  }>;
  upcomingOutflowsList?: Array<{
    id: string;
    description: string;
    amount: number;
    dueDate: string;
    costType?: string;
  }>;
  categoryDistribution: Array<{ name: string; color: string; amount: number; percentage: number }>;
  budgetProgress: BudgetData[];
  chartData: Array<{ month: string; inflow: number; outflow: number; balance: number }>;
  upcoming: Transaction[];
  productMacroReport?: ProductMacroReport;
  selectedMonth: number;
  selectedYear: number;
}

type TabType =
  | "dashboard"
  | "transactions"
  | "clients"
  | "accounts"
  | "team"
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

// ─── Design System: Cockpit Macro Report by Product & Month ──────────────────

interface ProductAvatarProps {
  productId?: string;
  productName: string;
  productColor?: string;
  productIcon?: string | null;
  size?: number;
  borderRadius?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function ProductAvatar({
  productId,
  productName,
  productColor,
  productIcon,
  size = 26,
  borderRadius,
  className,
  style,
}: ProductAvatarProps) {
  const { projects } = useContext(AppContext);
  const [imgError, setImgError] = useState(false);

  // Match by id or by name
  const matchedProj = projects?.find(
    (p) =>
      (productId && p.id === productId) ||
      (p.name && productName && p.name.trim().toLowerCase() === productName.trim().toLowerCase())
  );

  const candidateIcon = productIcon || matchedProj?.icon || null;
  const color = productColor || matchedProj?.color || "#8B5CF6";
  const isUnallocated = productId === "unallocated" || candidateIcon === "Layers";

  const isImage = Boolean(
    candidateIcon &&
      !isUnallocated &&
      (candidateIcon.startsWith("http://") ||
        candidateIcon.startsWith("https://") ||
        candidateIcon.startsWith("//") ||
        candidateIcon.startsWith("data:") ||
        candidateIcon.startsWith("/") ||
        candidateIcon.startsWith("blob:") ||
        /\.(png|jpe?g|svg|webp|gif|avif)($|\?)/i.test(candidateIcon))
  );

  const rad = borderRadius ?? Math.max(6, Math.round(size * 0.28));
  const initial = productName?.trim() ? productName.trim()[0].toUpperCase() : "P";

  return (
    <div
      className={className}
      style={{
        width: size,
        height: size,
        borderRadius: rad,
        background: isImage && !imgError ? "rgba(255,255,255,0.06)" : color,
        border: isImage && !imgError ? `1px solid rgba(255,255,255,0.18)` : `1px solid ${color}60`,
        boxShadow: `0 2px 8px ${color}35`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        overflow: "hidden",
        position: "relative",
        ...style,
      }}
    >
      {isImage && !imgError ? (
        <img
          src={candidateIcon!}
          alt={productName}
          onError={() => setImgError(true)}
          style={{
            width: "100%",
            height: "100%",
            objectFit: "cover",
            display: "block",
          }}
        />
      ) : isUnallocated ? (
        <Layers style={{ width: Math.round(size * 0.52), height: Math.round(size * 0.52), color: "#fff" }} />
      ) : (
        <span
          style={{
            fontSize: Math.max(10, Math.round(size * 0.44)),
            fontWeight: 800,
            color: "#fff",
            lineHeight: 1,
            textShadow: "0 1px 3px rgba(0,0,0,0.6)",
            userSelect: "none",
          }}
        >
          {initial}
        </span>
      )}
    </div>
  );
}

interface CockpitProductMacroReportProps {
  report?: ProductMacroReport;
  selectedMonth: number;
  selectedYear: number;
  onGoToClients?: () => void;
  onGoToTransactions?: () => void;
}

function CockpitProductMacroReport({
  report,
  selectedMonth,
  selectedYear,
  onGoToClients,
  onGoToTransactions,
}: CockpitProductMacroReportProps) {
  const isMobile = useIsMobile();
  const [periodFilter, setPeriodFilter] = useState<"6m" | "12m" | "past" | "future">("6m");
  const [metricMode, setMetricMode] = useState<"total" | "paid" | "pending">("total");
  const [natureFilter, setNatureFilter] = useState<"all" | "recurring" | "one_time">("all");
  const [viewMode, setViewMode] = useState<"matrix" | "cards">("matrix");
  const [selectedCell, setSelectedCell] = useState<{
    product: ProductMacroRow;
    month: ProductMacroMonth;
  } | null>(null);

  // Hidden products state with localStorage persistence
  const [hiddenProductIds, setHiddenProductIds] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("teltech_macro_hidden_products");
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });
  const [productsDropdownOpen, setProductsDropdownOpen] = useState(false);
  const productsDropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      localStorage.setItem("teltech_macro_hidden_products", JSON.stringify(hiddenProductIds));
    } catch {}
  }, [hiddenProductIds]);

  useEffect(() => {
    if (!productsDropdownOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (productsDropdownRef.current && !productsDropdownRef.current.contains(e.target as Node)) {
        setProductsDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [productsDropdownOpen]);

  const toggleProductVisibility = (productId: string) => {
    setHiddenProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  };

  const showAllProducts = () => {
    setHiddenProductIds([]);
  };

  if (!report || !report.months || report.months.length === 0) {
    return null;
  }

  // Determine visible months
  const allMonths = report.months;
  const currentOrSelectedIdx = allMonths.findIndex(
    (m) => m.year === selectedYear && m.month === selectedMonth
  );
  const anchorIdx = currentOrSelectedIdx >= 0 ? currentOrSelectedIdx : allMonths.findIndex((m) => m.isCurrent);
  const safeAnchor = anchorIdx >= 0 ? anchorIdx : 0;

  let visibleMonths: ProductMacroMonth[] = allMonths;
  if (periodFilter === "6m") {
    const start = Math.max(0, Math.min(safeAnchor - 2, allMonths.length - 6));
    visibleMonths = allMonths.slice(start, start + 6);
  } else if (periodFilter === "past") {
    visibleMonths = allMonths.filter((m) => m.isPast || m.isCurrent);
  } else if (periodFilter === "future") {
    visibleMonths = allMonths.filter((m) => m.isFuture || m.isCurrent);
  }

  // Helper to extract value based on metricMode & natureFilter
  const getCellValue = (amounts?: ProductMonthlyAmount | null): number => {
    if (!amounts) return 0;
    if (natureFilter === "recurring") return amounts.recurring || 0;
    if (natureFilter === "one_time") return amounts.oneTime || 0;
    if (metricMode === "paid") return amounts.paid || 0;
    if (metricMode === "pending") return amounts.pending || 0;
    return amounts.total || 0;
  };

  const products = report.products || [];

  // Compute row totals for all products in the visible period
  const allProductRowsCalculated = products.map((p) => {
    const visibleTotal = visibleMonths.reduce((sum, m) => sum + getCellValue(p.months[m.key]), 0);
    const visiblePaid = visibleMonths.reduce((sum, m) => sum + (p.months[m.key]?.paid || 0), 0);
    const visiblePending = visibleMonths.reduce((sum, m) => sum + (p.months[m.key]?.pending || 0), 0);
    const visibleRecurring = visibleMonths.reduce((sum, m) => sum + (p.months[m.key]?.recurring || 0), 0);
    const visibleOneTime = visibleMonths.reduce((sum, m) => sum + (p.months[m.key]?.oneTime || 0), 0);
    const averageMonthly = visibleMonths.length > 0 ? Math.round(visibleTotal / visibleMonths.length) : 0;

    return {
      ...p,
      visibleTotal,
      visiblePaid,
      visiblePending,
      visibleRecurring,
      visibleOneTime,
      averageMonthly,
    };
  });

  const hideZeroRevenueProducts = () => {
    const zeroIds = allProductRowsCalculated
      .filter((p) => p.visibleTotal === 0)
      .map((p) => p.productId);
    setHiddenProductIds(zeroIds);
  };

  // Filter ONLY active (non-hidden) products for display and aggregation
  const productRowsCalculated = allProductRowsCalculated.filter(
    (p) => !hiddenProductIds.includes(p.productId)
  );

  // Calculate totals per visible month ONLY with active products
  const monthTotalsCalculated: Record<string, number> = {};
  for (const m of visibleMonths) {
    monthTotalsCalculated[m.key] = productRowsCalculated.reduce(
      (sum, p) => sum + getCellValue(p.months[m.key]),
      0
    );
  }

  const grandVisibleTotal = Object.values(monthTotalsCalculated).reduce((sum, v) => sum + v, 0);
  const totalRecurringVisible = productRowsCalculated.reduce((sum, p) => sum + p.visibleRecurring, 0);
  const totalOneTimeVisible = productRowsCalculated.reduce((sum, p) => sum + p.visibleOneTime, 0);

  // Key Analytical Highlights
  const topProduct = [...productRowsCalculated].sort((a, b) => b.visibleTotal - a.visibleTotal)[0];
  const peakMonth = [...visibleMonths].sort(
    (a, b) => (monthTotalsCalculated[b.key] || 0) - (monthTotalsCalculated[a.key] || 0)
  )[0];
  const peakMonthTotal = peakMonth ? monthTotalsCalculated[peakMonth.key] || 0 : 0;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(26,26,30,0.98), rgba(20,20,24,0.98))",
        border: "1px solid rgba(139,92,246,0.25)",
        borderRadius: 14,
        padding: isMobile ? "16px 14px" : "24px 26px",
        boxShadow: "0 10px 40px -10px rgba(0,0,0,0.55)",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative Glow Orb */}
      <div
        style={{
          position: "absolute",
          top: -40,
          right: -40,
          width: 180,
          height: 180,
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)",
          pointerEvents: "none",
        }}
      />

      {/* ─── Header ──────────────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: 14,
          marginBottom: 18,
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          paddingBottom: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
          <div
            style={{
              padding: 9,
              borderRadius: 10,
              background: "rgba(139,92,246,0.15)",
              border: "1px solid rgba(139,92,246,0.3)",
              color: "#A78BFA",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginTop: 2,
            }}
          >
            <Layers style={{ width: 20, height: 20 }} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.01em" }}>
                Relatório Macro: Faturamento por Produto & Mês
              </h3>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 12,
                  background: "rgba(139,92,246,0.15)",
                  color: "#C4B5FD",
                  border: "1px solid rgba(139,92,246,0.3)",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Cockpit Executivo
              </span>
            </div>
            <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
              Matriz consolidada de receitas por produto/sistema e competência mensal (realizado x a faturar)
            </p>
          </div>
        </div>

        {/* KPI Badges */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: "6px 12px",
            }}
          >
            <span style={{ fontSize: 10, color: "#a1a1aa", textTransform: "uppercase", fontWeight: 600 }}>Total no Período</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#10B981" }}>{formatBRL(grandVisibleTotal)}</span>
          </div>

          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "flex-end",
              background: "rgba(139,92,246,0.08)",
              border: "1px solid rgba(139,92,246,0.2)",
              borderRadius: 8,
              padding: "6px 12px",
            }}
          >
            <span style={{ fontSize: 10, color: "#A78BFA", textTransform: "uppercase", fontWeight: 600 }}>MRR Contratado</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: "#C4B5FD" }}>{formatBRL(totalRecurringVisible)}</span>
          </div>
        </div>
      </div>

      {/* ─── Controls & Filters Strip ────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "stretch" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: 12,
          marginBottom: 18,
          background: "rgba(0,0,0,0.2)",
          padding: isMobile ? "10px" : "10px 12px",
          borderRadius: 10,
          border: "1px solid rgba(255,255,255,0.05)",
        }}
      >
        {/* Left Filters: Período & Status & Natureza (Horizontal scroller on mobile) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            overflowX: isMobile ? "auto" : "visible",
            flexWrap: isMobile ? "nowrap" : "wrap",
            paddingBottom: isMobile ? 4 : 0,
            WebkitOverflowScrolling: "touch",
            scrollbarWidth: "none",
            width: isMobile ? "100%" : "auto",
          }}
        >
          {/* Período Selector */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 7, padding: 2, flexShrink: 0 }}>
            {[
              { id: "6m", label: "Semestre (6M)" },
              { id: "12m", label: "Ano (12M)" },
              { id: "past", label: "Histórico" },
              { id: "future", label: "Projeção" },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setPeriodFilter(tab.id as any)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 11,
                  fontWeight: periodFilter === tab.id ? 700 : 500,
                  background: periodFilter === tab.id ? "#8B5CF6" : "transparent",
                  color: periodFilter === tab.id ? "#fff" : "#a1a1aa",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Metric Status Selector */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 7, padding: 2, flexShrink: 0 }}>
            {[
              { id: "total", label: "Total Contratado" },
              { id: "paid", label: "Realizado (Pago)" },
              { id: "pending", label: "Previsto (Aberto)" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setMetricMode(btn.id as any)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 11,
                  fontWeight: metricMode === btn.id ? 700 : 500,
                  background: metricMode === btn.id ? "rgba(16,185,129,0.25)" : "transparent",
                  color: metricMode === btn.id ? "#10B981" : "#a1a1aa",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Natureza Filter */}
          <div style={{ display: "flex", background: "rgba(255,255,255,0.06)", borderRadius: 7, padding: 2, flexShrink: 0 }}>
            {[
              { id: "all", label: "Todas" },
              { id: "recurring", label: "MRR / Mensalidade" },
              { id: "one_time", label: "Entradas / Setup" },
            ].map((btn) => (
              <button
                key={btn.id}
                onClick={() => setNatureFilter(btn.id as any)}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: "none",
                  fontSize: 11,
                  fontWeight: natureFilter === btn.id ? 700 : 500,
                  background: natureFilter === btn.id ? "rgba(245,158,11,0.25)" : "transparent",
                  color: natureFilter === btn.id ? "#F59E0B" : "#a1a1aa",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.2s ease",
                }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          {/* Product Filter Dropdown */}
          <div ref={productsDropdownRef} style={{ position: "relative", flexShrink: 0 }}>
            <button
              onClick={() => setProductsDropdownOpen(!productsDropdownOpen)}
              style={{
                padding: "4px 10px",
                borderRadius: 7,
                border: hiddenProductIds.length > 0 ? "1px solid rgba(239,68,68,0.4)" : "1px solid rgba(255,255,255,0.1)",
                fontSize: 11,
                fontWeight: 600,
                background: hiddenProductIds.length > 0 ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.06)",
                color: hiddenProductIds.length > 0 ? "#FCA5A5" : "#e4e4e7",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
                transition: "all 0.2s ease",
              }}
            >
              <SlidersHorizontal style={{ width: 12, height: 12 }} />
              <span>
                Produtos ({productRowsCalculated.length}/{products.length})
              </span>
              {hiddenProductIds.length > 0 && (
                <span
                  style={{
                    background: "#EF4444",
                    color: "#fff",
                    fontSize: 9,
                    fontWeight: 800,
                    padding: "1px 5px",
                    borderRadius: 10,
                  }}
                >
                  {hiddenProductIds.length} oculto{hiddenProductIds.length > 1 ? "s" : ""}
                </span>
              )}
              <ChevronDown style={{ width: 12, height: 12, opacity: 0.7 }} />
            </button>

            {productsDropdownOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: isMobile ? "auto" : 0,
                  right: isMobile ? 0 : "auto",
                  zIndex: 60,
                  minWidth: isMobile ? 260 : 290,
                  maxWidth: isMobile ? "min(320px, 90vw)" : 340,
                  background: "#18181b",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: 10,
                  boxShadow: "0 16px 48px rgba(0,0,0,0.75)",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingBottom: 6, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.03em" }}>
                    Produtos Contabilizados
                  </span>
                  <span style={{ fontSize: 10, color: "#a1a1aa" }}>
                    {productRowsCalculated.length} de {products.length} ativos
                  </span>
                </div>

                {/* Quick actions */}
                <div style={{ display: "flex", gap: 6 }}>
                  <button
                    onClick={showAllProducts}
                    disabled={hiddenProductIds.length === 0}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      borderRadius: 5,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.05)",
                      color: hiddenProductIds.length === 0 ? "#52525b" : "#e4e4e7",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: hiddenProductIds.length === 0 ? "default" : "pointer",
                    }}
                  >
                    Mostrar Todos
                  </button>
                  <button
                    onClick={hideZeroRevenueProducts}
                    style={{
                      flex: 1,
                      padding: "4px 8px",
                      borderRadius: 5,
                      border: "1px solid rgba(139,92,246,0.3)",
                      background: "rgba(139,92,246,0.12)",
                      color: "#C4B5FD",
                      fontSize: 10,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Ocultar Sem Receita (R$ 0)
                  </button>
                </div>

                {/* Product List */}
                <div style={{ display: "flex", flexDirection: "column", gap: 5, maxHeight: 280, overflowY: "auto", paddingRight: 2 }}>
                  {allProductRowsCalculated.map((prod) => {
                    const isHidden = hiddenProductIds.includes(prod.productId);
                    return (
                      <div
                        key={prod.productId}
                        onClick={() => toggleProductVisibility(prod.productId)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 8px",
                          borderRadius: 6,
                          background: isHidden ? "rgba(255,255,255,0.02)" : "rgba(255,255,255,0.06)",
                          border: isHidden ? "1px solid rgba(255,255,255,0.04)" : "1px solid rgba(255,255,255,0.08)",
                          cursor: "pointer",
                          opacity: isHidden ? 0.45 : 1,
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                          <ProductAvatar
                            productId={prod.productId}
                            productName={prod.productName}
                            productColor={prod.productColor}
                            productIcon={prod.productIcon}
                            size={22}
                            borderRadius={5}
                          />
                          <div style={{ display: "flex", flexDirection: "column", minWidth: 0 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: isHidden ? "#71717a" : "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {prod.productName}
                            </span>
                            <span style={{ fontSize: 10, color: isHidden ? "#52525b" : "#10B981", fontWeight: 600 }}>
                              {formatBRL(prod.visibleTotal)}
                            </span>
                          </div>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
                          {isHidden ? (
                            <EyeOff style={{ width: 14, height: 14, color: "#EF4444" }} />
                          ) : (
                            <Eye style={{ width: 14, height: 14, color: "#10B981" }} />
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* View Mode Toggle: Matriz vs Cards */}
        <div
          style={{
            display: "flex",
            background: "rgba(255,255,255,0.06)",
            borderRadius: 7,
            padding: 2,
            width: isMobile ? "100%" : "auto",
          }}
        >
          <button
            onClick={() => setViewMode("matrix")}
            style={{
              flex: isMobile ? 1 : "initial",
              justifyContent: "center",
              padding: isMobile ? "6px 10px" : "4px 10px",
              borderRadius: 6,
              border: "none",
              fontSize: 11,
              fontWeight: viewMode === "matrix" ? 700 : 500,
              background: viewMode === "matrix" ? "rgba(255,255,255,0.15)" : "transparent",
              color: viewMode === "matrix" ? "#fff" : "#a1a1aa",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <BarChart3 style={{ width: 13, height: 13 }} /> Matriz Mês a Mês
          </button>
          <button
            onClick={() => setViewMode("cards")}
            style={{
              flex: isMobile ? 1 : "initial",
              justifyContent: "center",
              padding: isMobile ? "6px 10px" : "4px 10px",
              borderRadius: 6,
              border: "none",
              fontSize: 11,
              fontWeight: viewMode === "cards" ? 700 : 500,
              background: viewMode === "cards" ? "rgba(255,255,255,0.15)" : "transparent",
              color: viewMode === "cards" ? "#fff" : "#a1a1aa",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
            }}
          >
            <PieChart style={{ width: 13, height: 13 }} /> Cards por Produto
          </button>
        </div>
      </div>

      {/* ─── Hidden Products Notice Banner ─────────────────────────────── */}
      {hiddenProductIds.length > 0 && (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 10,
            background: "rgba(239,68,68,0.08)",
            border: "1px solid rgba(239,68,68,0.25)",
            borderRadius: 8,
            padding: "8px 14px",
            marginBottom: 16,
            fontSize: 12,
            color: "#FCA5A5",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <EyeOff style={{ width: 15, height: 15, color: "#EF4444", flexShrink: 0 }} />
            <span>
              <strong>{hiddenProductIds.length} {hiddenProductIds.length === 1 ? "produto oculto" : "produtos ocultos"}</strong> da consolidação macro. Os totais acima e abaixo foram recalculados considerando apenas os produtos ativos.
            </span>
          </div>
          <button
            onClick={showAllProducts}
            style={{
              background: "rgba(239,68,68,0.2)",
              border: "1px solid rgba(239,68,68,0.4)",
              color: "#fff",
              borderRadius: 6,
              padding: "3px 10px",
              fontSize: 11,
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            Restaurar Todos ({products.length})
          </button>
        </div>
      )}

      {/* ─── Mode 1: Matriz Mês a Mês (Tabela) ────────────────────────────── */}
      {viewMode === "matrix" && (
        <div
          style={{
            overflowX: "auto",
            WebkitOverflowScrolling: "touch",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            background: "rgba(18,18,22,0.9)",
            marginBottom: 16,
          }}
        >
          {isMobile && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "7px 12px",
                background: "rgba(139,92,246,0.1)",
                borderBottom: "1px solid rgba(139,92,246,0.18)",
                fontSize: 11,
                color: "#C4B5FD",
                fontWeight: 600,
              }}
            >
              <span>← Deslize horizontalmente para navegar nos meses →</span>
              <span style={{ fontSize: 11, opacity: 0.8 }}>↔ Scroll</span>
            </div>
          )}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: isMobile ? 11 : 12, textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                {/* Sticky Product Header */}
                <th
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 2,
                    background: "rgba(24,24,28,0.98)",
                    padding: isMobile ? "8px 10px" : "12px 14px",
                    fontWeight: 700,
                    color: "#a1a1aa",
                    minWidth: isMobile ? 120 : 220,
                    maxWidth: isMobile ? 140 : "none",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                    fontSize: isMobile ? 10 : 11,
                  }}
                >
                  Produto
                </th>

                {/* Visible Month Headers */}
                {visibleMonths.map((m) => {
                  const isCurrent = m.isCurrent;
                  return (
                    <th
                      key={m.key}
                      style={{
                        padding: isMobile ? "8px 6px" : "10px 14px",
                        fontWeight: 700,
                        color: isCurrent ? "#C4B5FD" : "#a1a1aa",
                        background: isCurrent ? "rgba(139,92,246,0.12)" : "transparent",
                        borderRight: "1px solid rgba(255,255,255,0.04)",
                        minWidth: isMobile ? 76 : 110,
                        textAlign: "right",
                        textTransform: "capitalize",
                        fontSize: isMobile ? 10 : 11,
                      }}
                    >
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
                        <span>{m.label}</span>
                        {isCurrent && (
                          <span
                            style={{
                              fontSize: 8,
                              fontWeight: 800,
                              color: "#8B5CF6",
                              background: "rgba(139,92,246,0.2)",
                              padding: "1px 4px",
                              borderRadius: 3,
                              textTransform: "uppercase",
                            }}
                          >
                            Atual
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}

                {/* Total Period Column */}
                <th
                  style={{
                    padding: isMobile ? "8px 8px" : "12px 16px",
                    fontWeight: 800,
                    color: "#fafafa",
                    background: "rgba(255,255,255,0.04)",
                    minWidth: isMobile ? 85 : 120,
                    textAlign: "right",
                    fontSize: isMobile ? 10 : 11,
                    textTransform: "uppercase",
                    letterSpacing: "0.03em",
                  }}
                >
                  Total
                </th>

                {/* Average Column */}
                <th
                  style={{
                    padding: isMobile ? "8px 6px" : "12px 14px",
                    fontWeight: 700,
                    color: "#a1a1aa",
                    minWidth: isMobile ? 75 : 110,
                    textAlign: "right",
                    fontSize: isMobile ? 10 : 11,
                    textTransform: "uppercase",
                  }}
                >
                  Média
                </th>

                {/* Share % Column */}
                <th
                  style={{
                    padding: isMobile ? "8px 6px" : "12px 14px",
                    fontWeight: 700,
                    color: "#a1a1aa",
                    minWidth: isMobile ? 60 : 90,
                    textAlign: "right",
                    fontSize: isMobile ? 10 : 11,
                    textTransform: "uppercase",
                  }}
                >
                  % Share
                </th>
              </tr>
            </thead>

            <tbody>
              {productRowsCalculated.length === 0 ? (
                <tr>
                  <td
                    colSpan={visibleMonths.length + 4}
                    style={{
                      padding: "40px 20px",
                      textAlign: "center",
                      color: "#a1a1aa",
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                      <EyeOff style={{ width: 28, height: 28, color: "#EF4444" }} />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                        Todos os produtos foram ocultados
                      </span>
                      <span style={{ fontSize: 12, color: "#71717a" }}>
                        Nenhum produto está sendo considerado no cálculo macro no momento.
                      </span>
                      <button
                        onClick={showAllProducts}
                        style={{
                          marginTop: 6,
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "#8B5CF6",
                          border: "none",
                          color: "#fff",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Restaurar Todos os Produtos ({products.length})
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                productRowsCalculated.map((prod) => {
                  const sharePercent = grandVisibleTotal > 0 ? Math.round((prod.visibleTotal / grandVisibleTotal) * 100) : 0;
                  return (
                    <tr
                      key={prod.productId}
                      style={{
                        borderBottom: "1px solid rgba(255,255,255,0.05)",
                        transition: "background 0.15s ease",
                      }}
                    >
                      {/* Sticky Product Cell */}
                      <td
                        style={{
                          position: "sticky",
                          left: 0,
                          zIndex: 1,
                          background: "rgba(22,22,26,0.98)",
                          padding: isMobile ? "8px 6px" : "12px 14px",
                          borderRight: "1px solid rgba(255,255,255,0.06)",
                          minWidth: isMobile ? 120 : 220,
                          maxWidth: isMobile ? 140 : "none",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10 }}>
                          <ProductAvatar
                            productId={prod.productId}
                            productName={prod.productName}
                            productColor={prod.productColor}
                            productIcon={prod.productIcon}
                            size={isMobile ? 20 : 26}
                            borderRadius={isMobile ? 5 : 7}
                          />
                          <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                            <span style={{ fontWeight: 700, color: "#fff", fontSize: isMobile ? 11 : 13, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {prod.productName}
                            </span>
                            {!isMobile && (
                              <span style={{ fontSize: 10, color: "#71717a" }}>
                                {prod.activeClientsCount} {prod.activeClientsCount === 1 ? "cliente ativo" : "clientes ativos"}
                              </span>
                            )}
                          </div>
                          {!isMobile && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleProductVisibility(prod.productId);
                              }}
                              title={`Ocultar ${prod.productName} e recalcular totais`}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#71717a",
                                padding: "4px 6px",
                                cursor: "pointer",
                                borderRadius: 4,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                transition: "all 0.15s ease",
                                marginLeft: "auto",
                              }}
                              onMouseEnter={(e) => {
                                e.currentTarget.style.color = "#EF4444";
                                e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                              }}
                              onMouseLeave={(e) => {
                                e.currentTarget.style.color = "#71717a";
                                e.currentTarget.style.background = "transparent";
                              }}
                            >
                              <EyeOff style={{ width: 14, height: 14 }} />
                            </button>
                          )}
                        </div>
                      </td>

                    {/* Month Amounts */}
                    {visibleMonths.map((m) => {
                      const mData = prod.months[m.key];
                      const val = getCellValue(mData);
                      const isCurrent = m.isCurrent;
                      const hasPaid = (mData?.paid || 0) > 0;
                      const hasPending = (mData?.pending || 0) > 0;

                      return (
                        <td
                          key={m.key}
                          onClick={() => setSelectedCell({ product: prod, month: m })}
                          title={`Clique para ver detalhes de ${prod.productName} em ${m.label}`}
                          style={{
                            padding: isMobile ? "8px 5px" : "10px 14px",
                            textAlign: "right",
                            background: isCurrent ? "rgba(139,92,246,0.05)" : "transparent",
                            borderRight: "1px solid rgba(255,255,255,0.04)",
                            cursor: "pointer",
                            transition: "background 0.2s ease",
                          }}
                        >
                          <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end" }}>
                            <span
                              style={{
                                fontWeight: val > 0 ? 700 : 400,
                                color: val > 0 ? (metricMode === "paid" ? "#10B981" : metricMode === "pending" ? "#F59E0B" : "#fafafa") : "#52525b",
                                fontSize: isMobile ? 11 : 12,
                              }}
                            >
                              {val > 0 ? formatBRL(val) : "—"}
                            </span>

                            {/* Micro-pills for breakdown indicator */}
                            {metricMode === "total" && val > 0 && (
                              <div style={{ display: "flex", gap: 3, marginTop: 2 }}>
                                {hasPaid && (
                                  <span
                                    title={`Realizado: ${formatBRL(mData?.paid)}`}
                                    style={{ width: 4, height: 4, borderRadius: "50%", background: "#10B981" }}
                                  />
                                )}
                                {hasPending && (
                                  <span
                                    title={`A Receber: ${formatBRL(mData?.pending)}`}
                                    style={{ width: 4, height: 4, borderRadius: "50%", background: "#F59E0B" }}
                                  />
                                )}
                              </div>
                            )}
                          </div>
                        </td>
                      );
                    })}

                    {/* Total Period for Row */}
                    <td
                      style={{
                        padding: isMobile ? "8px 8px" : "12px 16px",
                        textAlign: "right",
                        background: "rgba(255,255,255,0.02)",
                        fontWeight: 800,
                        color: prod.visibleTotal > 0 ? "#10B981" : "#52525b",
                        fontSize: isMobile ? 11 : 13,
                      }}
                    >
                      {formatBRL(prod.visibleTotal)}
                    </td>

                    {/* Average Monthly */}
                    <td
                      style={{
                        padding: isMobile ? "8px 6px" : "12px 14px",
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#a1a1aa",
                        fontSize: isMobile ? 10 : 12,
                      }}
                    >
                      {formatBRL(prod.averageMonthly)}
                    </td>

                    {/* Share Percentage */}
                    <td
                      style={{
                        padding: isMobile ? "8px 6px" : "12px 14px",
                        textAlign: "right",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: isMobile ? 4 : 6 }}>
                        {!isMobile && (
                          <div
                            style={{
                              width: 32,
                              height: 4,
                              background: "rgba(255,255,255,0.08)",
                              borderRadius: 2,
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.min(sharePercent, 100)}%`,
                                height: "100%",
                                background: prod.productColor,
                              }}
                            />
                          </div>
                        )}
                        <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: 700, color: prod.visibleTotal > 0 ? "#fff" : "#52525b" }}>
                          {sharePercent}%
                        </span>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>

            {/* Total Row (TOTAL GERAL TELTECH) */}
            <tfoot>
              <tr
                style={{
                  background: "rgba(139,92,246,0.08)",
                  borderTop: "2px solid rgba(139,92,246,0.3)",
                }}
              >
                <td
                  style={{
                    position: "sticky",
                    left: 0,
                    zIndex: 1,
                    background: "rgba(26,22,34,0.98)",
                    padding: isMobile ? "10px 8px" : "14px",
                    fontWeight: 800,
                    color: "#fafafa",
                    borderRight: "1px solid rgba(255,255,255,0.06)",
                    fontSize: isMobile ? 10 : 12,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Coins style={{ width: 14, height: 14, color: "#A78BFA" }} />
                    {isMobile ? "TOTAL" : "TOTAL GERAL TELTECH"}
                  </div>
                </td>

                {visibleMonths.map((m) => {
                  const mTotal = monthTotalsCalculated[m.key] || 0;
                  const isCurrent = m.isCurrent;
                  return (
                    <td
                      key={m.key}
                      style={{
                        padding: isMobile ? "10px 5px" : "14px",
                        textAlign: "right",
                        fontWeight: 800,
                        color: mTotal > 0 ? (isCurrent ? "#C4B5FD" : "#fafafa") : "#52525b",
                        background: isCurrent ? "rgba(139,92,246,0.12)" : "transparent",
                        borderRight: "1px solid rgba(255,255,255,0.04)",
                        fontSize: isMobile ? 11 : 12,
                      }}
                    >
                      {formatBRL(mTotal)}
                    </td>
                  );
                })}

                {/* Grand Total */}
                <td
                  style={{
                    padding: isMobile ? "10px 8px" : "14px 16px",
                    textAlign: "right",
                    fontWeight: 900,
                    color: "#10B981",
                    fontSize: isMobile ? 12 : 14,
                    background: "rgba(16,185,129,0.1)",
                  }}
                >
                  {formatBRL(grandVisibleTotal)}
                </td>

                {/* Grand Average */}
                <td
                  style={{
                    padding: isMobile ? "10px 6px" : "14px",
                    textAlign: "right",
                    fontWeight: 700,
                    color: "#a1a1aa",
                    fontSize: isMobile ? 10 : 12,
                  }}
                >
                  {formatBRL(visibleMonths.length > 0 ? Math.round(grandVisibleTotal / visibleMonths.length) : 0)}
                </td>

                {/* 100% */}
                <td
                  style={{
                    padding: isMobile ? "10px 6px" : "14px",
                    textAlign: "right",
                    fontWeight: 800,
                    color: "#fafafa",
                    fontSize: isMobile ? 10 : 12,
                  }}
                >
                  100%
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* ─── Mode 2: Cards por Produto ────────────────────────────────────── */}
      {viewMode === "cards" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(280px, 1fr))",
            gap: 16,
            marginBottom: 16,
          }}
        >
          {productRowsCalculated.length === 0 ? (
            <div
              style={{
                gridColumn: "1 / -1",
                padding: "40px 20px",
                background: "rgba(22,22,26,0.6)",
                border: "1px dashed rgba(255,255,255,0.12)",
                borderRadius: 12,
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 10,
              }}
            >
              <EyeOff style={{ width: 28, height: 28, color: "#EF4444" }} />
              <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                Todos os produtos foram ocultados
              </span>
              <span style={{ fontSize: 12, color: "#71717a" }}>
                Nenhum produto está sendo considerado no cálculo macro no momento.
              </span>
              <button
                onClick={showAllProducts}
                style={{
                  marginTop: 6,
                  padding: "6px 14px",
                  borderRadius: 6,
                  background: "#8B5CF6",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Restaurar Todos os Produtos ({products.length})
              </button>
            </div>
          ) : (
            productRowsCalculated.map((prod) => {
              const sharePercent = grandVisibleTotal > 0 ? Math.round((prod.visibleTotal / grandVisibleTotal) * 100) : 0;
              return (
                <div
                  key={prod.productId}
                  style={{
                    background: "rgba(22,22,26,0.8)",
                    border: `1px solid ${prod.productColor}35`,
                    borderRadius: 12,
                    padding: 18,
                    position: "relative",
                    overflow: "hidden",
                    display: "flex",
                    flexDirection: "column",
                    gap: 12,
                    boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
                  }}
                >
                  {/* Top Color Accent Line */}
                  <div
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: prod.productColor,
                    }}
                  />

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <ProductAvatar
                        productId={prod.productId}
                        productName={prod.productName}
                        productColor={prod.productColor}
                        productIcon={prod.productIcon}
                        size={32}
                        borderRadius={8}
                      />
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                        {prod.productName}
                      </h4>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 12,
                          background: "rgba(255,255,255,0.06)",
                          color: "#a1a1aa",
                        }}
                      >
                        {prod.activeClientsCount} {prod.activeClientsCount === 1 ? "cliente" : "clientes"}
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleProductVisibility(prod.productId);
                        }}
                        title={`Ocultar ${prod.productName} e recalcular totais`}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#71717a",
                          padding: "4px",
                          cursor: "pointer",
                          borderRadius: 4,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.15s ease",
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.color = "#EF4444";
                          e.currentTarget.style.background = "rgba(239,68,68,0.15)";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.color = "#71717a";
                          e.currentTarget.style.background = "transparent";
                        }}
                      >
                        <EyeOff style={{ width: 14, height: 14 }} />
                      </button>
                    </div>
                  </div>

                <div>
                  <span style={{ fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", fontWeight: 600 }}>
                    Faturamento no Período
                  </span>
                  <div style={{ fontSize: 22, fontWeight: 800, color: "#fafafa", marginTop: 2 }}>
                    {formatBRL(prod.visibleTotal)}
                  </div>
                </div>

                {/* Progress Share Bar */}
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, color: "#a1a1aa" }}>
                    <span>Participação Teltech</span>
                    <span style={{ fontWeight: 700, color: "#fff" }}>{sharePercent}%</span>
                  </div>
                  <div style={{ width: "100%", height: 6, background: "rgba(255,255,255,0.06)", borderRadius: 3, overflow: "hidden" }}>
                    <div
                      style={{
                        width: `${Math.min(sharePercent, 100)}%`,
                        height: "100%",
                        background: prod.productColor,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>

                {/* Sub Metrics: MRR x OneTime */}
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "1fr 1fr",
                    gap: 8,
                    background: "rgba(0,0,0,0.25)",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.04)",
                  }}
                >
                  <div>
                    <span style={{ fontSize: 10, color: "#A78BFA", fontWeight: 600, textTransform: "uppercase" }}>Recorrente (MRR)</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fafafa", marginTop: 1 }}>
                      {formatBRL(prod.visibleRecurring)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 10, color: "#60A5FA", fontWeight: 600, textTransform: "uppercase" }}>Pontual (Projetos)</span>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "#fafafa", marginTop: 1 }}>
                      {formatBRL(prod.visibleOneTime)}
                    </div>
                  </div>
                </div>

                {/* Average Monthly */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#71717a", paddingTop: 4 }}>
                  <span>Média no Período:</span>
                  <span style={{ fontWeight: 600, color: "#a1a1aa" }}>{formatBRL(prod.averageMonthly)}/mês</span>
                </div>
              </div>
            );
          })
          )}
        </div>
      )}

      {/* ─── Executive Analytics Highlights Strip ────────────────────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: 12,
          padding: "12px 16px",
          background: "rgba(139,92,246,0.06)",
          border: "1px solid rgba(139,92,246,0.18)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {topProduct && topProduct.visibleTotal > 0 ? (
            <ProductAvatar
              productId={topProduct.productId}
              productName={topProduct.productName}
              productColor={topProduct.productColor}
              productIcon={topProduct.productIcon}
              size={26}
              borderRadius={7}
            />
          ) : (
            <Crown style={{ width: 18, height: 18, color: "#F59E0B" }} />
          )}
          <div>
            <div style={{ fontSize: 10, color: "#a1a1aa", textTransform: "uppercase", fontWeight: 700 }}>Produto Carro-Chefe</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
              {topProduct && topProduct.visibleTotal > 0
                ? `${topProduct.productName} (${grandVisibleTotal > 0 ? Math.round((topProduct.visibleTotal / grandVisibleTotal) * 100) : 0}%)`
                : "Sem receitas no período"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <Repeat2 style={{ width: 18, height: 18, color: "#10B981" }} />
          <div>
            <div style={{ fontSize: 10, color: "#a1a1aa", textTransform: "uppercase", fontWeight: 700 }}>Mix de Receita Teltech</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
              {grandVisibleTotal > 0
                ? `${Math.round((totalRecurringVisible / grandVisibleTotal) * 100)}% Recorrente | ${Math.round((totalOneTimeVisible / grandVisibleTotal) * 100)}% Pontual`
                : "Aguardando faturamentos"}
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <TrendingUp style={{ width: 18, height: 18, color: "#8B5CF6" }} />
          <div>
            <div style={{ fontSize: 10, color: "#a1a1aa", textTransform: "uppercase", fontWeight: 700 }}>Mês com Maior Volume</div>
            <div style={{ fontSize: 13, fontWeight: 800, color: "#fff" }}>
              {peakMonth && peakMonthTotal > 0 ? `${peakMonth.label} — ${formatBRL(peakMonthTotal)}` : "Sem faturamento"}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Cell Details Drawer / Modal ─────────────────────────────────── */}
      {selectedCell && (
        <div
          onClick={() => setSelectedCell(null)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.75)",
            backdropFilter: "blur(6px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(135deg, rgba(30,30,36,0.98), rgba(20,20,24,0.98))",
              border: "1px solid rgba(139,92,246,0.35)",
              borderRadius: 14,
              padding: 24,
              width: "100%",
              maxWidth: 420,
              boxShadow: "0 20px 60px rgba(0,0,0,0.7)",
              display: "flex",
              flexDirection: "column",
              gap: 16,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <ProductAvatar
                  productId={selectedCell.product.productId}
                  productName={selectedCell.product.productName}
                  productColor={selectedCell.product.productColor}
                  productIcon={selectedCell.product.productIcon}
                  size={36}
                  borderRadius={9}
                />
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                    {selectedCell.product.productName}
                  </h3>
                  <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                    Competência: <strong style={{ color: "#fafafa" }}>{selectedCell.month.label}</strong>
                  </span>
                </div>
              </div>
              <button
                onClick={() => setSelectedCell(null)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  borderRadius: 6,
                  color: "#a1a1aa",
                  padding: 6,
                  cursor: "pointer",
                }}
              >
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Breakdown Cards */}
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {(() => {
                const cellData = selectedCell.product.months[selectedCell.month.key];
                const total = cellData?.total || 0;
                const paid = cellData?.paid || 0;
                const pending = cellData?.pending || 0;
                const recurring = cellData?.recurring || 0;
                const oneTime = cellData?.oneTime || 0;
                const txCount = cellData?.txCount || 0;

                return (
                  <>
                    <div
                      style={{
                        padding: "12px 14px",
                        background: "rgba(139,92,246,0.1)",
                        borderRadius: 10,
                        border: "1px solid rgba(139,92,246,0.25)",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}>Total Faturado no Mês</span>
                      <span style={{ fontSize: 18, fontWeight: 900, color: "#10B981" }}>{formatBRL(total)}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "rgba(16,185,129,0.08)",
                          borderRadius: 8,
                          border: "1px solid rgba(16,185,129,0.2)",
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#10B981", textTransform: "uppercase" }}>Realizado (Pago)</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 2 }}>{formatBRL(paid)}</div>
                      </div>

                      <div
                        style={{
                          padding: "10px 12px",
                          background: "rgba(245,158,11,0.08)",
                          borderRadius: 8,
                          border: "1px solid rgba(245,158,11,0.2)",
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase" }}>A Receber (Aberto)</span>
                        <div style={{ fontSize: 14, fontWeight: 800, color: "#fff", marginTop: 2 }}>{formatBRL(pending)}</div>
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div
                        style={{
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase" }}>Recorrente (MRR)</span>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#C4B5FD", marginTop: 2 }}>{formatBRL(recurring)}</div>
                      </div>

                      <div
                        style={{
                          padding: "10px 12px",
                          background: "rgba(255,255,255,0.04)",
                          borderRadius: 8,
                          border: "1px solid rgba(255,255,255,0.08)",
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase" }}>Pontual (Projetos)</span>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#60A5FA", marginTop: 2 }}>{formatBRL(oneTime)}</div>
                      </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#71717a", padding: "4px 2px" }}>
                      <span>Transações vinculadas:</span>
                      <strong style={{ color: "#a1a1aa" }}>{txCount} lançamentos</strong>
                    </div>
                  </>
                );
              })()}
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
              <button
                onClick={() => {
                  setSelectedCell(null);
                  if (onGoToTransactions) onGoToTransactions();
                }}
                style={{
                  flex: 1,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#8B5CF6",
                  border: "none",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Abrir Extrato de Transações
              </button>
              <button
                onClick={() => setSelectedCell(null)}
                style={{
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "rgba(255,255,255,0.08)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#e4e4e7",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
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
  onAction,
  actionLabel,
}: {
  title: string;
  value: string;
  subtitle?: string;
  badge?: { label: string; color: string; bg: string };
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  color?: string;
  alert?: boolean;
  onAction?: () => void;
  actionLabel?: string;
}) {
  const isMobile = useIsMobile();
  return (
    <div
      style={{
        flex: 1,
        minWidth: isMobile ? 0 : 240,
        background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
        border: `1px solid ${alert ? "rgba(239,68,68,0.5)" : "rgba(255,255,255,0.08)"}`,
        borderRadius: 14,
        padding: isMobile ? "14px 16px" : "20px 22px",
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
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: isMobile ? 8 : 12 }}>
        <span style={{ fontSize: isMobile ? 11 : 12, fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.04em" }}>
          {title}
        </span>
        <div
          style={{
            padding: isMobile ? 5 : 7,
            borderRadius: 8,
            background: `${color}18`,
            border: `1px solid ${color}30`,
            color,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Icon style={{ width: isMobile ? 16 : 18, height: isMobile ? 16 : 18 }} />
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginBottom: 4, flexWrap: "wrap" }}>
        <span style={{ fontSize: isMobile ? 22 : 26, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.02em" }}>
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
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginTop: 4, flexWrap: "wrap" }}>
          <span style={{ fontSize: 12, color: alert ? "#EF4444" : "#71717a", fontWeight: 500 }}>
            {subtitle}
          </span>
          {onAction && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onAction();
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 6,
                padding: "2px 8px",
                color: "#d4d4d8",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.color = "#fff";
                e.currentTarget.style.background = "rgba(255,255,255,0.14)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.color = "#d4d4d8";
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
              }}
            >
              <SlidersHorizontal style={{ width: 11, height: 11 }} />
              {actionLabel || "Ajustar"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MAIN FINANCE MODULE PAGE
// ─────────────────────────────────────────────────────────────────────────────

export function FinanceiroPage() {
  const isMobile = useIsMobile();

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
  const [sales, setSales] = useState<SaleView[]>([]);

  // Modals
  const [showSalesWizard, setShowSalesWizard] = useState(false);
  const [salesWizardClientId, setSalesWizardClientId] = useState<string | null>(null);
  const [showModulesModal, setShowModulesModal] = useState(false);
  const [managingSaleId, setManagingSaleId] = useState<string | null>(null);
  const [showTxModal, setShowTxModal] = useState(false);
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [txInitialClientId, setTxInitialClientId] = useState<string | null>(null);
  const [txInitialType, setTxInitialType] = useState<TxType | null>(null);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [editingAccount, setEditingAccount] = useState<BankAccount | null>(null);
  const [showBudgetModal, setShowBudgetModal] = useState(false);
  const [showClientModal, setShowClientModal] = useState(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [initialClientProjectId, setInitialClientProjectId] = useState<string>("");
  const [sendingBillingId, setSendingBillingId] = useState<string | null>(null);
  const [rejectingTxId, setRejectingTxId] = useState<string | null>(null);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showReserveModal, setShowReserveModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [filterQuery, setFilterQuery] = useState("");
  const [quickFilter, setQuickFilter] = useState<"all" | "inflow" | "outflow" | "pending" | "paid" | "overdue" | "approval">("all");

  // Verifica se veio da barra lateral com ?newClient=true&projectId=...
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      if (params.get("newClient") === "true") {
        const pId = params.get("projectId") || "";
        setInitialClientProjectId(pId);
        setEditingClient(null);
        setShowClientModal(true);
        setActiveTab("clients");
        window.history.replaceState({}, "", window.location.pathname);
      }
    }
  }, []);

  // ─── Fetch All Data ──────────────────────────────────────────────────────────

  const loadAllData = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoading(true);
      const m = selectedMonth;
      const y = selectedYear;

      const results = await Promise.allSettled([
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
        API.get(`/finance/sales`),
      ]);

      const [dashRes, txRes, catRes, accRes, clRes, dreRes, profRes, partRes, budRes, appRes, projRes, salesRes] =
        results.map(r => (r.status === "fulfilled" ? (r as PromiseFulfilledResult<any>).value : null));

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
      if (salesRes?.sales) setSales(salesRes.sales);
    } catch (err) {
      console.error("Erro ao carregar dados financeiros:", err);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    loadAllData();
  }, [loadAllData]);

  useEffect(() => {
    const refresh = () => void loadAllData(true);
    window.addEventListener("teltech:finance-synced", refresh);
    return () => window.removeEventListener("teltech:finance-synced", refresh);
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

  const handleExportCSV = async () => {
    try {
      const token = localStorage.getItem("teltech_token") || localStorage.getItem("token") || "";
      const baseUrl = API.baseUrl || (import.meta.env.DEV ? "http://localhost:5000" : "");
      const res = await fetch(`${baseUrl}/api/finance/export?month=${selectedMonth}&year=${selectedYear}`, {
        headers: {
          Authorization: `Bearer ${token}`
        }
      });
      if (!res.ok) throw new Error("Erro ao exportar dados.");
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `teltech-financeiro-${selectedYear}-${String(selectedMonth).padStart(2, "0")}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      toast.success("Exportação concluída com sucesso.");
    } catch (e) {
      console.error(e);
      toast.error("Erro ao exportar relatório CSV.");
    }
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
    if (!(await confirmDialog({ title: "Remover lançamento", message: "Tem certeza que deseja remover este lançamento financeiro?", confirmLabel: "Remover", danger: true }))) return;
    try {
      await API.delete(`/finance/transactions/${id}`);
      toast.success("Lançamento removido.");
      await loadAllData();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao excluir transação.");
    }
  };

  const handleDeleteClient = async (client: Client) => {
    const isAlreadyInactive = client.status === "inactive";
    const confirmMsg = isAlreadyInactive
      ? `Deseja realmente excluir definitivamente o cadastro do cliente "${client.name}"?\n\n(Se não houver faturas vinculadas, ele será totalmente removido do sistema).`
      : `Deseja encerrar o contrato e desativar o cliente "${client.name}"?\n\n- Cobranças automáticas pelo WhatsApp serão suspensas imediatamente.\n- Se houver faturas e histórico contábil, eles serão mantidos em segurança.\n- Se for um cadastro sem faturas, ele será excluído.`;

    if (!(await confirmDialog({ title: isAlreadyInactive ? "Excluir cliente" : "Encerrar contrato", message: confirmMsg, confirmLabel: isAlreadyInactive ? "Excluir" : "Encerrar contrato", danger: true }))) return;

    try {
      const res = await API.delete(`/finance/clients/${client.id}`);
      toast.success(res?.message || "Operação realizada com sucesso.");
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao processar cliente.");
    }
  };

  const handleReactivateClient = async (client: Client) => {
    try {
      const res = await API.post(`/finance/clients/${client.id}/reactivate`, {});
      toast.success(res?.message || "Cliente e contrato reativados com sucesso.");
      await loadAllData();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao reativar cliente.");
    }
  };

  const handleSendWhatsAppPix = async (_client: Client, tx?: Transaction) => {
    const selectedTx = transactions.find(item => item.id === tx?.id);
    const selectedClient = clients.find(item => item.id === selectedTx?.clientId);
    if (!selectedTx || selectedTx.type !== "inflow" || selectedTx.status !== "pending") {
      toast.error("Selecione uma parcela em aberto para enviar a cobrança.");
      return;
    }
    if (!selectedClient?.whatsappOptIn) {
      toast.error("Registre a autorização do cliente antes de enviar cobranças pelo WhatsApp.");
      return;
    }
    if (!selectedClient.phone?.replace(/\D/g, "")) {
      toast.error("Este cliente não possui WhatsApp cadastrado.");
      return;
    }
    if (selectedClient.status === "inactive") {
      toast.error("Este cliente está inativo. Revise a ficha antes de cobrar.");
      return;
    }
    if (selectedTx.pauseBilling) {
      if (!(await confirmDialog({ title: "Cobrança pausada", message: "Esta parcela está marcada como 'Cobrança Pausada'. Deseja realmente enviar a cobrança via WhatsApp?", confirmLabel: "Enviar mesmo assim" }))) {
        return;
      }
    }
    if (sendingBillingId) return;
    setSendingBillingId(selectedTx.id);
    try {
      await API.post("/whatsapp/messages/manual-billing", { transactionId: selectedTx.id });
      toast.success("Cobrança registrada para envio pelo WhatsApp da empresa.");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível enviar a cobrança.");
    } finally {
      setSendingBillingId(null);
    }
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
      {isMobile ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "8px 12px",
            borderBottom: "1px solid rgba(255,255,255,0.08)",
            background: "linear-gradient(180deg, #18181c 0%, #131316 100%)",
            gap: 8,
            flexShrink: 0,
          }}
        >
          {/* Month Stepper - Compact */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "2px 4px",
            }}
          >
            <button
              onClick={handlePrevMonth}
              style={{
                background: "transparent",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                padding: "4px 5px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
              title="Mês anterior"
            >
              <ChevronLeft style={{ width: 15, height: 15 }} />
            </button>
            <span
              style={{
                fontSize: 12,
                fontWeight: 700,
                color: "#fff",
                padding: "0 6px",
                minWidth: 88,
                textAlign: "center",
              }}
            >
              {monthNames[selectedMonth - 1]?.slice(0, 3)} / {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              style={{
                background: "transparent",
                border: "none",
                color: "#ccc",
                cursor: "pointer",
                padding: "4px 5px",
                borderRadius: 4,
                display: "flex",
                alignItems: "center",
              }}
              title="Próximo mês"
            >
              <ChevronRight style={{ width: 15, height: 15 }} />
            </button>
          </div>

          {/* Quick Actions Aligned on the Same Line */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <button
              onClick={handleExportCSV}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 9px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e4e4e7",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer",
                height: 32,
              }}
              title="Exportar CSV"
            >
              <Download style={{ width: 13, height: 13 }} />
              <span>CSV</span>
            </button>

            <button
              onClick={() => {
                setEditingTx(null);
                setTxInitialClientId(null);
                setTxInitialType(null);
                setShowTxModal(true);
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: "6px 11px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #8B5CF6 0%, #7C3AED 100%)",
                border: "none",
                color: "#fff",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(139,92,246,0.35)",
                height: 32,
                whiteSpace: "nowrap",
              }}
            >
              <Plus style={{ width: 14, height: 14 }} />
              <span>Lançamento</span>
            </button>
          </div>
        </div>
      ) : (
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
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
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
                flexShrink: 0,
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
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <button
                onClick={handleExportCSV}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
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
                  setTxInitialClientId(null);
                  setTxInitialType(null);
                  setShowTxModal(true);
                }}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
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
        </div>
      )}

      {/* ─── 8 Routine Navigation Tabs ───────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: "#141417",
          padding: isMobile ? "0 8px" : "0 16px",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          flexShrink: 0,
          gap: isMobile ? 2 : 0,
        }}
      >
        {[
          { key: "dashboard",    label: "Cockpit Executivo",     shortLabel: "Cockpit",   icon: BarChart3 },
          { key: "transactions", label: "Livro Caixa",           shortLabel: "Extrato",   icon: FileText, badge: transactions.length },
          { key: "clients",      label: "Clientes & Cobranças",  shortLabel: "Clientes",  icon: Users },
          { key: "accounts",     label: "Contas & Conciliação",  shortLabel: "Contas",    icon: Building2 },
          { key: "team",         label: "Equipe & Metas",        shortLabel: "Equipe",    icon: Trophy },
          { key: "dre",          label: "DRE & Rentabilidade",   shortLabel: "DRE",       icon: Scale },
          { key: "budgets",      label: "Orçamentos & Metas",    shortLabel: "Metas",     icon: Target },
          { key: "approvals",    label: "Governança & Alçadas",  shortLabel: "Alçadas",   icon: ShieldCheck, badge: pendingApprovals.length, alert: pendingApprovals.length > 0 },
          { key: "partners",     label: "Sócios & Reembolsos",   shortLabel: "Sócios",    icon: CreditCard },
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
                gap: isMobile ? 5 : 8,
                padding: isMobile ? "9px 11px" : "13px 16px",
                border: "none",
                background: "transparent",
                color: isActive ? "#fafafa" : "#71717a",
                fontSize: isMobile ? 12 : 13,
                fontWeight: isActive ? 700 : 500,
                borderBottom: isActive ? "2px solid #8B5CF6" : "2px solid transparent",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s ease",
              }}
            >
              <Icon style={{ width: isMobile ? 14 : 16, height: isMobile ? 14 : 16, color: isActive ? "#8B5CF6" : "#71717a" }} />
              <span>{isMobile ? tab.shortLabel : tab.label}</span>
              {tab.badge !== undefined && tab.badge > 0 && (
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    padding: "1px 5px",
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
                clients={clients}
                onGoToTab={(t) => setActiveTab(t)}
                onNewTx={() => setShowTxModal(true)}
                onApprove={handleApprove}
                onReject={(id) => setRejectingTxId(id)}
                onSendWhatsApp={handleSendWhatsAppPix}
                onMarkPaid={handleMarkPaid}
                onResetAll={loadAllData}
                onOpenReserveSettings={() => setShowReserveModal(true)}
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
                  setTxInitialClientId(null);
                  setTxInitialType(null);
                  setShowTxModal(true);
                }}
                onEditTx={(tx) => {
                  setEditingTx(tx);
                  setTxInitialClientId(null);
                  setTxInitialType(null);
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
                sales={sales}
                onNewSale={(clientId) => { setSalesWizardClientId(clientId ?? null); setShowSalesWizard(true); }}
                onManageSale={(sale) => setManagingSaleId(sale.id)}
                onOpenModules={() => setShowModulesModal(true)}
                onNewClient={() => { setEditingClient(null); setShowClientModal(true); }}
                onEditClient={(client) => { setEditingClient(client); setShowClientModal(true); }}
                onSendWhatsApp={handleSendWhatsAppPix}
                onDeleteClient={handleDeleteClient}
                onReactivateClient={handleReactivateClient}
                sendingBillingId={sendingBillingId}
                onResetAll={loadAllData}
                onNewTxForClient={(clientId) => {
                  setEditingTx(null);
                  setTxInitialClientId(clientId);
                  setTxInitialType("inflow");
                  setShowTxModal(true);
                }}
              />
            )}

            {activeTab === "accounts" && (
              <AccountsView
                accounts={accounts}
                transactions={transactions}
                onNewAccount={() => {
                  setEditingAccount(null);
                  setShowAccountModal(true);
                }}
                onManageAccount={(acc) => {
                  setEditingAccount(acc);
                  setShowAccountModal(true);
                }}
                onNewTx={() => setShowTxModal(true)}
              />
            )}

            {activeTab === "team" && (
              <TeamModule
                onGoToTransactions={() => setActiveTab("transactions")}
                currentCash={dashboard?.totalCash}
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
                onResetAll={loadAllData}
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
          initialClientId={txInitialClientId ?? undefined}
          initialType={txInitialType ?? undefined}
          categories={categories}
          accounts={accounts}
          clients={clients}
          projects={projects}
          partners={partners}
          onClose={() => {
            setShowTxModal(false);
            setEditingTx(null);
            setTxInitialClientId(null);
            setTxInitialType(null);
          }}
          onSaved={() => {
            setShowTxModal(false);
            setEditingTx(null);
            setTxInitialClientId(null);
            setTxInitialType(null);
            loadAllData();
          }}
        />
      )}

      {showAccountModal && (
        <AccountModal
          account={editingAccount}
          onClose={() => {
            setShowAccountModal(false);
            setEditingAccount(null);
          }}
          onSaved={() => {
            setShowAccountModal(false);
            setEditingAccount(null);
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
          client={editingClient}
          initialProjectId={initialClientProjectId}
          onClose={() => { setShowClientModal(false); setEditingClient(null); setInitialClientProjectId(""); }}
          onSaved={() => {
            setShowClientModal(false);
            setEditingClient(null);
            setInitialClientProjectId("");
            loadAllData();
          }}
          onDelete={handleDeleteClient}
          onReactivate={handleReactivateClient}
        />
      )}

      {showSalesWizard && (
        <SalesWizardModal
          clients={clients}
          projects={projects}
          initialClientId={salesWizardClientId}
          onClose={() => { setShowSalesWizard(false); setSalesWizardClientId(null); }}
          onSaved={() => {
            setShowSalesWizard(false);
            setSalesWizardClientId(null);
            loadAllData();
          }}
        />
      )}

      {showModulesModal && (
        <ModulesCatalogModal
          onClose={() => setShowModulesModal(false)}
          onChanged={() => { /* catálogo é lido sob demanda pelos modais */ }}
        />
      )}

      {managingSaleId && sales.find((s) => s.id === managingSaleId) && (
        <SaleManageModal
          sale={sales.find((s) => s.id === managingSaleId)!}
          onClose={() => setManagingSaleId(null)}
          onChanged={() => loadAllData()}
        />
      )}

      {showReserveModal && dashboard && (
        <ReserveSettingsModal
          currentTarget={dashboard.emergencyReserveTarget}
          onClose={() => setShowReserveModal(false)}
          onSaved={(newTargetCents) => {
            setShowReserveModal(false);
            setDashboard((prev) =>
              prev
                ? {
                    ...prev,
                    emergencyReserveTarget: newTargetCents,
                    isBelowReserve: prev.totalCash < newTargetCents,
                  }
                : prev
            );
            loadAllData();
          }}
        />
      )}

      {rejectingTxId && (
        <Drawer
          title="Reprovação de Despesa (Alçada)"
          icon={<AlertTriangle size={18} style={{ color: "#EF4444" }} />}
          width={480}
          onClose={() => {
            setRejectingTxId(null);
            setRejectionReason("");
          }}
          footer={
            <>
              <button
                type="button"
                onClick={() => {
                  setRejectingTxId(null);
                  setRejectionReason("");
                }}
                style={drawerBtn.ghost}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={!rejectionReason.trim()}
                style={{ ...drawerBtn.primary(!rejectionReason.trim()), background: "#EF4444" }}
              >
                Confirmar Reprovação
              </button>
            </>
          }
        >
          <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", lineHeight: 1.5 }}>
            Informe a justificativa corporativa para a reprovação desta solicitação. A razão será gravada na trilha de auditoria.
          </p>
          <textarea
            rows={5}
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
              resize: "vertical",
              outline: "none",
              boxSizing: "border-box",
              fontFamily: "inherit",
            }}
          />
        </Drawer>
      )}

      <FinanceUiRoot>{null}</FinanceUiRoot>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. COCKPIT VIEW (Redesigned Executive Cockpit)
// ─────────────────────────────────────────────────────────────────────────────

function CockpitView({
  dashboard,
  clients,
  onGoToTab,
  onNewTx,
  onApprove,
  onReject,
  onSendWhatsApp,
  onMarkPaid,
  onResetAll,
  onOpenReserveSettings,
}: {
  dashboard: DashboardData | null;
  clients: Client[];
  onGoToTab: (t: TabType) => void;
  onNewTx: () => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onSendWhatsApp: (client: Client, tx?: Transaction) => void;
  onMarkPaid: (tx: Transaction) => void;
  onResetAll?: () => void;
  onOpenReserveSettings?: () => void;
}) {
  const isMobile = useIsMobile();
  if (!dashboard) return null;

  const handleResetFinance = async () => {
    const ok = await confirmDialog({
      title: "Resetar Todo o Módulo Financeiro?",
      message: "Esta ação apagará permanentemente todas as transações, contratos, vendas comerciais, cobranças WhatsApp e clientes cadastrados para você começar o financeiro limpo do zero. Deseja continuar?",
      confirmLabel: "Sim, Resetar Tudo",
      danger: true,
    });
    if (!ok) return;

    try {
      await API.post("/finance/reset-all", { confirm: "RESET_FINANCE" });
      toast.success("Base financeira resetada com sucesso!");
      if (onResetAll) onResetAll();
    } catch (err: any) {
      toast.error(err?.response?.data?.error || err.message || "Erro ao resetar base");
    }
  };

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

  // Pending items count & lists
  const pendingApprovalsCount = dashboard.pendingApprovalsCount || 0;
  const overdueInflows = dashboard.overdueInflowsList || [];
  const todayDueInflows = dashboard.todayDueInflowsList || [];
  const upcomingInflows = dashboard.upcomingInflowsList || [];
  const overdueOutflows = dashboard.overdueOutflowsList || [];
  const todayDueOutflows = dashboard.todayDueOutflowsList || [];
  const upcomingOutflows = dashboard.upcomingOutflowsList || [];
  const totalUrgentIssues = pendingApprovalsCount + overdueInflows.length + overdueOutflows.length;

  // Collection Center interactive state
  const [collectionTab, setCollectionTab] = useState<"overdue" | "upcoming" | "payables" | "approvals">(
    overdueInflows.length > 0 ? "overdue" : upcomingInflows.length > 0 ? "upcoming" : "payables"
  );
  const [upcomingRange, setUpcomingRange] = useState<"all" | "today" | "7d" | "30d">("all");
  const [showFullCollectionModal, setShowFullCollectionModal] = useState(false);
  const [collectionSearch, setCollectionSearch] = useState("");
  const [modalFilterTab, setModalFilterTab] = useState<"all" | "overdue" | "today" | "7d" | "30d" | "payables">("all");
  const [markingPaidId, setMarkingPaidId] = useState<string | null>(null);

  // Time boundaries
  const now = new Date();
  const todayStartTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const todayEndTs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
  const next7DaysTs = todayStartTs + 7 * 24 * 60 * 60 * 1000;
  const next30DaysTs = todayStartTs + 30 * 24 * 60 * 60 * 1000;

  // Filtered upcoming inflows for widget
  const filteredUpcomingInflows = upcomingInflows.filter(item => {
    const dueTime = new Date(item.dueDate).getTime();
    if (upcomingRange === "today") return dueTime >= todayStartTs && dueTime <= todayEndTs;
    if (upcomingRange === "7d") return dueTime >= todayStartTs && dueTime <= next7DaysTs;
    if (upcomingRange === "30d") return dueTime >= todayStartTs && dueTime <= next30DaysTs;
    return true;
  });

  const todayInflowsCount = upcomingInflows.filter(item => {
    const dueTime = new Date(item.dueDate).getTime();
    return dueTime >= todayStartTs && dueTime <= todayEndTs;
  }).length;
  const next7DaysCount = upcomingInflows.filter(item => {
    const dueTime = new Date(item.dueDate).getTime();
    return dueTime >= todayStartTs && dueTime <= next7DaysTs;
  }).length;
  const next30DaysCount = upcomingInflows.filter(item => {
    const dueTime = new Date(item.dueDate).getTime();
    return dueTime >= todayStartTs && dueTime <= next30DaysTs;
  }).length;

  const totalOverdueSum = overdueInflows.reduce((s, i) => s + i.amount, 0);
  const totalUpcomingFilteredSum = filteredUpcomingInflows.reduce((s, i) => s + i.amount, 0);
  const totalUpcomingAllSum = upcomingInflows.reduce((s, i) => s + i.amount, 0);
  const todayInflowsSum = upcomingInflows.filter(i => {
    const d = new Date(i.dueDate).getTime();
    return d >= todayStartTs && d <= todayEndTs;
  }).reduce((s, i) => s + i.amount, 0);
  const next7DaysSum = upcomingInflows.filter(i => {
    const d = new Date(i.dueDate).getTime();
    return d >= todayStartTs && d <= next7DaysTs;
  }).reduce((s, i) => s + i.amount, 0);
  const totalPayablesSum = [...overdueOutflows, ...todayDueOutflows].reduce((s, i) => s + i.amount, 0);

  const handleQuickMarkPaid = async (item: { id: string; [key: string]: any }) => {
    setMarkingPaidId(item.id);
    try {
      await onMarkPaid({ id: item.id } as Transaction);
    } finally {
      setMarkingPaidId(null);
    }
  };

  const handleCobrarPix = (item: { id: string; clientId?: string; clientName?: string; clientPhone?: string | null; [key: string]: any }) => {
    const foundClient = clients.find(c => c.id === item.clientId);
    const clientToCharge: Client = foundClient || ({
      id: item.clientId || "",
      name: item.clientName || "Cliente",
      phone: item.clientPhone || "",
      whatsappOptIn: true,
      status: "active",
    } as Client);
    onSendWhatsApp(clientToCharge, { id: item.id } as Transaction);
  };

  const getDueBadge = (dueDateStr: string, isOverdueItem?: boolean, daysOverdue?: number) => {
    const due = new Date(dueDateStr);
    const dueMidnight = new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime();
    const diffDays = Math.round((dueMidnight - todayStartTs) / (1000 * 60 * 60 * 24));

    if (diffDays < 0 || isOverdueItem) {
      const days = daysOverdue ?? Math.max(1, Math.abs(diffDays));
      return {
        label: `Venceu há ${days}d (${formatShortDate(dueDateStr)})`,
        color: "#EF4444",
        bg: "rgba(239,68,68,0.15)",
        border: "rgba(239,68,68,0.35)",
        isAlert: true,
      };
    }
    if (diffDays === 0) {
      return {
        label: `Vence HOJE (${formatShortDate(dueDateStr)})`,
        color: "#F59E0B",
        bg: "rgba(245,158,11,0.2)",
        border: "rgba(245,158,11,0.45)",
        isAlert: true,
        isPulse: true,
      };
    }
    if (diffDays === 1) {
      return {
        label: `Vence amanhã (${formatShortDate(dueDateStr)})`,
        color: "#A78BFA",
        bg: "rgba(139,92,246,0.15)",
        border: "rgba(139,92,246,0.35)",
        isAlert: false,
      };
    }
    return {
      label: `Vencimento: ${formatShortDate(dueDateStr)} (em ${diffDays}d)`,
      color: "#a1a1aa",
      bg: "rgba(255,255,255,0.05)",
      border: "rgba(255,255,255,0.08)",
      isAlert: false,
    };
  };

  return (
    <div style={{ padding: isMobile ? "12px 14px" : "24px", display: "flex", flexDirection: "column", gap: isMobile ? 16 : 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* ─── Top Bar: Cockpit Title & Quick Admin Action ─────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.04em" }}>
            Visão Executiva & Diretoria Teltech
          </span>
        </div>
        <button
          onClick={handleResetFinance}
          title="Apagar todas as transações, clientes, contratos e histórico para recomeçar o financeiro do zero"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            padding: "6px 12px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: "1px solid rgba(239,68,68,0.3)",
            color: "#EF4444",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
          }}
        >
          <Trash2 style={{ width: 13, height: 13 }} /> Resetar Base do Zero
        </button>
      </div>

      {/* ─── Row 1: The 4 Noble KPIs ────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(260px, 1fr))", gap: 14 }}>
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
          onAction={onOpenReserveSettings}
          actionLabel="Ajustar"
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

      {/* ─── Receita Contratada (recorrente x pontual x futura) ─────────────── */}
      {((dashboard.mrr ?? 0) > 0 || (dashboard.oneTimeContracted ?? 0) > 0 || (dashboard.contractedReceivable ?? 0) > 0) && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
            gap: 14,
            background: "linear-gradient(135deg, rgba(139,92,246,0.08), rgba(26,26,30,0.95))",
            border: "1px solid rgba(139,92,246,0.22)",
            borderRadius: 14,
            padding: isMobile ? "14px" : "16px 22px",
          }}
        >
          {[
            { label: "MRR — Mensalidades do mês", value: dashboard.mrr ?? 0, hint: "Receita recorrente (SaaS + manutenção)", color: "#A78BFA" },
            { label: "Projetos / Entradas do mês", value: dashboard.oneTimeContracted ?? 0, hint: "Receita pontual prevista", color: "#60A5FA" },
            { label: "Já contratado p/ meses futuros", value: dashboard.contractedReceivable ?? 0, hint: "Parcelas e mensalidades já geradas", color: "#34D399" },
          ].map((k) => (
            <div key={k.label} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: 0.3 }}>{k.label}</span>
              <span style={{ fontSize: 22, fontWeight: 800, color: k.color }}>{formatBRL(k.value)}</span>
              <span style={{ fontSize: 11, color: "#71717a" }}>{k.hint}</span>
            </div>
          ))}
        </div>
      )}

      {/* ─── Relatório Macro: Faturamento por Produto & Mês ─────────────── */}
      <CockpitProductMacroReport
        report={dashboard.productMacroReport}
        selectedMonth={dashboard.selectedMonth}
        selectedYear={dashboard.selectedYear}
        onGoToClients={() => onGoToTab("clients")}
        onGoToTransactions={() => onGoToTab("transactions")}
      />

      {/* ─── Row 2: 2-Column Grid (Left: 2/3 Content, Right: 1/3 Pendencies) ─── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "2fr 1fr", gap: 20, alignItems: "start" }}>
        {/* LEFT COLUMN (2/3) */}
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {/* Cash Flow Evolution Chart */}
          <div
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: isMobile ? "16px 14px" : "22px 24px",
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
              padding: isMobile ? "16px 14px" : "22px 24px",
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
        <div style={{ display: "flex", flexDirection: "column", gap: 18, order: isMobile ? -1 : 0 }}>
          <div
            style={{
              background: "linear-gradient(135deg, rgba(30,30,36,0.98), rgba(22,22,26,0.98))",
              border: totalUrgentIssues > 0 ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: isMobile ? "16px 14px" : "20px",
              boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
              position: "relative",
            }}
          >
            {/* Header: Title + Expand Button + Urgent Badge */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <ShieldCheck style={{ width: 18, height: 18, color: totalUrgentIssues > 0 ? "#F59E0B" : "#10B981" }} />
                <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                  Central de Cobranças & Pendências
                </h3>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  onClick={() => setShowFullCollectionModal(true)}
                  title="Abrir painel completo de recebimentos e cobranças 360"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 4,
                    padding: "4px 8px",
                    borderRadius: 6,
                    background: "rgba(139,92,246,0.15)",
                    border: "1px solid rgba(139,92,246,0.35)",
                    color: "#C4B5FD",
                    fontSize: 11,
                    fontWeight: 700,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Maximize2 size={12} />
                  <span>Expandir 360°</span>
                </button>
                {totalUrgentIssues > 0 && (
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: 10,
                      background: "rgba(245,158,11,0.15)",
                      color: "#F59E0B",
                      border: "1px solid rgba(245,158,11,0.3)",
                    }}
                  >
                    {totalUrgentIssues} pendências
                  </span>
                )}
              </div>
            </div>

            {/* Segmented Switcher / Tabs Bar (Horizontal swipeable on mobile) */}
            <div
              style={{
                display: "flex",
                background: "rgba(0,0,0,0.3)",
                padding: 3,
                borderRadius: 9,
                marginBottom: 12,
                gap: 4,
                overflowX: "auto",
                WebkitOverflowScrolling: "touch",
                scrollbarWidth: "none",
              }}
            >
              {/* Tab 1: Em Atraso */}
              <button
                onClick={() => setCollectionTab("overdue")}
                style={{
                  flex: isMobile ? "0 0 auto" : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: 7,
                  border: "none",
                  fontSize: 11,
                  fontWeight: collectionTab === "overdue" ? 700 : 500,
                  background: collectionTab === "overdue" ? "rgba(239,68,68,0.25)" : "transparent",
                  color: collectionTab === "overdue" ? "#EF4444" : "#a1a1aa",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <AlertOctagon size={12} />
                <span>Em Atraso</span>
                {overdueInflows.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 8, background: "#EF4444", color: "#fff" }}>
                    {overdueInflows.length}
                  </span>
                )}
              </button>

              {/* Tab 2: Próximos Recebimentos */}
              <button
                onClick={() => setCollectionTab("upcoming")}
                style={{
                  flex: isMobile ? "0 0 auto" : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: 7,
                  border: "none",
                  fontSize: 11,
                  fontWeight: collectionTab === "upcoming" ? 700 : 500,
                  background: collectionTab === "upcoming" ? "rgba(16,185,129,0.2)" : "transparent",
                  color: collectionTab === "upcoming" ? "#10B981" : "#a1a1aa",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <CalendarDays size={12} />
                <span>A Receber</span>
                {upcomingInflows.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 8, background: "#10B981", color: "#fff" }}>
                    {upcomingInflows.length}
                  </span>
                )}
              </button>

              {/* Tab 3: Contas a Pagar */}
              <button
                onClick={() => setCollectionTab("payables")}
                style={{
                  flex: isMobile ? "0 0 auto" : 1,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 5,
                  padding: "6px 10px",
                  borderRadius: 7,
                  border: "none",
                  fontSize: 11,
                  fontWeight: collectionTab === "payables" ? 700 : 500,
                  background: collectionTab === "payables" ? "rgba(245,158,11,0.2)" : "transparent",
                  color: collectionTab === "payables" ? "#F59E0B" : "#a1a1aa",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                <CreditCard size={12} />
                <span>A Pagar</span>
                {overdueOutflows.length + todayDueOutflows.length > 0 && (
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 8, background: "#F59E0B", color: "#fff" }}>
                    {overdueOutflows.length + todayDueOutflows.length}
                  </span>
                )}
              </button>

              {/* Tab 4: Alçadas (if any) */}
              {pendingApprovalsCount > 0 && (
                <button
                  onClick={() => setCollectionTab("approvals")}
                  style={{
                    flex: isMobile ? "0 0 auto" : 1,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 5,
                    padding: "6px 10px",
                    borderRadius: 7,
                    border: "none",
                    fontSize: 11,
                    fontWeight: collectionTab === "approvals" ? 700 : 500,
                    background: collectionTab === "approvals" ? "rgba(139,92,246,0.25)" : "transparent",
                    color: collectionTab === "approvals" ? "#C4B5FD" : "#a1a1aa",
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Scale size={12} />
                  <span>Alçadas</span>
                  <span style={{ fontSize: 9, fontWeight: 800, padding: "1px 5px", borderRadius: 8, background: "#8B5CF6", color: "#fff" }}>
                    {pendingApprovalsCount}
                  </span>
                </button>
              )}
            </div>

            {/* ─── TAB 1: EM ATRASO (Faturas Vencidas) ────────────────────────── */}
            {collectionTab === "overdue" && (
              <div>
                {/* Summary Strip */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    background: "rgba(239,68,68,0.08)",
                    border: "1px solid rgba(239,68,68,0.2)",
                    borderRadius: 8,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#FCA5A5", fontWeight: 600 }}>Total Vencido em Atraso</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#EF4444" }}>{formatBRL(totalOverdueSum)}</span>
                </div>

                {overdueInflows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {overdueInflows.slice(0, 5).map((item) => {
                      const dueStatus = getDueBadge(item.dueDate, true, item.daysOverdue);
                      const isPaying = markingPaidId === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: "1px solid rgba(239,68,68,0.25)",
                            borderRadius: 10,
                            padding: isMobile ? "12px 10px" : "12px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {/* Header: Client & Amount */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  background: "rgba(239,68,68,0.18)",
                                  color: "#EF4444",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {item.clientName?.charAt(0)?.toUpperCase() || "C"}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.clientName}
                                </div>
                                <div style={{ fontSize: 11, color: "#a1a1aa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.description}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#EF4444", whiteSpace: "nowrap" }}>
                              {formatBRL(item.amount)}
                            </div>
                          </div>

                          {/* Status & Actions Row */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: isMobile ? "stretch" : "center",
                              flexDirection: isMobile ? "column" : "row",
                              gap: 8,
                              paddingTop: 4,
                              borderTop: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 5,
                                background: dueStatus.bg,
                                color: dueStatus.color,
                                border: `1px solid ${dueStatus.border}`,
                                alignSelf: isMobile ? "flex-start" : "center",
                              }}
                            >
                              {dueStatus.label}
                            </span>

                            {/* Buttons: Dar Baixa & Cobrar Pix */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, width: isMobile ? "100%" : "auto" }}>
                              {/* DAR BAIXA */}
                              <button
                                onClick={() => handleQuickMarkPaid(item)}
                                disabled={isPaying}
                                title="Liquidar esta fatura como paga"
                                style={{
                                  flex: isMobile ? 1 : "initial",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 5,
                                  padding: "6px 12px",
                                  minHeight: isMobile ? 38 : 30,
                                  borderRadius: 6,
                                  background: "rgba(16,185,129,0.2)",
                                  border: "1px solid rgba(16,185,129,0.45)",
                                  color: "#10B981",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: isPaying ? "wait" : "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isPaying ? (
                                  <RefreshCw className="animate-spin" style={{ width: 12, height: 12 }} />
                                ) : (
                                  <CheckCircle2 style={{ width: 12, height: 12 }} />
                                )}
                                <span>Dar Baixa</span>
                              </button>

                              {/* COBRAR PIX */}
                              {item.clientPhone ? (
                                <button
                                  onClick={() => handleCobrarPix(item)}
                                  title="Enviar cobrança via WhatsApp com chave Pix"
                                  style={{
                                    flex: isMobile ? 1 : "initial",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 5,
                                    padding: "6px 12px",
                                    minHeight: isMobile ? 38 : 30,
                                    borderRadius: 6,
                                    background: "#25D366",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <Send style={{ width: 11, height: 11 }} />
                                  <span>Cobrar Pix</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: 10, color: "#71717a", alignSelf: "center" }}>Sem WhatsApp</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "16px 12px", background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 8, fontSize: 12, color: "#34D399", display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={16} style={{ color: "#10B981", flexShrink: 0 }} />
                    <span>Excelente! Nenhum cliente com faturas em atraso no momento.</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 2: PRÓXIMOS RECEBIMENTOS ──────────────────────────────── */}
            {collectionTab === "upcoming" && (
              <div>
                {/* Sub-pills (Range selector) */}
                <div
                  style={{
                    display: "flex",
                    background: "rgba(255,255,255,0.04)",
                    borderRadius: 7,
                    padding: 2,
                    marginBottom: 10,
                    gap: 3,
                    overflowX: "auto",
                    WebkitOverflowScrolling: "touch",
                    scrollbarWidth: "none",
                  }}
                >
                  {[
                    { id: "all", label: `Todos (${upcomingInflows.length})` },
                    { id: "today", label: `Hoje (${todayInflowsCount})` },
                    { id: "7d", label: `7 Dias (${next7DaysCount})` },
                    { id: "30d", label: `30 Dias (${next30DaysCount})` },
                  ].map((sub) => (
                    <button
                      key={sub.id}
                      onClick={() => setUpcomingRange(sub.id as any)}
                      style={{
                        flex: isMobile ? "0 0 auto" : 1,
                        padding: "4px 8px",
                        borderRadius: 5,
                        border: "none",
                        fontSize: 10,
                        fontWeight: upcomingRange === sub.id ? 700 : 500,
                        background: upcomingRange === sub.id ? "#10B981" : "transparent",
                        color: upcomingRange === sub.id ? "#fff" : "#a1a1aa",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                    >
                      {sub.label}
                    </button>
                  ))}
                </div>

                {/* Summary Strip */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    background: "rgba(16,185,129,0.08)",
                    border: "1px solid rgba(16,185,129,0.2)",
                    borderRadius: 8,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#6EE7B7", fontWeight: 600 }}>Total Previsto no Filtro</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#10B981" }}>{formatBRL(totalUpcomingFilteredSum)}</span>
                </div>

                {filteredUpcomingInflows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {filteredUpcomingInflows.slice(0, 5).map((item) => {
                      const dueStatus = getDueBadge(item.dueDate, false);
                      const isPaying = markingPaidId === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{
                            background: "rgba(255,255,255,0.03)",
                            border: item.isToday ? "1px solid rgba(245,158,11,0.4)" : "1px solid rgba(255,255,255,0.08)",
                            borderRadius: 10,
                            padding: isMobile ? "12px 10px" : "12px 14px",
                            display: "flex",
                            flexDirection: "column",
                            gap: 8,
                            transition: "all 0.2s ease",
                          }}
                        >
                          {/* Header: Client & Amount */}
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                              <div
                                style={{
                                  width: 28,
                                  height: 28,
                                  borderRadius: 8,
                                  background: item.isToday ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.18)",
                                  color: item.isToday ? "#F59E0B" : "#10B981",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontSize: 12,
                                  fontWeight: 800,
                                  flexShrink: 0,
                                }}
                              >
                                {item.clientName?.charAt(0)?.toUpperCase() || "C"}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.clientName}
                                </div>
                                <div style={{ fontSize: 11, color: "#a1a1aa", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                                  {item.description}
                                </div>
                              </div>
                            </div>
                            <div style={{ fontSize: 13, fontWeight: 800, color: "#10B981", whiteSpace: "nowrap" }}>
                              {formatBRL(item.amount)}
                            </div>
                          </div>

                          {/* Status & Actions Row */}
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: isMobile ? "stretch" : "center",
                              flexDirection: isMobile ? "column" : "row",
                              gap: 8,
                              paddingTop: 4,
                              borderTop: "1px solid rgba(255,255,255,0.04)",
                            }}
                          >
                            <span
                              style={{
                                fontSize: 10,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 5,
                                background: dueStatus.bg,
                                color: dueStatus.color,
                                border: `1px solid ${dueStatus.border}`,
                                alignSelf: isMobile ? "flex-start" : "center",
                              }}
                            >
                              {dueStatus.label}
                            </span>

                            {/* Buttons: Dar Baixa & Cobrar Pix */}
                            <div style={{ display: "flex", alignItems: "center", gap: 6, width: isMobile ? "100%" : "auto" }}>
                              {/* DAR BAIXA */}
                              <button
                                onClick={() => handleQuickMarkPaid(item)}
                                disabled={isPaying}
                                title="Confirmar pagamento e liquidar esta fatura"
                                style={{
                                  flex: isMobile ? 1 : "initial",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  gap: 5,
                                  padding: "6px 12px",
                                  minHeight: isMobile ? 38 : 30,
                                  borderRadius: 6,
                                  background: "rgba(16,185,129,0.2)",
                                  border: "1px solid rgba(16,185,129,0.45)",
                                  color: "#10B981",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  cursor: isPaying ? "wait" : "pointer",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                {isPaying ? (
                                  <RefreshCw className="animate-spin" style={{ width: 12, height: 12 }} />
                                ) : (
                                  <CheckCircle2 style={{ width: 12, height: 12 }} />
                                )}
                                <span>Dar Baixa</span>
                              </button>

                              {/* COBRAR PIX */}
                              {item.clientPhone ? (
                                <button
                                  onClick={() => handleCobrarPix(item)}
                                  title="Enviar fatura Pix com antecedência pelo WhatsApp"
                                  style={{
                                    flex: isMobile ? 1 : "initial",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: 5,
                                    padding: "6px 12px",
                                    minHeight: isMobile ? 38 : 30,
                                    borderRadius: 6,
                                    background: "#25D366",
                                    border: "none",
                                    color: "#fff",
                                    fontSize: 11,
                                    fontWeight: 700,
                                    cursor: "pointer",
                                    transition: "all 0.15s ease",
                                  }}
                                >
                                  <Send style={{ width: 11, height: 11 }} />
                                  <span>Cobrar Pix</span>
                                </button>
                              ) : (
                                <span style={{ fontSize: 10, color: "#71717a", alignSelf: "center" }}>Sem WhatsApp</span>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12, color: "#a1a1aa", display: "flex", alignItems: "center", gap: 8 }}>
                    <Calendar size={16} style={{ color: "#10B981", flexShrink: 0 }} />
                    <span>Nenhum faturamento previsto para este período selecionado.</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 3: CONTAS A PAGAR ─────────────────────────────────────── */}
            {collectionTab === "payables" && (
              <div>
                {/* Summary Strip */}
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "8px 10px",
                    background: "rgba(245,158,11,0.08)",
                    border: "1px solid rgba(245,158,11,0.2)",
                    borderRadius: 8,
                    marginBottom: 10,
                  }}
                >
                  <span style={{ fontSize: 11, color: "#FDE68A", fontWeight: 600 }}>Total de Contas Críticas</span>
                  <span style={{ fontSize: 13, fontWeight: 800, color: "#F59E0B" }}>{formatBRL(totalPayablesSum)}</span>
                </div>

                {overdueOutflows.length > 0 || todayDueOutflows.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {[...overdueOutflows, ...todayDueOutflows].slice(0, 5).map((item) => {
                      const isPaying = markingPaidId === item.id;
                      return (
                        <div
                          key={item.id}
                          style={{
                            background: "rgba(245,158,11,0.08)",
                            border: "1px solid rgba(245,158,11,0.25)",
                            borderRadius: 10,
                            padding: isMobile ? "12px 10px" : "12px 14px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                            <span style={{ fontSize: 12, fontWeight: 700, color: "#fff" }}>{item.description}</span>
                            <span style={{ fontSize: 12, fontWeight: 800, color: "#EF4444" }}>{formatBRL(item.amount)}</span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#888" }}>
                            <span>Vencimento: {formatShortDate(item.dueDate)}</span>
                            <button
                              onClick={() => handleQuickMarkPaid(item)}
                              disabled={isPaying}
                              style={{
                                padding: "4px 10px",
                                minHeight: isMobile ? 36 : 28,
                                borderRadius: 5,
                                background: "rgba(16,185,129,0.2)",
                                border: "1px solid rgba(16,185,129,0.4)",
                                color: "#10B981",
                                fontSize: 11,
                                fontWeight: 700,
                                cursor: isPaying ? "wait" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              {isPaying ? <RefreshCw className="animate-spin" size={11} /> : <CheckCircle2 size={11} />}
                              <span>Dar Baixa</span>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12, color: "#a1a1aa", display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                    <span>Nenhuma conta atrasada ou vencendo hoje.</span>
                  </div>
                )}
              </div>
            )}

            {/* ─── TAB 4: ALÇADAS ────────────────────────────────────────────── */}
            {collectionTab === "approvals" && (
              <div>
                {dashboard.pendingApprovalsList && dashboard.pendingApprovalsList.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {dashboard.pendingApprovalsList.slice(0, 4).map((item) => (
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
                                padding: "4px 10px",
                                borderRadius: 5,
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
                                padding: "4px 10px",
                                borderRadius: 5,
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
                  <div style={{ padding: "16px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, fontSize: 12, color: "#a1a1aa", display: "flex", alignItems: "center", gap: 8 }}>
                    <CheckCircle2 size={16} style={{ color: "#10B981" }} />
                    <span>Nenhuma despesa aguardando aprovação no momento.</span>
                  </div>
                )}
              </div>
            )}

            {/* Bottom Button to Expand Modal */}
            <button
              onClick={() => {
                setModalFilterTab(collectionTab === "overdue" ? "overdue" : collectionTab === "upcoming" ? "all" : "payables");
                setShowFullCollectionModal(true);
              }}
              style={{
                width: "100%",
                marginTop: 12,
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
                color: "#C4B5FD",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                transition: "all 0.15s ease",
              }}
            >
              <span>Ver todos os registros na Central 360°</span>
              <ChevronRight size={13} />
            </button>
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

      {/* ─── MODAL: Central de Cobranças & Recebimentos 360° ───────────────── */}
      {showFullCollectionModal && (
        <div
          onClick={() => setShowFullCollectionModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.78)",
            backdropFilter: "blur(8px)",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: isMobile ? 8 : 20,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.98), rgba(18,18,22,0.98))",
              border: "1px solid rgba(139,92,246,0.3)",
              borderRadius: 16,
              width: "100%",
              maxWidth: 960,
              maxHeight: "92vh",
              display: "flex",
              flexDirection: "column",
              boxShadow: "0 24px 64px rgba(0,0,0,0.85)",
              overflow: "hidden",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: isMobile ? "14px 16px" : "18px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.02)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    padding: 8,
                    borderRadius: 10,
                    background: "rgba(139,92,246,0.15)",
                    border: "1px solid rgba(139,92,246,0.3)",
                    color: "#A78BFA",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <ShieldCheck size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: isMobile ? 15 : 17, fontWeight: 800, color: "#fff" }}>
                    Central de Cobranças & Recebimentos 360°
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 11, color: "#a1a1aa" }}>
                    Visão expandida de faturas, liquidação direta (baixa rápida) e cobrança WhatsApp
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFullCollectionModal(false)}
                style={{
                  background: "rgba(255,255,255,0.06)",
                  border: "none",
                  color: "#a1a1aa",
                  padding: "6px",
                  borderRadius: 8,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  transition: "all 0.15s ease",
                }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal KPI Header Bar (2x2 on mobile, 4 columns on desktop) */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: isMobile ? "1fr 1fr" : "repeat(4, 1fr)",
                gap: 10,
                padding: isMobile ? "12px 14px" : "16px 24px",
                background: "rgba(0,0,0,0.25)",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
              }}
            >
              {/* 1. Vencido em Atraso */}
              <div
                style={{
                  background: "rgba(239,68,68,0.08)",
                  border: "1px solid rgba(239,68,68,0.25)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 10, color: "#FCA5A5", fontWeight: 700, textTransform: "uppercase" }}>
                  Em Atraso ({overdueInflows.length})
                </div>
                <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: "#EF4444", marginTop: 2 }}>
                  {formatBRL(totalOverdueSum)}
                </div>
              </div>

              {/* 2. Vencendo Hoje */}
              <div
                style={{
                  background: "rgba(245,158,11,0.08)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 10, color: "#FDE68A", fontWeight: 700, textTransform: "uppercase" }}>
                  Vence Hoje ({todayInflowsCount})
                </div>
                <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: "#F59E0B", marginTop: 2 }}>
                  {formatBRL(todayInflowsSum)}
                </div>
              </div>

              {/* 3. Próximos 7 Dias */}
              <div
                style={{
                  background: "rgba(16,185,129,0.08)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 10, color: "#6EE7B7", fontWeight: 700, textTransform: "uppercase" }}>
                  Próximos 7 Dias ({next7DaysCount})
                </div>
                <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: "#10B981", marginTop: 2 }}>
                  {formatBRL(next7DaysSum)}
                </div>
              </div>

              {/* 4. Total a Receber */}
              <div
                style={{
                  background: "rgba(139,92,246,0.08)",
                  border: "1px solid rgba(139,92,246,0.25)",
                  borderRadius: 10,
                  padding: "10px 12px",
                }}
              >
                <div style={{ fontSize: 10, color: "#C4B5FD", fontWeight: 700, textTransform: "uppercase" }}>
                  Total a Receber ({upcomingInflows.length})
                </div>
                <div style={{ fontSize: isMobile ? 15 : 18, fontWeight: 800, color: "#A78BFA", marginTop: 2 }}>
                  {formatBRL(totalUpcomingAllSum)}
                </div>
              </div>
            </div>

            {/* Search & Filter Strip */}
            <div
              style={{
                display: "flex",
                flexDirection: isMobile ? "column" : "row",
                alignItems: isMobile ? "stretch" : "center",
                justifyContent: "space-between",
                gap: 10,
                padding: isMobile ? "12px 14px" : "12px 24px",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "rgba(0,0,0,0.15)",
              }}
            >
              {/* Search Bar */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 8,
                  padding: "6px 12px",
                  flex: isMobile ? "initial" : "0 0 280px",
                }}
              >
                <Search size={14} style={{ color: "#a1a1aa" }} />
                <input
                  type="text"
                  placeholder="Buscar cliente ou serviço..."
                  value={collectionSearch}
                  onChange={(e) => setCollectionSearch(e.target.value)}
                  style={{
                    background: "transparent",
                    border: "none",
                    outline: "none",
                    color: "#fff",
                    fontSize: 12,
                    width: "100%",
                  }}
                />
                {collectionSearch && (
                  <button
                    onClick={() => setCollectionSearch("")}
                    style={{ background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer", padding: 0 }}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>

              {/* Filter Tabs */}
              <div
                style={{
                  display: "flex",
                  gap: 4,
                  overflowX: "auto",
                  WebkitOverflowScrolling: "touch",
                  scrollbarWidth: "none",
                  paddingBottom: isMobile ? 4 : 0,
                }}
              >
                {[
                  { id: "all", label: `Todos a Receber (${upcomingInflows.length + overdueInflows.length})` },
                  { id: "overdue", label: `Em Atraso (${overdueInflows.length})` },
                  { id: "today", label: `Hoje (${todayInflowsCount})` },
                  { id: "7d", label: `7 Dias (${next7DaysCount})` },
                  { id: "30d", label: `30 Dias (${next30DaysCount})` },
                  { id: "payables", label: `Contas a Pagar (${overdueOutflows.length + todayDueOutflows.length})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setModalFilterTab(tab.id as any)}
                    style={{
                      padding: "5px 10px",
                      borderRadius: 6,
                      border: "none",
                      fontSize: 11,
                      fontWeight: modalFilterTab === tab.id ? 700 : 500,
                      background: modalFilterTab === tab.id ? "#8B5CF6" : "rgba(255,255,255,0.05)",
                      color: modalFilterTab === tab.id ? "#fff" : "#a1a1aa",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List Body with Full Scroll */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: isMobile ? "12px 14px" : "16px 24px",
                display: "flex",
                flexDirection: "column",
                gap: 10,
                maxHeight: "55vh",
              }}
            >
              {(() => {
                let list: Array<{
                  id: string;
                  description: string;
                  amount: number;
                  dueDate: string;
                  daysOverdue?: number;
                  clientId?: string;
                  clientName?: string;
                  clientPhone?: string | null;
                  isToday?: boolean;
                  isOverdue?: boolean;
                  type?: "inflow" | "outflow";
                  [key: string]: any;
                }> = [];

                if (modalFilterTab === "all") {
                  list = [
                    ...overdueInflows.map(i => ({ ...i, type: "inflow" as const, isOverdue: true })),
                    ...upcomingInflows.map(i => ({ ...i, type: "inflow" as const, isOverdue: false })),
                  ];
                } else if (modalFilterTab === "overdue") {
                  list = overdueInflows.map(i => ({ ...i, type: "inflow" as const, isOverdue: true }));
                } else if (modalFilterTab === "today") {
                  list = upcomingInflows
                    .filter(i => {
                      const d = new Date(i.dueDate).getTime();
                      return d >= todayStartTs && d <= todayEndTs;
                    })
                    .map(i => ({ ...i, type: "inflow" as const, isToday: true, isOverdue: false }));
                } else if (modalFilterTab === "7d") {
                  list = upcomingInflows
                    .filter(i => {
                      const d = new Date(i.dueDate).getTime();
                      return d >= todayStartTs && d <= next7DaysTs;
                    })
                    .map(i => ({ ...i, type: "inflow" as const, isOverdue: false }));
                } else if (modalFilterTab === "30d") {
                  list = upcomingInflows
                    .filter(i => {
                      const d = new Date(i.dueDate).getTime();
                      return d >= todayStartTs && d <= next30DaysTs;
                    })
                    .map(i => ({ ...i, type: "inflow" as const, isOverdue: false }));
                } else if (modalFilterTab === "payables") {
                  list = [
                    ...overdueOutflows.map(o => ({ ...o, type: "outflow" as const, isOverdue: true })),
                    ...todayDueOutflows.map(o => ({ ...o, type: "outflow" as const, isToday: true })),
                    ...upcomingOutflows.map(o => ({ ...o, type: "outflow" as const })),
                  ];
                }

                if (collectionSearch.trim()) {
                  const q = collectionSearch.toLowerCase().trim();
                  list = list.filter(item =>
                    (item.clientName && item.clientName.toLowerCase().includes(q)) ||
                    (item.description && item.description.toLowerCase().includes(q)) ||
                    (item.clientPhone && item.clientPhone.includes(q))
                  );
                }

                if (list.length === 0) {
                  return (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "#a1a1aa" }}>
                      <CheckCircle2 size={32} style={{ color: "#10B981", margin: "0 auto 10px" }} />
                      <div style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                        Nenhum registro encontrado
                      </div>
                      <div style={{ fontSize: 12, color: "#71717a", marginTop: 4 }}>
                        Não foram localizadas faturas com os filtros e busca aplicados.
                      </div>
                    </div>
                  );
                }

                return list.map((item) => {
                  const isOutflow = item.type === "outflow";
                  const dueStatus = getDueBadge(item.dueDate, item.isOverdue, item.daysOverdue);
                  const isPaying = markingPaidId === item.id;

                  return (
                    <div
                      key={item.id}
                      style={{
                        background: "rgba(255,255,255,0.03)",
                        border: item.isOverdue ? "1px solid rgba(239,68,68,0.25)" : "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 12,
                        padding: isMobile ? "12px 14px" : "14px 18px",
                        display: "flex",
                        flexDirection: isMobile ? "column" : "row",
                        justifyContent: "space-between",
                        alignItems: isMobile ? "stretch" : "center",
                        gap: 12,
                        transition: "all 0.15s ease",
                      }}
                    >
                      {/* Left side: Client / Description */}
                      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0, flex: 1 }}>
                        <div
                          style={{
                            width: 36,
                            height: 36,
                            borderRadius: 10,
                            background: isOutflow
                              ? "rgba(239,68,68,0.18)"
                              : item.isOverdue
                              ? "rgba(239,68,68,0.18)"
                              : "rgba(16,185,129,0.18)",
                            color: isOutflow || item.isOverdue ? "#EF4444" : "#10B981",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontSize: 14,
                            fontWeight: 800,
                            flexShrink: 0,
                          }}
                        >
                          {isOutflow ? <CreditCard size={18} /> : (item.clientName?.charAt(0)?.toUpperCase() || "C")}
                        </div>

                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                              {item.clientName || item.description}
                            </span>
                            {item.clientPhone && (
                              <span style={{ fontSize: 11, color: "#25D366", fontWeight: 600 }}>
                                📱 {item.clientPhone}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 12, color: "#a1a1aa", marginTop: 2 }}>
                            {item.clientName ? item.description : "Conta / Despesa Operacional"}
                          </div>
                        </div>
                      </div>

                      {/* Right side: Badge, Amount, and Actions */}
                      <div
                        style={{
                          display: "flex",
                          alignItems: isMobile ? "stretch" : "center",
                          justifyContent: "space-between",
                          flexDirection: isMobile ? "column" : "row",
                          gap: 12,
                          flexShrink: 0,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: isMobile ? "space-between" : "flex-end" }}>
                          <span
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              padding: "3px 8px",
                              borderRadius: 6,
                              background: dueStatus.bg,
                              color: dueStatus.color,
                              border: `1px solid ${dueStatus.border}`,
                              whiteSpace: "nowrap",
                            }}
                          >
                            {dueStatus.label}
                          </span>
                          <span
                            style={{
                              fontSize: 15,
                              fontWeight: 800,
                              color: isOutflow ? "#EF4444" : "#10B981",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatBRL(item.amount)}
                          </span>
                        </div>

                        {/* Action buttons */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, width: isMobile ? "100%" : "auto" }}>
                          {/* DAR BAIXA */}
                          <button
                            onClick={() => handleQuickMarkPaid(item)}
                            disabled={isPaying}
                            title="Confirmar pagamento e dar baixa imediata nesta fatura"
                            style={{
                              flex: isMobile ? 1 : "initial",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: 6,
                              padding: "7px 14px",
                              minHeight: isMobile ? 40 : 32,
                              borderRadius: 7,
                              background: "rgba(16,185,129,0.2)",
                              border: "1px solid rgba(16,185,129,0.45)",
                              color: "#10B981",
                              fontSize: 12,
                              fontWeight: 700,
                              cursor: isPaying ? "wait" : "pointer",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {isPaying ? (
                              <RefreshCw className="animate-spin" size={13} />
                            ) : (
                              <CheckCircle2 size={13} />
                            )}
                            <span>Dar Baixa</span>
                          </button>

                          {/* COBRAR PIX (only for inflows) */}
                          {!isOutflow && item.clientPhone && (
                            <button
                              onClick={() => handleCobrarPix(item)}
                              title="Enviar cobrança Pix pelo WhatsApp"
                              style={{
                                flex: isMobile ? 1 : "initial",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: 6,
                                padding: "7px 14px",
                                minHeight: isMobile ? 40 : 32,
                                borderRadius: 7,
                                background: "#25D366",
                                border: "none",
                                color: "#fff",
                                fontSize: 12,
                                fontWeight: 700,
                                cursor: "pointer",
                                transition: "all 0.15s ease",
                              }}
                            >
                              <Send size={12} />
                              <span>Cobrar Pix</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>

            {/* Modal Footer */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: isMobile ? "12px 14px" : "14px 24px",
                borderTop: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(0,0,0,0.2)",
              }}
            >
              <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                Ao clicar em <strong>Dar Baixa</strong>, a fatura é liquidada imediatamente no banco de dados.
              </span>
              <button
                onClick={() => setShowFullCollectionModal(false)}
                style={{
                  padding: "6px 16px",
                  borderRadius: 7,
                  background: "rgba(255,255,255,0.06)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: "#fff",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
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
  const isMobile = useIsMobile();
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
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "12px 14px" : "24px", gap: isMobile ? 12 : 18, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      {/* ─── Top Filter Metrics Ribbon ────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(auto-fit, minmax(200px, 1fr))", gap: isMobile ? 8 : 12 }}>
        <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: isMobile ? "8px 12px" : "12px 16px" }}>
          <span style={{ fontSize: 10, color: "#888", fontWeight: 600, textTransform: "uppercase" }}>Filtradas</span>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: "#fff", marginTop: 2 }}>{filtered.length} itens</div>
        </div>
        <div style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: isMobile ? "8px 12px" : "12px 16px" }}>
          <span style={{ fontSize: 10, color: "#10B981", fontWeight: 600, textTransform: "uppercase" }}>Entradas</span>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: "#10B981", marginTop: 2 }}>{formatBRL(totalInflowFiltered)}</div>
        </div>
        <div style={{ background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 10, padding: isMobile ? "8px 12px" : "12px 16px" }}>
          <span style={{ fontSize: 10, color: "#EF4444", fontWeight: 600, textTransform: "uppercase" }}>Saídas</span>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: "#EF4444", marginTop: 2 }}>{formatBRL(totalOutflowFiltered)}</div>
        </div>
        <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, padding: isMobile ? "8px 12px" : "12px 16px" }}>
          <span style={{ fontSize: 10, color: "#A78BFA", fontWeight: 600, textTransform: "uppercase" }}>Saldo</span>
          <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 800, color: balanceFiltered >= 0 ? "#10B981" : "#EF4444", marginTop: 2 }}>
            {formatBRL(balanceFiltered)}
          </div>
        </div>
      </div>

      {/* ─── Quick View Tabs ──────────────────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div style={{ display: "flex", gap: 5, overflowX: "auto", maxWidth: "100%", paddingBottom: 2 }}>
          {[
            { id: "all",      label: "Todas" },
            { id: "inflow",   label: isMobile ? "Entradas" : "A Receber / Entradas" },
            { id: "outflow",  label: isMobile ? "Saídas" : "A Pagar / Saídas" },
            { id: "overdue",  label: isMobile ? "Atrasadas" : "Atrasadas / Urgentes", icon: <AlertTriangle size={12} style={{ color: "#EF4444" }} /> },
            { id: "paid",     label: isMobile ? "Pagas" : "Liquidadas" },
            { id: "approval", label: isMobile ? "Alçada" : "Em Alçada", icon: <Scale size={12} style={{ color: "#A78BFA" }} /> },
          ].map((qv) => (
            <button
              key={qv.id}
              onClick={() => setQuickFilter(qv.id as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
                padding: isMobile ? "5px 10px" : "6px 12px",
                borderRadius: 20,
                fontSize: 11,
                fontWeight: quickFilter === qv.id ? 700 : 500,
                background: quickFilter === qv.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                border: quickFilter === qv.id ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.08)",
                color: quickFilter === qv.id ? "#fff" : "#a1a1aa",
                cursor: "pointer",
                whiteSpace: "nowrap",
                flexShrink: 0
              }}
            >
              {qv.icon}
              {qv.label}
            </button>
          ))}
        </div>

        {!isMobile && (
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
        )}
      </div>

      {/* ─── Search & Dropdown Filters Bar ────────────────────────────────── */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <div style={{ flex: 1, minWidth: isMobile ? "100%" : 260, position: "relative" }}>
          <Search style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", width: 15, height: 15, color: "#666" }} />
          <input
            type="text"
            placeholder={isMobile ? "Buscar lançamentos..." : "Pesquisar por descrição, cliente, sócio ou categoria..."}
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            style={{
              width: "100%",
              background: "rgba(255,255,255,0.04)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 8,
              padding: "8px 12px 8px 34px",
              color: "#fff",
              fontSize: 13,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <Select
          value={selectedAccountId}
          onChange={(e) => setSelectedAccountId(e.target.value)}
          style={{
            width: isMobile ? "100%" : 210,
            background: "#18181c",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "8px 10px",
            color: "#ccc",
            fontSize: 12,
            outline: "none",
          }}
        >
          <option value="all">Todas as Contas</option>
          {accounts.map(a => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </Select>

        <Select
          value={selectedProjectId}
          onChange={(e) => setSelectedProjectId(e.target.value)}
          style={{
            width: isMobile ? "100%" : 210,
            background: "#18181c",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: 8,
            padding: "8px 10px",
            color: "#ccc",
            fontSize: 12,
            outline: "none",
          }}
        >
          <option value="all">Todos os Projetos</option>
          {projects.map(p => (
            <option key={p.id} value={p.id}>{p.name}</option>
          ))}
        </Select>
      </div>

      {/* ─── Ledger Accounting Table / Mobile Cards ───────────────────────── */}
      {filtered.length > 0 ? (
        isMobile ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {filtered.map((tx) => {
              const isInflow = tx.type === "inflow";
              return (
                <div
                  key={tx.id}
                  style={{
                    background: "#18181c",
                    border: "1px solid rgba(255,255,255,0.08)",
                    borderRadius: 12,
                    padding: 14,
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 700, color: "#fafafa", fontSize: 14, wordBreak: "break-word" }}>{tx.description}</div>
                      <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                        Venc: {formatDate(tx.dueDate)}
                        {tx.paidAt && <span style={{ color: "#10B981", marginLeft: 6 }}>• Pago {formatDate(tx.paidAt)}</span>}
                      </div>
                    </div>
                    <div style={{ textAlign: "right", flexShrink: 0 }}>
                      <div style={{
                        fontSize: 15,
                        fontWeight: 800,
                        color: isInflow ? "#10B981" : "#fafafa",
                      }}>
                        {isInflow ? "+" : "-"} {formatBRL(tx.amount)}
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <StatusBadge status={tx.status} approvalStatus={tx.approvalStatus} />
                      </div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center", fontSize: 11 }}>
                    {tx.clientName && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(59,130,246,0.12)", color: "#93c5fd" }}>
                        Cliente: {tx.clientName}
                      </span>
                    )}
                    {tx.partnerName && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(139,92,246,0.12)", color: "#c4b5fd" }}>
                        Sócio: {tx.partnerName}
                      </span>
                    )}
                    {tx.projectName && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: tx.projectColor || "#ccc" }}>
                        {tx.projectName}
                      </span>
                    )}
                    {tx.categoryName && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "#a1a1aa" }}>
                        {tx.categoryName}
                      </span>
                    )}
                    {tx.accountName && (
                      <span style={{ padding: "2px 8px", borderRadius: 4, background: "rgba(255,255,255,0.04)", color: "#a1a1aa" }}>
                        {tx.accountName}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, paddingTop: 8, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
                    {tx.status !== "paid" && (
                      <button
                        onClick={() => onMarkPaid(tx)}
                        style={{
                          padding: "6px 14px",
                          borderRadius: 6,
                          background: "rgba(16,185,129,0.15)",
                          border: "1px solid rgba(16,185,129,0.3)",
                          color: "#10B981",
                          fontSize: 12,
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Baixar
                      </button>
                    )}
                    <button
                      onClick={() => onEditTx(tx)}
                      style={{
                        padding: "6px 14px",
                        borderRadius: 6,
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        color: "#ccc",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      Editar
                    </button>
                    <button
                      onClick={() => onDeleteTx(tx.id)}
                      title="Excluir lançamento"
                      style={{
                        padding: "6px 10px",
                        borderRadius: 6,
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#EF4444",
                        fontSize: 12,
                        cursor: "pointer",
                      }}
                    >
                      <X style={{ width: 14, height: 14 }} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
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
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 7, fontSize: 11, fontWeight: 600, color: tx.projectColor || "#ccc" }}>
                              <ProductAvatar
                                productId={tx.projectId || undefined}
                                productName={tx.projectName}
                                productColor={tx.projectColor || undefined}
                                size={18}
                                borderRadius={5}
                              />
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
        )
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
  sales,
  onNewClient,
  onEditClient,
  onSendWhatsApp,
  onNewTxForClient,
  onDeleteClient,
  onReactivateClient,
  onNewSale,
  onManageSale,
  onOpenModules,
  sendingBillingId,
  onResetAll,
}: {
  clients: Client[];
  transactions: Transaction[];
  sales: SaleView[];
  onNewClient: () => void;
  onEditClient: (client: Client) => void;
  onSendWhatsApp: (client: Client, tx?: Transaction) => void;
  onNewTxForClient: (clientId: string) => void;
  onDeleteClient: (client: Client) => void;
  onReactivateClient: (client: Client) => void;
  onNewSale: (clientId?: string) => void;
  onManageSale: (sale: SaleView) => void;
  onOpenModules: () => void;
  sendingBillingId: string | null;
  onResetAll?: () => void;
}) {
  const isMobile = useIsMobile();
  const [resetting, setResetting] = useState(false);
  const [searchClient, setSearchClient] = useState("");

  const handleResetFinance = async () => {
    const ok = await confirmDialog({
      title: "Resetar Todo o Módulo Financeiro?",
      message: "Esta ação apagará todos os clientes, contratos, vendas comerciais, faturas geradas e zerará o Livro Caixa e os saldos das contas para iniciar um ciclo limpo. Confirma?",
      confirmLabel: "Sim, Resetar Tudo",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!ok) return;

    try {
      setResetting(true);
      await API.post("/finance/reset-all", { confirm: "RESET_FINANCE" });
      toast.success("Módulo financeiro zerado com sucesso!");
      onResetAll?.();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao resetar financeiro.");
    } finally {
      setResetting(false);
    }
  };
  const [statusFilter, setStatusFilter] = useState<"active" | "all" | "inactive">("active");

  const activeCount = clients.filter(c => c.status !== "inactive").length;
  const inactiveCount = clients.filter(c => c.status === "inactive").length;

  const filteredClients = clients.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchClient.toLowerCase()) ||
      (c.document || "").includes(searchClient);
    if (!matchesSearch) return false;
    if (statusFilter === "active") return c.status !== "inactive";
    if (statusFilter === "inactive") return c.status === "inactive";
    return true;
  });

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "12px 14px" : "24px", gap: isMobile ? 14 : 20, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "#fff" }}>
            Carteira de Clientes & Contas a Receber
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Gestão de contratos B2B, emissão de cobranças Pix via WhatsApp e cancelamento/reativação de assinaturas
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={onOpenModules}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#ccc",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Layers style={{ width: 14, height: 14 }} /> Módulos SaaS
          </button>
          <button
            onClick={onNewClient}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(255,255,255,0.05)",
              border: "1px solid rgba(255,255,255,0.12)",
              color: "#ccc",
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Plus style={{ width: 15, height: 15 }} /> Novo Cliente
          </button>
          <button
            onClick={() => onNewSale()}
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
            <Sparkles style={{ width: 15, height: 15 }} /> Nova Venda
          </button>
          {onResetAll && (
            <button
              type="button"
              disabled={resetting}
              onClick={handleResetFinance}
              style={{
                padding: "8px 14px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#EF4444",
                fontSize: 13,
                fontWeight: 600,
                cursor: resetting ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
              }}
              title="Zerar dados financeiros e reiniciar ciclo limpo"
            >
              <Trash2 style={{ width: 14, height: 14 }} /> {resetting ? "Resetando..." : "Resetar Base"}
            </button>
          )}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ maxWidth: 360, width: "100%", position: "relative" }}>
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
              fontSize: 14,
              outline: "none",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {[
            { id: "active",   label: `Ativos (${activeCount})` },
            { id: "all",      label: `Todos (${clients.length})` },
            { id: "inactive", label: `Cancelados / Inativos (${inactiveCount})` },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setStatusFilter(tab.id as any)}
              style={{
                padding: "6px 12px",
                borderRadius: 20,
                fontSize: 12,
                fontWeight: statusFilter === tab.id ? 700 : 500,
                background: statusFilter === tab.id ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)",
                border: statusFilter === tab.id ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.08)",
                color: statusFilter === tab.id ? "#fff" : "#a1a1aa",
                cursor: "pointer",
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {filteredClients.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {filteredClients.map((client) => {
            const isInactive = client.status === "inactive";
            const clientTxs = transactions.filter(t => t.clientId === client.id && t.type === "inflow");
            const totalBilled = clientTxs.filter(t => t.status === "paid").reduce((s, t) => s + t.amount, 0);
            const pendingTxs = clientTxs.filter(t => t.status === "pending").sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());
            const pendingAmount = pendingTxs.reduce((s, t) => s + t.amount, 0);
            const hasOverdue = pendingTxs.some(t => new Date(t.dueDate) < new Date());
            const canSendBilling = Boolean(client.whatsappOptIn && client.phone?.replace(/\D/g, "") && !isInactive && pendingTxs.length > 0);

            return (
              <div
                key={client.id}
                style={{
                  background: isInactive
                    ? "linear-gradient(135deg, rgba(22,22,25,0.95), rgba(18,18,20,0.95))"
                    : "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
                  border: `1px solid ${isInactive ? "rgba(239,68,68,0.2)" : hasOverdue ? "rgba(239,68,68,0.3)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: 14,
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  opacity: isInactive ? 0.85 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                      <ClientAvatar name={client.name} photoUrl={client.photoUrl} />
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>{client.name}</h4>
                    </div>
                    <span style={{ fontSize: 11, color: "#888" }}>{client.document || "Sem CNPJ/CPF"}</span>
                    {client.projectId && client.projectName && (
                      <div style={{ marginTop: 5 }}>
                        <span style={{
                          display: "inline-flex", alignItems: "center", gap: 6,
                          fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10,
                          background: `${client.projectColor || "#7C5AC2"}22`,
                          border: `1px solid ${client.projectColor || "#7C5AC2"}44`,
                          color: client.projectColor || "#A78BFA",
                        }}>
                          <ProductAvatar
                            productId={client.projectId}
                            productName={client.projectName}
                            productColor={client.projectColor || undefined}
                            size={14}
                            borderRadius={3}
                          />
                          {client.projectName}
                        </span>
                      </div>
                    )}
                  </div>
                  <span
                    style={{
                      fontSize: 10,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 12,
                      background: isInactive
                        ? "rgba(239,68,68,0.12)"
                        : hasOverdue
                          ? "rgba(239,68,68,0.15)"
                          : "rgba(16,185,129,0.15)",
                      color: isInactive ? "#EF4444" : hasOverdue ? "#EF4444" : "#10B981",
                      border: `1px solid ${isInactive ? "rgba(239,68,68,0.25)" : hasOverdue ? "rgba(239,68,68,0.3)" : "rgba(16,185,129,0.3)"}`,
                    }}
                  >
                    {isInactive ? "Contrato Cancelado" : hasOverdue ? "Inadimplente / Atrasado" : "Em Dia"}
                  </span>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontSize: 11, fontWeight: 600, color: isInactive ? "#888" : client.whatsappOptIn ? "hsl(152 65% 45%)" : "hsl(240 5% 65%)" }}>
                    {isInactive ? "● Cobrança Suspensa" : client.whatsappOptIn ? "WhatsApp autorizado" : "WhatsApp sem autorização"}
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <button type="button" onClick={() => onEditClient(client)} style={{ border: "none", background: "transparent", color: "hsl(265 85% 62%)", cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                      Editar ficha
                    </button>
                    {!isInactive && (
                      <button
                        type="button"
                        title="Cancelar contrato ou excluir cliente"
                        onClick={() => onDeleteClient(client)}
                        style={{ border: "none", background: "transparent", color: "#666", cursor: "pointer", padding: 2, display: "inline-flex", alignItems: "center" }}
                      >
                        <Trash2 style={{ width: 13, height: 13 }} />
                      </button>
                    )}
                  </div>
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

                {!isInactive && (
                  <ClientSalesSummary
                    sales={sales.filter((s) => s.clientId === client.id)}
                    onNewSale={() => onNewSale(client.id)}
                    onManage={onManageSale}
                  />
                )}

                {isInactive ? (
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      type="button"
                      onClick={() => onReactivateClient(client)}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: "rgba(16,185,129,0.15)",
                        border: "1px solid rgba(16,185,129,0.3)",
                        color: "#10B981",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <CheckCircle2 style={{ width: 13, height: 13 }} /> Reativar Contrato
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteClient(client)}
                      style={{
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "rgba(239,68,68,0.1)",
                        border: "1px solid rgba(239,68,68,0.25)",
                        color: "#EF4444",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <Trash2 style={{ width: 13, height: 13 }} /> Excluir
                    </button>
                  </div>
                ) : (
                  <div style={{ display: "flex", gap: 8 }}>
                    <Tip
                      style={{ flex: 1 }}
                      text={!client.whatsappOptIn ? "Registre a autorização na ficha do cliente" : !client.phone ? "Cadastre o WhatsApp do cliente" : client.status === "inactive" ? "Cliente inativo" : !pendingTxs.length ? "Nenhuma parcela em aberto" : ""}
                    >
                    <button
                      onClick={() => onSendWhatsApp(client, pendingTxs[0])}
                      disabled={!canSendBilling || sendingBillingId === pendingTxs[0]?.id}
                      style={{
                        flex: 1,
                        padding: "8px 10px",
                        borderRadius: 8,
                        background: canSendBilling ? "hsl(152 65% 45%)" : "hsl(240 4% 22%)",
                        border: "none",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: canSendBilling ? "pointer" : "not-allowed",
                        opacity: canSendBilling ? 1 : 0.65,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                      }}
                    >
                      <Send style={{ width: 13, height: 13 }} /> {sendingBillingId === pendingTxs[0]?.id ? "Enviando..." : "Cobrança WhatsApp"}
                    </button>
                    </Tip>
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
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <EmptyState
          icon={Users}
          title={statusFilter === "inactive" ? "Nenhum cliente cancelado ou inativo" : "Nenhum cliente encontrado"}
          description={statusFilter === "inactive" ? "Não há contratos cancelados no momento." : "Cadastre clientes para vincular faturamentos, controlar contas a receber e emitir cobranças Pix via WhatsApp."}
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
  onManageAccount,
  onNewTx,
}: {
  accounts: BankAccount[];
  transactions: Transaction[];
  onNewAccount: () => void;
  onManageAccount: (acc: BankAccount) => void;
  onNewTx: () => void;
}) {
  const isMobile = useIsMobile();
  const totalBalance = accounts.reduce((s, a) => s + a.currentBalance, 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "12px 14px" : "24px", gap: isMobile ? 14 : 20, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "#fff" }}>
            Contas Bancárias & Saldos do Sistema
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Saldo consolidado registrado no sistema Teltech Ledger (conciliação com extrato bancário externo em breve)
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

      <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.15), rgba(79,45,138,0.15))", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 14, padding: isMobile ? "14px 16px" : "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 12, fontWeight: 600, color: "#A78BFA", textTransform: "uppercase" }}>Patrimônio Líquido em Caixa</span>
          <div style={{ fontSize: isMobile ? 22 : 30, fontWeight: 900, color: "#fff", marginTop: 2 }}>{formatBRL(totalBalance)}</div>
        </div>
        <span style={{ fontSize: 12, color: "#ccc" }}>{accounts.length} {accounts.length === 1 ? "conta bancária ativa" : "contas bancárias ativas"}</span>
      </div>

      {accounts.length === 0 ? (
        <div
          style={{
            padding: "48px 24px",
            textAlign: "center",
            background: "rgba(255,255,255,0.02)",
            border: "1px dashed rgba(255,255,255,0.12)",
            borderRadius: 14,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: 12,
          }}
        >
          <Wallet style={{ width: 38, height: 38, color: "#8B5CF6", opacity: 0.8 }} />
          <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Nenhuma conta bancária cadastrada</div>
          <p style={{ fontSize: 13, color: "#888", maxWidth: 460, margin: 0, lineHeight: 1.5 }}>
            Cadastre suas contas bancárias reais oficiais para registrar movimentações e apurar saldos com total conformidade e auditoria.
          </p>
          <button
            onClick={onNewAccount}
            style={{
              marginTop: 6,
              padding: "9px 20px",
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
            <Plus style={{ width: 16, height: 16 }} /> Cadastrar Primeira Conta
          </button>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
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
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 10, textTransform: "uppercase", padding: "2px 7px", borderRadius: 4, background: "rgba(255,255,255,0.06)", color: "#aaa" }}>
                      {acc.type}
                    </span>
                    <button
                      type="button"
                      onClick={() => onManageAccount(acc)}
                      title="Gerenciar dados cadastrais ou desativar conta"
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.12)",
                        borderRadius: 6,
                        padding: "3px 8px",
                        color: "#ccc",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 4,
                      }}
                    >
                      <SlidersHorizontal size={12} /> Gerenciar
                    </button>
                  </div>
                </div>

                <div>
                  <span style={{ fontSize: 11, color: "#777" }}>Saldo Registrado:</span>
                  <div style={{ fontSize: 24, fontWeight: 800, color: "#10B981" }}>{formatBRL(acc.currentBalance)}</div>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#888", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10 }}>
                  <span>Saldo Inicial: {formatBRL(acc.initialBalance)}</span>
                  <span style={{ color: pendingCount > 0 ? "#F59E0B" : "#10B981" }}>
                    {pendingCount > 0 ? `${pendingCount} a realizar` : <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}><Check size={12} /> Saldo interno em dia</span>}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
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
  const isMobile = useIsMobile();
  if (!dre) return null;

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "12px 14px" : "24px", gap: isMobile ? 16 : 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "#fff" }}>
          DRE Gerencial & Rentabilidade de Projetos
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
          Demonstração do Resultado do Exercício e margem de contribuição individual de cada produto Teltech
        </p>
      </div>

      {/* DRE Accounting Cascade Table */}
      <div style={{ background: "#18181c", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden", overflowX: "auto" }}>
        <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", minWidth: isMobile ? 480 : "auto" }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Estrutura de Demonstração de Resultado</span>
          <span style={{ fontSize: 12, color: "#888" }}>Base: Regime de Caixa (lançamentos liquidados)</span>
        </div>

        <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 2, minWidth: isMobile ? 480 : "auto" }}>
          {[
            { label: "(+) RECEITA BRUTA OPERACIONAL", val: dre.grossRevenue, pct: 100, bold: true, color: "#10B981" },
            ...(((dre.recurringRevenue ?? 0) > 0 || (dre.oneTimeRevenue ?? 0) > 0)
              ? [
                  { label: "    ↳ Recorrente (mensalidades SaaS / manutenção)", val: dre.recurringRevenue ?? 0, pct: dre.grossRevenue > 0 ? ((dre.recurringRevenue ?? 0) / dre.grossRevenue) * 100 : 0, color: "#34D399" },
                  { label: "    ↳ Pontual (projetos / entradas)", val: dre.oneTimeRevenue ?? 0, pct: dre.grossRevenue > 0 ? ((dre.oneTimeRevenue ?? 0) / dre.grossRevenue) * 100 : 0, color: "#6EE7B7" },
                  ...((dre.otherRevenue ?? 0) > 0
                    ? [{ label: "    ↳ Outras receitas (lançamentos avulsos)", val: dre.otherRevenue ?? 0, pct: dre.grossRevenue > 0 ? ((dre.otherRevenue ?? 0) / dre.grossRevenue) * 100 : 0, color: "#A7F3D0" }]
                    : []),
                ]
              : []),
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
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
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
  const isMobile = useIsMobile();
  const totalBudget = budgets.reduce((s, b) => s + (b.amount || 0), 0);
  const totalSpent = budgets.reduce((s, b) => s + (b.spent || 0), 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "12px 14px" : "24px", gap: isMobile ? 16 : 20, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "#fff" }}>
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
          <Plus style={{ width: 15, height: 15 }} /> {isMobile ? "Novo Teto" : "Novo Teto Orçamentário"}
        </button>
      </div>

      {/* Global Progress */}
      <div style={{ background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, padding: isMobile ? "16px" : "20px 24px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
          <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 700, color: "#fff" }}>Teto Global Consolidado da Teltech</span>
          <span style={{ fontSize: isMobile ? 13 : 14, fontWeight: 800, color: "#A78BFA" }}>
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
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
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
  onResetAll,
}: {
  pendingApprovals: Transaction[];
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onNewTx: () => void;
  onResetAll?: () => void;
}) {
  const isMobile = useIsMobile();
  const [resetting, setResetting] = useState(false);

  const handleResetFinance = async () => {
    const ok = await confirmDialog({
      title: "Resetar Todo o Módulo Financeiro?",
      message: "Esta ação apagará todos os clientes, contratos, vendas comerciais, faturas geradas e zerará o Livro Caixa e os saldos das contas para iniciar um ciclo limpo. Confirma?",
      confirmLabel: "Sim, Resetar Tudo",
      cancelLabel: "Cancelar",
      danger: true,
    });
    if (!ok) return;

    try {
      setResetting(true);
      await API.post("/finance/reset-all", { confirm: "RESET_FINANCE" });
      toast.success("Módulo financeiro zerado com sucesso!");
      onResetAll?.();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao resetar financeiro.");
    } finally {
      setResetting(false);
    }
  };

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "12px 14px" : "24px", gap: isMobile ? 16 : 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div>
        <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "#fff" }}>
          Governança Corporativa & Matriz de Alçadas
        </h2>
        <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
          Regras de validação de despesas, compliance de gastos e fila de deliberação executiva
        </p>
      </div>

      {/* Matriz Ativa de Governança (Cards Always Visible) */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fit, minmax(280px, 1fr))", gap: 14 }}>
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
                  padding: isMobile ? "14px 16px" : "18px 22px",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: isMobile ? "stretch" : "center",
                  flexWrap: "wrap",
                  gap: 14,
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                    <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>{item.description}</h4>
                    <CostTypeBadge type={item.costType} />
                  </div>
                  <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: isMobile ? 4 : 16, marginTop: 6, fontSize: 12, color: "#a1a1aa" }}>
                    <span>Solicitante: <strong style={{ color: "#fff" }}>{item.partnerName || "Membro"}</strong></span>
                    <span>Vencimento: <strong style={{ color: "#fff" }}>{formatDate(item.dueDate)}</strong></span>
                    <span>Conta: <strong style={{ color: "#fff" }}>{item.accountName || "Geral"}</strong></span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "space-between" : "flex-end", width: isMobile ? "100%" : "auto", gap: 12, borderTop: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none", paddingTop: isMobile ? 10 : 0 }}>
                  <span style={{ fontSize: isMobile ? 18 : 20, fontWeight: 900, color: "#EF4444" }}>{formatBRL(item.amount)}</span>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => onApprove(item.id)}
                      style={{
                        padding: "8px 14px",
                        borderRadius: 8,
                        background: "#10B981",
                        border: "none",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Aprovar
                    </button>
                    <button
                      onClick={() => onReject(item.id)}
                      style={{
                        padding: "8px 14px",
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

      {/* Zona de Manutenção & Reset (Diretoria) */}
      <div
        style={{
          marginTop: 10,
          background: "rgba(239,68,68,0.05)",
          border: "1px dashed rgba(239,68,68,0.3)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Trash2 size={16} style={{ color: "#EF4444" }} />
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>
              Reset do Módulo Financeiro (Deliberação Executiva)
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Limpa todas as vendas, clientes, contratos e lançamentos do Livro Caixa para iniciar um novo ciclo zerado.
          </p>
        </div>
        <button
          type="button"
          disabled={resetting}
          onClick={handleResetFinance}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.15)",
            border: "1px solid rgba(239,68,68,0.4)",
            color: "#EF4444",
            fontSize: 12,
            fontWeight: 700,
            cursor: resetting ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
          }}
        >
          <Trash2 size={13} /> {resetting ? "Resetando..." : "Resetar Base Financeira"}
        </button>
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
  const isMobile = useIsMobile();

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: isMobile ? "12px 14px" : "24px", gap: isMobile ? 16 : 24, maxWidth: 1600, margin: "0 auto", width: "100%", boxSizing: "border-box" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: isMobile ? 16 : 18, fontWeight: 800, color: "#fff" }}>
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
          <Plus style={{ width: 15, height: 15 }} /> {isMobile ? "Solicitar" : "Solicitar Reembolso / Pró-labore"}
        </button>
      </div>

      {/* Partner Executive Cards */}
      <div style={{ display: "grid", gridTemplateColumns: isMobile ? "1fr" : "repeat(auto-fill, minmax(320px, 1fr))", gap: 16 }}>
        {partners.map((p) => (
          <div
            key={p.id}
            style={{
              background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
              border: `1px solid ${p.color}40`,
              borderRadius: 14,
              padding: isMobile ? "16px" : "22px",
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
  initialClientId,
  initialType,
  categories,
  accounts,
  clients,
  projects,
  partners,
  onClose,
  onSaved,
}: {
  tx: Transaction | null;
  initialClientId?: string;
  initialType?: TxType;
  categories: Category[];
  accounts: BankAccount[];
  clients: Client[];
  projects: Project[];
  partners: PartnerData[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isMobile = useIsMobile();
  const [type, setType] = useState<TxType>(tx?.type || initialType || "outflow");
  const [description, setDescription] = useState(tx?.description || "");
  const [amountInput, setAmountInput] = useState(
    tx && typeof tx.amount === "number" ? (tx.amount / 100).toFixed(2).replace(".", ",") : ""
  );
  const [dueDate, setDueDate] = useState(
    tx?.dueDate ? tx.dueDate.split("T")[0] : new Date().toISOString().split("T")[0]
  );
  const [categoryId, setCategoryId] = useState(tx?.categoryId || "");
  const [accountId, setAccountId] = useState(tx?.accountId || (accounts[0]?.id ?? ""));
  const [projectId, setProjectId] = useState(tx?.projectId || "");
  const [clientId, setClientId] = useState(tx?.clientId || initialClientId || "");
  const [partnerId, setPartnerId] = useState(tx?.partnerId || "");
  const [costType, setCostType] = useState<CostType>(tx?.costType || "fixed_operating");
  const [status, setStatus] = useState<TxStatus>(tx?.status || "pending");
  const [notes, setNotes] = useState(tx?.notes || "");

  // Batch installments & recurrence
  const [isInstallment, setIsInstallment] = useState(false);
  const [installmentsCount, setInstallmentsCount] = useState(2);
  const [installmentMode, setInstallmentMode] = useState<"per_installment" | "total">("per_installment");
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringInterval, setRecurringInterval] = useState("monthly");
  const [pauseBilling, setPauseBilling] = useState(tx?.pauseBilling === true);

  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = parseBRL(amountInput);
    if (!description.trim() || amount <= 0) {
      toast.error("Por favor, preencha a descrição e um valor válido.");
      return;
    }
    if (!dueDate) {
      toast.error("Informe a data de vencimento.");
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
        pauseBilling,
      };

      if (!tx && isInstallment && installmentsCount > 1) {
        payload.installmentsTotal = installmentsCount;
        payload.isInstallmentBatch = true;
        payload.installmentMode = installmentMode;
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
    <Drawer
      title={tx ? "Editar Lançamento" : initialClientId ? "Faturar Cliente (A Receber)" : "Novo Lançamento Financeiro"}
      icon={<Receipt size={18} />}
      onClose={onClose}
      onSubmit={handleSubmit}
      width={560}
      footer={
        <>
          <button type="button" onClick={onClose} style={drawerBtn.ghost}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} style={drawerBtn.primary(saving)}>
            {saving ? "Salvando..." : tx ? "Salvar Alterações" : "Concluir Lançamento"}
          </button>
        </>
      }
    >
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
              <DateInput
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "9px 10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Conta Bancária</label>
              <Select
                value={accountId}
                onChange={(e) => setAccountId(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                {accounts.map(a => (
                  <option key={a.id} value={a.id}>{a.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Status Inicial</label>
              <Select
                value={status}
                onChange={(e) => setStatus(e.target.value as TxStatus)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="pending">Pendente</option>
                <option value="paid">Liquidado / Pago</option>
              </Select>
            </div>
          </div>

          {type === "outflow" && (
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Tipo de Custo (DRE)</label>
              <Select
                value={costType}
                onChange={(e) => setCostType(e.target.value as CostType)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="direct_cogs">Custo Direto de Projeto (CPV / COGS)</option>
                <option value="fixed_operating">Despesa Operacional Fixa</option>
                <option value="partner_withdrawal">Pró-labore / Retirada de Sócio</option>
                <option value="tax">Impostos / Simples Nacional</option>
                <option value="investment">Investimento / Expansão</option>
              </Select>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Projeto / Produto</label>
              <Select
                value={projectId}
                onChange={(e) => setProjectId(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="">Geral Teltech</option>
                {projects.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </Select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Cliente ou Sócio</label>
              {type === "inflow" ? (
                <Select
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
                >
                  <option value="">Nenhum cliente</option>
                  {clients.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </Select>
              ) : (
                <Select
                  value={partnerId}
                  onChange={(e) => setPartnerId(e.target.value)}
                  style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
                >
                  <option value="">Nenhum sócio específico</option>
                  {partners.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.role.toUpperCase()})</option>
                  ))}
                </Select>
              )}
            </div>
          </div>

          {!tx && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, background: "rgba(255,255,255,0.03)", padding: "12px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#ccc" }}>Gerar Parcelamento em Lote?</label>
                <Checkbox
                  
                  checked={isInstallment}
                  onChange={(e) => setIsInstallment(e.target.checked)}
                />
              </div>
              {isInstallment && (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 12, color: "#888" }}>Número de parcelas:</span>
                    <Select
                      value={String(installmentsCount)}
                      onChange={(e) => setInstallmentsCount(parseInt(e.target.value))}
                      style={{ width: 160, background: "#111113", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "6px 8px", color: "#fff", fontSize: 13 }}
                    >
                      {[2, 3, 4, 5, 6, 10, 12, 24, 36, 48].map(n => (
                        <option key={n} value={n}>{n}x mensais</option>
                      ))}
                    </Select>
                  </div>

                  {/* Seletor de Modo de Parcelamento */}
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#888" }}>Como interpretar o valor digitado:</span>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <button
                        type="button"
                        onClick={() => setInstallmentMode("per_installment")}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: installmentMode === "per_installment" ? "1px solid #10B981" : "1px solid rgba(255,255,255,0.1)",
                          background: installmentMode === "per_installment" ? "rgba(16,185,129,0.15)" : "transparent",
                          color: installmentMode === "per_installment" ? "#10B981" : "#888",
                          textAlign: "center",
                          lineHeight: 1.3,
                        }}
                      >
                        Por Parcela / Mensalidade
                        <span style={{ display: "block", fontSize: 10, opacity: 0.8, fontWeight: 400, marginTop: 2 }}>
                          (Ex: {installmentsCount}x de {amountInput ? `R$ ${amountInput}` : "R$ 109,90"})
                        </span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setInstallmentMode("total")}
                        style={{
                          padding: "8px 10px",
                          borderRadius: 6,
                          fontSize: 11,
                          fontWeight: 600,
                          cursor: "pointer",
                          border: installmentMode === "total" ? "1px solid #A78BFA" : "1px solid rgba(255,255,255,0.1)",
                          background: installmentMode === "total" ? "rgba(139,92,246,0.15)" : "transparent",
                          color: installmentMode === "total" ? "#A78BFA" : "#888",
                          textAlign: "center",
                          lineHeight: 1.3,
                        }}
                      >
                        Valor Total da Venda
                        <span style={{ display: "block", fontSize: 10, opacity: 0.8, fontWeight: 400, marginTop: 2 }}>
                          (Dividir em {installmentsCount} parcelas)
                        </span>
                      </button>
                    </div>
                  </div>

                  {/* Resumo em tempo real */}
                  {(() => {
                    const parsedAmt = parseBRL(amountInput);
                    const singleInst = installmentMode === "per_installment" ? parsedAmt : Math.floor(parsedAmt / installmentsCount);
                    const totalCalc = installmentMode === "per_installment" ? parsedAmt * installmentsCount : parsedAmt;
                    return (
                      <div style={{
                        padding: "8px 12px",
                        background: "rgba(139,92,246,0.1)",
                        border: "1px solid rgba(139,92,246,0.25)",
                        borderRadius: 8,
                        fontSize: 12,
                        color: "#ddd",
                        display: "flex",
                        flexDirection: "column",
                        gap: 3,
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span>Valor de cada fatura ({installmentsCount}x):</span>
                          <strong style={{ color: "#10B981", fontSize: 13 }}>{formatBRL(singleInst)}</strong>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#888", fontSize: 11 }}>
                          <span>Faturamento acumulado:</span>
                          <span>{formatBRL(totalCalc)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          )}

          {type === "inflow" && (
            <div style={{ background: "hsl(240 3% 7% / 0.55)", border: "1px solid hsl(240 4% 20%)", borderRadius: 8, padding: "12px", display: "flex", flexDirection: "column", gap: 6 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                <Checkbox
                  
                  checked={pauseBilling}
                  onChange={(e) => setPauseBilling(e.target.checked)}
                  style={{ accentColor: "hsl(265 85% 62%)" }}
                />
                <span style={{ fontSize: 12, fontWeight: 600, color: "#fafafa" }}>Pausar régua de cobrança automática no WhatsApp</span>
              </label>
              <span style={{ fontSize: 11, color: "#888", marginLeft: 24 }}>
                Ative para parcelas com renegociação ou quando um acordo prévio foi feito com o cliente.
              </span>
            </div>
          )}

        </div>
      </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: BANK ACCOUNT
// ─────────────────────────────────────────────────────────────────────────────

function AccountModal({
  account,
  onClose,
  onSaved,
}: {
  account?: BankAccount | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(account?.name ?? "");
  const [type, setType] = useState<"checking" | "credit_card" | "investment" | "cash">(account?.type ?? "checking");
  const [balanceInput, setBalanceInput] = useState("");
  const [color, setColor] = useState(account?.color ?? "#8B5CF6");
  const [saving, setSaving] = useState(false);
  const [deactivating, setDeactivating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      if (account) {
        // Atualiza apenas informações cadastrais (nome, tipo, cor)
        await API.put(`/finance/accounts/${account.id}`, {
          name: name.trim(),
          type,
          color,
        });
        toast.success("Dados cadastrais da conta atualizados.");
      } else {
        // Nova conta com saldo inicial de abertura
        await API.post("/finance/accounts", {
          name: name.trim(),
          type,
          color,
          initialBalance: parseBRL(balanceInput),
        });
        toast.success("Nova conta bancária cadastrada.");
      }
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar conta bancária.");
    } finally {
      setSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!account) return;
    const confirmMsg = `Deseja realmente desativar a conta "${account.name}"?\n\n- Se não houver movimentações, ela será removida do sistema.\n- Se houver movimentações, ela será arquivada preservando todo o histórico contábil e auditoria.`;
    if (!(await confirmDialog({ title: "Desativar conta", message: confirmMsg, confirmLabel: "Desativar", danger: true }))) return;

    try {
      setDeactivating(true);
      const res = await API.delete(`/finance/accounts/${account.id}`);
      toast.success(res?.message || "Conta processada com sucesso.");
      onSaved();
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao desativar conta.");
    } finally {
      setDeactivating(false);
    }
  };

  return (
    <Drawer
      title={account ? "Gerenciar Conta Bancária" : "Nova Conta Bancária"}
      icon={<Wallet size={18} />}
      onClose={onClose}
      onSubmit={handleSubmit}
      width={460}
      footer={
        <>
          {account && (
            <button
              type="button"
              onClick={handleDeactivate}
              disabled={deactivating}
              style={{
                marginRight: "auto",
                padding: "8px 12px",
                borderRadius: 8,
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.25)",
                color: "#EF4444",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {deactivating ? "Processando..." : "Desativar Conta"}
            </button>
          )}
          <button type="button" onClick={onClose} style={drawerBtn.ghost}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} style={drawerBtn.primary(saving)}>
            {saving ? "Salvando..." : account ? "Salvar Alterações" : "Salvar Conta"}
          </button>
        </>
      }
    >
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Nome da Conta *</label>
            <input
              type="text"
              required
              placeholder="Ex: Banco Inter PJ / Itaú Empresas..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: account ? "1fr" : "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Tipo</label>
              <Select
                value={type}
                onChange={(e) => setType(e.target.value as "checking" | "credit_card" | "investment" | "cash")}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none" }}
              >
                <option value="checking">Conta Corrente</option>
                <option value="cash">Caixa Reserva</option>
                <option value="investment">Investimentos</option>
                <option value="credit_card">Cartão Corporativo</option>
              </Select>
            </div>
            {!account && (
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
            )}
          </div>

          {account && (
            <div style={{ background: "rgba(139,92,246,0.08)", border: "1px solid rgba(139,92,246,0.22)", borderRadius: 8, padding: "10px 12px", display: "flex", gap: 8, alignItems: "flex-start" }}>
              <ShieldCheck style={{ width: 16, height: 16, color: "#A78BFA", flexShrink: 0, marginTop: 2 }} />
              <div style={{ fontSize: 11, color: "#ccc", lineHeight: 1.4 }}>
                <strong>Saldo Registrado Atual: {formatBRL(account.currentBalance)}</strong>
                <br />
                Por integridade e governança contábil, o saldo é apurado exclusivamente através dos lançamentos de receitas e despesas no Livro Caixa, impedindo manipulações indevidas.
              </div>
            </div>
          )}

    </Drawer>
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
    <Drawer
      title="Novo Teto Orçamentário"
      icon={<Target size={18} />}
      onClose={onClose}
      onSubmit={handleSubmit}
      width={460}
      footer={
        <>
          <button type="button" onClick={onClose} style={drawerBtn.ghost}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} style={drawerBtn.primary(saving)}>
            {saving ? "Salvando..." : "Salvar Teto"}
          </button>
        </>
      }
    >
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
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: CLIENT
// ─────────────────────────────────────────────────────────────────────────────

function ClientModal({
  client,
  initialProjectId,
  onClose,
  onSaved,
  onDelete,
  onReactivate,
}: {
  client?: Client | null;
  initialProjectId?: string;
  onClose: () => void;
  onSaved: () => void;
  onDelete?: (client: Client) => Promise<void> | void;
  onReactivate?: (client: Client) => Promise<void> | void;
}) {
  const { projects } = useContext(AppContext);
  const [name, setName] = useState(client?.name ?? "");
  const [document, setDocument] = useState(client?.document ?? "");
  const [email, setEmail] = useState(client?.email ?? "");
  const [phone, setPhone] = useState(client?.phone ?? "");
  const [notes, setNotes] = useState(client?.notes ?? "");
  const [whatsappOptIn, setWhatsappOptIn] = useState(client?.whatsappOptIn === true);
  const [projectId, setProjectId] = useState(client?.projectId || initialProjectId || "");

  useEffect(() => {
    if (initialProjectId && !client?.projectId) {
      setProjectId(initialProjectId);
    }
  }, [initialProjectId, client?.projectId]);

  // Contrato
  const [contractOpen, setContractOpen] = useState(false);
  const [contract, setContract] = useState<ClientContract | null>(null);
  const [loadingContract, setLoadingContract] = useState(false);
  const [monthlyAmountInput, setMonthlyAmountInput] = useState("");
  const [billingDay, setBillingDay] = useState("1");
  const [billingType, setBillingType] = useState<"recurring" | "installments">("recurring");
  const [totalInstallments, setTotalInstallments] = useState("");
  const [contractStartDate, setContractStartDate] = useState("");
  const [contractEndDate, setContractEndDate] = useState("");
  const [contractNotes, setContractNotes] = useState("");
  const [savingContract, setSavingContract] = useState(false);
  const [generatingInstallments, setGeneratingInstallments] = useState(false);
  const [generateMonths, setGenerateMonths] = useState("3");

  const [saving, setSaving] = useState(false);
  const [processingAction, setProcessingAction] = useState(false);

  const handleCancelOrDelete = async () => {
    if (!client || !onDelete) return;
    try {
      setProcessingAction(true);
      await onDelete(client);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("teltech:client-saved", { detail: { projectId: client.projectId } }));
      }
      onClose();
    } catch {
      // toast already handled
    } finally {
      setProcessingAction(false);
    }
  };

  const handleReactivate = async () => {
    if (!client || !onReactivate) return;
    try {
      setProcessingAction(true);
      await onReactivate(client);
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("teltech:client-saved", { detail: { projectId: client.projectId } }));
      }
      onClose();
    } catch {
      // toast already handled
    } finally {
      setProcessingAction(false);
    }
  };

  // Carrega contrato existente ao abrir (se editando cliente)
  useEffect(() => {
    if (client?.id && contractOpen) {
      setLoadingContract(true);
      API.get(`/finance/clients/${client.id}/contract`)
        .then(res => {
          if (res?.contract) {
            const c: ClientContract = res.contract;
            setContract(c);
            setMonthlyAmountInput((c.monthlyAmount / 100).toFixed(2).replace(".", ","));
            setBillingDay(String(c.billingDay));
            setBillingType(c.totalInstallments ? "installments" : "recurring");
            setTotalInstallments(c.totalInstallments ? String(c.totalInstallments) : "");
            setContractStartDate(c.contractStartDate ? c.contractStartDate.substring(0, 10) : "");
            setContractEndDate(c.contractEndDate ? c.contractEndDate.substring(0, 10) : "");
            setContractNotes(c.notes ?? "");
          }
        })
        .catch(() => {})
        .finally(() => setLoadingContract(false));
    }
  }, [client?.id, contractOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        document: document.trim() || null,
        email: email.trim() || null,
        phone: phone.trim() || null,
        notes: notes.trim() || null,
        whatsappOptIn,
        projectId: projectId || null,
      };
      if (client?.id) {
        await API.put(`/finance/clients/${client.id}`, payload);
      } else {
        await API.post("/finance/clients", payload);
      }
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("teltech:client-saved", { detail: { projectId: payload.projectId } }));
      }
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar cliente.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveContract = async () => {
    if (!client?.id) { toast.error("Salve o cliente primeiro."); return; }
    if (!projectId) { toast.error("Selecione um Projeto antes de configurar o contrato."); return; }
    const amountCents = Math.round(parseFloat(monthlyAmountInput.replace(",", ".").replace(/[^\d.]/g, "")) * 100);
    if (isNaN(amountCents) || amountCents < 0) { toast.error("Valor inválido."); return; }
    try {
      setSavingContract(true);
      await API.put(`/finance/clients/${client.id}/contract`, {
        projectId,
        monthlyAmount: amountCents,
        billingDay: parseInt(billingDay),
        billingCycleMonths: 1,
        contractStartDate: contractStartDate || null,
        contractEndDate: contractEndDate || null,
        totalInstallments: billingType === "installments" && totalInstallments ? parseInt(totalInstallments) : null,
        notes: contractNotes.trim() || null,
      });
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("teltech:client-saved", { detail: { projectId } }));
      }
      toast.success("Contrato salvo com sucesso!");
      onSaved();
    } catch (err) {
      console.error(err);
      toast.error("Erro ao salvar contrato.");
    } finally {
      setSavingContract(false);
    }
  };

  const handleGenerateInstallments = async () => {
    if (!client?.id) { toast.error("Salve o cliente primeiro."); return; }
    const months = parseInt(generateMonths);
    if (isNaN(months) || months < 1 || months > 24) { toast.error("Informe entre 1 e 24 meses."); return; }
    try {
      setGeneratingInstallments(true);
      const res = await API.post(`/finance/clients/${client.id}/contract/generate-installments`, { months });
      toast.success(`${res.count} fatura(s) gerada(s) com sucesso!`);
    } catch (err) {
      console.error(err);
      toast.error("Erro ao gerar faturas.");
    } finally {
      setGeneratingInstallments(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box",
  };

  return (
    <Drawer
      title={
        <span style={{ display: "inline-flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {client ? "Editar Cliente" : "Novo Cliente Corporativo"}
          {client?.photoUrl && <ClientAvatar name={client.name} photoUrl={client.photoUrl} size={32} />}
          {client && (
            <span style={{
              fontSize: 11,
              padding: "3px 8px",
              borderRadius: 6,
              fontWeight: 700,
              background: client.status === "inactive" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
              color: client.status === "inactive" ? "#EF4444" : "#10B981",
              border: client.status === "inactive" ? "1px solid rgba(239,68,68,0.3)" : "1px solid rgba(16,185,129,0.3)",
            }}>
              {client.status === "inactive" ? "Contrato Cancelado / Inativo" : "Contrato Ativo"}
            </span>
          )}
        </span>
      }
      icon={<Building2 size={18} />}
      onClose={onClose}
      width={560}
      footer={
        <>
          {client && onDelete && (
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginRight: "auto" }}>
              {client.status === "inactive" && onReactivate && (
                <button
                  type="button"
                  disabled={saving || processingAction}
                  onClick={handleReactivate}
                  style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", color: "#10B981", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                >
                  <RefreshCw size={13} /> Reativar Contrato
                </button>
              )}
              <button
                type="button"
                disabled={saving || processingAction}
                onClick={handleCancelOrDelete}
                style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
              >
                <Trash2 size={13} /> {client.status === "inactive" ? "Excluir Definitivo" : "Cancelar Contrato / Excluir"}
              </button>
            </div>
          )}
          <button type="button" onClick={onClose} style={drawerBtn.ghost}>
            Cancelar
          </button>
          <button type="submit" form="client-form" disabled={saving || processingAction} style={drawerBtn.primary(saving || processingAction)}>
            {saving ? "Salvando..." : client ? "Salvar Alterações" : "Salvar Cliente"}
          </button>
        </>
      }
    >
        <form id="client-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Nome */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Razão Social / Nome *</label>
            <input type="text" required placeholder="Ex: StrataScratch Inc..." value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
          </div>

          {/* Projeto */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}><FolderOpen size={12} /> Produto / Projeto Contratado</span>
            </label>
            <Select
              value={projectId}
              onChange={e => setProjectId(e.target.value)}
              style={{ ...inputStyle, appearance: "none", cursor: "pointer" }}
            >
              <option value="">— Sem vínculo —</option>
              {projects.map((p: any) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>

          {/* CNPJ + Telefone */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>CNPJ / CPF</label>
              <input type="text" placeholder="00.000.000/0001-00" value={document} onChange={(e) => setDocument(e.target.value)} style={inputStyle} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>WhatsApp / Telefone</label>
              <input type="text" placeholder="(11) 99999-9999" value={phone} onChange={(e) => setPhone(e.target.value)} style={inputStyle} />
            </div>
          </div>

          {/* E-mail */}
          <div>
            <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>E-mail Financeiro</label>
            <input type="email" placeholder="financeiro@empresa.com" value={email} onChange={(e) => setEmail(e.target.value)} style={inputStyle} />
          </div>

          {/* WhatsApp opt-in */}
          <label style={{ display: "flex", alignItems: "flex-start", gap: 10, padding: 12, borderRadius: 10, border: "1px solid hsl(240 4% 20%)", background: "hsl(240 3% 7% / 0.55)", cursor: "pointer" }}>
            <Checkbox  checked={whatsappOptIn} onChange={(e) => setWhatsappOptIn(e.target.checked)} style={{ marginTop: 3, accentColor: "hsl(265 85% 62%)" }} />
            <span style={{ display: "flex", flexDirection: "column", gap: 4 }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: "#fafafa" }}>Cliente autorizou cobranças pelo WhatsApp</span>
              <span style={{ fontSize: 11, lineHeight: 1.5, color: "hsl(240 5% 65%)" }}>Marque apenas após confirmar a autorização com o cliente.</span>
            </span>
          </label>

        </form>

        {/* ── Seção de Contrato (só quando editando) ── */}
        {client?.id && (
          <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14 }}>
            <button
              type="button"
              onClick={() => setContractOpen(!contractOpen)}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                background: contractOpen ? "rgba(139,92,246,0.08)" : "transparent",
                border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, padding: "10px 14px",
                cursor: "pointer", color: "#A78BFA", fontSize: 13, fontWeight: 700,
              }}
            >
              <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
                <Coins size={14} /> Configurar Contrato / Parcelas
              </span>
              <ChevronDown size={14} style={{ transform: contractOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "0.2s" }} />
            </button>

            {contractOpen && (
              <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
                {loadingContract ? (
                  <div style={{ fontSize: 12, color: "#666", textAlign: "center", padding: 12 }}>Carregando contrato...</div>
                ) : (
                  <>
                    {/* Valor Mensal */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Valor (R\$) *</label>
                        <input
                          type="text"
                          placeholder="0,00"
                          value={monthlyAmountInput}
                          onChange={e => setMonthlyAmountInput(e.target.value)}
                          style={{ width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Dia de Vencimento</label>
                        <input
                          type="number"
                          min="1" max="28"
                          placeholder="1-28"
                          value={billingDay}
                          onChange={e => setBillingDay(e.target.value)}
                          style={{ width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Tipo */}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 6 }}>Tipo de Cobrança</label>
                      <div style={{ display: "flex", gap: 8 }}>
                        {(["recurring", "installments"] as const).map(t => (
                          <button
                            key={t}
                            type="button"
                            onClick={() => setBillingType(t)}
                            style={{
                              flex: 1, padding: "8px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                              border: billingType === t ? "1px solid #A78BFA" : "1px solid rgba(255,255,255,0.1)",
                              background: billingType === t ? "rgba(139,92,246,0.15)" : "transparent",
                              color: billingType === t ? "#A78BFA" : "#777",
                            }}
                          >
                            {t === "recurring" ? (
                              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Repeat2 size={12} /> Recorrente</span>
                            ) : (
                              <span style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 5 }}><Receipt size={12} /> Parcelado</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    {billingType === "installments" && (
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Total de Parcelas</label>
                        <input
                          type="number" min="1" placeholder="Ex: 12"
                          value={totalInstallments}
                          onChange={e => setTotalInstallments(e.target.value)}
                          style={{ width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    )}

                    {/* Datas */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Início do Contrato</label>
                        <DateInput  value={contractStartDate} onChange={e => setContractStartDate(e.target.value)}
                          style={{ width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Fim do Contrato</label>
                        <DateInput  value={contractEndDate} onChange={e => setContractEndDate(e.target.value)}
                          style={{ width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
                        />
                      </div>
                    </div>

                    {/* Notas do contrato */}
                    <div>
                      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>Observações do Contrato</label>
                      <textarea
                        placeholder="Condições especiais, descontos, multas..."
                        value={contractNotes}
                        onChange={e => setContractNotes(e.target.value)}
                        rows={2}
                        style={{ width: "100%", background: "#0e0e11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "9px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
                      />
                    </div>

                    {/* Status do contrato se já existe */}
                    {contract && (
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 12px", background: "rgba(255,255,255,0.03)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)" }}>
                        <span style={{ fontSize: 12, color: "#888" }}>Status do Contrato:</span>
                        <span style={{
                          fontSize: 11,
                          fontWeight: 700,
                          padding: "2px 8px",
                          borderRadius: 6,
                          background: contract.status === "cancelled" ? "rgba(239,68,68,0.15)" : "rgba(16,185,129,0.15)",
                          color: contract.status === "cancelled" ? "#EF4444" : "#10B981",
                        }}>
                          {contract.status === "cancelled" ? "Cancelado" : "Ativo"}
                        </span>
                      </div>
                    )}

                    {/* Salvar contrato */}
                    <button
                      type="button"
                      onClick={handleSaveContract}
                      disabled={savingContract}
                      style={{ padding: "9px 16px", borderRadius: 8, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.35)", color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      {savingContract ? "Salvando Contrato..." : "Salvar Contrato"}
                    </button>

                    {/* Gerar Faturas Automáticas */}
                    {contract && (
                      <div style={{ background: "rgba(16,185,129,0.07)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "12px 14px", display: "flex", flexDirection: "column", gap: 10 }}>
                        <span style={{ fontSize: 12, fontWeight: 700, color: "#10B981", display: "flex", alignItems: "center", gap: 6 }}>
                          <Sparkles size={13} /> Gerar Faturas Automáticas
                        </span>
                        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                          <input
                            type="number" min="1" max="24"
                            value={generateMonths}
                            onChange={e => setGenerateMonths(e.target.value)}
                            style={{ width: 60, background: "#0e0e11", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 6, padding: "7px 8px", color: "#fff", fontSize: 13, outline: "none", textAlign: "center" }}
                          />
                          <span style={{ fontSize: 12, color: "#666" }}>meses à frente</span>
                          <button
                            type="button"
                            onClick={handleGenerateInstallments}
                            disabled={generatingInstallments}
                            style={{ flex: 1, padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                          >
                            {generatingInstallments ? "Gerando..." : "Gerar Faturas"}
                          </button>
                        </div>
                        <span style={{ fontSize: 11, color: "#555" }}>
                          Cria lançamentos de entrada (pendentes) no Livro Caixa para os próximos meses.
                        </span>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        )}
    </Drawer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MODAL: CONFIGURAÇÃO DA RESERVA DE EMERGÊNCIA
// ─────────────────────────────────────────────────────────────────────────────

function ReserveSettingsModal({
  currentTarget,
  onClose,
  onSaved,
}: {
  currentTarget: number;
  onClose: () => void;
  onSaved: (newTargetCents: number) => void;
}) {
  const [val, setVal] = useState(
    (currentTarget / 100).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  );
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = parseFloat(val.replace(/\./g, "").replace(",", "."));
    if (isNaN(cleanNum) || cleanNum < 0) {
      toast.error("Informe um valor válido para a meta de reserva.");
      return;
    }
    const targetCents = Math.round(cleanNum * 100);
    try {
      setSaving(true);
      await API.put("/finance/settings", {
        emergencyReserveTarget: targetCents,
      });
      toast.success("Meta de reserva atualizada com sucesso!");
      onSaved(targetCents);
    } catch (err: any) {
      console.error(err);
      toast.error(err?.message || "Erro ao salvar meta de reserva.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title="Meta da Reserva de Emergência"
      icon={<Wallet size={18} />}
      onClose={onClose}
      onSubmit={handleSubmit}
      width={420}
      footer={
        <>
          <button type="button" onClick={onClose} style={drawerBtn.ghost}>
            Cancelar
          </button>
          <button type="submit" disabled={saving} style={drawerBtn.primary(saving)}>
            {saving ? "Salvando..." : "Salvar Meta"}
          </button>
        </>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        <p style={{ fontSize: 13, color: "#a1a1aa", margin: 0, lineHeight: 1.5 }}>
          Defina o patamar de segurança de caixa da Teltech. O indicador <strong>Reserva Alerta</strong> só será disparado quando o caixa consolidado cair abaixo desta meta.
        </p>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 6 }}>
            Meta da Reserva (R$) *
          </label>
          <div style={{ position: "relative" }}>
            <span style={{ position: "absolute", left: 12, top: 11, color: "#71717a", fontSize: 14, fontWeight: 600 }}>
              R$
            </span>
            <input
              type="text"
              required
              autoFocus
              value={val}
              onChange={(e) => setVal(e.target.value)}
              placeholder="0,00"
              style={{
                width: "100%",
                background: "#111113",
                border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 8,
                padding: "10px 12px 10px 38px",
                color: "#fff",
                fontSize: 15,
                fontWeight: 700,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>
        </div>

        <div>
          <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: "#71717a", marginBottom: 8 }}>
            Atalhos rápidos:
          </label>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            {[
              { label: "R$ 0 (Sem reserva)", value: 0 },
              { label: "R$ 2.000", value: 2000 },
              { label: "R$ 5.000", value: 5000 },
              { label: "R$ 10.000", value: 10000 },
              { label: "R$ 20.000", value: 20000 },
            ].map((preset) => (
              <button
                key={preset.value}
                type="button"
                onClick={() =>
                  setVal(preset.value.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 }))
                }
                style={{
                  background: "rgba(255,255,255,0.05)",
                  border: "1px solid rgba(255,255,255,0.1)",
                  borderRadius: 6,
                  padding: "4px 8px",
                  color: "#d4d4d8",
                  fontSize: 11,
                  fontWeight: 500,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                  e.currentTarget.style.color = "#fff";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = "rgba(255,255,255,0.05)";
                  e.currentTarget.style.color = "#d4d4d8";
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Drawer>
  );
}

