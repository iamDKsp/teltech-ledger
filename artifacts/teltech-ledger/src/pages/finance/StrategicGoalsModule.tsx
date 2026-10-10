import { useState, useEffect, useMemo, useCallback } from "react";
import {
  Target,
  TrendingUp,
  DollarSign,
  Calendar,
  Sparkles,
  Layers,
  ArrowUpRight,
  ShieldCheck,
  Check,
  RotateCcw,
  Save,
  HelpCircle,
  Sliders,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  Store,
  Landmark,
  Crown,
  Building,
  CheckCircle2,
  Zap,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { useIsMobile } from "../../hooks/use-mobile";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface ProductPricing {
  // PDV Balcão / Frente de caixa
  pdvMonthly: number; // em reais (ex: 140)
  pdvSetup: number;   // em reais (ex: 120)
  // PDV Multi-empresa (filial/base adicional)
  pdvMultiMonthly: number; // em reais (ex: 90)
  // Shark Solução Financeira / Empréstimos (SaaS)
  sharkSaasMonthly: number; // em reais (ex: 250)
  sharkSaasSetup: number;   // em reais (ex: 500)
  // Shark Personnalité (Customizado / Exclusivo)
  sharkPersonnaliteEntry: number;   // em reais (ex: 3000)
  sharkPersonnaliteMonthly: number; // em reais (ex: 300)
}

export interface MonthGoalItem {
  monthIndex: number; // 1 to 6
  monthLabel: string; // Ex: "Mês 1 (Out/26)"
  pdvCount: number;
  pdvMultiCount: number;
  sharkSaasCount: number;
  sharkPersonnaliteCount: number;
}

export interface StrategicGoalsPlan {
  version: number;
  pricing: ProductPricing;
  months: MonthGoalItem[];
  updatedAt: string;
}

// ─── Valores Padrão Alinhados com a Realidade da Teltech ─────────────────────

export const DEFAULT_PRODUCT_PRICING: ProductPricing = {
  pdvMonthly: 140,
  pdvSetup: 120,
  pdvMultiMonthly: 90,
  sharkSaasMonthly: 250,
  sharkSaasSetup: 500,
  sharkPersonnaliteEntry: 3000,
  sharkPersonnaliteMonthly: 300,
};

// Gera os nomes dos próximos 6 meses
function getNextSixMonthsLabels(): string[] {
  const shortMonths = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"];
  const now = new Date();
  const labels: string[] = [];
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    const mName = shortMonths[d.getMonth()];
    const yShort = String(d.getFullYear()).slice(-2);
    labels.push(`Mês ${i + 1} (${mName}/${yShort})`);
  }
  return labels;
}

// Preset 1: O cenário realista gradual (pé no chão para começar)
export function getGradualPreset(): MonthGoalItem[] {
  const labels = getNextSixMonthsLabels();
  return [
    { monthIndex: 1, monthLabel: labels[0], pdvCount: 3, pdvMultiCount: 0, sharkSaasCount: 0, sharkPersonnaliteCount: 0 },
    { monthIndex: 2, monthLabel: labels[1], pdvCount: 4, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 3, monthLabel: labels[2], pdvCount: 4, pdvMultiCount: 0, sharkSaasCount: 1, sharkPersonnaliteCount: 1 },
    { monthIndex: 4, monthLabel: labels[3], pdvCount: 5, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 5, monthLabel: labels[4], pdvCount: 5, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 6, monthLabel: labels[5], pdvCount: 6, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 1 },
  ];
}

// Preset 2: O cenário sugerido na simulação (6 PDVs + Shark)
export function getSimulationPreset(): MonthGoalItem[] {
  const labels = getNextSixMonthsLabels();
  return [
    { monthIndex: 1, monthLabel: labels[0], pdvCount: 6, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 2, monthLabel: labels[1], pdvCount: 6, pdvMultiCount: 0, sharkSaasCount: 1, sharkPersonnaliteCount: 1 },
    { monthIndex: 3, monthLabel: labels[2], pdvCount: 6, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 4, monthLabel: labels[3], pdvCount: 6, pdvMultiCount: 0, sharkSaasCount: 1, sharkPersonnaliteCount: 1 },
    { monthIndex: 5, monthLabel: labels[4], pdvCount: 6, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 6, monthLabel: labels[5], pdvCount: 6, pdvMultiCount: 0, sharkSaasCount: 1, sharkPersonnaliteCount: 1 },
  ];
}

// Preset 3: Foco Inicial no Giro do PDV
export function getPdvFocusPreset(): MonthGoalItem[] {
  const labels = getNextSixMonthsLabels();
  return [
    { monthIndex: 1, monthLabel: labels[0], pdvCount: 4, pdvMultiCount: 0, sharkSaasCount: 0, sharkPersonnaliteCount: 0 },
    { monthIndex: 2, monthLabel: labels[1], pdvCount: 5, pdvMultiCount: 1, sharkSaasCount: 0, sharkPersonnaliteCount: 0 },
    { monthIndex: 3, monthLabel: labels[2], pdvCount: 6, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 4, monthLabel: labels[3], pdvCount: 6, pdvMultiCount: 1, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
    { monthIndex: 5, monthLabel: labels[4], pdvCount: 7, pdvMultiCount: 2, sharkSaasCount: 1, sharkPersonnaliteCount: 1 },
    { monthIndex: 6, monthLabel: labels[5], pdvCount: 8, pdvMultiCount: 2, sharkSaasCount: 1, sharkPersonnaliteCount: 0 },
  ];
}

function formatBRL(value: number): string {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

const STORAGE_KEY_PREFIX = "teltech_strategic_goals_plan_v2";

export function loadStoredPlan(workspaceId?: string): StrategicGoalsPlan {
  const key = `${STORAGE_KEY_PREFIX}_${workspaceId || "default"}`;
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed && parsed.pricing && Array.isArray(parsed.months) && parsed.months.length === 6) {
        return parsed;
      }
    }
  } catch (e) {
    console.error("Falha ao carregar plano de metas:", e);
  }
  return {
    version: 2,
    pricing: DEFAULT_PRODUCT_PRICING,
    months: getGradualPreset(),
    updatedAt: new Date().toISOString(),
  };
}

export function saveStoredPlan(plan: StrategicGoalsPlan, workspaceId?: string) {
  const key = `${STORAGE_KEY_PREFIX}_${workspaceId || "default"}`;
  try {
    localStorage.setItem(key, JSON.stringify({ ...plan, updatedAt: new Date().toISOString() }));
  } catch (e) {
    console.error("Falha ao salvar plano de metas:", e);
  }
}

// ─── Componente Principal da Aba de Metas ───────────────────────────────────

export function StrategicGoalsModule({
  workspaceId,
  onGoToClients,
}: {
  workspaceId?: string;
  onGoToClients?: () => void;
}) {
  const isMobile = useIsMobile();
  const [plan, setPlan] = useState<StrategicGoalsPlan>(() => loadStoredPlan(workspaceId));
  const [showPricingConfig, setShowPricingConfig] = useState(false);
  const [activePreset, setActivePreset] = useState<"gradual" | "simulation" | "pdvFocus" | "custom">("gradual");

  // Salva no storage quando mudar
  const handleSave = () => {
    saveStoredPlan(plan, workspaceId);
    toast.success("Plano Estratégico de Metas salvo com sucesso!", {
      description: "As metas configuradas agora governam as projeções do seu Ledger.",
    });
  };

  const handleApplyPreset = (type: "gradual" | "simulation" | "pdvFocus") => {
    let newMonths: MonthGoalItem[];
    if (type === "gradual") newMonths = getGradualPreset();
    else if (type === "simulation") newMonths = getSimulationPreset();
    else newMonths = getPdvFocusPreset();

    const newPlan: StrategicGoalsPlan = {
      ...plan,
      months: newMonths,
      updatedAt: new Date().toISOString(),
    };
    setPlan(newPlan);
    setActivePreset(type);
    saveStoredPlan(newPlan, workspaceId);
    toast.info("Cenário aplicado!", { description: "Você pode ajustar cada mês livremente na tabela." });
  };

  const handleResetPricing = () => {
    const newPlan: StrategicGoalsPlan = {
      ...plan,
      pricing: DEFAULT_PRODUCT_PRICING,
      updatedAt: new Date().toISOString(),
    };
    setPlan(newPlan);
    saveStoredPlan(newPlan, workspaceId);
    toast.info("Preços padrão da Teltech restaurados.");
  };

  const handleUpdatePricing = (key: keyof ProductPricing, value: number) => {
    setActivePreset("custom");
    setPlan((prev) => ({
      ...prev,
      pricing: { ...prev.pricing, [key]: Math.max(0, value) },
    }));
  };

  const handleUpdateMonthCount = (
    monthIdx: number,
    field: "pdvCount" | "pdvMultiCount" | "sharkSaasCount" | "sharkPersonnaliteCount",
    delta: number
  ) => {
    setActivePreset("custom");
    setPlan((prev) => {
      const nextMonths = prev.months.map((m) => {
        if (m.monthIndex !== monthIdx) return m;
        const current = m[field];
        return {
          ...m,
          [field]: Math.max(0, current + delta),
        };
      });
      return { ...prev, months: nextMonths };
    });
  };

  const handleSetMonthCountDirect = (
    monthIdx: number,
    field: "pdvCount" | "pdvMultiCount" | "sharkSaasCount" | "sharkPersonnaliteCount",
    val: number
  ) => {
    setActivePreset("custom");
    setPlan((prev) => {
      const nextMonths = prev.months.map((m) => {
        if (m.monthIndex !== monthIdx) return m;
        return {
          ...m,
          [field]: Math.max(0, val),
        };
      });
      return { ...prev, months: nextMonths };
    });
  };

  // ─── Cálculos da Planilha Mês a Mês ─────────────────────────────────────────

  const calculatedRows = useMemo(() => {
    const { pricing, months } = plan;
    let accumulatedMrr = 0;

    return months.map((m) => {
      // 1. Caixa Imediato (Entradas / Setups)
      const immediateCash =
        m.pdvCount * pricing.pdvSetup +
        m.sharkSaasCount * pricing.sharkSaasSetup +
        m.sharkPersonnaliteCount * pricing.sharkPersonnaliteEntry;

      // 2. Novo MRR Adicionado no Mês
      const newMrr =
        m.pdvCount * pricing.pdvMonthly +
        m.pdvMultiCount * pricing.pdvMultiMonthly +
        m.sharkSaasCount * pricing.sharkSaasMonthly +
        m.sharkPersonnaliteCount * pricing.sharkPersonnaliteMonthly;

      // 3. MRR Acumulado (efeito escadinha)
      accumulatedMrr += newMrr;

      // 4. Faturamento Total do Mês (Caixa Imediato + Mensalidades do Mês)
      const totalMonthRevenue = immediateCash + accumulatedMrr;

      // Resumo de texto de fechamentos
      const parts: string[] = [];
      if (m.pdvCount > 0) parts.push(`${m.pdvCount} PDV`);
      if (m.pdvMultiCount > 0) parts.push(`+ ${m.pdvMultiCount} Multi`);
      if (m.sharkSaasCount > 0) parts.push(`+ ${m.sharkSaasCount} Shark SaaS`);
      if (m.sharkPersonnaliteCount > 0) parts.push(`+ ${m.sharkPersonnaliteCount} Shark Personnalité`);
      const summaryText = parts.length > 0 ? parts.join(" ") : "Sem fechamentos planejados";

      return {
        ...m,
        summaryText,
        immediateCash,
        newMrr,
        accumulatedMrr,
        totalMonthRevenue,
      };
    });
  }, [plan]);

  // Totais do Semestre (Rodapé e KPIs)
  const totals = useMemo(() => {
    const totalImmediateCash = calculatedRows.reduce((acc, r) => acc + r.immediateCash, 0);
    const finalMrrMonth6 = calculatedRows[calculatedRows.length - 1]?.accumulatedMrr || 0;
    const totalRevenueSemester = calculatedRows.reduce((acc, r) => acc + r.totalMonthRevenue, 0);
    const totalPdv = calculatedRows.reduce((acc, r) => acc + r.pdvCount, 0);
    const totalMulti = calculatedRows.reduce((acc, r) => acc + r.pdvMultiCount, 0);
    const totalSharkSaas = calculatedRows.reduce((acc, r) => acc + r.sharkSaasCount, 0);
    const totalSharkPersonnalite = calculatedRows.reduce((acc, r) => acc + r.sharkPersonnaliteCount, 0);
    const totalContracts = totalPdv + totalSharkSaas + totalSharkPersonnalite;

    // Breakdown do MRR no Mês 7
    const mrrPdv = totalPdv * plan.pricing.pdvMonthly;
    const mrrMulti = totalMulti * plan.pricing.pdvMultiMonthly;
    const mrrSharkSaas = totalSharkSaas * plan.pricing.sharkSaasMonthly;
    const mrrSharkPersonnalite = totalSharkPersonnalite * plan.pricing.sharkPersonnaliteMonthly;

    return {
      totalImmediateCash,
      finalMrrMonth6,
      totalRevenueSemester,
      totalPdv,
      totalMulti,
      totalSharkSaas,
      totalSharkPersonnalite,
      totalContracts,
      mrrPdv,
      mrrMulti,
      mrrSharkSaas,
      mrrSharkPersonnalite,
    };
  }, [calculatedRows, plan.pricing]);

  return (
    <div
      style={{
        flex: 1,
        display: "flex",
        flexDirection: "column",
        padding: isMobile ? "12px 14px" : "24px",
        gap: isMobile ? 18 : 24,
        maxWidth: 1600,
        margin: "0 auto",
        width: "100%",
        boxSizing: "border-box",
      }}
    >
      {/* ─── Header da Tela ──────────────────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: isMobile ? "flex-start" : "center",
          flexDirection: isMobile ? "column" : "row",
          gap: 14,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(139,92,246,0.3), rgba(124,90,194,0.1))",
                border: "1px solid rgba(139,92,246,0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#A78BFA",
              }}
            >
              <Target style={{ width: 20, height: 20 }} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: isMobile ? 18 : 22, fontWeight: 800, color: "#fff", letterSpacing: -0.3 }}>
                Planejador Estratégico de Metas por Produto
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "#a1a1aa" }}>
                Metas reais de vendas, entradas e acúmulo de recorrência (MRR) para o ciclo de 6 meses
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowPricingConfig(!showPricingConfig)}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              background: showPricingConfig ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.06)",
              border: "1px solid " + (showPricingConfig ? "rgba(139,92,246,0.5)" : "rgba(255,255,255,0.12)"),
              color: showPricingConfig ? "#c4b5fd" : "#e4e4e7",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <Sliders style={{ width: 14, height: 14 }} />
            {showPricingConfig ? "Ocultar Preços" : "Configurar Preços"}
          </button>

          <button
            onClick={handleSave}
            style={{
              padding: "8px 16px",
              borderRadius: 8,
              background: "linear-gradient(135deg, #8B5CF6 0%, #7C5AC2 100%)",
              border: "none",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
            }}
          >
            <Save style={{ width: 14, height: 14 }} />
            Salvar Plano
          </button>
        </div>
      </div>

      {/* ─── 3 Cartões de Resumo Executivo (Glow & High Contrast) ────────── */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "1fr" : "repeat(3, 1fr)",
          gap: 16,
        }}
      >
        {/* Card 1: Caixa Imediato Total */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30,30,36,0.95), rgba(22,22,26,0.95))",
            border: "1px solid rgba(59,130,246,0.25)",
            borderRadius: 14,
            padding: "20px 22px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "rgba(59,130,246,0.12)", filter: "blur(30px)", borderRadius: "50%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#93c5fd", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Caixa Imediato Projetado (6M)
            </span>
            <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(59,130,246,0.15)", color: "#60a5fa", fontSize: 11, fontWeight: 700 }}>
              Entradas & Setups
            </span>
          </div>
          <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: "#60a5fa" }}>
            {formatBRL(totals.totalImmediateCash)}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: 1.4 }}>
            Dinheiro vivo que entra no caixa para bancar despesas, comissões e custos imediatos do semestre.
          </p>
        </div>

        {/* Card 2: O Tesouro Recorrente (MRR Consolidado no Mês 7) */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30,30,36,0.95), rgba(22,22,26,0.95))",
            border: "1px solid rgba(139,92,246,0.35)",
            borderRadius: 14,
            padding: "20px 22px",
            boxShadow: "0 10px 30px rgba(139,92,246,0.15)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "rgba(139,92,246,0.18)", filter: "blur(30px)", borderRadius: "50%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd", textTransform: "uppercase", letterSpacing: 0.5 }}>
              MRR Consolidado no Mês 7
            </span>
            <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(139,92,246,0.2)", color: "#a78bfa", fontSize: 11, fontWeight: 700 }}>
              Patrimônio Recorrente
            </span>
          </div>
          <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: "#c4b5fd" }}>
            {formatBRL(totals.finalMrrMonth6)} <span style={{ fontSize: 14, fontWeight: 600, color: "#a1a1aa" }}>/ mês</span>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 2 }}>
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, color: "#e4e4e7" }}>
              PDV: <b>{formatBRL(totals.mrrPdv + totals.mrrMulti)}/m</b>
            </span>
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, color: "#e4e4e7" }}>
              Shark SaaS: <b>{formatBRL(totals.mrrSharkSaas)}/m</b>
            </span>
            <span style={{ fontSize: 11, background: "rgba(255,255,255,0.06)", padding: "2px 6px", borderRadius: 4, color: "#e4e4e7" }}>
              Personnalité: <b>{formatBRL(totals.mrrSharkPersonnalite)}/m</b>
            </span>
          </div>
        </div>

        {/* Card 3: Faturamento Total Projetado do Semestre */}
        <div
          style={{
            background: "linear-gradient(135deg, rgba(30,30,36,0.95), rgba(22,22,26,0.95))",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 14,
            padding: "20px 22px",
            boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
            display: "flex",
            flexDirection: "column",
            gap: 8,
            position: "relative",
            overflow: "hidden",
          }}
        >
          <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, background: "rgba(16,185,129,0.12)", filter: "blur(30px)", borderRadius: "50%" }} />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "#6ee7b7", textTransform: "uppercase", letterSpacing: 0.5 }}>
              Faturamento Total do Ciclo
            </span>
            <span style={{ padding: "2px 8px", borderRadius: 6, background: "rgba(16,185,129,0.15)", color: "#34d399", fontSize: 11, fontWeight: 700 }}>
              6 Meses Somados
            </span>
          </div>
          <div style={{ fontSize: isMobile ? 24 : 28, fontWeight: 800, color: "#34d399" }}>
            {formatBRL(totals.totalRevenueSemester)}
          </div>
          <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: 1.4 }}>
            Soma de todo o caixa de entrada com todas as mensalidades acumuladas cobradas ao longo do semestre.
          </p>
        </div>
      </div>

      {/* ─── Painel Expansível de Parâmetros dos Produtos ─────────────────── */}
      {showPricingConfig && (
        <div
          style={{
            background: "linear-gradient(135deg, rgba(26,26,30,0.98), rgba(20,20,24,0.98))",
            border: "1px solid rgba(139,92,246,0.3)",
            borderRadius: 14,
            padding: isMobile ? "16px 14px" : "20px 24px",
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
            <div>
              <h4 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
                Preços e Tickets Médios dos Produtos
              </h4>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#a1a1aa" }}>
                Edite os valores médios praticados. A planilha abaixo recalcula instantaneamente com base neles.
              </p>
            </div>
            <button
              onClick={handleResetPricing}
              style={{
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#a1a1aa",
                fontSize: 11,
                fontWeight: 600,
                borderRadius: 6,
                padding: "4px 10px",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 4,
              }}
            >
              <RotateCcw style={{ width: 12, height: 12 }} /> Restaurar Valores Base
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: isMobile ? "1fr" : "repeat(4, 1fr)",
              gap: 14,
            }}
          >
            {/* PDV Balcão */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Store style={{ width: 16, height: 16, color: "#3B82F6" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>PDV Balcão</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 3 }}>Mensalidade Média (R$)</label>
                  <input
                    type="number"
                    value={plan.pricing.pdvMonthly}
                    onChange={(e) => handleUpdatePricing("pdvMonthly", Number(e.target.value))}
                    style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 3 }}>Setup / Entrada Média (R$)</label>
                  <input
                    type="number"
                    value={plan.pricing.pdvSetup}
                    onChange={(e) => handleUpdatePricing("pdvSetup", Number(e.target.value))}
                    style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            {/* PDV Multi-Empresas */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Building style={{ width: 16, height: 16, color: "#14B8A6" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>PDV Multi-Empresas</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 3 }}>Adicional / Filial Extra (R$)</label>
                  <input
                    type="number"
                    value={plan.pricing.pdvMultiMonthly}
                    onChange={(e) => handleUpdatePricing("pdvMultiMonthly", Number(e.target.value))}
                    style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 11, color: "#71717a" }}>
                  Cobrado recorrente por unidade adicional do cliente.
                </p>
              </div>
            </div>

            {/* Shark SaaS */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Landmark style={{ width: 16, height: 16, color: "#8B5CF6" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Shark SaaS</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 3 }}>Mensalidade (R$)</label>
                  <input
                    type="number"
                    value={plan.pricing.sharkSaasMonthly}
                    onChange={(e) => handleUpdatePricing("sharkSaasMonthly", Number(e.target.value))}
                    style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 3 }}>Implementação / Setup (R$)</label>
                  <input
                    type="number"
                    value={plan.pricing.sharkSaasSetup}
                    onChange={(e) => handleUpdatePricing("sharkSaasSetup", Number(e.target.value))}
                    style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>

            {/* Shark Personnalité */}
            <div style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 10, padding: 14 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                <Crown style={{ width: 16, height: 16, color: "#F59E0B" }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Shark Personnalité</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <div>
                  <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 3 }}>Entrada / Implantação (R$)</label>
                  <input
                    type="number"
                    value={plan.pricing.sharkPersonnaliteEntry}
                    onChange={(e) => handleUpdatePricing("sharkPersonnaliteEntry", Number(e.target.value))}
                    style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: 11, color: "#a1a1aa", display: "block", marginBottom: 3 }}>Mensalidade Fixa (R$)</label>
                  <input
                    type="number"
                    value={plan.pricing.sharkPersonnaliteMonthly}
                    onChange={(e) => handleUpdatePricing("sharkPersonnaliteMonthly", Number(e.target.value))}
                    style={{ width: "100%", background: "#111113", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, padding: "6px 10px", color: "#fff", fontSize: 13, fontWeight: 600, boxSizing: "border-box" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ─── Seletor de Presets Rápidos ──────────────────────────────────── */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12,
          padding: "12px 18px",
          background: "rgba(255,255,255,0.02)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Sparkles style={{ width: 16, height: 16, color: "#8B5CF6" }} />
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fff" }}>Cenários Pré-configurados:</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[
            { id: "gradual", label: "🐢 Conservador (Pé no chão)", hint: "Começa com 3 PDVs e cresce gradual" },
            { id: "simulation", label: "⚡ Equilibrado (6 PDV + Shark)", hint: "O modelo da simulação estratégica" },
            { id: "pdvFocus", label: "🔥 Foco no Giro do PDV", hint: "Explora o alto volume do comércio local" },
          ].map((ps) => {
            const isSel = activePreset === ps.id;
            return (
              <button
                key={ps.id}
                onClick={() => handleApplyPreset(ps.id as any)}
                title={ps.hint}
                style={{
                  padding: "6px 12px",
                  borderRadius: 6,
                  background: isSel ? "rgba(139,92,246,0.25)" : "rgba(255,255,255,0.05)",
                  border: "1px solid " + (isSel ? "rgba(139,92,246,0.6)" : "rgba(255,255,255,0.08)"),
                  color: isSel ? "#c4b5fd" : "#a1a1aa",
                  fontSize: 12,
                  fontWeight: isSel ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                {ps.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── A Grande Planilha Estratégica Interativa de 6 Meses ─────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(26,26,30,0.95), rgba(20,20,24,0.95))",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 14,
          overflow: "hidden",
          boxShadow: "0 10px 40px rgba(0,0,0,0.4)",
        }}
      >
        <div style={{ padding: "18px 22px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
              Planilha de Metas & Projeção Mensal (6 Meses)
            </h3>
            <p style={{ margin: "2px 0 0", fontSize: 12, color: "#a1a1aa" }}>
              Ajuste a quantidade de contratos em cada mês. O Caixa Imediato, o Novo MRR e o Acumulado calculam automaticamente.
            </p>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#a1a1aa" }}>
            <Info style={{ width: 14, height: 14, color: "#8B5CF6" }} />
            <span>Empilhamento inteligente: MRR acumula mês a mês</span>
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
            <thead>
              <tr style={{ background: "rgba(255,255,255,0.03)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "#a1a1aa", width: 140 }}>Mês</th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "#a1a1aa", minWidth: 320 }}>
                  Fechamentos Planejados do Mês
                </th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "#93c5fd", textAlign: "right" }}>
                  Caixa Imediato (Entradas)
                </th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "#34d399", textAlign: "right" }}>
                  Novo MRR do Mês
                </th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "#c4b5fd", textAlign: "right" }}>
                  MRR Total Acumulado
                </th>
                <th style={{ padding: "14px 18px", fontSize: 12, fontWeight: 700, color: "#fff", textAlign: "right" }}>
                  Faturamento Total
                </th>
              </tr>
            </thead>
            <tbody>
              {calculatedRows.map((r, i) => {
                const isEven = i % 2 === 0;
                return (
                  <tr
                    key={r.monthIndex}
                    style={{
                      background: isEven ? "rgba(255,255,255,0.01)" : "rgba(255,255,255,0.03)",
                      borderBottom: "1px solid rgba(255,255,255,0.05)",
                      transition: "background 0.15s ease",
                    }}
                  >
                    {/* 1. Mês */}
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column" }}>
                        <span style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{r.monthLabel}</span>
                        <span style={{ fontSize: 11, color: "#71717a" }}>Ciclo 6M • Etapa {r.monthIndex}</span>
                      </div>
                    </td>

                    {/* 2. Fechamentos Planejados (Controles Interativos) */}
                    <td style={{ padding: "16px 18px", verticalAlign: "middle" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                          {/* PDV */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(59,130,246,0.1)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: 6, padding: "2px 6px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#60a5fa" }}>PDV:</span>
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "pdvCount", -1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={r.pdvCount}
                              onChange={(e) => handleSetMonthCountDirect(r.monthIndex, "pdvCount", Number(e.target.value))}
                              style={{ width: 32, textAlign: "center", background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 12 }}
                            />
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "pdvCount", 1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              +
                            </button>
                          </div>

                          {/* Shark SaaS */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(139,92,246,0.1)", border: "1px solid rgba(139,92,246,0.3)", borderRadius: 6, padding: "2px 6px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#c4b5fd" }}>Shark SaaS:</span>
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "sharkSaasCount", -1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={r.sharkSaasCount}
                              onChange={(e) => handleSetMonthCountDirect(r.monthIndex, "sharkSaasCount", Number(e.target.value))}
                              style={{ width: 28, textAlign: "center", background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 12 }}
                            />
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "sharkSaasCount", 1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              +
                            </button>
                          </div>

                          {/* Shark Personnalité */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)", borderRadius: 6, padding: "2px 6px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#fbbf24" }}>Personnalité:</span>
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "sharkPersonnaliteCount", -1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={r.sharkPersonnaliteCount}
                              onChange={(e) => handleSetMonthCountDirect(r.monthIndex, "sharkPersonnaliteCount", Number(e.target.value))}
                              style={{ width: 28, textAlign: "center", background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 12 }}
                            />
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "sharkPersonnaliteCount", 1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              +
                            </button>
                          </div>

                          {/* PDV Multi */}
                          <div style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "rgba(20,184,166,0.1)", border: "1px solid rgba(20,184,166,0.3)", borderRadius: 6, padding: "2px 6px" }}>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#2dd4bf" }}>Multi:</span>
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "pdvMultiCount", -1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              -
                            </button>
                            <input
                              type="number"
                              min={0}
                              value={r.pdvMultiCount}
                              onChange={(e) => handleSetMonthCountDirect(r.monthIndex, "pdvMultiCount", Number(e.target.value))}
                              style={{ width: 28, textAlign: "center", background: "transparent", border: "none", color: "#fff", fontWeight: 700, fontSize: 12 }}
                            />
                            <button
                              onClick={() => handleUpdateMonthCount(r.monthIndex, "pdvMultiCount", 1)}
                              style={{ width: 18, height: 18, borderRadius: 3, border: "none", background: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                            >
                              +
                            </button>
                          </div>
                        </div>

                        <div style={{ fontSize: 12, color: "#d4d4d8", fontWeight: 600 }}>
                          {r.summaryText}
                        </div>
                      </div>
                    </td>

                    {/* 3. Caixa Imediato */}
                    <td style={{ padding: "16px 18px", textAlign: "right", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#60a5fa" }}>
                        {formatBRL(r.immediateCash)}
                      </span>
                    </td>

                    {/* 4. Novo MRR */}
                    <td style={{ padding: "16px 18px", textAlign: "right", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#34d399" }}>
                        + {formatBRL(r.newMrr)} <span style={{ fontSize: 11, fontWeight: 500, color: "#a1a1aa" }}>/mês</span>
                      </span>
                    </td>

                    {/* 5. MRR Acumulado (A Escadinha) */}
                    <td style={{ padding: "16px 18px", textAlign: "right", verticalAlign: "middle" }}>
                      <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "flex-end" }}>
                        <span style={{ fontSize: 15, fontWeight: 800, color: "#c4b5fd" }}>
                          {formatBRL(r.accumulatedMrr)} <span style={{ fontSize: 11, fontWeight: 500, color: "#a1a1aa" }}>/mês</span>
                        </span>
                        <div style={{ width: 80, height: 4, background: "rgba(255,255,255,0.06)", borderRadius: 2, marginTop: 4, overflow: "hidden" }}>
                          <div
                            style={{
                              width: `${Math.min(100, Math.round((r.accumulatedMrr / (totals.finalMrrMonth6 || 1)) * 100))}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #8B5CF6, #34D399)",
                              borderRadius: 2,
                            }}
                          />
                        </div>
                      </div>
                    </td>

                    {/* 6. Faturamento Total do Mês */}
                    <td style={{ padding: "16px 18px", textAlign: "right", verticalAlign: "middle" }}>
                      <span style={{ fontSize: 15, fontWeight: 800, color: "#fff" }}>
                        {formatBRL(r.totalMonthRevenue)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>

            {/* Rodapé com Totais do Ciclo */}
            <tfoot>
              <tr style={{ background: "rgba(139,92,246,0.1)", borderTop: "2px solid rgba(139,92,246,0.3)" }}>
                <td style={{ padding: "16px 18px", fontWeight: 800, color: "#fff", fontSize: 14 }}>
                  TOTAIS DO CICLO (6M)
                </td>
                <td style={{ padding: "16px 18px", fontWeight: 700, color: "#c4b5fd", fontSize: 13 }}>
                  {totals.totalContracts} novos contratos ({totals.totalPdv} PDV + {totals.totalMulti} Multi + {totals.totalSharkSaas} Shark SaaS + {totals.totalSharkPersonnalite} Personnalité)
                </td>
                <td style={{ padding: "16px 18px", textAlign: "right", fontWeight: 800, color: "#60a5fa", fontSize: 15 }}>
                  {formatBRL(totals.totalImmediateCash)}
                </td>
                <td style={{ padding: "16px 18px", textAlign: "right", fontWeight: 700, color: "#a1a1aa", fontSize: 12 }}>
                  Média: {formatBRL(Math.round(totals.finalMrrMonth6 / 6))}/mês novo
                </td>
                <td style={{ padding: "16px 18px", textAlign: "right", fontWeight: 800, color: "#c4b5fd", fontSize: 16 }}>
                  {formatBRL(totals.finalMrrMonth6)} /mês
                </td>
                <td style={{ padding: "16px 18px", textAlign: "right", fontWeight: 800, color: "#34d399", fontSize: 17 }}>
                  {formatBRL(totals.totalRevenueSemester)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* ─── Dica Tática para Reunião dos Sócios ──────────────────────────── */}
      <div
        style={{
          background: "linear-gradient(135deg, rgba(139,92,246,0.06), rgba(30,30,36,0.95))",
          border: "1px solid rgba(139,92,246,0.2)",
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          alignItems: "flex-start",
          gap: 14,
        }}
      >
        <Zap style={{ width: 20, height: 20, color: "#A78BFA", flexShrink: 0, marginTop: 2 }} />
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 14, fontWeight: 700, color: "#fff" }}>
            Estratégia Realista para a Reunião de Sócios
          </h4>
          <p style={{ margin: 0, fontSize: 12, color: "#a1a1aa", lineHeight: 1.5 }}>
            • <b>Foco no Mês 1:</b> Não tentem bater o semestre inteiro agora. Escolham uma meta factível para o <b>Mês 1</b> (ex: 2 ou 3 PDVs) e foquem todas as energias em fechar esses.<br />
            • <b>O poder do Personnalité:</b> Cada Shark Personnalité fechado (R$ 3.000) equivale ao caixa de quase 25 implantações de PDV. Mantenham 1 na mira a cada bimestre.<br />
            • <b>A escadinha não zera:</b> Todo cliente de PDV ou Shark que vocês conquistam vira receita garantida que alivia a pressão do próximo mês.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Card para o Cockpit / Dashboard Principal do Financeiro ────────────────

export function CockpitStrategicGoalsCard({
  onGoToPlanner,
  workspaceId,
}: {
  onGoToPlanner: () => void;
  workspaceId?: string;
}) {
  const plan = useMemo(() => loadStoredPlan(workspaceId), [workspaceId]);
  const month1 = plan.months[0] || { pdvCount: 3, sharkSaasCount: 0, sharkPersonnaliteCount: 0, pdvMultiCount: 0, monthLabel: "Mês 1" };

  // Cálculos do Mês 1
  const m1Immediate =
    month1.pdvCount * plan.pricing.pdvSetup +
    month1.sharkSaasCount * plan.pricing.sharkSaasSetup +
    month1.sharkPersonnaliteCount * plan.pricing.sharkPersonnaliteEntry;

  const m1Mrr =
    month1.pdvCount * plan.pricing.pdvMonthly +
    month1.pdvMultiCount * plan.pricing.pdvMultiMonthly +
    month1.sharkSaasCount * plan.pricing.sharkSaasMonthly +
    month1.sharkPersonnaliteCount * plan.pricing.sharkPersonnaliteMonthly;

  // Total acumulado em 6 meses
  let accumulatedMrr6 = 0;
  for (const m of plan.months) {
    accumulatedMrr6 +=
      m.pdvCount * plan.pricing.pdvMonthly +
      m.pdvMultiCount * plan.pricing.pdvMultiMonthly +
      m.sharkSaasCount * plan.pricing.sharkSaasMonthly +
      m.sharkPersonnaliteCount * plan.pricing.sharkPersonnaliteMonthly;
  }

  const totalContractsM1 = month1.pdvCount + month1.sharkSaasCount + month1.sharkPersonnaliteCount;

  return (
    <div
      style={{
        background: "linear-gradient(135deg, rgba(26,26,30,0.98), rgba(20,20,24,0.98))",
        border: "1px solid rgba(139,92,246,0.25)",
        borderRadius: 14,
        padding: "20px 22px",
        boxShadow: "0 8px 30px rgba(0,0,0,0.4)",
        display: "flex",
        flexDirection: "column",
        gap: 14,
        position: "relative",
        overflow: "hidden",
      }}
    >
      <div style={{ position: "absolute", top: -20, right: -20, width: 90, height: 90, background: "rgba(139,92,246,0.12)", filter: "blur(30px)", borderRadius: "50%" }} />

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <Target style={{ width: 16, height: 16, color: "#A78BFA" }} />
            <h3 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#fff" }}>
              Metas & Projeção Estratégica (Ciclo 6M)
            </h3>
          </div>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#a1a1aa" }}>
            Meta do mês atual e projeção de MRR consolidado por produto
          </p>
        </div>
        <button
          onClick={onGoToPlanner}
          style={{
            background: "transparent",
            border: "none",
            color: "#A78BFA",
            fontSize: 12,
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: 4,
          }}
        >
          Planejador 6M <ChevronRight style={{ width: 14, height: 14 }} />
        </button>
      </div>

      {/* Grid de Resumo do Mês Vigente vs 6M */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: 12,
          background: "rgba(255,255,255,0.03)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderRadius: 10,
          padding: "12px 14px",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase" }}>
            Meta do Mês Vigente ({month1.monthLabel})
          </span>
          <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
            <span style={{ fontSize: 18, fontWeight: 800, color: "#fff" }}>
              {totalContractsM1} Fechamentos
            </span>
            <span style={{ fontSize: 11, color: "#34D399", fontWeight: 700 }}>
              +{formatBRL(m1Mrr)} MRR
            </span>
          </div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 2 }}>
            {month1.pdvCount > 0 && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(59,130,246,0.15)", color: "#93c5fd", fontWeight: 600 }}>
                {month1.pdvCount} PDV
              </span>
            )}
            {month1.sharkSaasCount > 0 && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(139,92,246,0.15)", color: "#c4b5fd", fontWeight: 600 }}>
                {month1.sharkSaasCount} Shark SaaS
              </span>
            )}
            {month1.sharkPersonnaliteCount > 0 && (
              <span style={{ fontSize: 10, padding: "2px 6px", borderRadius: 4, background: "rgba(245,158,11,0.15)", color: "#fde68a", fontWeight: 600 }}>
                {month1.sharkPersonnaliteCount} Personnalité
              </span>
            )}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 3, borderLeft: "1px solid rgba(255,255,255,0.08)", paddingLeft: 12 }}>
          <span style={{ fontSize: 11, fontWeight: 700, color: "#a1a1aa", textTransform: "uppercase" }}>
            MRR no 6º Mês
          </span>
          <span style={{ fontSize: 18, fontWeight: 800, color: "#A78BFA" }}>
            {formatBRL(accumulatedMrr6)} <span style={{ fontSize: 11, color: "#a1a1aa" }}>/mês</span>
          </span>
          <span style={{ fontSize: 11, color: "#71717a" }}>
            Caixa imediato M1: {formatBRL(m1Immediate)}
          </span>
        </div>
      </div>

      {/* Botão de Chamada para Ação */}
      <button
        onClick={onGoToPlanner}
        style={{
          width: "100%",
          padding: "10px 14px",
          borderRadius: 8,
          background: "linear-gradient(135deg, rgba(139,92,246,0.2) 0%, rgba(124,90,194,0.1) 100%)",
          border: "1px solid rgba(139,92,246,0.4)",
          color: "#c4b5fd",
          fontSize: 12,
          fontWeight: 700,
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 6,
          transition: "all 0.2s ease",
        }}
      >
        <Sparkles style={{ width: 14, height: 14 }} />
        Abrir Planilha de Metas & Projeção (6 Meses)
      </button>
    </div>
  );
}
