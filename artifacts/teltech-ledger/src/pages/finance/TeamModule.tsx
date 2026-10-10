import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Users,
  Trophy,
  Target,
  Flame,
  Plus,
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
  Award,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  CreditCard,
  Edit2,
  Trash2,
  RefreshCw,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Check,
  X,
  Send,
  Zap,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "../../lib/api";
import { Drawer, Select, DateInput, drawerBtn, confirmDialog } from "../../components/finance-ui";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export type TeamRole = "pos_venda" | "vendedor" | "hunter" | "personnalite" | "custom";
export type CommissionType = "first_installment" | "project_percentage" | "both" | "none";

export interface TeamMember {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  role: TeamRole;
  roleTitle: string;
  baseSalary: number; // em centavos
  commissionType: CommissionType;
  projectPercentage: number; // basis points (2500 = 25%)
  targetClients: number;
  targetBonus: number; // em centavos
  careerLevel: number;
  consecutiveTargetMonths: number;
  pixKey?: string | null;
  status: "active" | "inactive";
  notes?: string | null;
}

export interface SaleDetail {
  saleId: string;
  title: string;
  clientName: string;
  projectName?: string | null;
  totalAmount: number;
  firstInstallmentAmount: number;
  createdAt: string;
}

export interface MemberPerformance {
  member: TeamMember;
  metrics: {
    clientsClosedCount: number;
    targetClients: number;
    targetAchieved: boolean;
    progressPercent: number;
    missingClients: number;
    careerLevel: number;
    consecutiveMonths: number;
    salesDetails: SaleDetail[];
    hunterSalesCount: number;
  };
  financials: {
    baseSalary: number;
    firstInstallmentCommission: number;
    projectCommission: number;
    bonusEarned: number;
    bonusAtRisk: number;
    totalPayable: number;
    hasPaidOrPendingTx: boolean;
    txId: string | null;
    txStatus: string | null;
  };
}

export interface PerformanceSummary {
  totalFixedSalaries: number;
  totalFirstInstallmentCommissions: number;
  totalProjectCommissions: number;
  totalTargetBonusesUnlocked: number;
  totalTargetBonusesAtRisk: number;
  totalRealizedPayroll: number;
  totalMaxProjectedPayroll: number;
  totalClientsClosed: number;
  activeMembersCount: number;
  membersHittingTargetCount: number;
  currentCash?: number;
  cashAfterMaxPayroll?: number;
  cashCoverageRatio?: number | null;
  cashCommitmentPercent?: number;
  accountsBreakdown?: Array<{
    id: string;
    name: string;
    type: string;
    color: string;
    currentBalance: number;
  }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const brl = (cents?: number | null) =>
  (typeof cents === "number" && !isNaN(cents) ? cents / 100 : 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });

function parseMoney(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned || "0");
  return isNaN(n) ? 0 : Math.round(n * 100);
}

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

const ROLE_BADGES: Record<TeamRole, { label: string; color: string; bg: string }> = {
  pos_venda: { label: "Pós-Venda / CS", color: "#3B82F6", bg: "rgba(59,130,246,0.15)" },
  vendedor: { label: "Closer / Vendedor", color: "#8B5CF6", bg: "rgba(139,92,246,0.15)" },
  hunter: { label: "Hunter / SDR", color: "#EC4899", bg: "rgba(236,72,153,0.15)" },
  personnalite: { label: "Personnalité (25%)", color: "#F59E0B", bg: "rgba(245,158,11,0.15)" },
  custom: { label: "Especialista", color: "#10B981", bg: "rgba(16,185,129,0.15)" },
};

const MONTH_NAMES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

// ─── Componente Principal ─────────────────────────────────────────────────────

export function TeamModule({
  onGoToTransactions,
  currentCash: propCurrentCash,
}: {
  onGoToTransactions?: () => void;
  currentCash?: number;
}) {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [activeSubTab, setActiveSubTab] = useState<"tracker" | "payroll" | "members">("tracker");

  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<PerformanceSummary | null>(null);
  const [performance, setPerformance] = useState<MemberPerformance[]>([]);
  const [expandedMemberIds, setExpandedMemberIds] = useState<string[]>([]);

  // Modal Colaborador
  const [memberModalOpen, setMemberModalOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  // Modal Fechamento Folha
  const [closingPayroll, setClosingPayroll] = useState(false);
  const [payrollModalOpen, setPayrollModalOpen] = useState(false);
  const [showCashBreakdown, setShowCashBreakdown] = useState(false);
  const [payrollDueDate, setPayrollDueDate] = useState(() => {
    const d = new Date(selectedYear, selectedMonth, 5);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-05`;
  });
  const [autoApprovePayroll, setAutoApprovePayroll] = useState(true);

  // Fetch de dados
  const fetchPerformance = useCallback(async () => {
    try {
      setLoading(true);
      const res = await API.get(`/finance/team/performance?month=${selectedMonth}&year=${selectedYear}`);
      if (res) {
        setSummary(res.summary);
        setPerformance(res.performance || []);
      }
    } catch (err) {
      console.error(err);
      toast.error("Erro ao carregar métricas da equipe");
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchPerformance();
  }, [fetchPerformance]);

  const toggleExpand = (id: string) => {
    setExpandedMemberIds((prev) =>
      prev.includes(id) ? prev.filter((mId) => mId !== id) : [...prev, id]
    );
  };

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear((y) => y - 1);
    } else {
      setSelectedMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear((y) => y + 1);
    } else {
      setSelectedMonth((m) => m + 1);
    }
  };

  const handleSeedDefaultTeam = async () => {
    try {
      const res = await API.post("/finance/team/seed-default", {});
      if (res?.success) {
        toast.success("Equipe padrão Teltech configurada com sucesso!");
        fetchPerformance();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao semear equipe");
    }
  };

  const handlePromote = async (member: TeamMember) => {
    const ok = await confirmDialog({
      title: `Promover ${member.name}?`,
      message: `O colaborador avançará para o Nível ${member.careerLevel + 1}. Seu bônus por meta passará para R$ ${((member.targetBonus + 40000) / 100).toFixed(2)}.`,
      confirmLabel: "Sim, Promover Nível",
    });
    if (!ok) return;

    try {
      const res = await API.post(`/finance/team/members/${member.id}/promote`, {});
      if (res?.success) {
        toast.success(res.message);
        fetchPerformance();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao promover colaborador");
    }
  };

  const handleExecuteClosePayroll = async () => {
    try {
      setClosingPayroll(true);
      const res = await API.post("/finance/team/close-payroll", {
        month: selectedMonth,
        year: selectedYear,
        paymentDueDate: payrollDueDate,
        autoApprove: autoApprovePayroll,
      });

      if (res?.success) {
        toast.success(`Folha fechada! ${res.createdTransactionsCount} lançamento(s) gerado(s) no Livro Caixa.`);
        if (res.promotedMembers?.length > 0) {
          res.promotedMembers.forEach((p: any) => {
            toast.success(`🔥 Level Up: ${p.name} bateu 3 meses seguidos e subiu para o Nível ${p.newLevel}!`);
          });
        }
        setPayrollModalOpen(false);
        fetchPerformance();
      }
    } catch (err: any) {
      toast.error(err?.message || "Erro ao fechar folha de pagamento");
    } finally {
      setClosingPayroll(false);
    }
  };

  const effectiveCash = typeof propCurrentCash === "number" ? propCurrentCash : (summary?.currentCash ?? 0);
  const maxPayroll = summary?.totalMaxProjectedPayroll ?? 0;
  const cashAfterMax = effectiveCash - maxPayroll;
  const isCashHealthy = effectiveCash >= maxPayroll;
  const coverageRatio = maxPayroll > 0 ? Number((effectiveCash / maxPayroll).toFixed(1)) : 0;
  const commitmentPercent = effectiveCash > 0 ? Math.min(100, Math.round((maxPayroll / effectiveCash) * 100)) : (maxPayroll > 0 ? 100 : 0);

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", padding: "16px 20px", gap: 20, width: "100%", boxSizing: "border-box" }}>
      {/* ─── Header & Controles de Período ─────────────────────────────────── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 14 }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <h2 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              <Users style={{ width: 20, height: 20, color: "#8B5CF6" }} />
              Equipe, Metas & Comissões
            </h2>
            <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 12, background: "rgba(139,92,246,0.15)", color: "#A78BFA", border: "1px solid rgba(139,92,246,0.3)" }}>
              Motor de Carreira & Provisão
            </span>
          </div>
          <p style={{ margin: "4px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Controle de remuneração de Pós-Venda, Vendedores (1ª parcela + bônus de 4 clientes), Hunters e Personnalité (25%).
          </p>
        </div>

        {/* Controles de Ação e Seletor de Competência */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          {/* Seletor de Mês/Ano */}
          <div style={{ display: "inline-flex", alignItems: "center", background: "#18181b", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, padding: "3px 4px" }}>
            <button
              onClick={handlePrevMonth}
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer", borderRadius: 6 }}
              title="Mês anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span style={{ padding: "0 10px", fontSize: 13, fontWeight: 700, color: "#fff", minWidth: 130, textAlign: "center" }}>
              {MONTH_NAMES[selectedMonth - 1]} {selectedYear}
            </span>
            <button
              onClick={handleNextMonth}
              style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", background: "transparent", border: "none", color: "#a1a1aa", cursor: "pointer", borderRadius: 6 }}
              title="Próximo mês"
            >
              <ChevronRight size={16} />
            </button>
          </div>

          <button
            onClick={() => { setEditingMember(null); setMemberModalOpen(true); }}
            style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}
          >
            <Plus size={14} /> Novo Colaborador
          </button>

          <button
            onClick={() => setPayrollModalOpen(true)}
            disabled={performance.length === 0}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 14px",
              borderRadius: 9,
              background: "linear-gradient(135deg, #7C5AC2, #9B6DE3)",
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: performance.length === 0 ? "not-allowed" : "pointer",
              opacity: performance.length === 0 ? 0.6 : 1,
              boxShadow: "0 4px 14px rgba(124,90,194,0.35)",
            }}
          >
            <CreditCard size={14} /> Fechar Folha & Lançar
          </button>
        </div>
      </div>

      {/* ─── Banner se Lista Vazia ─────────────────────────────────────────── */}
      {!loading && performance.length === 0 && (
        <div style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(17,17,19,0.95))", border: "1px dashed rgba(139,92,246,0.4)", borderRadius: 14, padding: "28px 24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", gap: 12 }}>
          <Sparkles size={32} style={{ color: "#8B5CF6" }} />
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
            Configure a Estrutura de Pessoal da Teltech
          </h3>
          <p style={{ margin: 0, fontSize: 13, color: "#a1a1aa", maxWidth: 540 }}>
            Você ainda não cadastrou colaboradores. Podemos iniciar com o modelo padrão da Teltech: 1 Pós-Venda (salário mínimo), Vendedores/Closers e Hunters (1ª parcela + carreira de bônus por 4 clientes) e Personnalité (25%).
          </p>
          <div style={{ display: "flex", gap: 10, marginTop: 6 }}>
            <button
              onClick={handleSeedDefaultTeam}
              style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "10px 18px", borderRadius: 9, background: "#8B5CF6", border: "none", color: "#fff", fontSize: 13, fontWeight: 700, cursor: "pointer" }}
            >
              <Zap size={14} /> Criar Equipe Padrão Teltech
            </button>
            <button
              onClick={() => { setEditingMember(null); setMemberModalOpen(true); }}
              style={{ padding: "10px 18px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer" }}
            >
              Cadastrar Manualmente
            </button>
          </div>
        </div>
      )}

      {/* ─── 4 Top Metric Cards (KPIs) ─────────────────────────────────────── */}
      {summary && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 14 }}>
          {/* Card 1: Folha Realizada */}
          <div style={{ background: "rgba(22,22,26,0.85)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#8B5CF6" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase" }}>
                Folha Realizada no Mês
              </span>
              <DollarSign size={16} style={{ color: "#8B5CF6" }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
              {brl(summary.totalRealizedPayroll)}
            </div>
            <div style={{ fontSize: 11, color: "#71717a", display: "flex", gap: 8, flexWrap: "wrap" }}>
              <span>Fixos: {brl(summary.totalFixedSalaries)}</span>
              <span>•</span>
              <span>Comissões: {brl(summary.totalFirstInstallmentCommissions + summary.totalProjectCommissions)}</span>
            </div>
          </div>

          {/* Card 2: Provisão Máxima vs. Caixa Atual */}
          <div
            style={{
              background: "rgba(22,22,26,0.85)",
              border: `1px solid ${isCashHealthy ? "rgba(245,158,11,0.22)" : "rgba(239,68,68,0.3)"}`,
              borderRadius: 12,
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: 9,
              position: "relative",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: 3,
                background: isCashHealthy ? "linear-gradient(90deg, #F59E0B, #10B981)" : "#EF4444",
              }}
            />

            {/* Cabeçalho */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase", letterSpacing: "0.4px" }}>
                Provisão Máxima vs. Caixa
              </span>
              <span
                style={{
                  fontSize: 10,
                  fontWeight: 700,
                  padding: "2px 8px",
                  borderRadius: 999,
                  background: isCashHealthy ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)",
                  color: isCashHealthy ? "#10B981" : "#EF4444",
                  border: `1px solid ${isCashHealthy ? "rgba(16,185,129,0.3)" : "rgba(239,68,68,0.3)"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                {isCashHealthy ? (
                  <>
                    <CheckCircle2 size={11} /> Cobre 100%
                  </>
                ) : (
                  <>
                    <AlertCircle size={11} /> Déficit
                  </>
                )}
              </span>
            </div>

            {/* Comparativo lado a lado: Provisão Máxima vs Caixa Atual */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, alignItems: "flex-end" }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase" }}>
                  Provisão Máxima
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: "#FBBF24", lineHeight: 1.2, marginTop: 2 }}>
                  {brl(summary.totalMaxProjectedPayroll)}
                </div>
              </div>

              <div style={{ borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: 10 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: "#a1a1aa", textTransform: "uppercase" }}>
                    Caixa Atual
                  </span>
                  {summary.accountsBreakdown && summary.accountsBreakdown.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCashBreakdown(true)}
                      style={{
                        background: "rgba(255,255,255,0.06)",
                        border: "1px solid rgba(255,255,255,0.1)",
                        borderRadius: 4,
                        padding: "1px 5px",
                        color: "#c4b5fd",
                        fontSize: 9,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                      title="Ver contas bancárias"
                    >
                      Contas
                    </button>
                  )}
                </div>
                <div style={{ fontSize: 20, fontWeight: 800, color: isCashHealthy ? "#10B981" : "#EF4444", lineHeight: 1.2, marginTop: 2 }}>
                  {brl(effectiveCash)}
                </div>
              </div>
            </div>

            {/* Termômetro de Comprometimento de Caixa */}
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#71717a", marginBottom: 3 }}>
                <span>Comprometimento do Caixa</span>
                <span style={{ fontWeight: 700, color: !isCashHealthy ? "#EF4444" : commitmentPercent > 65 ? "#F59E0B" : "#10B981" }}>
                  {effectiveCash > 0 ? `${commitmentPercent}% da liquidez` : "100% (Sem saldo)"}
                </span>
              </div>
              <div style={{ height: 5, borderRadius: 999, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
                <div
                  style={{
                    height: "100%",
                    width: `${Math.min(100, commitmentPercent)}%`,
                    background: !isCashHealthy
                      ? "linear-gradient(90deg, #F59E0B, #EF4444)"
                      : commitmentPercent > 65
                      ? "linear-gradient(90deg, #10B981, #F59E0B)"
                      : "linear-gradient(90deg, #059669, #10B981)",
                    borderRadius: 999,
                    transition: "width 0.4s ease",
                  }}
                />
              </div>
            </div>

            {/* Linha Inferior com Sobra/Déficit e Bônus em Risco */}
            <div style={{ fontSize: 11, color: "#a1a1aa", display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, borderTop: "1px solid rgba(255,255,255,0.05)" }}>
              <span>
                {isCashHealthy ? "Sobra Líquida:" : "Déficit:"}{" "}
                <strong style={{ color: isCashHealthy ? "#10B981" : "#EF4444", fontWeight: 700 }}>
                  {brl(Math.abs(cashAfterMax))}
                </strong>
              </span>
              <span style={{ fontSize: 10, color: "#71717a" }}>
                Bônus em Risco: <span style={{ color: "#F59E0B", fontWeight: 700 }}>{brl(summary.totalTargetBonusesAtRisk)}</span>
              </span>
            </div>
          </div>

          {/* Card 3: Vendas Fechadas */}
          <div style={{ background: "rgba(22,22,26,0.85)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#10B981" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase" }}>
                Novos Clientes Fechados
              </span>
              <TrendingUp size={16} style={{ color: "#10B981" }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#10B981" }}>
              {summary.totalClientsClosed} clientes
            </div>
            <div style={{ fontSize: 11, color: "#71717a" }}>
              Novos contratos no mês de {MONTH_NAMES[selectedMonth - 1]}
            </div>
          </div>

          {/* Card 4: Batedores de Meta */}
          <div style={{ background: "rgba(22,22,26,0.85)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: "16px 18px", display: "flex", flexDirection: "column", gap: 8, position: "relative", overflow: "hidden" }}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: "#EC4899" }} />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase" }}>
                Batedores de Meta (4+ Vendas)
              </span>
              <Trophy size={16} style={{ color: "#EC4899" }} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "#fff" }}>
              {summary.membersHittingTargetCount} <span style={{ fontSize: 14, color: "#71717a", fontWeight: 500 }}>/ {summary.activeMembersCount} colaboradores</span>
            </div>
            <div style={{ fontSize: 11, color: "#71717a" }}>
              Bônus Desbloqueados: <span style={{ color: "#10B981", fontWeight: 700 }}>{brl(summary.totalTargetBonusesUnlocked)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ─── Sub-Navegação de Visualizações ─────────────────────────────────── */}
      <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.08)", gap: 4 }}>
        {[
          { key: "tracker", label: "Metas & Carreira (Live Tracker)", icon: Target },
          { key: "payroll", label: "Fechamento de Folha & Livro Caixa", icon: FileText },
          { key: "members", label: "Quadro de Colaboradores", icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.key;
          return (
            <button
              key={tab.key}
              onClick={() => setActiveSubTab(tab.key as any)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "10px 16px",
                border: "none",
                background: "transparent",
                color: isActive ? "#fafafa" : "#71717a",
                fontSize: 13,
                fontWeight: isActive ? 700 : 500,
                borderBottom: isActive ? "2px solid #8B5CF6" : "2px solid transparent",
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icon size={15} style={{ color: isActive ? "#8B5CF6" : "#71717a" }} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ─── Visão 1: Live Tracker de Metas e Carreira ──────────────────────── */}
      {activeSubTab === "tracker" && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {performance.map((item) => {
            const m = item.member;
            const met = item.metrics;
            const fin = item.financials;
            const isExpanded = expandedMemberIds.includes(m.id);
            const roleBadge = ROLE_BADGES[m.role] || ROLE_BADGES.custom;

            return (
              <div
                key={m.id}
                style={{
                  background: "rgba(22,22,26,0.9)",
                  border: met.targetAchieved ? "1px solid rgba(16,185,129,0.35)" : "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 14,
                  padding: 20,
                  display: "flex",
                  flexDirection: "column",
                  gap: 16,
                  transition: "all 0.2s ease",
                }}
              >
                {/* Linha Superior: Perfil + Nível + Status da Meta */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    {/* Avatar com Gradiente */}
                    <div
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: "50%",
                        background: "linear-gradient(135deg, #7C5AC2, #9B6DE3)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: 16,
                        fontWeight: 800,
                        color: "#fff",
                        border: "2px solid rgba(255,255,255,0.1)",
                      }}
                    >
                      {m.name.slice(0, 2).toUpperCase()}
                    </div>

                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <h4 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: "#fff" }}>
                          {m.name}
                        </h4>
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: roleBadge.bg, color: roleBadge.color }}>
                          {m.roleTitle}
                        </span>
                        {/* Badge de Nível de Carreira */}
                        {m.role !== "pos_venda" && (
                          <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Trophy size={11} /> Nível {m.careerLevel} (Bônus {brl(m.targetBonus)})
                          </span>
                        )}
                      </div>

                      {/* Subtítulo com Chave Pix ou Email */}
                      <p style={{ margin: "2px 0 0", fontSize: 12, color: "#71717a" }}>
                        {m.pixKey ? `Pix: ${m.pixKey}` : m.email || "Sem dados de contato"}
                      </p>
                    </div>
                  </div>

                  {/* Proventos do Mês / Total a Receber */}
                  <div style={{ textAlign: "right", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                    <span style={{ fontSize: 11, color: "#a1a1aa", textTransform: "uppercase", fontWeight: 700 }}>
                      Total a Receber ({MONTH_NAMES[selectedMonth - 1]})
                    </span>
                    <div style={{ fontSize: 20, fontWeight: 800, color: met.targetAchieved ? "#10B981" : "#fafafa" }}>
                      {brl(fin.totalPayable)}
                    </div>
                    {fin.hasPaidOrPendingTx && (
                      <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 6px", borderRadius: 6, background: fin.txStatus === "paid" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: fin.txStatus === "paid" ? "#10B981" : "#F59E0B" }}>
                        {fin.txStatus === "paid" ? "Pago no Livro Caixa" : "Lançamento Pendente no Caixa"}
                      </span>
                    )}
                  </div>
                </div>

                {/* Barra de Progresso de Meta (para Vendedores e Hunters) */}
                {m.targetClients > 0 && (
                  <div style={{ background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 8 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: "#fff", display: "flex", alignItems: "center", gap: 6 }}>
                        <Target size={14} style={{ color: met.targetAchieved ? "#10B981" : "#8B5CF6" }} />
                        Progresso da Meta: {met.clientsClosedCount} de {met.targetClients} Clientes ({met.progressPercent}%)
                      </span>

                      {met.targetAchieved ? (
                        <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: "rgba(16,185,129,0.18)", color: "#10B981", border: "1px solid rgba(16,185,129,0.3)", display: "inline-flex", alignItems: "center", gap: 4 }}>
                          <CheckCircle2 size={12} /> Meta Batida! +{brl(fin.bonusEarned)} Desbloqueado
                        </span>
                      ) : (
                        <span style={{ fontSize: 11, fontWeight: 600, padding: "2px 8px", borderRadius: 6, background: "rgba(245,158,11,0.15)", color: "#F59E0B", border: "1px solid rgba(245,158,11,0.3)" }}>
                          Falta {met.missingClients} cliente(s) para liberar {brl(m.targetBonus)}
                        </span>
                      )}
                    </div>

                    {/* Barra Visual */}
                    <div style={{ width: "100%", height: 8, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${met.progressPercent}%`,
                          height: "100%",
                          background: met.targetAchieved
                            ? "linear-gradient(90deg, #10B981, #34D399)"
                            : "linear-gradient(90deg, #7C5AC2, #A78BFA)",
                          borderRadius: 4,
                          transition: "width 0.4s ease",
                        }}
                      />
                    </div>

                    {/* Rastreamento de Consistência (3 Meses Seguidos para Level Up) */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 4, fontSize: 11, color: "#a1a1aa" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                        <Flame size={13} style={{ color: "#F59E0B" }} />
                        Consistência de Carreira: <strong style={{ color: "#fff" }}>{met.consecutiveMonths} de 3 meses</strong> batendo a meta para subir de nível!
                      </span>

                      <button
                        onClick={() => handlePromote(m)}
                        style={{ background: "transparent", border: "none", color: "#8B5CF6", fontSize: 11, fontWeight: 700, cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                      >
                        Promover Manualmente <ArrowUpRight size={12} />
                      </button>
                    </div>
                  </div>
                )}

                {/* Grid de Proventos Discriminados */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10, background: "rgba(255,255,255,0.02)", padding: 12, borderRadius: 10, border: "1px solid rgba(255,255,255,0.04)" }}>
                  <div>
                    <span style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 700 }}>Salário Fixo / Base</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: fin.baseSalary > 0 ? "#fff" : "#52525b", marginTop: 2 }}>
                      {brl(fin.baseSalary)}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 700 }}>1ªs Parcelas (Vendas)</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: fin.firstInstallmentCommission > 0 ? "#10B981" : "#52525b", marginTop: 2 }}>
                      {brl(fin.firstInstallmentCommission)}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 700 }}>Bônus por Meta</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: fin.bonusEarned > 0 ? "#10B981" : fin.bonusAtRisk > 0 ? "#F59E0B" : "#52525b", marginTop: 2 }}>
                      {fin.bonusEarned > 0 ? `+${brl(fin.bonusEarned)}` : fin.bonusAtRisk > 0 ? `0 (Pendente ${brl(fin.bonusAtRisk)})` : "R$ 0,00"}
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: 10, color: "#71717a", textTransform: "uppercase", fontWeight: 700 }}>Comissão Projeto (25%)</span>
                    <div style={{ fontSize: 14, fontWeight: 700, color: fin.projectCommission > 0 ? "#10B981" : "#52525b", marginTop: 2 }}>
                      {brl(fin.projectCommission)}
                    </div>
                  </div>
                </div>

                {/* Vendas Fechadas no Mês (Retrátil) */}
                {met.salesDetails.length > 0 && (
                  <div>
                    <button
                      onClick={() => toggleExpand(m.id)}
                      style={{ background: "transparent", border: "none", color: "#a1a1aa", fontSize: 12, fontWeight: 600, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", padding: "4px 0" }}
                    >
                      {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                      <span>{met.salesDetails.length} venda(s) registrada(s) no mês</span>
                    </button>

                    {isExpanded && (
                      <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 6 }}>
                        {met.salesDetails.map((s) => (
                          <div
                            key={s.saleId}
                            style={{
                              background: "rgba(0,0,0,0.3)",
                              border: "1px solid rgba(255,255,255,0.05)",
                              borderRadius: 8,
                              padding: "8px 12px",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              fontSize: 12,
                            }}
                          >
                            <div>
                              <strong style={{ color: "#fff" }}>{s.clientName}</strong>
                              <span style={{ color: "#71717a", marginLeft: 8 }}>({s.title})</span>
                            </div>
                            <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                              <span style={{ color: "#a1a1aa" }}>Valor Venda: {brl(s.totalAmount)}</span>
                              <span style={{ color: "#10B981", fontWeight: 700 }}>
                                1ª Parcela (Comissão): {brl(s.firstInstallmentAmount)}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Visão 2: Fechamento de Folha & Lançamento no Livro Caixa ────────── */}
      {activeSubTab === "payroll" && (
        <div style={{ background: "rgba(22,22,26,0.9)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>
                Espelho da Folha de Pagamento — {MONTH_NAMES[selectedMonth - 1]} / {selectedYear}
              </h3>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#71717a" }}>
                Valores calculados automaticamente pelo fechamento de metas e vendas do período.
              </p>
            </div>

            <button
              onClick={() => setPayrollModalOpen(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px", borderRadius: 8, background: "#8B5CF6", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
            >
              <CreditCard size={14} /> Fechar Folha Oficial & Gerar no Caixa
            </button>
          </div>

          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "rgba(255,255,255,0.02)", borderBottom: "1px solid rgba(255,255,255,0.06)", color: "#71717a", textTransform: "uppercase", fontSize: 10, fontWeight: 700 }}>
                  <th style={{ padding: "12px 16px" }}>Colaborador</th>
                  <th style={{ padding: "12px 14px" }}>Cargo</th>
                  <th style={{ padding: "12px 14px" }}>Nível Carreira</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Salário Fixo</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>1ªs Parcelas</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Bônus Meta</th>
                  <th style={{ padding: "12px 14px", textAlign: "right" }}>Personnalité (25%)</th>
                  <th style={{ padding: "12px 16px", textAlign: "right" }}>Total a Pagar</th>
                  <th style={{ padding: "12px 16px", textAlign: "center" }}>Status Caixa</th>
                </tr>
              </thead>
              <tbody>
                {performance.map((item) => {
                  const m = item.member;
                  const fin = item.financials;
                  const met = item.metrics;

                  return (
                    <tr key={m.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <td style={{ padding: "12px 16px", fontWeight: 700, color: "#fff" }}>
                        {m.name}
                        {m.pixKey && <div style={{ fontSize: 10, color: "#71717a", fontWeight: 400 }}>Pix: {m.pixKey}</div>}
                      </td>
                      <td style={{ padding: "12px 14px", color: "#a1a1aa" }}>{m.roleTitle}</td>
                      <td style={{ padding: "12px 14px", color: "#F59E0B", fontWeight: 700 }}>
                        {m.role !== "pos_venda" ? `Nível ${m.careerLevel}` : "—"}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: "#fafafa" }}>
                        {brl(fin.baseSalary)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: fin.firstInstallmentCommission > 0 ? "#10B981" : "#52525b" }}>
                        {brl(fin.firstInstallmentCommission)}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: fin.bonusEarned > 0 ? "#10B981" : "#52525b", fontWeight: fin.bonusEarned > 0 ? 700 : 400 }}>
                        {brl(fin.bonusEarned)}
                        {met.targetAchieved && <span style={{ fontSize: 9, marginLeft: 4, color: "#10B981" }}>✓</span>}
                      </td>
                      <td style={{ padding: "12px 14px", textAlign: "right", color: fin.projectCommission > 0 ? "#10B981" : "#52525b" }}>
                        {brl(fin.projectCommission)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 800, color: "#fff", fontSize: 13 }}>
                        {brl(fin.totalPayable)}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "center" }}>
                        {fin.hasPaidOrPendingTx ? (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 8, background: fin.txStatus === "paid" ? "rgba(16,185,129,0.15)" : "rgba(245,158,11,0.15)", color: fin.txStatus === "paid" ? "#10B981" : "#F59E0B" }}>
                            {fin.txStatus === "paid" ? "Liquidado" : "Pendente"}
                          </span>
                        ) : (
                          <span style={{ fontSize: 10, color: "#71717a" }}>Aguardando Fechamento</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ─── Visão 3: Quadro de Colaboradores ───────────────────────────────── */}
      {activeSubTab === "members" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: 14 }}>
          {performance.map((item) => {
            const m = item.member;
            const roleBadge = ROLE_BADGES[m.role] || ROLE_BADGES.custom;

            return (
              <div
                key={m.id}
                style={{
                  background: "rgba(22,22,26,0.9)",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 12,
                  padding: 16,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: 12,
                }}
              >
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fff" }}>{m.name}</h4>
                      <span style={{ fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 6, background: roleBadge.bg, color: roleBadge.color, marginTop: 4, display: "inline-block" }}>
                        {m.roleTitle}
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        onClick={() => { setEditingMember(m); setMemberModalOpen(true); }}
                        style={{ padding: "4px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#a1a1aa", cursor: "pointer" }}
                        title="Editar regras do colaborador"
                      >
                        <Edit2 size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "#a1a1aa" }}>
                    <div>Salário Fixo: <strong style={{ color: "#fff" }}>{brl(m.baseSalary)}</strong></div>
                    <div>Modelo Comissão: <strong style={{ color: "#fff" }}>{m.commissionType === "first_installment" ? "1ª Parcela do Contrato" : m.commissionType === "project_percentage" ? "25% do Projeto" : m.commissionType === "none" ? "Sem comissão direta" : "Híbrido"}</strong></div>
                    {m.targetClients > 0 && (
                      <div>Meta Mensal: <strong style={{ color: "#fff" }}>{m.targetClients} clientes</strong> (Bônus: {brl(m.targetBonus)})</div>
                    )}
                    {m.pixKey && <div>Chave Pix: <strong style={{ color: "#fff" }}>{m.pixKey}</strong></div>}
                  </div>
                </div>

                <div style={{ borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 10, display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, color: "#71717a" }}>
                  <span>Nível Atual: {m.careerLevel}</span>
                  <button
                    onClick={() => handlePromote(m)}
                    style={{ background: "transparent", border: "none", color: "#8B5CF6", fontWeight: 700, cursor: "pointer" }}
                  >
                    Level Up +1
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Modal: Cadastro / Edição de Colaborador ────────────────────────── */}
      {memberModalOpen && (
        <MemberFormDrawer
          member={editingMember}
          onClose={() => { setMemberModalOpen(false); setEditingMember(null); }}
          onSaved={() => { setMemberModalOpen(false); setEditingMember(null); fetchPerformance(); }}
        />
      )}

      {/* ─── Modal: Fechamento de Folha ────────────────────────────────────── */}
      {payrollModalOpen && (
        <Drawer
          title={`Fechar Folha de Pagamento — ${MONTH_NAMES[selectedMonth - 1]} ${selectedYear}`}
          icon={<CreditCard size={18} />}
          onClose={() => setPayrollModalOpen(false)}
          width={520}
          footer={
            <>
              <button onClick={() => setPayrollModalOpen(false)} style={drawerBtn.ghost}>
                Cancelar
              </button>
              <button
                onClick={handleExecuteClosePayroll}
                disabled={closingPayroll}
                style={drawerBtn.primary(closingPayroll)}
              >
                {closingPayroll ? "Gerando Lançamentos..." : "Confirmar e Lançar no Caixa"}
              </button>
            </>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div style={{ background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 10, padding: 14 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#A78BFA", display: "flex", alignItems: "center", gap: 6 }}>
                <Sparkles size={14} /> Fechamento Automatizado Teltech
              </span>
              <p style={{ margin: "6px 0 0", fontSize: 12, color: "#ccc" }}>
                Serão geradas saídas (`outflow`) no Livro Caixa para os colaboradores com valores apurados nesta competência.
              </p>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 6 }}>
                Data de Vencimento do Pagamento
              </label>
              <input
                type="date"
                value={payrollDueDate}
                onChange={(e) => setPayrollDueDate(e.target.value)}
                style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 8, padding: "10px", color: "#fff", fontSize: 13, outline: "none", boxSizing: "border-box" }}
              />
              <span style={{ fontSize: 11, color: "#666", marginTop: 4, display: "block" }}>
                Data agendada para pagamento (padrão: 5º dia útil do mês seguinte).
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "10px 0" }}>
              <input
                type="checkbox"
                id="auto-approve-cb"
                checked={autoApprovePayroll}
                onChange={(e) => setAutoApprovePayroll(e.target.checked)}
                style={{ width: 16, height: 16, accentColor: "#8B5CF6", cursor: "pointer" }}
              />
              <label htmlFor="auto-approve-cb" style={{ fontSize: 12, color: "#fafafa", cursor: "pointer" }}>
                Aprovar automaticamente os lançamentos na alçada de governança
              </label>
            </div>

            <div style={{ background: "rgba(0,0,0,0.25)", borderRadius: 8, padding: 12, fontSize: 12, color: "#a1a1aa", display: "flex", flexDirection: "column", gap: 6 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Total de Proventos a Lançar:</span>
                <strong style={{ color: "#10B981" }}>{summary ? brl(summary.totalRealizedPayroll) : "R$ 0,00"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Caixa Atual em Contas:</span>
                <strong style={{ color: "#38BDF8" }}>{brl(effectiveCash)}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 4 }}>
                <span>Saldo Pós-Liquidação da Folha:</span>
                <strong style={{ color: effectiveCash >= (summary?.totalRealizedPayroll ?? 0) ? "#10B981" : "#EF4444" }}>
                  {brl(effectiveCash - (summary?.totalRealizedPayroll ?? 0))}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Colaboradores com Pagamento:</span>
                <strong style={{ color: "#fff" }}>{performance.filter((p) => p.financials.totalPayable > 0).length} pessoas</strong>
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {/* ─── Modal: Detalhamento de Contas Bancárias & Liquidez ────────────── */}
      {showCashBreakdown && (
        <Drawer
          title="Detalhamento de Caixa vs. Provisão Máxima"
          icon={<Wallet size={18} />}
          onClose={() => setShowCashBreakdown(false)}
          width={460}
          footer={
            <button
              type="button"
              onClick={() => setShowCashBreakdown(false)}
              style={drawerBtn.ghost}
            >
              Fechar
            </button>
          }
        >
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <p style={{ fontSize: 13, color: "#a1a1aa", margin: 0, lineHeight: 1.5 }}>
              Comparativo consolidado entre o saldo disponível nas contas ativas e o teto máximo de custos da equipe se todos baterem suas metas.
            </p>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div style={{ background: "rgba(245,158,11,0.08)", border: "1px solid rgba(245,158,11,0.25)", borderRadius: 10, padding: "12px 14px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#F59E0B", textTransform: "uppercase" }}>Teto da Folha</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: "#FBBF24", marginTop: 4 }}>
                  {brl(summary?.totalMaxProjectedPayroll)}
                </div>
                <span style={{ fontSize: 10, color: "#a1a1aa", marginTop: 2, display: "block" }}>
                  Fixos + Comissões + Bônus
                </span>
              </div>

              <div style={{ background: isCashHealthy ? "rgba(16,185,129,0.08)" : "rgba(239,68,68,0.08)", border: `1px solid ${isCashHealthy ? "rgba(16,185,129,0.25)" : "rgba(239,68,68,0.25)"}`, borderRadius: 10, padding: "12px 14px" }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: isCashHealthy ? "#10B981" : "#EF4444", textTransform: "uppercase" }}>Caixa Consolidado</span>
                <div style={{ fontSize: 18, fontWeight: 800, color: isCashHealthy ? "#10B981" : "#EF4444", marginTop: 4 }}>
                  {brl(effectiveCash)}
                </div>
                <span style={{ fontSize: 10, color: "#a1a1aa", marginTop: 2, display: "block" }}>
                  {isCashHealthy ? `Sobra: ${brl(cashAfterMax)}` : `Déficit: ${brl(Math.abs(cashAfterMax))}`}
                </span>
              </div>
            </div>

            <div>
              <h4 style={{ fontSize: 12, fontWeight: 700, color: "#888", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.5px" }}>
                Saldos por Conta Ativa
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {summary?.accountsBreakdown && summary.accountsBreakdown.length > 0 ? (
                  summary.accountsBreakdown.map((acc) => (
                    <div
                      key={acc.id}
                      style={{
                        background: "rgba(0,0,0,0.3)",
                        border: "1px solid rgba(255,255,255,0.06)",
                        borderRadius: 8,
                        padding: "10px 14px",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <div
                          style={{
                            width: 10,
                            height: 10,
                            borderRadius: "50%",
                            background: acc.color || "#7C5AC2",
                          }}
                        />
                        <div>
                          <strong style={{ fontSize: 13, color: "#fff" }}>{acc.name}</strong>
                          <span style={{ fontSize: 10, color: "#71717a", marginLeft: 6, textTransform: "uppercase" }}>
                            {acc.type === "checking" ? "Conta Corrente" : acc.type === "investment" ? "Investimento" : acc.type === "cash" ? "Caixa Físico" : acc.type}
                          </span>
                        </div>
                      </div>
                      <span style={{ fontSize: 13, fontWeight: 700, color: acc.currentBalance >= 0 ? "#fff" : "#EF4444" }}>
                        {brl(acc.currentBalance)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p style={{ fontSize: 12, color: "#71717a", margin: 0 }}>
                    Nenhuma conta bancária ativa cadastrada.
                  </p>
                )}
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </div>
  );
}

// ─── Sub-Componente: Drawer de Cadastro / Edição ───────────────────────────────

function MemberFormDrawer({
  member,
  onClose,
  onSaved,
}: {
  member: TeamMember | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(member?.name ?? "");
  const [email, setEmail] = useState(member?.email ?? "");
  const [phone, setPhone] = useState(member?.phone ?? "");
  const [role, setRole] = useState<TeamRole>(member?.role ?? "vendedor");
  const [roleTitle, setRoleTitle] = useState(member?.roleTitle ?? "Vendedor / Closer");
  const [baseSalaryInput, setBaseSalaryInput] = useState(member ? centsToInput(member.baseSalary) : "0,00");
  const [commissionType, setCommissionType] = useState<CommissionType>(member?.commissionType ?? "first_installment");
  const [projectPercentageInput, setProjectPercentageInput] = useState(member ? String(member.projectPercentage / 100) : "25");
  const [targetClients, setTargetClients] = useState(member ? String(member.targetClients) : "4");
  const [targetBonusInput, setTargetBonusInput] = useState(member ? centsToInput(member.targetBonus) : "800,00");
  const [careerLevel, setCareerLevel] = useState(member ? String(member.careerLevel) : "1");
  const [pixKey, setPixKey] = useState(member?.pixKey ?? "");
  const [notes, setNotes] = useState(member?.notes ?? "");
  const [saving, setSaving] = useState(false);

  // Auto-ajuste de regras ao mudar de cargo (presets da Teltech)
  const handleRoleChange = (newRole: TeamRole) => {
    setRole(newRole);
    if (newRole === "pos_venda") {
      setRoleTitle("Pós-Venda / Customer Success");
      setBaseSalaryInput("1518,00"); // 1 Salário Mínimo nacional
      setCommissionType("none");
      setTargetClients("0");
      setTargetBonusInput("0,00");
    } else if (newRole === "vendedor") {
      setRoleTitle("Executivo de Vendas / Closer");
      setBaseSalaryInput("0,00");
      setCommissionType("first_installment");
      setTargetClients("4");
      setTargetBonusInput("800,00");
    } else if (newRole === "hunter") {
      setRoleTitle("Hunter / SDR Prospecção");
      setBaseSalaryInput("0,00");
      setCommissionType("first_installment");
      setTargetClients("4");
      setTargetBonusInput("800,00");
    } else if (newRole === "personnalite") {
      setRoleTitle("Executivo Personnalité");
      setBaseSalaryInput("0,00");
      setCommissionType("project_percentage");
      setProjectPercentageInput("25");
      setTargetClients("0");
      setTargetBonusInput("0,00");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Nome é obrigatório");
      return;
    }

    try {
      setSaving(true);
      const payload = {
        name: name.trim(),
        email: email.trim() || null,
        phone: phone.trim() || null,
        role,
        roleTitle: roleTitle.trim() || "Colaborador",
        baseSalary: parseMoney(baseSalaryInput),
        commissionType,
        projectPercentage: Math.round(parseFloat(projectPercentageInput || "0") * 100),
        targetClients: parseInt(targetClients) || 0,
        targetBonus: parseMoney(targetBonusInput),
        careerLevel: parseInt(careerLevel) || 1,
        pixKey: pixKey.trim() || null,
        notes: notes.trim() || null,
      };

      if (member?.id) {
        await API.put(`/finance/team/members/${member.id}`, payload);
        toast.success("Colaborador atualizado com sucesso!");
      } else {
        await API.post("/finance/team/members", payload);
        toast.success("Colaborador cadastrado com sucesso!");
      }

      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar colaborador");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    width: "100%",
    background: "#111113",
    border: "1px solid rgba(255,255,255,0.12)",
    borderRadius: 8,
    padding: "10px",
    color: "#fff",
    fontSize: 13,
    outline: "none",
    boxSizing: "border-box",
  };

  return (
    <Drawer
      title={member ? `Editar: ${member.name}` : "Novo Colaborador"}
      icon={<Users size={18} />}
      onClose={onClose}
      width={540}
      footer={
        <>
          <button type="button" onClick={onClose} style={drawerBtn.ghost}>
            Cancelar
          </button>
          <button
            type="submit"
            form="member-form"
            disabled={saving}
            style={drawerBtn.primary(saving)}
          >
            {saving ? "Salvando..." : member ? "Salvar Alterações" : "Cadastrar Colaborador"}
          </button>
        </>
      }
    >
      <form id="member-form" onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* Cargo / Perfil Predefinido */}
        <div>
          <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 6 }}>
            Perfil / Cargo Teltech
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 6 }}>
            {[
              { role: "pos_venda" as TeamRole, label: "Pós-Venda (1 Salário Mínimo)" },
              { role: "vendedor" as TeamRole, label: "Closer / Vendedor (1ª Parcela + Bônus)" },
              { role: "hunter" as TeamRole, label: "Hunter / SDR (1ª Parcela + Bônus)" },
              { role: "personnalite" as TeamRole, label: "Personnalité (25% Projeto)" },
            ].map((p) => {
              const active = role === p.role;
              return (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => handleRoleChange(p.role)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    background: active ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.03)",
                    border: active ? "1px solid #8B5CF6" : "1px solid rgba(255,255,255,0.08)",
                    color: active ? "#fff" : "#a1a1aa",
                    fontSize: 11,
                    fontWeight: active ? 700 : 500,
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Nome & Título */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 6 }}>
              Nome Completo *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Carlos Silva"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 6 }}>
              Título do Cargo
            </label>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              style={inputStyle}
            />
          </div>
        </div>

        {/* E-mail, Telefone & Chave Pix */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 6 }}>
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="carlos@teltech.com.br"
              style={inputStyle}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 6 }}>
              Chave Pix (para Pagamento)
            </label>
            <input
              type="text"
              value={pixKey}
              onChange={(e) => setPixKey(e.target.value)}
              placeholder="CPF, CNPJ, Email ou Telefone"
              style={inputStyle}
            />
          </div>
        </div>

        {/* Regras Financeiras */}
        <div style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14, display: "flex", flexDirection: "column", gap: 12 }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#8B5CF6", textTransform: "uppercase" }}>
            Regras de Remuneração & Metas
          </span>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Salário Fixo / Base (R$)
              </label>
              <input
                type="text"
                value={baseSalaryInput}
                onChange={(e) => setBaseSalaryInput(e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 10, color: "#666" }}>1 Salário Mínimo = R$ 1.518,00</span>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Tipo de Comissão
              </label>
              <select
                value={commissionType}
                onChange={(e) => setCommissionType(e.target.value as CommissionType)}
                style={inputStyle}
              >
                <option value="first_installment">1ª Parcela do Contrato</option>
                <option value="project_percentage">% do Projeto (Personnalité)</option>
                <option value="both">Ambos (1ª Parcela + % Projeto)</option>
                <option value="none">Sem Comissão Direta (Apenas Fixo)</option>
              </select>
            </div>
          </div>

          {commissionType === "project_percentage" && (
            <div>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Percentual sobre o Projeto (%)
              </label>
              <input
                type="number"
                value={projectPercentageInput}
                onChange={(e) => setProjectPercentageInput(e.target.value)}
                style={inputStyle}
              />
            </div>
          )}

          {/* Meta Mensal de Clientes & Bônus */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Meta de Clientes / Mês
              </label>
              <input
                type="number"
                value={targetClients}
                onChange={(e) => setTargetClients(e.target.value)}
                style={inputStyle}
              />
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Bônus se Bater Meta (R$)
              </label>
              <input
                type="text"
                value={targetBonusInput}
                onChange={(e) => setTargetBonusInput(e.target.value)}
                style={inputStyle}
              />
              <span style={{ fontSize: 10, color: "#666" }}>Nível 1: R$ 800,00</span>
            </div>

            <div>
              <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
                Nível de Carreira
              </label>
              <input
                type="number"
                min="1"
                max="10"
                value={careerLevel}
                onChange={(e) => setCareerLevel(e.target.value)}
                style={inputStyle}
              />
            </div>
          </div>
        </div>

        <div>
          <label style={{ fontSize: 12, color: "#888", fontWeight: 600, display: "block", marginBottom: 4 }}>
            Observações / Acordo Contratual
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Informações contratuais, detalhes de metas ou combinações internas..."
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </div>
      </form>
    </Drawer>
  );
}
