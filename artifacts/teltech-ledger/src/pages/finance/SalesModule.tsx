import { useState, useEffect, useMemo, useCallback } from "react";
import { Plus, Trash2, Repeat2, Receipt, AlertTriangle, ChevronDown, Layers, Sparkles, Pause, Play, Ban } from "lucide-react";
import { toast } from "sonner";
import { API } from "../../lib/api";
import { Drawer, Select, Checkbox, DateInput, drawerBtn, confirmDialog } from "../../components/finance-ui";

// ─── Tipos ────────────────────────────────────────────────────────────────────

export interface SaasModule {
  id: string;
  name: string;
  description?: string | null;
  defaultPrice: number;
  isActive: boolean;
}

export interface SaleModuleView {
  id: string;
  moduleId: string;
  name: string;
  price: number;
  startDate: string;
  endDate: string | null;
  active: boolean;
}

export interface SaleItemView {
  id: string;
  kind: "project" | "subscription";
  label: string;
  status: string;
  totalAmount: number;
  installmentsCount: number;
  paymentMode: string;
  firstDueDate: string | null;
  startMode: string | null;
  billingDay: number;
  startDate: string | null;
  endDate: string | null;
  fixedAmount: number | null;
  currentMonthly: number;
  modules: SaleModuleView[];
  paid: number;
  pending: number;
  overdue: number;
  nextDueDate: string | null;
  nextDueAmount: number | null;
}

export interface SaleView {
  id: string;
  clientId: string;
  clientName: string;
  projectId: string | null;
  projectName: string | null;
  title: string;
  status: "active" | "paused" | "cancelled" | "completed";
  notes: string | null;
  createdAt: string;
  items: SaleItemView[];
}

interface ClientLite {
  id: string;
  name: string;
  projectId?: string;
  status?: string;
}

interface ProjectLite {
  id: string;
  name: string;
}

interface PreviewData {
  entry: Array<{ label: string; amount: number; dueDate: string }>;
  entryTotal: number;
  subscription: null | {
    awaitingStart: boolean;
    firstDueDate: string | null;
    monthlyAmount: number;
    charges: Array<{ referenceMonth: string; dueDate: string; amount: number }>;
  };
  firstYearTotal: number;
  warnings: string[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const brl = (cents?: number | null) =>
  (typeof cents === "number" && !isNaN(cents) ? cents / 100 : 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

function parseMoney(value: string): number {
  const cleaned = value.replace(/[^\d,]/g, "").replace(",", ".");
  const n = parseFloat(cleaned || "0");
  return isNaN(n) ? 0 : Math.round(n * 100);
}

const centsToInput = (cents: number) => (cents / 100).toFixed(2).replace(".", ",");

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

// Vencimentos são gravados ao meio-dia UTC: formatar em UTC evita "voltar um dia".
function fmtDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
}

function fmtMonth(referenceMonth: string): string {
  const [y, m] = referenceMonth.split("-");
  return `${m}/${y}`;
}

const START_MODE_OPTIONS: Array<{ value: string; label: string; help: string; needsEntry: boolean }> = [
  { value: "with_entry", label: "Junto com a entrada", help: "A 1ª mensalidade vence no mesmo mês da 1ª parcela da entrada.", needsEntry: true },
  { value: "after_entry", label: "Depois de quitar a entrada", help: "A 1ª mensalidade vence no mês seguinte à última parcela da entrada.", needsEntry: true },
  { value: "fixed_date", label: "Em uma data específica", help: "Você escolhe a data do 1º vencimento.", needsEntry: false },
  { value: "after_delivery", label: "Após a entrega do projeto", help: "Fica aguardando. Você inicia manualmente quando o projeto for entregue.", needsEntry: false },
];

const SALE_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativa", color: "#10B981" },
  paused: { label: "Pausada", color: "#F59E0B" },
  cancelled: { label: "Cancelada", color: "#EF4444" },
  completed: { label: "Concluída", color: "#9CA3AF" },
};

const ITEM_STATUS: Record<string, { label: string; color: string }> = {
  active: { label: "Ativo", color: "#10B981" },
  awaiting_start: { label: "Aguardando início", color: "#F59E0B" },
  paused: { label: "Pausado", color: "#F59E0B" },
  cancelled: { label: "Cancelado", color: "#EF4444" },
  completed: { label: "Concluído", color: "#9CA3AF" },
};

const inputStyle: React.CSSProperties = {
  width: "100%",
  background: "#111113",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 8,
  padding: "9px 10px",
  color: "#fff",
  fontSize: 13,
  outline: "none",
  boxSizing: "border-box",
};

const labelStyle: React.CSSProperties = { display: "block", fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 };

function SectionCard({ active, onToggle, icon, title, subtitle, children }: {
  active: boolean;
  onToggle: () => void;
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children?: React.ReactNode;
}) {
  return (
    <div style={{ border: `1px solid ${active ? "rgba(139,92,246,0.45)" : "rgba(255,255,255,0.08)"}`, background: active ? "rgba(139,92,246,0.06)" : "rgba(255,255,255,0.02)", borderRadius: 12, flexShrink: 0 }}>
      <button
        type="button"
        onClick={onToggle}
        style={{ width: "100%", display: "flex", alignItems: "center", gap: 10, padding: "12px 14px", background: "transparent", border: "none", cursor: "pointer", textAlign: "left" }}
      >
        <span style={{ width: 18, height: 18, borderRadius: 5, border: `1.5px solid ${active ? "#8B5CF6" : "#555"}`, background: active ? "#8B5CF6" : "transparent", display: "inline-flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 800 }}>
          {active ? "✓" : ""}
        </span>
        <span style={{ color: active ? "#A78BFA" : "#888", display: "inline-flex" }}>{icon}</span>
        <span style={{ display: "flex", flexDirection: "column" }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}>{title}</span>
          <span style={{ fontSize: 11, color: "#888" }}>{subtitle}</span>
        </span>
      </button>
      {active && <div style={{ padding: "4px 14px 14px", display: "flex", flexDirection: "column", gap: 12 }}>{children}</div>}
    </div>
  );
}

// ─── Assistente "Nova Venda" ──────────────────────────────────────────────────

interface MilestoneDraft { label: string; amount: string; dueDate: string }

export function SalesWizardModal({
  clients,
  projects,
  initialClientId,
  onClose,
  onSaved,
}: {
  clients: ClientLite[];
  projects: ProjectLite[];
  initialClientId?: string | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const activeClients = useMemo(() => clients.filter((c) => c.status !== "inactive"), [clients]);

  const [clientId, setClientId] = useState(initialClientId && activeClients.some((c) => c.id === initialClientId) ? initialClientId : "");
  const [projectId, setProjectId] = useState(() => clients.find((c) => c.id === initialClientId)?.projectId ?? "");
  const [notes, setNotes] = useState("");

  const [sellProject, setSellProject] = useState(true);
  const [sellSub, setSellSub] = useState(true);

  // Entrada / Projeto
  const [entryLabel, setEntryLabel] = useState("Entrada");
  const [entryMode, setEntryMode] = useState<"installments" | "milestones">("installments");
  const [entryTotal, setEntryTotal] = useState("");
  const [entryCount, setEntryCount] = useState("1");
  const [entryFirstDue, setEntryFirstDue] = useState(todayStr());
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { label: "Kickoff", amount: "", dueDate: todayStr() },
    { label: "Entrega", amount: "", dueDate: "" },
  ]);

  // Mensalidade
  const [subLabel, setSubLabel] = useState("Mensalidade");
  const [startMode, setStartMode] = useState("after_entry");
  const [billingDay, setBillingDay] = useState("10");
  const [fixedDate, setFixedDate] = useState(todayStr());
  const [endDate, setEndDate] = useState("");
  const [catalog, setCatalog] = useState<SaasModule[]>([]);
  const [catalogLoaded, setCatalogLoaded] = useState(false);
  const [useModules, setUseModules] = useState(true);
  const [selectedModules, setSelectedModules] = useState<Record<string, string>>({});
  const [fixedAmount, setFixedAmount] = useState("");

  const [preview, setPreview] = useState<PreviewData | null>(null);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    API.get("/finance/modules")
      .then((res) => {
        const list: SaasModule[] = (res?.modules ?? []).filter((m: SaasModule) => m.isActive);
        setCatalog(list);
        if (list.length === 0) setUseModules(false);
      })
      .catch(() => setUseModules(false))
      .finally(() => setCatalogLoaded(true));
  }, []);

  // Início da mensalidade depende da entrada: se não há entrada, não faz sentido "junto/depois".
  useEffect(() => {
    const opt = START_MODE_OPTIONS.find((o) => o.value === startMode);
    if (!sellProject && opt?.needsEntry) setStartMode("fixed_date");
  }, [sellProject, startMode]);

  const onPickClient = (id: string) => {
    setClientId(id);
    const c = clients.find((x) => x.id === id);
    if (c?.projectId && !projectId) setProjectId(c.projectId);
  };

  const toggleModule = (m: SaasModule) => {
    setSelectedModules((prev) => {
      const next = { ...prev };
      if (m.id in next) delete next[m.id];
      else next[m.id] = centsToInput(m.defaultPrice);
      return next;
    });
  };

  const monthlyTotal = useMemo(() => {
    if (useModules) return Object.values(selectedModules).reduce((s, v) => s + parseMoney(v), 0);
    return parseMoney(fixedAmount);
  }, [useModules, selectedModules, fixedAmount]);

  // Monta o corpo da requisição; retorna null enquanto o formulário estiver incompleto.
  const payload = useMemo(() => {
    if (!clientId || (!sellProject && !sellSub)) return null;
    const body: Record<string, unknown> = { clientId, projectId: projectId || null, notes: notes.trim() || null };

    if (sellProject) {
      if (entryMode === "installments") {
        const total = parseMoney(entryTotal);
        const count = parseInt(entryCount, 10);
        if (total <= 0 || !count || count < 1 || !entryFirstDue) return null;
        body.entry = { label: entryLabel.trim() || "Entrada", mode: "installments", totalAmount: total, installmentsCount: count, firstDueDate: entryFirstDue };
      } else {
        const rows = milestones.map((m) => ({ label: m.label.trim(), amount: parseMoney(m.amount), dueDate: m.dueDate }));
        if (rows.length === 0 || rows.some((r) => r.amount <= 0 || !r.dueDate)) return null;
        body.entry = { label: entryLabel.trim() || "Projeto", mode: "milestones", milestones: rows };
      }
    }

    if (sellSub) {
      const sub: Record<string, unknown> = {
        label: subLabel.trim() || "Mensalidade",
        startMode,
        billingDay: parseInt(billingDay, 10) || 1,
        endDate: endDate || null,
      };
      if (useModules) {
        const mods = Object.entries(selectedModules).map(([moduleId, price]) => ({ moduleId, price: parseMoney(price) }));
        if (mods.length === 0 || mods.some((m) => m.price <= 0)) return null;
        sub.modules = mods;
      } else {
        const amount = parseMoney(fixedAmount);
        if (amount <= 0) return null;
        sub.fixedAmount = amount;
      }
      if (startMode === "fixed_date") {
        if (!fixedDate) return null;
        sub.fixedDate = fixedDate;
      }
      body.subscription = sub;
    }
    return body;
  }, [clientId, projectId, notes, sellProject, sellSub, entryMode, entryLabel, entryTotal, entryCount, entryFirstDue, milestones, subLabel, startMode, billingDay, fixedDate, endDate, useModules, selectedModules, fixedAmount]);

  // Preview ao vivo (debounce) — o servidor é a única fonte das regras de cronograma.
  useEffect(() => {
    if (!payload) {
      setPreview(null);
      setPreviewError(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(() => {
      API.post("/finance/sales/preview", payload)
        .then((res) => {
          if (cancelled) return;
          setPreview(res?.preview ?? null);
          setPreviewError(null);
        })
        .catch((err: Error) => {
          if (cancelled) return;
          setPreview(null);
          setPreviewError(err.message);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [payload]);

  const handleSubmit = async () => {
    if (!payload) {
      toast.error("Preencha os dados da venda para continuar.");
      return;
    }
    try {
      setSaving(true);
      const res = await API.post("/finance/sales", payload);
      toast.success(`Venda criada! ${res?.transactionsCreated ?? 0} cobrança(s) gerada(s) no Livro Caixa.`);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar venda.");
    } finally {
      setSaving(false);
    }
  };

  const startOpt = START_MODE_OPTIONS.find((o) => o.value === startMode);

  return (
    <Drawer
      title="Nova Venda"
      subtitle="Configure uma vez — o sistema gera todas as cobranças."
      icon={<Receipt size={18} />}
      onClose={onClose}
      width={720}
      footer={
        <>
          <button type="button" onClick={onClose} style={drawerBtn.ghost}>
            Cancelar
          </button>
          <button type="button" onClick={handleSubmit} disabled={saving || !payload || !preview} style={drawerBtn.primary(saving || !payload || !preview)}>
            {saving ? "Gerando cobranças..." : "Confirmar venda e gerar cobranças"}
          </button>
        </>
      }
    >

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
          <div>
            <label style={labelStyle}>Cliente *</label>
            <Select value={clientId} onChange={(e) => onPickClient(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Selecione —</option>
              {activeClients.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </Select>
          </div>
          <div>
            <label style={labelStyle}>Produto / Projeto vinculado (opcional)</label>
            <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              <option value="">— Sem vínculo —</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </Select>
          </div>
        </div>

        {/* ── Entrada / Projeto ── */}
        <SectionCard
          active={sellProject}
          onToggle={() => setSellProject(!sellProject)}
          icon={<Receipt size={16} />}
          title="Projeto / Entrada"
          subtitle="Pagamento pontual, em parcelas fixas ou por marcos"
        >
          <div style={{ display: "flex", gap: 8 }}>
            {([["installments", "Parcelas fixas"], ["milestones", "Por marcos"]] as const).map(([val, text]) => (
              <button
                key={val}
                type="button"
                onClick={() => setEntryMode(val)}
                style={{
                  flex: 1, padding: "7px 0", borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: "pointer",
                  border: entryMode === val ? "1px solid #A78BFA" : "1px solid rgba(255,255,255,0.1)",
                  background: entryMode === val ? "rgba(139,92,246,0.15)" : "transparent",
                  color: entryMode === val ? "#A78BFA" : "#777",
                }}
              >
                {text}
              </button>
            ))}
          </div>

          <div>
            <label style={labelStyle}>Descrição</label>
            <input type="text" value={entryLabel} onChange={(e) => setEntryLabel(e.target.value)} placeholder="Ex: Entrada, Projeto Portal..." style={inputStyle} />
          </div>

          {entryMode === "installments" ? (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
              <div>
                <label style={labelStyle}>Valor total (R$) *</label>
                <input type="text" inputMode="decimal" placeholder="0,00" value={entryTotal} onChange={(e) => setEntryTotal(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>Nº de parcelas</label>
                <input type="number" min={1} max={60} value={entryCount} onChange={(e) => setEntryCount(e.target.value)} style={inputStyle} />
              </div>
              <div>
                <label style={labelStyle}>1º vencimento *</label>
                <DateInput  value={entryFirstDue} onChange={(e) => setEntryFirstDue(e.target.value)} style={inputStyle} />
              </div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {milestones.map((m, i) => (
                <div key={i} style={{ display: "grid", gridTemplateColumns: "minmax(0,1.3fr) minmax(0,1fr) minmax(0,1.1fr) auto", gap: 8, alignItems: "end" }}>
                  <div>
                    {i === 0 && <label style={labelStyle}>Marco</label>}
                    <input type="text" value={m.label} placeholder={`Marco ${i + 1}`} onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)))} style={inputStyle} />
                  </div>
                  <div>
                    {i === 0 && <label style={labelStyle}>Valor (R$)</label>}
                    <input type="text" inputMode="decimal" value={m.amount} placeholder="0,00" onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, amount: e.target.value } : x)))} style={inputStyle} />
                  </div>
                  <div>
                    {i === 0 && <label style={labelStyle}>Vencimento</label>}
                    <DateInput  value={m.dueDate} onChange={(e) => setMilestones(milestones.map((x, j) => (j === i ? { ...x, dueDate: e.target.value } : x)))} style={inputStyle} />
                  </div>
                  <button
                    type="button"
                    disabled={milestones.length <= 1}
                    onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}
                    style={{ background: "transparent", border: "none", color: "#777", cursor: milestones.length <= 1 ? "not-allowed" : "pointer", padding: 8 }}
                    title="Remover marco"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => setMilestones([...milestones, { label: "", amount: "", dueDate: "" }])}
                style={{ alignSelf: "flex-start", display: "inline-flex", alignItems: "center", gap: 5, padding: "6px 10px", borderRadius: 8, background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", fontSize: 12, cursor: "pointer" }}
              >
                <Plus size={12} /> Adicionar marco
              </button>
            </div>
          )}
        </SectionCard>

        {/* ── Mensalidade ── */}
        <SectionCard
          active={sellSub}
          onToggle={() => setSellSub(!sellSub)}
          icon={<Repeat2 size={16} />}
          title="Mensalidade (SaaS / manutenção)"
          subtitle="Cobrança recorrente por módulos"
        >
          <div>
            <label style={labelStyle}>Quando a mensalidade começa?</label>
            <Select value={startMode} onChange={(e) => setStartMode(e.target.value)} style={{ ...inputStyle, cursor: "pointer" }}>
              {START_MODE_OPTIONS.map((o) => (
                <option key={o.value} value={o.value} disabled={o.needsEntry && !sellProject}>
                  {o.label}{o.needsEntry && !sellProject ? " (requer entrada)" : ""}
                </option>
              ))}
            </Select>
            {startOpt && <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>{startOpt.help}</div>}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 12 }}>
            {(startMode === "with_entry" || startMode === "after_entry" || startMode === "after_delivery") && (
              <div>
                <label style={labelStyle}>Dia de vencimento (1–28)</label>
                <input type="number" min={1} max={28} value={billingDay} onChange={(e) => setBillingDay(e.target.value)} style={inputStyle} />
              </div>
            )}
            {startMode === "fixed_date" && (
              <div>
                <label style={labelStyle}>1º vencimento *</label>
                <DateInput  value={fixedDate} onChange={(e) => setFixedDate(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div>
              <label style={labelStyle}>Término (opcional)</label>
              <DateInput  value={endDate} onChange={(e) => setEndDate(e.target.value)} style={inputStyle} />
            </div>
          </div>

          <div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
              <label style={{ ...labelStyle, marginBottom: 0 }}>{useModules ? "Módulos contratados" : "Valor mensal"}</label>
              {catalog.length > 0 && (
                <button
                  type="button"
                  onClick={() => setUseModules(!useModules)}
                  style={{ background: "transparent", border: "none", color: "#A78BFA", fontSize: 11, fontWeight: 700, cursor: "pointer" }}
                >
                  {useModules ? "Usar valor fixo" : "Escolher módulos"}
                </button>
              )}
            </div>

            {useModules ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {catalog.map((m) => {
                  const checked = m.id in selectedModules;
                  return (
                    <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 130px", gap: 8, alignItems: "center", padding: "7px 10px", borderRadius: 8, background: checked ? "rgba(139,92,246,0.08)" : "rgba(255,255,255,0.03)", border: `1px solid ${checked ? "rgba(139,92,246,0.3)" : "rgba(255,255,255,0.06)"}` }}>
                      <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", fontSize: 13, color: "#eee" }}>
                        <Checkbox  checked={checked} onChange={() => toggleModule(m)} style={{ accentColor: "#8B5CF6" }} />
                        <span>{m.name}</span>
                        <span style={{ fontSize: 11, color: "#666" }}>tabela {brl(m.defaultPrice)}</span>
                      </label>
                      <input
                        type="text"
                        inputMode="decimal"
                        disabled={!checked}
                        value={checked ? selectedModules[m.id] : ""}
                        placeholder="—"
                        onChange={(e) => setSelectedModules({ ...selectedModules, [m.id]: e.target.value })}
                        style={{ ...inputStyle, padding: "6px 8px", opacity: checked ? 1 : 0.4 }}
                      />
                    </div>
                  );
                })}
                <div style={{ fontSize: 11, color: "#777" }}>O preço de cada módulo pode ser negociado para este cliente.</div>
              </div>
            ) : (
              <div>
                <input type="text" inputMode="decimal" placeholder="0,00" value={fixedAmount} onChange={(e) => setFixedAmount(e.target.value)} style={inputStyle} />
                {catalogLoaded && catalog.length === 0 && (
                  <div style={{ fontSize: 11, color: "#777", marginTop: 4 }}>
                    Nenhum módulo cadastrado. Use “Módulos SaaS” na aba Clientes para criar o catálogo.
                  </div>
                )}
              </div>
            )}
            <div style={{ marginTop: 8, fontSize: 12, color: "#A78BFA", fontWeight: 700 }}>Mensalidade total: {brl(monthlyTotal)}</div>
          </div>
        </SectionCard>

        {/* ── Prévia ── */}
        <div style={{ border: "1px solid rgba(16,185,129,0.25)", background: "rgba(16,185,129,0.05)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, fontWeight: 800, color: "#10B981" }}>
            <Sparkles size={13} /> Prévia do cronograma
          </span>

          {!payload && <span style={{ fontSize: 12, color: "#777" }}>Escolha o cliente e preencha os valores para ver as cobranças que serão geradas.</span>}
          {previewError && <span style={{ fontSize: 12, color: "#F59E0B" }}>{previewError}</span>}

          {preview && (
            <>
              {preview.entry.length > 0 && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>ENTRADA / PROJETO — {brl(preview.entryTotal)}</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                    {preview.entry.map((p, i) => (
                      <div key={i} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, color: "#ddd" }}>
                        <span>{p.label} <span style={{ color: "#777" }}>· {fmtDate(p.dueDate)}</span></span>
                        <span style={{ fontWeight: 700 }}>{brl(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {preview.subscription && (
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: "#888", marginBottom: 4 }}>
                    MENSALIDADE — {brl(preview.subscription.monthlyAmount)}/mês
                  </div>
                  {preview.subscription.awaitingStart ? (
                    <div style={{ fontSize: 12, color: "#F59E0B" }}>Aguardando início manual (após a entrega do projeto). Nenhuma mensalidade será gerada agora.</div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: "#ddd", marginBottom: 6 }}>Primeira cobrança em <b>{fmtDate(preview.subscription.firstDueDate)}</b></div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {preview.subscription.charges.map((c) => (
                          <span key={c.referenceMonth} style={{ fontSize: 11, padding: "3px 8px", borderRadius: 6, background: "rgba(255,255,255,0.06)", color: "#ccc" }}>
                            {fmtMonth(c.referenceMonth)} · dia {fmtDate(c.dueDate).slice(0, 2)}
                          </span>
                        ))}
                        <span style={{ fontSize: 11, color: "#666", alignSelf: "center" }}>…</span>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8, display: "flex", justifyContent: "space-between", fontSize: 12 }}>
                <span style={{ color: "#aaa" }}>Previsão de receita (entrada + 12 mensalidades)</span>
                <span style={{ fontWeight: 800, color: "#10B981" }}>{brl(preview.firstYearTotal)}</span>
              </div>
              {preview.warnings.map((w, i) => (
                <div key={i} style={{ display: "flex", gap: 6, alignItems: "flex-start", fontSize: 11, color: "#F59E0B" }}>
                  <AlertTriangle size={12} style={{ flexShrink: 0, marginTop: 1 }} /> {w}
                </div>
              ))}
            </>
          )}
        </div>

        <div>
          <label style={labelStyle}>Observações (opcional)</label>
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Condições negociadas, descontos..." style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }} />
        </div>

    </Drawer>
  );
}

// ─── Catálogo de módulos SaaS ─────────────────────────────────────────────────

function ModuleRow({ module, onSaved }: { module: SaasModule; onSaved: () => void }) {
  const [name, setName] = useState(module.name);
  const [price, setPrice] = useState(centsToInput(module.defaultPrice));
  const [busy, setBusy] = useState(false);
  const dirty = name.trim() !== module.name || parseMoney(price) !== module.defaultPrice;

  const save = async (patch: Record<string, unknown>) => {
    try {
      setBusy(true);
      await API.put(`/finance/modules/${module.id}`, patch);
      onSaved();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao salvar módulo.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) 110px auto auto", gap: 8, alignItems: "center", opacity: module.isActive ? 1 : 0.55 }}>
      <input type="text" value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
      <input type="text" inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} style={inputStyle} />
      <button
        type="button"
        disabled={!dirty || busy || !name.trim()}
        onClick={() => save({ name: name.trim(), defaultPrice: parseMoney(price) })}
        style={{ padding: "8px 12px", borderRadius: 8, background: dirty ? "rgba(139,92,246,0.2)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(139,92,246,0.3)", color: dirty ? "#A78BFA" : "#555", fontSize: 12, fontWeight: 700, cursor: dirty ? "pointer" : "default" }}
      >
        Salvar
      </button>
      <button
        type="button"
        disabled={busy}
        onClick={() => save({ isActive: !module.isActive })}
        style={{ padding: "8px 10px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", color: module.isActive ? "#999" : "#10B981", fontSize: 11, cursor: "pointer" }}
      >
        {module.isActive ? "Desativar" : "Reativar"}
      </button>
    </div>
  );
}

export function ModulesCatalogModal({ onClose, onChanged }: { onClose: () => void; onChanged: () => void }) {
  const [modules, setModules] = useState<SaasModule[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [newPrice, setNewPrice] = useState("");
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await API.get("/finance/modules");
      setModules(res?.modules ?? []);
    } catch (err: any) {
      toast.error(err?.message || "Erro ao carregar módulos.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim()) return;
    try {
      setAdding(true);
      await API.post("/finance/modules", { name: newName.trim(), defaultPrice: parseMoney(newPrice) });
      setNewName("");
      setNewPrice("");
      await load();
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao criar módulo.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <Drawer title="Módulos do SaaS" subtitle="Preço de tabela. O valor de cada cliente é definido na venda." icon={<Layers size={18} />} onClose={onClose} width={560}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 120px auto", gap: 8, alignItems: "end" }}>
          <div>
            <label style={labelStyle}>Novo módulo</label>
            <input type="text" placeholder="Ex: Financeiro, CRM, Agenda..." value={newName} onChange={(e) => setNewName(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Preço (R$)</label>
            <input type="text" inputMode="decimal" placeholder="0,00" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} style={inputStyle} />
          </div>
          <button type="button" onClick={handleAdd} disabled={adding || !newName.trim()} style={{ padding: "9px 14px", borderRadius: 8, background: "#8B5CF6", border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: adding || !newName.trim() ? 0.55 : 1 }}>
            Adicionar
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {loading ? (
            <span style={{ fontSize: 12, color: "#777" }}>Carregando...</span>
          ) : modules.length === 0 ? (
            <span style={{ fontSize: 12, color: "#777" }}>Nenhum módulo cadastrado ainda.</span>
          ) : (
            modules.map((m) => <ModuleRow key={m.id} module={m} onSaved={() => { load(); onChanged(); }} />)
          )}
        </div>
    </Drawer>
  );
}

// ─── Gerenciar uma venda (módulos, início da mensalidade, pausar/cancelar) ────

function SubscriptionManager({ item, catalog, onChanged }: { item: SaleItemView; catalog: SaasModule[]; onChanged: () => void }) {
  const activeMods = item.modules.filter((m) => m.active && m.endDate === null);
  const [selected, setSelected] = useState<Record<string, string>>(() =>
    Object.fromEntries(activeMods.map((m) => [m.moduleId, centsToInput(m.price)])),
  );
  const [fixed, setFixed] = useState(item.fixedAmount ? centsToInput(item.fixedAmount) : "");
  const [effective, setEffective] = useState(todayStr());
  const [startDate, setStartDate] = useState(todayStr());
  const [busy, setBusy] = useState(false);

  const usesModules = activeMods.length > 0 || (item.fixedAmount === null && catalog.length > 0);
  const total = usesModules ? Object.values(selected).reduce((s, v) => s + parseMoney(v), 0) : parseMoney(fixed);

  const start = async () => {
    try {
      setBusy(true);
      const res = await API.post(`/finance/sales/items/${item.id}/start`, { firstDueDate: startDate });
      toast.success(`Mensalidade iniciada. ${res?.transactionsCreated ?? 0} cobrança(s) gerada(s).`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao iniciar mensalidade.");
    } finally {
      setBusy(false);
    }
  };

  const saveModules = async () => {
    try {
      setBusy(true);
      const body = usesModules
        ? { effectiveDate: effective, modules: Object.entries(selected).map(([moduleId, price]) => ({ moduleId, price: parseMoney(price) })) }
        : { effectiveDate: effective, modules: [], fixedAmount: parseMoney(fixed) };
      const res = await API.put(`/finance/sales/items/${item.id}/modules`, body);
      toast.success(`Valores atualizados. ${res?.chargesUpdated ?? 0} cobrança(s) pendente(s) recalculada(s).`);
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar módulos.");
    } finally {
      setBusy(false);
    }
  };

  const st = ITEM_STATUS[item.status] ?? ITEM_STATUS.active;

  return (
    <div style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8 }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}><Repeat2 size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{item.label}</span>
        <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 10, color: st.color, background: `${st.color}22` }}>{st.label}</span>
      </div>

      {item.status === "awaiting_start" ? (
        <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
          <div>
            <label style={labelStyle}>1º vencimento da mensalidade</label>
            <DateInput  value={startDate} onChange={(e) => setStartDate(e.target.value)} style={inputStyle} />
          </div>
          <button type="button" disabled={busy || !startDate} onClick={start} style={{ padding: "9px 14px", borderRadius: 8, background: "rgba(16,185,129,0.15)", border: "1px solid rgba(16,185,129,0.35)", color: "#10B981", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
            Projeto entregue — iniciar mensalidade
          </button>
        </div>
      ) : item.status === "cancelled" ? (
        <span style={{ fontSize: 12, color: "#777" }}>Mensalidade cancelada.</span>
      ) : (
        <>
          <div style={{ fontSize: 11, color: "#888" }}>
            Atual: <b style={{ color: "#ddd" }}>{brl(item.currentMonthly)}/mês</b>
            {item.nextDueDate && <> · próxima cobrança {fmtDate(item.nextDueDate)}</>}
          </div>

          {usesModules ? (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {catalog.map((m) => {
                const checked = m.id in selected;
                return (
                  <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 120px", gap: 8, alignItems: "center" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#ddd", cursor: "pointer" }}>
                      <Checkbox
                        
                        checked={checked}
                        style={{ accentColor: "#8B5CF6" }}
                        onChange={() => {
                          const next = { ...selected };
                          if (checked) delete next[m.id];
                          else next[m.id] = centsToInput(m.defaultPrice);
                          setSelected(next);
                        }}
                      />
                      {m.name}
                    </label>
                    <input type="text" inputMode="decimal" disabled={!checked} value={checked ? selected[m.id] : ""} onChange={(e) => setSelected({ ...selected, [m.id]: e.target.value })} style={{ ...inputStyle, padding: "6px 8px", opacity: checked ? 1 : 0.4 }} />
                  </div>
                );
              })}
            </div>
          ) : (
            <div>
              <label style={labelStyle}>Valor mensal (R$)</label>
              <input type="text" inputMode="decimal" value={fixed} onChange={(e) => setFixed(e.target.value)} style={inputStyle} />
            </div>
          )}

          <div style={{ display: "flex", gap: 8, alignItems: "end", flexWrap: "wrap" }}>
            <div>
              <label style={labelStyle}>Vale a partir de</label>
              <DateInput  value={effective} onChange={(e) => setEffective(e.target.value)} style={inputStyle} />
            </div>
            <div style={{ fontSize: 12, color: "#A78BFA", fontWeight: 700, paddingBottom: 10 }}>Novo total: {brl(total)}/mês</div>
            <button type="button" disabled={busy || total <= 0} onClick={saveModules} style={{ marginLeft: "auto", padding: "9px 14px", borderRadius: 8, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.35)", color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: "pointer", opacity: busy || total <= 0 ? 0.55 : 1 }}>
              Aplicar alteração
            </button>
          </div>
          <div style={{ fontSize: 11, color: "#666" }}>As cobranças já pagas não mudam. As pendentes a partir da data são recalculadas.</div>
        </>
      )}
    </div>
  );
}

export function SaleManageModal({ sale, onClose, onChanged }: { sale: SaleView; onClose: () => void; onChanged: () => void }) {
  const [catalog, setCatalog] = useState<SaasModule[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    API.get("/finance/modules")
      .then((res) => setCatalog((res?.modules ?? []).filter((m: SaasModule) => m.isActive)))
      .catch(() => setCatalog([]));
  }, []);

  const changeStatus = async (status: "active" | "paused" | "cancelled") => {
    if (status === "cancelled" && !(await confirmDialog({ title: "Cancelar esta venda?", message: "As cobranças que ainda não venceram serão canceladas. O que já está em aberto ou atrasado continua para cobrança.", confirmLabel: "Cancelar venda", cancelLabel: "Voltar", danger: true }))) return;
    try {
      setBusy(true);
      const res = await API.put(`/finance/sales/${sale.id}/status`, { status });
      toast.success(status === "cancelled" ? `Venda cancelada. ${res?.cancelledCharges ?? 0} cobrança(s) futura(s) cancelada(s).` : status === "paused" ? "Venda pausada." : "Venda reativada.");
      onChanged();
    } catch (err: any) {
      toast.error(err?.message || "Erro ao atualizar venda.");
    } finally {
      setBusy(false);
    }
  };

  const st = SALE_STATUS[sale.status] ?? SALE_STATUS.active;
  const entryItems = sale.items.filter((i) => i.kind === "project");
  const subItems = sale.items.filter((i) => i.kind === "subscription");

  return (
    <Drawer
      title={sale.title}
      subtitle={
        <>
          <span style={{ fontWeight: 700, color: st.color }}>● {st.label}</span>
          {sale.projectName && <> · {sale.projectName}</>}
        </>
      }
      icon={<Layers size={18} />}
      onClose={onClose}
      width={620}
      footer={
        sale.status !== "cancelled" ? (
          <>
            {sale.status === "active" ? (
              <button type="button" disabled={busy} onClick={() => changeStatus("paused")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#F59E0B", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Pause size={12} /> Pausar mensalidade
              </button>
            ) : (
              <button type="button" disabled={busy} onClick={() => changeStatus("active")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "rgba(16,185,129,0.12)", border: "1px solid rgba(16,185,129,0.3)", color: "#10B981", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
                <Play size={12} /> Reativar
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => changeStatus("cancelled")} style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 12px", borderRadius: 8, background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", color: "#EF4444", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>
              <Ban size={12} /> Cancelar venda
            </button>
          </>
        ) : undefined
      }
    >

        {entryItems.map((i) => (
          <div key={i.id} style={{ border: "1px solid rgba(255,255,255,0.08)", borderRadius: 10, padding: 12, display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#fafafa" }}><Receipt size={13} style={{ verticalAlign: "-2px", marginRight: 6 }} />{i.label} — {brl(i.totalAmount)} em {i.installmentsCount}x</span>
            <span style={{ fontSize: 11, color: "#888" }}>
              Pago {brl(i.paid)} · Em aberto {brl(i.pending)}{i.overdue > 0 && <span style={{ color: "#EF4444" }}> (atrasado {brl(i.overdue)})</span>}
            </span>
            <span style={{ fontSize: 11, color: "#666" }}>Parcelas editáveis individualmente no Livro Caixa.</span>
          </div>
        ))}

        {subItems.map((i) => (
          <SubscriptionManager key={`${i.id}-${i.modules.length}-${i.status}`} item={i} catalog={catalog} onChanged={onChanged} />
        ))}

    </Drawer>
  );
}

// ─── Resumo de contratos dentro do cartão do cliente ──────────────────────────

export function ClientSalesSummary({
  sales,
  onNewSale,
  onManage,
}: {
  sales: SaleView[];
  onNewSale: () => void;
  onManage: (sale: SaleView) => void;
}) {
  const [open, setOpen] = useState(false);
  const live = sales.filter((s) => s.status !== "cancelled");
  const mrr = live
    .filter((s) => s.status === "active")
    .flatMap((s) => s.items)
    .filter((i) => i.kind === "subscription" && i.status === "active")
    .reduce((sum, i) => sum + i.currentMonthly, 0);
  const awaiting = live.flatMap((s) => s.items).filter((i) => i.status === "awaiting_start").length;

  return (
    <div style={{ border: "1px solid rgba(139,92,246,0.2)", borderRadius: 10, background: "rgba(139,92,246,0.04)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "8px 10px", gap: 8 }}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          disabled={sales.length === 0}
          style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "transparent", border: "none", color: "#A78BFA", fontSize: 12, fontWeight: 700, cursor: sales.length ? "pointer" : "default", padding: 0 }}
        >
          {sales.length > 0 && <ChevronDown size={13} style={{ transform: open ? "rotate(0deg)" : "rotate(-90deg)", transition: "0.2s" }} />}
          {sales.length === 0 ? "Sem contratos" : `Contratos (${live.length})`}
          {mrr > 0 && <span style={{ color: "#10B981", fontWeight: 800 }}>· {brl(mrr)}/mês</span>}
          {awaiting > 0 && <span style={{ color: "#F59E0B", fontWeight: 700 }}>· {awaiting} aguardando início</span>}
        </button>
        <button type="button" onClick={onNewSale} style={{ display: "inline-flex", alignItems: "center", gap: 4, padding: "4px 9px", borderRadius: 7, background: "rgba(139,92,246,0.2)", border: "1px solid rgba(139,92,246,0.35)", color: "#A78BFA", fontSize: 11, fontWeight: 700, cursor: "pointer" }}>
          <Plus size={11} /> Venda
        </button>
      </div>

      {open && (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 10px 10px" }}>
          {sales.map((s) => {
            const st = SALE_STATUS[s.status] ?? SALE_STATUS.active;
            const parts = s.items.map((i) =>
              i.kind === "project"
                ? `${i.label} ${brl(i.totalAmount)}/${i.installmentsCount}x`
                : i.status === "awaiting_start"
                  ? `${i.label} (aguardando)`
                  : `${i.label} ${brl(i.currentMonthly)}${i.modules.filter((m) => m.active).length ? ` · ${i.modules.filter((m) => m.active).map((m) => m.name).join(", ")}` : ""}`,
            );
            const pending = s.items.reduce((sum, i) => sum + i.pending, 0);
            const overdue = s.items.reduce((sum, i) => sum + i.overdue, 0);
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => onManage(s)}
                style={{ textAlign: "left", display: "flex", flexDirection: "column", gap: 2, padding: "8px 10px", borderRadius: 8, background: "rgba(0,0,0,0.25)", border: "1px solid rgba(255,255,255,0.06)", cursor: "pointer" }}
              >
                <span style={{ display: "flex", justifyContent: "space-between", gap: 6, fontSize: 12, fontWeight: 700, color: "#eee" }}>
                  <span>{s.title}</span>
                  <span style={{ fontSize: 10, color: st.color }}>● {st.label}</span>
                </span>
                <span style={{ fontSize: 11, color: "#888" }}>{parts.join("  +  ")}</span>
                {(pending > 0 || overdue > 0) && (
                  <span style={{ fontSize: 11, color: overdue > 0 ? "#EF4444" : "#F59E0B" }}>
                    Em aberto {brl(pending)}{overdue > 0 && ` · atrasado ${brl(overdue)}`}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
