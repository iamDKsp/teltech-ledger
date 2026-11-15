import { useState, useEffect, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Flame,
  MessageSquare,
  Send,
  Pause,
  Play,
  CheckCircle2,
  RefreshCw,
  Search,
  Sparkles,
  Clock,
  Plus,
  Trash2,
  RotateCcw,
  Save,
  ChevronDown,
  ChevronUp,
  Phone,
  Eye,
  Zap,
  SlidersHorizontal,
  UserPlus,
  X,
  CheckCheck,
  AlertCircle,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "../lib/api";
import { useIsMobile } from "../hooks/use-mobile";

interface SourceOption {
  source: string;
  label: string;
  totalSteps: number;
  leadCount: number;
}

interface DemoLeadItem {
  id: string;
  source: string;
  sourceLabel: string;
  externalId: string;
  name: string;
  phone: string;
  email: string | null;
  accessCount: number;
  firstAccessAt: string;
  lastAccessAt: string;
  status: "active_cadence" | "paused" | "replied" | "converted" | "completed" | "opted_out" | "discarded";
  pauseReason: string | null;
  currentStep: number;
  nextStepOrder: number | null;
  nextStepAt: string | null;
  sentCount: number;
  totalSteps: number;
  lastSentAt: string | null;
  repliedAt: string | null;
  notes: string | null;
}

interface DemoLeadMessage {
  id: string;
  kind: string;
  direction: "outbound" | "inbound";
  body: string;
  status: string;
  cadenceStep: number | null;
  sentAt: string | null;
  createdAt: string;
  lastError: string | null;
}

interface CadenceStepItem {
  id?: string;
  stepKind: "sequence" | "reaccess";
  stepOrder: number;
  title: string;
  delayMinutes: number;
  respectBusinessHours: boolean;
  businessStartHour: number;
  businessEndHour: number;
  bodyTemplate: string;
  enabled: boolean;
}

interface DemoKpis {
  total: number;
  activeCadence: number;
  replied: number;
  paused: number;
  converted: number;
  completed: number;
  totalMessagesSent: number;
}

const STATUS_META: Record<
  string,
  { label: string; bg: string; border: string; color: string }
> = {
  active_cadence: {
    label: "Em Cadência",
    bg: "rgba(124, 90, 194, 0.18)",
    border: "rgba(124, 90, 194, 0.45)",
    color: "#c4a8ff",
  },
  replied: {
    label: "Respondeu!",
    bg: "rgba(16, 185, 129, 0.16)",
    border: "rgba(16, 185, 129, 0.4)",
    color: "#6ee7b7",
  },
  converted: {
    label: "Cliente Convertido",
    bg: "rgba(34, 197, 94, 0.18)",
    border: "rgba(34, 197, 94, 0.45)",
    color: "#86efac",
  },
  paused: {
    label: "Pausado",
    bg: "rgba(245, 158, 11, 0.15)",
    border: "rgba(245, 158, 11, 0.38)",
    color: "#fcd34d",
  },
  completed: {
    label: "Régua Concluída",
    bg: "rgba(113, 113, 122, 0.2)",
    border: "rgba(113, 113, 122, 0.4)",
    color: "#d4d4d8",
  },
  opted_out: {
    label: "Pediu Parar",
    bg: "rgba(239, 68, 68, 0.15)",
    border: "rgba(239, 68, 68, 0.35)",
    color: "#fca5a5",
  },
  discarded: {
    label: "Arquivado",
    bg: "rgba(82, 82, 91, 0.2)",
    border: "rgba(82, 82, 91, 0.35)",
    color: "#a1a1aa",
  },
};

const TEMPLATE_VARIABLES = [
  { token: "{saudacao}", desc: "Bom dia / Boa tarde / Boa noite" },
  { token: "{nome}", desc: "Primeiro nome do lead" },
  { token: "{cliente}", desc: "Nome completo" },
  { token: "{produto}", desc: "Nome do sistema (ex: PDV Lojista)" },
  { token: "{empresa}", desc: "Sua empresa (Teltech)" },
  { token: "{assistente}", desc: "Nome do assistente (Nexus)" },
  { token: "{acessos}", desc: "Nº de vezes que abriu a demo" },
];

function formatPhoneBr(phone: string): string {
  const d = (phone || "").replace(/\D/g, "");
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length === 11) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  }
  if (local.length === 10) {
    return `(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  }
  return phone;
}

function formatDateTimeBr(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "—";
  }
}

function splitDelayUnit(delayMinutes: number): { value: number; unit: "min" | "hours" | "days" } {
  if (delayMinutes >= 1440 && delayMinutes % 1440 === 0) {
    return { value: delayMinutes / 1440, unit: "days" };
  }
  if (delayMinutes >= 60 && delayMinutes % 60 === 0) {
    return { value: delayMinutes / 60, unit: "hours" };
  }
  return { value: delayMinutes, unit: "min" };
}

function formatDelayHuman(delayMinutes: number): string {
  if (delayMinutes <= 0) return "Imediato";
  if (delayMinutes < 60) return `${delayMinutes} min depois`;
  if (delayMinutes % 1440 === 0) {
    const d = delayMinutes / 1440;
    return `${d} ${d === 1 ? "dia" : "dias"} depois`;
  }
  const h = Math.round((delayMinutes / 60) * 10) / 10;
  return `${h}h depois`;
}

function renderPreviewText(
  template: string,
  productLabel: string,
  companyName: string,
  assistantName: string,
): string {
  return template
    .replace(/\{saudacao\}/g, "Boa tarde")
    .replace(/\{nome\}/g, "Carlos")
    .replace(/\{cliente\}/g, "Carlos Almeida")
    .replace(/\{produto\}/g, productLabel || "PDV Lojista")
    .replace(/\{empresa\}/g, companyName || "Teltech")
    .replace(/\{assistente\}/g, assistantName || "Nexus")
    .replace(/\{acessos\}/g, "2");
}

export function DemoLeadsPage() {
  const isMobile = useIsMobile();
  const [, navigate] = useLocation();

  const [activeMainTab, setActiveMainTab] = useState<"funnel" | "cadence">("funnel");
  const [sources, setSources] = useState<SourceOption[]>([]);
  const [selectedSource, setSelectedSource] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  const [kpis, setKpis] = useState<DemoKpis>({
    total: 0,
    activeCadence: 0,
    replied: 0,
    paused: 0,
    converted: 0,
    completed: 0,
    totalMessagesSent: 0,
  });
  const [leads, setLeads] = useState<DemoLeadItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [busyLeadId, setBusyLeadId] = useState<string | null>(null);

  // Expanded timeline per lead
  const [expandedLeadId, setExpandedLeadId] = useState<string | null>(null);
  const [leadMessages, setLeadMessages] = useState<Record<string, DemoLeadMessage[]>>({});
  const [loadingTimelineId, setLoadingTimelineId] = useState<string | null>(null);

  // Cadence editor state
  const [editorSource, setEditorSource] = useState<string>("pdv_lojista");
  const [editorProductLabel, setEditorProductLabel] = useState<string>("PDV Lojista");
  const [editorCompanyName, setEditorCompanyName] = useState<string>("Teltech");
  const [editorAssistantName, setEditorAssistantName] = useState<string>("Nexus");
  const [cadenceSteps, setCadenceSteps] = useState<CadenceStepItem[]>([]);
  const [loadingCadence, setLoadingCadence] = useState<boolean>(false);
  const [savingCadence, setSavingCadence] = useState<boolean>(false);

  // Simulate lead modal
  const [showSimulateModal, setShowSimulateModal] = useState<boolean>(false);
  const [simName, setSimName] = useState<string>("");
  const [simPhone, setSimPhone] = useState<string>("");
  const [simSource, setSimSource] = useState<string>("pdv_lojista");
  const [simNotes, setSimNotes] = useState<string>("");
  const [creatingSim, setCreatingSim] = useState<boolean>(false);

  // Webhook connection modal
  const [showWebhookModal, setShowWebhookModal] = useState<boolean>(false);
  const [whSource, setWhSource] = useState<string>("pdv_lojista");
  const [whName, setWhName] = useState<string>("PDV Lojista");
  const [whSecret, setWhSecret] = useState<string>("");
  const [savingWebhook, setSavingWebhook] = useState<boolean>(false);

  // Read ?source= from URL if present on initial mount
  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const src = params.get("source");
    if (src) {
      setSelectedSource(src);
      setEditorSource(src);
    }
  }, []);

  const fetchFunnel = useCallback(
    async (silent = false) => {
      if (!silent) setLoading(true);
      try {
        const params = new URLSearchParams();
        if (selectedSource !== "all") params.set("source", selectedSource);
        if (statusFilter !== "all") params.set("status", statusFilter);
        if (search.trim()) params.set("search", search.trim());

        const data = await API.get<{
          sources: SourceOption[];
          kpis: DemoKpis;
          leads: DemoLeadItem[];
        }>(`/demo-leads?${params.toString()}`);

        setSources(data.sources ?? []);
        setKpis(data.kpis);
        setLeads(data.leads ?? []);

        if ((data.sources ?? []).length > 0 && !data.sources.some((s) => s.source === editorSource)) {
          setEditorSource(data.sources[0].source);
        }
      } catch (err: any) {
        if (!silent) toast.error(err.message || "Falha ao carregar funil de demonstrações");
      } finally {
        if (!silent) setLoading(false);
      }
    },
    [selectedSource, statusFilter, search, editorSource],
  );

  useEffect(() => {
    fetchFunnel(false);
    const timer = setInterval(() => {
      void fetchFunnel(true);
    }, 12_000);
    return () => clearInterval(timer);
  }, [fetchFunnel]);

  const loadCadenceSteps = useCallback(async (source: string) => {
    setLoadingCadence(true);
    try {
      const res = await API.get<{
        source: string;
        productLabel: string;
        companyName: string;
        assistantName: string;
        steps: CadenceStepItem[];
      }>(`/demo-leads/cadence/${encodeURIComponent(source)}`);
      setEditorProductLabel(res.productLabel || "PDV Lojista");
      setEditorCompanyName(res.companyName || "Teltech");
      setEditorAssistantName(res.assistantName || "Nexus");
      setCadenceSteps(res.steps ?? []);
    } catch (err: any) {
      toast.error(err.message || "Falha ao carregar etapas da régua");
    } finally {
      setLoadingCadence(false);
    }
  }, []);

  useEffect(() => {
    if (activeMainTab === "cadence" && editorSource) {
      void loadCadenceSteps(editorSource);
    }
  }, [activeMainTab, editorSource, loadCadenceSteps]);

  const loadLeadTimeline = async (leadId: string) => {
    if (expandedLeadId === leadId) {
      setExpandedLeadId(null);
      return;
    }
    setExpandedLeadId(leadId);
    setLoadingTimelineId(leadId);
    try {
      const res = await API.get<{ messages: DemoLeadMessage[] }>(`/demo-leads/${leadId}/messages`);
      setLeadMessages((prev) => ({ ...prev, [leadId]: res.messages ?? [] }));
    } catch (err: any) {
      toast.error(err.message || "Não foi possível carregar o histórico");
    } finally {
      setLoadingTimelineId(null);
    }
  };

  const handleSendNextNow = async (lead: DemoLeadItem) => {
    setBusyLeadId(lead.id);
    try {
      const res = await API.post<{ stepOrder: number; stepTitle: string }>(
        `/demo-leads/${lead.id}/send-now`,
        {},
      );
      toast.success(`Disparo enfileirado agora: ${res.stepTitle}`);
      await fetchFunnel(true);
      if (expandedLeadId === lead.id) {
        const msgRes = await API.get<{ messages: DemoLeadMessage[] }>(`/demo-leads/${lead.id}/messages`);
        setLeadMessages((prev) => ({ ...prev, [lead.id]: msgRes.messages ?? [] }));
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao disparar mensagem agora");
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleUpdateLeadStatus = async (
    lead: DemoLeadItem,
    status: DemoLeadItem["status"],
    successMsg: string,
  ) => {
    setBusyLeadId(lead.id);
    try {
      await API.patch(`/demo-leads/${lead.id}`, { status });
      toast.success(successMsg);
      await fetchFunnel(true);
    } catch (err: any) {
      toast.error(err.message || "Falha ao atualizar status do lead");
    } finally {
      setBusyLeadId(null);
    }
  };

  const handleCreateSimulatedLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!simName.trim() || !simPhone.trim()) return;
    setCreatingSim(true);
    try {
      const matchedSrc = sources.find((s) => s.source === simSource);
      await API.post("/demo-leads/simulate", {
        source: simSource || "pdv_lojista",
        sourceLabel: matchedSrc?.label || "PDV Lojista",
        name: simName.trim(),
        phone: simPhone.trim(),
        notes: simNotes.trim() || null,
      });
      toast.success("Lead adicionado na régua automática! A 1ª mensagem já está agendada.");
      setShowSimulateModal(false);
      setSimName("");
      setSimPhone("");
      setSimNotes("");
      await fetchFunnel(false);
    } catch (err: any) {
      toast.error(err.message || "Falha ao cadastrar lead");
    } finally {
      setCreatingSim(false);
    }
  };

  const handleStepChange = (index: number, patch: Partial<CadenceStepItem>) => {
    setCadenceSteps((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  };

  const handleAddSequenceStep = () => {
    const seqCount = cadenceSteps.filter((s) => s.stepKind === "sequence").length;
    const newStep: CadenceStepItem = {
      stepKind: "sequence",
      stepOrder: seqCount + 1,
      title: `${seqCount + 1}. Nova Provocação Comercial`,
      delayMinutes: 1440,
      respectBusinessHours: true,
      businessStartHour: 9,
      businessEndHour: 20,
      bodyTemplate: `Fala, {nome}! Passando pra saber se você conseguiu avançar na decisão sobre o *{produto}*. Quer que eu libere um teste assistido pra sua loja?`,
      enabled: true,
    };
    const withoutReaccess = cadenceSteps.filter((s) => s.stepKind === "sequence");
    const reaccess = cadenceSteps.filter((s) => s.stepKind === "reaccess");
    setCadenceSteps([...withoutReaccess, newStep, ...reaccess]);
  };

  const handleRemoveStep = (index: number) => {
    if (cadenceSteps.filter((s) => s.stepKind === "sequence").length <= 1) {
      toast.error("Mantenha ao menos 1 etapa na régua.");
      return;
    }
    setCadenceSteps((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleSaveCadence = async () => {
    setSavingCadence(true);
    try {
      const res = await API.put<{ steps: CadenceStepItem[] }>(
        `/demo-leads/cadence/${encodeURIComponent(editorSource)}`,
        {
          productLabel: editorProductLabel,
          steps: cadenceSteps.map((s, idx) => ({
            stepKind: s.stepKind,
            stepOrder: s.stepKind === "reaccess" ? 99 : idx + 1,
            title: s.title,
            delayMinutes: s.delayMinutes,
            respectBusinessHours: s.respectBusinessHours,
            businessStartHour: s.businessStartHour,
            businessEndHour: s.businessEndHour,
            bodyTemplate: s.bodyTemplate,
            enabled: s.enabled,
          })),
        },
      );
      setCadenceSteps(res.steps ?? []);
      toast.success("Régua provocante salva! Já vale para todos os próximos disparos.");
      void fetchFunnel(true);
    } catch (err: any) {
      toast.error(err.message || "Erro ao salvar a régua");
    } finally {
      setSavingCadence(false);
    }
  };

  const handleResetCadenceDefaults = async () => {
    if (!window.confirm("Restaurar os textos provocantes originais de fábrica para este produto?")) return;
    setSavingCadence(true);
    try {
      const res = await API.put<{ steps: CadenceStepItem[] }>(
        `/demo-leads/cadence/${encodeURIComponent(editorSource)}`,
        {
          resetDefaults: true,
          productLabel: editorProductLabel,
        },
      );
      setCadenceSteps(res.steps ?? []);
      toast.success("Régua restaurada para o padrão provocante!");
      void fetchFunnel(true);
    } catch (err: any) {
      toast.error(err.message || "Falha ao restaurar padrão");
    } finally {
      setSavingCadence(false);
    }
  };

  const sequenceStepsCount = useMemo(
    () => cadenceSteps.filter((s) => s.stepKind === "sequence" && s.enabled).length,
    [cadenceSteps],
  );

  return (
    <div
      style={{
        flex: 1,
        overflowY: "auto",
        padding: isMobile ? "14px" : "22px 28px",
        background: "#111114",
        color: "#e4e4e7",
      }}
    >
      {/* Top Banner + Actions */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 14,
          marginBottom: 18,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 10,
                background: "linear-gradient(135deg, rgba(124,90,194,0.32), rgba(124,90,194,0.12))",
                border: "1px solid rgba(124,90,194,0.45)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#c4a8ff",
              }}
            >
              <Flame size={18} />
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: isMobile ? 17 : 20, fontWeight: 700, color: "#fafafa" }}>
                Funil Demo & Régua Provocante
              </h1>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#8e8e98" }}>
                Cadência comercial automática via Baileys para leads que testam a demonstração gratuita dos seus sistemas
              </p>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <button
            onClick={() => setShowWebhookModal(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 13px",
              borderRadius: 9,
              border: "1px solid rgba(16,185,129,0.42)",
              background: "rgba(16,185,129,0.12)",
              color: "#6ee7b7",
              fontSize: 12.5,
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="Configurar segredo HMAC para receber leads dos seus produtos sem editar variáveis no Portainer"
          >
            <Zap size={14} />
            Conectar Webhook
          </button>
          <button
            onClick={() => {
              setSimSource(selectedSource !== "all" ? selectedSource : (sources[0]?.source ?? "pdv_lojista"));
              setShowSimulateModal(true);
            }}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 13px",
              borderRadius: 9,
              border: "1px solid rgba(124,90,194,0.45)",
              background: "rgba(124,90,194,0.16)",
              color: "#d8c4ff",
              fontSize: 12,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <UserPlus size={14} />
            Testar / Adicionar Lead
          </button>

          <button
            onClick={() => fetchFunnel(false)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "8px 12px",
              borderRadius: 9,
              border: "1px solid rgba(255,255,255,0.1)",
              background: "#18181d",
              color: "#d4d4d8",
              fontSize: 12,
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <RefreshCw size={13} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Product / Source Filter Pills */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          overflowX: "auto",
          paddingBottom: 6,
          marginBottom: 16,
        }}
      >
        <button
          onClick={() => setSelectedSource("all")}
          style={{
            padding: "6px 13px",
            borderRadius: 999,
            border: selectedSource === "all" ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.09)",
            background: selectedSource === "all" ? "rgba(124,90,194,0.24)" : "#18181d",
            color: selectedSource === "all" ? "#f4f4f5" : "#a1a1aa",
            fontSize: 12,
            fontWeight: 600,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          Todos os Produtos ({sources.reduce((acc, s) => acc + s.leadCount, 0)})
        </button>
        {sources.map((src) => {
          const active = selectedSource === src.source;
          return (
            <button
              key={src.source}
              onClick={() => {
                setSelectedSource(src.source);
                setEditorSource(src.source);
              }}
              style={{
                padding: "6px 13px",
                borderRadius: 999,
                border: active ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.09)",
                background: active ? "rgba(124,90,194,0.24)" : "#18181d",
                color: active ? "#f4f4f5" : "#a1a1aa",
                fontSize: 12,
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {src.label} ({src.leadCount})
            </button>
          );
        })}
      </div>

      {/* KPI Strip */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : "repeat(5, 1fr)",
          gap: 10,
          marginBottom: 20,
        }}
      >
        {[
          { label: "Leads na Demo", value: kpis.total, accent: "#a78bfa", sub: "capturados via webhook" },
          { label: "Em Cadência Ativa", value: kpis.activeCadence, accent: "#c084fc", sub: "recebendo provocações" },
          { label: "Disparos Enviados", value: kpis.totalMessagesSent, accent: "#38bdf8", sub: "mensagens no WhatsApp" },
          { label: "Responderam", value: kpis.replied, accent: "#34d399", sub: "pausados p/ atendimento" },
          { label: "Convertidos", value: kpis.converted, accent: "#4ade80", sub: "viraram clientes ativos" },
        ].map((card) => (
          <div
            key={card.label}
            style={{
              background: "#17171c",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 12,
              padding: "13px 15px",
            }}
          >
            <div style={{ fontSize: 11, color: "#8e8e98", fontWeight: 600 }}>{card.label}</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: card.accent, marginTop: 4 }}>{card.value}</div>
            <div style={{ fontSize: 10.5, color: "#666672", marginTop: 2 }}>{card.sub}</div>
          </div>
        ))}
      </div>

      {/* Main Mode Switcher */}
      <div
        style={{
          display: "flex",
          gap: 8,
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          paddingBottom: 12,
          marginBottom: 18,
        }}
      >
        <button
          onClick={() => setActiveMainTab("funnel")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 16px",
            borderRadius: 9,
            border: activeMainTab === "funnel" ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.08)",
            background: activeMainTab === "funnel" ? "linear-gradient(135deg,#7C5AC2,#5c3ea3)" : "#18181d",
            color: activeMainTab === "funnel" ? "#fff" : "#a1a1aa",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Zap size={14} />
          Funil & Envios ({leads.length})
        </button>

        <button
          onClick={() => setActiveMainTab("cadence")}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 7,
            padding: "9px 16px",
            borderRadius: 9,
            border: activeMainTab === "cadence" ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.08)",
            background: activeMainTab === "cadence" ? "linear-gradient(135deg,#7C5AC2,#5c3ea3)" : "#18181d",
            color: activeMainTab === "cadence" ? "#fff" : "#a1a1aa",
            fontSize: 12.5,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <SlidersHorizontal size={14} />
          Régua Provocante (Mensagens)
        </button>
      </div>

      {activeMainTab === "funnel" ? (
        <div>
          {/* Search + Status Filter */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 10,
              alignItems: "center",
              justifyContent: "space-between",
              marginBottom: 16,
            }}
          >
            <div style={{ position: "relative", flex: "1 1 260px", maxWidth: 420 }}>
              <Search
                size={14}
                style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#71717a" }}
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar lead por nome, WhatsApp ou produto..."
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 34px",
                  borderRadius: 9,
                  background: "#18181d",
                  border: "1px solid rgba(255,255,255,0.09)",
                  color: "#f4f4f5",
                  fontSize: 12.5,
                  outline: "none",
                }}
              />
            </div>

            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[
                { id: "all", label: "Todos" },
                { id: "active_cadence", label: "Em Cadência" },
                { id: "replied", label: "Responderam" },
                { id: "paused", label: "Pausados" },
                { id: "converted", label: "Convertidos" },
                { id: "completed", label: "Concluídos" },
              ].map((st) => (
                <button
                  key={st.id}
                  onClick={() => setStatusFilter(st.id)}
                  style={{
                    padding: "6px 11px",
                    borderRadius: 8,
                    border: statusFilter === st.id ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.08)",
                    background: statusFilter === st.id ? "rgba(124,90,194,0.2)" : "#17171c",
                    color: statusFilter === st.id ? "#e9d5ff" : "#9ca3af",
                    fontSize: 11.5,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>

          {/* Leads List */}
          {loading ? (
            <div style={{ padding: 40, textAlign: "center", color: "#8e8e98" }}>
              Carregando leads e agendamentos...
            </div>
          ) : leads.length === 0 ? (
            <div
              style={{
                background: "#17171c",
                border: "1px dashed rgba(255,255,255,0.12)",
                borderRadius: 14,
                padding: "42px 20px",
                textAlign: "center",
              }}
            >
              <Sparkles size={28} color="#7C5AC2" style={{ marginBottom: 10 }} />
              <div style={{ fontSize: 15, fontWeight: 700, color: "#f4f4f5" }}>
                Nenhum lead na régua com este filtro
              </div>
              <p style={{ fontSize: 12.5, color: "#8e8e98", maxWidth: 480, margin: "6px auto 16px" }}>
                Assim que um lojista abrir a demonstração gratuita no PDV Lojista (ou em outro sistema integrado), ele cai aqui automaticamente e já recebe a 1ª abordagem no WhatsApp.
              </p>
              <button
                onClick={() => setShowSimulateModal(true)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 9,
                  border: "none",
                  background: "linear-gradient(135deg,#7C5AC2,#5c3ea3)",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Simular Meu Próprio Número Agora
              </button>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {leads.map((lead) => {
                const meta = STATUS_META[lead.status] ?? STATUS_META.active_cadence;
                const progressPct = Math.min(
                  100,
                  Math.round((Math.min(lead.sentCount, lead.totalSteps) / Math.max(1, lead.totalSteps)) * 100),
                );
                const isExpanded = expandedLeadId === lead.id;
                const isBusy = busyLeadId === lead.id;
                const timeline = leadMessages[lead.id] ?? [];

                return (
                  <div
                    key={lead.id}
                    style={{
                      background: "#17171c",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 13,
                      padding: isMobile ? "13px" : "15px 18px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 12,
                      }}
                    >
                      {/* Lead Identity */}
                      <div style={{ minWidth: 220, flex: "1 1 260px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 15, fontWeight: 700, color: "#fafafa" }}>{lead.name}</span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 700,
                              padding: "2px 8px",
                              borderRadius: 999,
                              background: meta.bg,
                              border: `1px solid ${meta.border}`,
                              color: meta.color,
                            }}
                          >
                            {meta.label}
                          </span>
                          <span
                            style={{
                              fontSize: 10.5,
                              fontWeight: 600,
                              padding: "2px 8px",
                              borderRadius: 6,
                              background: "rgba(255,255,255,0.06)",
                              color: "#c4b5fd",
                            }}
                          >
                            {lead.sourceLabel}
                          </span>
                          {lead.accessCount > 1 && (
                            <span
                              style={{
                                fontSize: 10.5,
                                fontWeight: 700,
                                padding: "2px 7px",
                                borderRadius: 6,
                                background: "rgba(249, 115, 22, 0.16)",
                                color: "#fdba74",
                              }}
                            >
                              🔥 {lead.accessCount}x na Demo
                            </span>
                          )}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: 14,
                            marginTop: 6,
                            fontSize: 12,
                            color: "#9ca3af",
                          }}
                        >
                          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                            <Phone size={12} color="#a78bfa" />
                            {formatPhoneBr(lead.phone)}
                          </span>
                          <span>Último acesso: {formatDateTimeBr(lead.lastAccessAt)}</span>
                          {lead.lastSentAt && <span>Último envio: {formatDateTimeBr(lead.lastSentAt)}</span>}
                        </div>
                      </div>

                      {/* Cadence Progress */}
                      <div style={{ minWidth: 210, flex: "1 1 220px" }}>
                        <div
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            fontSize: 11.5,
                            marginBottom: 5,
                          }}
                        >
                          <span style={{ color: "#d4d4d8", fontWeight: 600 }}>
                            {lead.sentCount} de {lead.totalSteps} provocações enviadas
                          </span>
                          <span style={{ color: "#a78bfa", fontWeight: 700 }}>{progressPct}%</span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            borderRadius: 999,
                            background: "rgba(255,255,255,0.07)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${progressPct}%`,
                              height: "100%",
                              background: "linear-gradient(90deg, #7C5AC2, #a855f7)",
                              borderRadius: 999,
                            }}
                          />
                        </div>
                        <div style={{ fontSize: 11, color: "#8e8e98", marginTop: 5 }}>
                          {lead.status === "active_cadence" && lead.nextStepAt ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#c4b5fd" }}>
                              <Clock size={11} />
                              Próx. etapa #{lead.nextStepOrder} em {formatDateTimeBr(lead.nextStepAt)}
                            </span>
                          ) : lead.pauseReason ? (
                            <span>{lead.pauseReason}</span>
                          ) : lead.repliedAt ? (
                            <span style={{ color: "#6ee7b7" }}>
                              Respondeu em {formatDateTimeBr(lead.repliedAt)}
                            </span>
                          ) : (
                            <span>Sem envios pendentes</span>
                          )}
                        </div>
                      </div>

                      {/* Quick Actions */}
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <button
                          onClick={() => navigate(`/monitoramento?phone=${encodeURIComponent(lead.phone)}`)}
                          title="Abrir conversa ao vivo no Monitoramento"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            padding: "7px 11px",
                            borderRadius: 8,
                            border: "1px solid rgba(124,90,194,0.45)",
                            background: "rgba(124,90,194,0.18)",
                            color: "#e9d5ff",
                            fontSize: 11.5,
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <MessageSquare size={13} />
                          Chat
                        </button>

                        {lead.status !== "opted_out" && lead.status !== "converted" && (
                          <button
                            disabled={isBusy}
                            onClick={() => handleSendNextNow(lead)}
                            title="Disparar a próxima mensagem provocante imediatamente"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                              padding: "7px 11px",
                              borderRadius: 8,
                              border: "1px solid rgba(255,255,255,0.12)",
                              background: "#22222a",
                              color: "#f4f4f5",
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                              opacity: isBusy ? 0.6 : 1,
                            }}
                          >
                            <Send size={12} />
                            Enviar Agora
                          </button>
                        )}

                        {lead.status === "active_cadence" ? (
                          <button
                            disabled={isBusy}
                            onClick={() => handleUpdateLeadStatus(lead, "paused", "Cadência pausada para este lead.")}
                            title="Pausar envios automáticos"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "7px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(245,158,11,0.3)",
                              background: "rgba(245,158,11,0.1)",
                              color: "#fcd34d",
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <Pause size={12} />
                            Pausar
                          </button>
                        ) : lead.status !== "converted" && lead.status !== "opted_out" ? (
                          <button
                            disabled={isBusy}
                            onClick={() =>
                              handleUpdateLeadStatus(lead, "active_cadence", "Cadência retomada para este lead!")
                            }
                            title="Retomar envios automáticos"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "7px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(16,185,129,0.35)",
                              background: "rgba(16,185,129,0.12)",
                              color: "#6ee7b7",
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <Play size={12} />
                            Retomar
                          </button>
                        ) : null}

                        {lead.status !== "converted" && (
                          <button
                            disabled={isBusy}
                            onClick={() =>
                              handleUpdateLeadStatus(lead, "converted", "Parabéns! Lead marcado como convertido!")
                            }
                            title="Marcar como cliente fechado (encerra provocações)"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 4,
                              padding: "7px 10px",
                              borderRadius: 8,
                              border: "1px solid rgba(34,197,94,0.35)",
                              background: "rgba(34,197,94,0.1)",
                              color: "#86efac",
                              fontSize: 11.5,
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <CheckCircle2 size={12} />
                            Converter
                          </button>
                        )}

                        <button
                          onClick={() => loadLeadTimeline(lead.id)}
                          title="Ver mensagens enviadas e respostas"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            padding: "7px 9px",
                            borderRadius: 8,
                            border: "1px solid rgba(255,255,255,0.09)",
                            background: "transparent",
                            color: "#a1a1aa",
                            fontSize: 11.5,
                            cursor: "pointer",
                          }}
                        >
                          <Eye size={13} />
                          {isExpanded ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                        </button>
                      </div>
                    </div>

                    {/* Expandable Message History */}
                    {isExpanded && (
                      <div
                        style={{
                          marginTop: 14,
                          paddingTop: 14,
                          borderTop: "1px solid rgba(255,255,255,0.07)",
                        }}
                      >
                        <div style={{ fontSize: 11.5, fontWeight: 700, color: "#a1a1aa", marginBottom: 10 }}>
                          Histórico de Disparos & Respostas no WhatsApp
                        </div>
                        {loadingTimelineId === lead.id ? (
                          <div style={{ fontSize: 12, color: "#71717a" }}>Carregando mensagens...</div>
                        ) : timeline.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#71717a" }}>
                            Nenhuma mensagem disparada ainda. A 1ª etapa será enviada no horário agendado.
                          </div>
                        ) : (
                          <div style={{ display: "flex", flexDirection: "column", gap: 8, maxHeight: 320, overflowY: "auto" }}>
                            {timeline.map((m) => {
                              const inbound = m.direction === "inbound";
                              return (
                                <div
                                  key={m.id}
                                  style={{
                                    alignSelf: inbound ? "flex-start" : "flex-end",
                                    maxWidth: "86%",
                                    background: inbound ? "#23232b" : "rgba(124, 90, 194, 0.2)",
                                    border: inbound
                                      ? "1px solid rgba(255,255,255,0.1)"
                                      : "1px solid rgba(124, 90, 194, 0.4)",
                                    borderRadius: 10,
                                    padding: "9px 12px",
                                  }}
                                >
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      gap: 10,
                                      fontSize: 10.5,
                                      color: inbound ? "#6ee7b7" : "#c4b5fd",
                                      fontWeight: 700,
                                      marginBottom: 4,
                                    }}
                                  >
                                    <span>
                                      {inbound
                                        ? "Resposta do Lead"
                                        : m.cadenceStep === 99
                                        ? "Gatilho: Reacesso à Demo"
                                        : m.cadenceStep
                                        ? `Etapa #${m.cadenceStep}`
                                        : "Mensagem Enviada"}
                                    </span>
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#9ca3af" }}>
                                      {formatDateTimeBr(m.sentAt || m.createdAt)}
                                      {m.status === "sent" && <CheckCheck size={12} color="#a78bfa" />}
                                      {m.status === "failed" && <AlertCircle size={12} color="#f87171" />}
                                    </span>
                                  </div>
                                  <div style={{ fontSize: 12, color: "#f4f4f5", whiteSpace: "pre-wrap", lineHeight: 1.45 }}>
                                    {m.body}
                                  </div>
                                  {m.lastError && m.status !== "sent" && (
                                    <div style={{ fontSize: 10.5, color: "#fca5a5", marginTop: 4 }}>
                                      Status ({m.status}): {m.lastError}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      ) : (
        /* TAB 2: CADENCE EDITOR */
        <div>
          <div
            style={{
              background: "#17171c",
              border: "1px solid rgba(124,90,194,0.3)",
              borderRadius: 13,
              padding: "16px 18px",
              marginBottom: 18,
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: 14,
            }}
          >
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                  Sistema / Origem da Régua
                </label>
                <select
                  value={editorSource}
                  onChange={(e) => setEditorSource(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fafafa",
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  {sources.map((s) => (
                    <option key={s.source} value={s.source}>
                      {s.label} ({s.source})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11, color: "#9ca3af", marginBottom: 4 }}>
                  Nome exibido em {"{produto}"}
                </label>
                <input
                  value={editorProductLabel}
                  onChange={(e) => setEditorProductLabel(e.target.value)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fafafa",
                    fontSize: 13,
                    width: 200,
                  }}
                />
              </div>

              <div style={{ fontSize: 12, color: "#a1a1aa", maxWidth: 380 }}>
                <strong>{sequenceStepsCount} etapas ativas</strong> • Se o lead responder ou virar cliente, os próximos disparos param sozinhos na hora.
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                onClick={handleAddSequenceStep}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.14)",
                  background: "#202028",
                  color: "#e4e4e7",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                <Plus size={14} />
                Nova Etapa
              </button>

              <button
                disabled={savingCadence}
                onClick={handleResetCadenceDefaults}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 12px",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.12)",
                  background: "transparent",
                  color: "#a1a1aa",
                  fontSize: 12,
                  fontWeight: 500,
                  cursor: "pointer",
                }}
              >
                <RotateCcw size={13} />
                Restaurar Padrão
              </button>

              <button
                disabled={savingCadence}
                onClick={handleSaveCadence}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 16px",
                  borderRadius: 8,
                  border: "none",
                  background: "linear-gradient(135deg,#7C5AC2,#5c3ea3)",
                  color: "#fff",
                  fontSize: 12.5,
                  fontWeight: 700,
                  cursor: "pointer",
                  opacity: savingCadence ? 0.6 : 1,
                }}
              >
                <Save size={14} />
                {savingCadence ? "Salvando..." : "Salvar Régua"}
              </button>
            </div>
          </div>

          {/* Variable Legend */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 6,
              alignItems: "center",
              marginBottom: 14,
              fontSize: 11.5,
              color: "#9ca3af",
            }}
          >
            <span>Variáveis disponíveis:</span>
            {TEMPLATE_VARIABLES.map((v) => (
              <span
                key={v.token}
                title={v.desc}
                style={{
                  padding: "3px 8px",
                  borderRadius: 6,
                  background: "rgba(124,90,194,0.15)",
                  border: "1px solid rgba(124,90,194,0.3)",
                  color: "#d8b4fe",
                  fontFamily: "monospace",
                  fontSize: 11,
                }}
              >
                {v.token}
              </span>
            ))}
          </div>

          {loadingCadence ? (
            <div style={{ padding: 36, textAlign: "center", color: "#8e8e98" }}>Carregando régua...</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {cadenceSteps.map((step, idx) => {
                const { value: delayVal, unit: delayUnit } = splitDelayUnit(step.delayMinutes);
                const isReaccess = step.stepKind === "reaccess";

                return (
                  <div
                    key={`${step.stepKind}-${idx}`}
                    style={{
                      background: "#17171c",
                      border: isReaccess
                        ? "1px solid rgba(249, 115, 22, 0.35)"
                        : step.enabled
                        ? "1px solid rgba(124, 90, 194, 0.32)"
                        : "1px solid rgba(255,255,255,0.07)",
                      borderRadius: 13,
                      padding: isMobile ? "14px" : "16px 20px",
                      opacity: step.enabled ? 1 : 0.62,
                    }}
                  >
                    {/* Step Header */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flex: "1 1 280px" }}>
                        <span
                          style={{
                            padding: "4px 9px",
                            borderRadius: 7,
                            background: isReaccess ? "rgba(249,115,22,0.2)" : "rgba(124,90,194,0.25)",
                            color: isReaccess ? "#fdba74" : "#d8b4fe",
                            fontSize: 11,
                            fontWeight: 800,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {isReaccess ? "GATILHO REACESSO" : `ETAPA #${idx + 1}`}
                        </span>
                        <input
                          value={step.title}
                          onChange={(e) => handleStepChange(idx, { title: e.target.value })}
                          style={{
                            flex: 1,
                            padding: "7px 10px",
                            borderRadius: 8,
                            background: "#111114",
                            border: "1px solid rgba(255,255,255,0.1)",
                            color: "#fafafa",
                            fontSize: 13,
                            fontWeight: 600,
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        {/* Delay Editor */}
                        <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                          <span style={{ fontSize: 11.5, color: "#9ca3af" }}>
                            {idx === 0 && !isReaccess ? "Após abrir demo:" : isReaccess ? "Após reentrar:" : "Espera após anterior:"}
                          </span>
                          <input
                            type="number"
                            min={0}
                            value={delayVal}
                            onChange={(e) => {
                              const raw = Math.max(0, Number(e.target.value) || 0);
                              const mult = delayUnit === "days" ? 1440 : delayUnit === "hours" ? 60 : 1;
                              handleStepChange(idx, { delayMinutes: raw * mult });
                            }}
                            style={{
                              width: 60,
                              padding: "6px 8px",
                              borderRadius: 7,
                              background: "#111114",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "#fff",
                              fontSize: 12.5,
                              textAlign: "center",
                            }}
                          />
                          <select
                            value={delayUnit}
                            onChange={(e) => {
                              const u = e.target.value as "min" | "hours" | "days";
                              const mult = u === "days" ? 1440 : u === "hours" ? 60 : 1;
                              handleStepChange(idx, { delayMinutes: Math.max(1, delayVal) * mult });
                            }}
                            style={{
                              padding: "6px 8px",
                              borderRadius: 7,
                              background: "#111114",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "#d4d4d8",
                              fontSize: 12,
                            }}
                          >
                            <option value="min">min</option>
                            <option value="hours">horas</option>
                            <option value="days">dias</option>
                          </select>
                        </div>

                        <label
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 11.5,
                            color: "#cbd5e1",
                            cursor: "pointer",
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={step.enabled}
                            onChange={(e) => handleStepChange(idx, { enabled: e.target.checked })}
                          />
                          Ativa
                        </label>

                        {!isReaccess && (
                          <button
                            onClick={() => handleRemoveStep(idx)}
                            title="Remover etapa"
                            style={{
                              padding: 6,
                              borderRadius: 7,
                              border: "1px solid rgba(239,68,68,0.25)",
                              background: "rgba(239,68,68,0.08)",
                              color: "#fca5a5",
                              cursor: "pointer",
                            }}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Commercial Hours Row */}
                    <div
                      style={{
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        gap: 12,
                        marginBottom: 10,
                        fontSize: 11.5,
                        color: "#9ca3af",
                      }}
                    >
                      <label style={{ display: "inline-flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
                        <input
                          type="checkbox"
                          checked={step.respectBusinessHours}
                          onChange={(e) => handleStepChange(idx, { respectBusinessHours: e.target.checked })}
                        />
                        Respeitar janela comercial (evita madrugada)
                      </label>

                      {step.respectBusinessHours && (
                        <div style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                          <span>Enviar somente entre</span>
                          <input
                            type="number"
                            min={6}
                            max={21}
                            value={step.businessStartHour}
                            onChange={(e) =>
                              handleStepChange(idx, { businessStartHour: Number(e.target.value) || 9 })
                            }
                            style={{
                              width: 46,
                              padding: "3px 6px",
                              borderRadius: 6,
                              background: "#111114",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "#fff",
                              textAlign: "center",
                            }}
                          />
                          <span>h e</span>
                          <input
                            type="number"
                            min={8}
                            max={23}
                            value={step.businessEndHour}
                            onChange={(e) =>
                              handleStepChange(idx, { businessEndHour: Number(e.target.value) || 20 })
                            }
                            style={{
                              width: 46,
                              padding: "3px 6px",
                              borderRadius: 6,
                              background: "#111114",
                              border: "1px solid rgba(255,255,255,0.12)",
                              color: "#fff",
                              textAlign: "center",
                            }}
                          />
                          <span>h (Brasília)</span>
                        </div>
                      )}
                    </div>

                    {/* Template Editor + Live WhatsApp Preview */}
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: isMobile ? "1fr" : "1.25fr 1fr",
                        gap: 12,
                      }}
                    >
                      <div>
                        <textarea
                          rows={5}
                          value={step.bodyTemplate}
                          onChange={(e) => handleStepChange(idx, { bodyTemplate: e.target.value })}
                          style={{
                            width: "100%",
                            padding: "10px 12px",
                            borderRadius: 9,
                            background: "#111114",
                            border: "1px solid rgba(255,255,255,0.12)",
                            color: "#f4f4f5",
                            fontSize: 12.5,
                            lineHeight: 1.5,
                            resize: "vertical",
                            fontFamily: "inherit",
                          }}
                        />
                      </div>

                      <div
                        style={{
                          background: "#0e1512",
                          border: "1px solid rgba(34, 197, 94, 0.22)",
                          borderRadius: 10,
                          padding: "10px 12px",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                        }}
                      >
                        <div>
                          <div
                            style={{
                              fontSize: 10,
                              fontWeight: 700,
                              color: "#6ee7b7",
                              textTransform: "uppercase",
                              letterSpacing: "0.04em",
                              marginBottom: 6,
                            }}
                          >
                            Prévia no WhatsApp do Lojista ({formatDelayHuman(step.delayMinutes)})
                          </div>
                          <div
                            style={{
                              fontSize: 12,
                              color: "#ecfdf5",
                              whiteSpace: "pre-wrap",
                              lineHeight: 1.45,
                            }}
                          >
                            {renderPreviewText(
                              step.bodyTemplate,
                              editorProductLabel,
                              editorCompanyName,
                              editorAssistantName,
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal: Simulate / Manual Demo Lead */}
      {showSimulateModal && (
        <div
          onClick={() => setShowSimulateModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            zIndex: 100000,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(430px, 100%)",
              background: "#18181f",
              border: "1px solid rgba(124,90,194,0.4)",
              borderRadius: 14,
              padding: "22px",
              boxShadow: "0 24px 70px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fafafa" }}>
                Adicionar / Testar Lead na Régua
              </h3>
              <button
                onClick={() => setShowSimulateModal(false)}
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateSimulatedLead} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#a1a1aa", marginBottom: 4 }}>
                  Produto / Sistema
                </label>
                <select
                  value={simSource}
                  onChange={(e) => setSimSource(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                >
                  {sources.map((s) => (
                    <option key={s.source} value={s.source}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#a1a1aa", marginBottom: 4 }}>
                  Nome do Cliente / Loja
                </label>
                <input
                  required
                  value={simName}
                  onChange={(e) => setSimName(e.target.value)}
                  placeholder="Ex: Loja Estilo Urbano"
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#a1a1aa", marginBottom: 4 }}>
                  WhatsApp (DDD + Número)
                </label>
                <input
                  required
                  value={simPhone}
                  onChange={(e) => setSimPhone(e.target.value)}
                  placeholder="Ex: (11) 99999-8888"
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#a1a1aa", marginBottom: 4 }}>
                  Observação (opcional)
                </label>
                <input
                  value={simNotes}
                  onChange={(e) => setSimNotes(e.target.value)}
                  placeholder="Ex: Veio pelo Instagram / Teste interno"
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowSimulateModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                    color: "#a1a1aa",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creatingSim}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg,#7C5AC2,#5c3ea3)",
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {creatingSim ? "Iniciando..." : "Iniciar Régua"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showWebhookModal && (
        <div
          onClick={() => setShowWebhookModal(false)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.72)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 16,
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "min(460px, 100%)",
              background: "#18181f",
              border: "1px solid rgba(16,185,129,0.4)",
              borderRadius: 14,
              padding: "22px",
              boxShadow: "0 24px 70px rgba(0,0,0,0.8)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
              <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fafafa" }}>
                Conectar Produto / Segredo Webhook
              </h3>
              <button
                onClick={() => setShowWebhookModal(false)}
                style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer" }}
              >
                <X size={18} />
              </button>
            </div>
            <p style={{ margin: "0 0 14px", fontSize: 12, color: "#9ca3af", lineHeight: 1.45 }}>
              Salva o segredo criptografado no PostgreSQL do Leadger e ativa imediatamente{" "}
              <code style={{ color: "#6ee7b7" }}>/api/webhooks/inbound/{whSource || "pdv_lojista"}</code> sem precisar editar variáveis no Portainer.
            </p>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setSavingWebhook(true);
                try {
                  await API.post("/integrations/webhooks", {
                    source: whSource.trim(),
                    name: whName.trim(),
                    secret: whSecret.trim(),
                  });
                  toast.success(`Integração "${whName}" ativada com sucesso!`);
                  setWhSecret("");
                  setShowWebhookModal(false);
                  void fetchFunnel(false);
                } catch (err: any) {
                  toast.error(err.message || "Falha ao salvar segredo do webhook");
                } finally {
                  setSavingWebhook(false);
                }
              }}
              style={{ display: "flex", flexDirection: "column", gap: 12 }}
            >
              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#a1a1aa", marginBottom: 4 }}>
                  Source (identificador único na URL)
                </label>
                <input
                  required
                  value={whSource}
                  onChange={(e) => setWhSource(e.target.value)}
                  placeholder="pdv_lojista"
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#a1a1aa", marginBottom: 4 }}>
                  Nome do Produto
                </label>
                <input
                  required
                  value={whName}
                  onChange={(e) => setWhName(e.target.value)}
                  placeholder="PDV Lojista"
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontSize: 13,
                  }}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 11.5, color: "#a1a1aa", marginBottom: 4 }}>
                  Segredo Compartilhado (LEADGER_WEBHOOK_SECRET — mín. 32 caracteres)
                </label>
                <input
                  required
                  minLength={32}
                  value={whSecret}
                  onChange={(e) => setWhSecret(e.target.value)}
                  placeholder="Cole aqui o mesmo segredo configurado no sistema emissor"
                  style={{
                    width: "100%",
                    padding: "9px 11px",
                    borderRadius: 8,
                    background: "#111114",
                    border: "1px solid rgba(255,255,255,0.14)",
                    color: "#fff",
                    fontSize: 13,
                    fontFamily: "monospace",
                  }}
                />
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, marginTop: 6 }}>
                <button
                  type="button"
                  onClick={() => setShowWebhookModal(false)}
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    border: "1px solid rgba(255,255,255,0.12)",
                    background: "transparent",
                    color: "#a1a1aa",
                    fontSize: 12.5,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={savingWebhook}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "none",
                    background: "linear-gradient(135deg,#10b981,#059669)",
                    color: "#fff",
                    fontSize: 12.5,
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  {savingWebhook ? "Salvando..." : "Salvar & Ativar"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
