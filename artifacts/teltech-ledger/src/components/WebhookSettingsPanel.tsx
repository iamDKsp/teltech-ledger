import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Copy, RefreshCw, Webhook } from "lucide-react";
import { toast } from "sonner";
import { API, API_BASE } from "../lib/api";

interface Integration {
  source: string; name: string; path: string; projectId: string; accountId: string | null;
  lastEvent: { eventId: string; eventType: string; processedAt: string; outcome: string } | null;
}

function ExistingClientLink({ integration, workspaceId }: { integration: Integration; workspaceId: string }) {
  const [open, setOpen] = useState(false);
  const [clients, setClients] = useState<Array<{ id: string; name: string }>>([]);
  const [sales, setSales] = useState<Array<{ clientId: string; projectId: string; title: string; items: Array<{ id: string; kind: string; label: string }> }>>([]);
  const [clientId, setClientId] = useState("");
  const [clientExternalId, setClientExternalId] = useState("");
  const [saleItemId, setSaleItemId] = useState("");
  const [baseExternalId, setBaseExternalId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setError("");
    Promise.all([API.get("/finance/clients", { headers: { "x-workspace-id": workspaceId } }),
      API.get("/finance/sales", { headers: { "x-workspace-id": workspaceId } })])
      .then(([c, s]) => { if (!cancelled) { setClients(c.clients ?? []); setSales(s.sales ?? []); } })
      .catch(() => { if (!cancelled) setError("Não foi possível carregar clientes e contratos."); });
    return () => { cancelled = true; };
  }, [open, workspaceId]);
  const save = async (e: FormEvent) => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError("");
    try {
      await API.post(`/integrations/webhooks/${integration.source}/link`, { clientId, clientExternalId,
        ...(saleItemId ? { saleItemId, baseExternalId } : {}) }, { headers: { "x-workspace-id": workspaceId } });
      toast.success("Vínculo salvo. O próximo evento atualizará o cadastro existente.");
      setClientExternalId(""); setBaseExternalId(""); setSaleItemId("");
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível vincular."); }
    finally { setBusy(false); }
  };
  const control = "mt-1 w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground";
  return <div className="border-t border-border pt-4">
    <button onClick={() => setOpen(!open)} aria-expanded={open} className="text-sm font-medium text-primary hover:underline">Vincular cliente já cadastrado</button>
    {open && <form onSubmit={save} className="mt-4 space-y-3">
      <p className="text-sm text-muted-foreground">Selecione o cliente do Leadger e informe seu ID no outro sistema. Se já houver uma mensalidade cadastrada, vincule também o contrato à base externa.</p>
      <label className="block text-xs text-muted-foreground">Cliente no Leadger
        <select required value={clientId} onChange={(e) => { setClientId(e.target.value); setSaleItemId(""); }} className={control}>
          <option value="">Selecione o cliente</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select></label>
      <label className="block text-xs text-muted-foreground">ID do cliente no sistema de origem
        <input required value={clientExternalId} onChange={(e) => setClientExternalId(e.target.value)} maxLength={120} className={control} placeholder="Ex.: cli-123" /></label>
      <label className="block text-xs text-muted-foreground">Contrato de mensalidade existente (opcional)
        <select value={saleItemId} onChange={(e) => setSaleItemId(e.target.value)} className={control}>
          <option value="">Vincular apenas o cliente</option>{sales.filter((s) => s.clientId === clientId && s.projectId === integration.projectId).flatMap((s) =>
            s.items.filter((i) => i.kind === "subscription").map((i) => <option key={i.id} value={i.id}>{s.title} · {i.label}</option>))}
        </select></label>
      {saleItemId && <><label className="block text-xs text-muted-foreground">ID da base no sistema de origem
        <input required value={baseExternalId} onChange={(e) => setBaseExternalId(e.target.value)} maxLength={120} className={control} placeholder="Ex.: base-456" /></label>
        <p className="text-xs text-muted-foreground">Ao vincular o contrato, as novas cobranças passam a ser recebidas pelo webhook. A geração automática local dessa mensalidade será desativada.</p></>}
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-all active:scale-95 disabled:opacity-50">{busy ? "Salvando…" : "Salvar vínculo"}</button>
    </form>}
  </div>;
}

export function WebhookSettingsPanel({ workspaceId }: { workspaceId?: string }) {
  const [integrations, setIntegrations] = useState<Integration[]>([]);
  const [resolvedWorkspace, setResolvedWorkspace] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const result = await API.get<{ workspaceId: string; integrations: Integration[] }>("/integrations/webhooks", {
        headers: workspaceId ? { "x-workspace-id": workspaceId } : {},
      });
      setIntegrations(result.integrations); setResolvedWorkspace(result.workspaceId);
    } catch (e) { setError(e instanceof Error ? e.message : "Não foi possível carregar integrações."); }
    finally { setLoading(false); }
  }, [workspaceId]);
  useEffect(() => { void load(); }, [load]);
  const copy = async (value: string) => {
    try { await navigator.clipboard.writeText(value); toast.success("URL copiada."); }
    catch { toast.error("Não foi possível copiar. Selecione a URL e copie manualmente."); }
  };

  return <section className="animate-fade-up mx-auto max-w-3xl space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div><h1 className="flex items-center gap-2 text-2xl font-semibold"><Webhook className="text-primary" size={24} /> Integrações</h1>
        <p className="mt-2 text-sm text-muted-foreground">Receba clientes, bases, mensalidades e pagamentos dos seus sistemas.</p></div>
      <button onClick={() => void load()} disabled={loading} className="flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm transition-colors hover:bg-muted disabled:opacity-50">
        <RefreshCw size={16} className={loading ? "animate-spin" : ""} /> Atualizar
      </button>
    </div>
    {error && <p role="alert" className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
    {loading && <p className="text-sm text-muted-foreground">Carregando integrações…</p>}
    {!loading && !error && integrations.length === 0 && <div className="glass rounded-xl p-6 shadow-card">
      <h2 className="font-semibold">Nenhum sistema conectado</h2>
      <p className="mt-2 text-sm text-muted-foreground">Para ativar o recebimento, configure os sistemas de origem no servidor com o guia de implantação do webhook.</p>
      <p className="mt-3 break-all text-xs text-muted-foreground">Workspace: {resolvedWorkspace}</p>
    </div>}
    {!loading && integrations.map((integration) => {
      const url = `${(API_BASE || window.location.origin).replace(/\/$/, "")}${integration.path}`;
      return <article key={integration.source} className="glass space-y-4 rounded-xl p-5 shadow-card sm:p-6">
        <div className="flex flex-wrap justify-between gap-2"><h2 className="font-semibold">{integration.name}</h2>
          <span className="rounded-lg bg-primary/10 px-2 py-1 text-xs text-primary">Recebimento configurado</span></div>
        <div><p className="mb-2 text-xs text-muted-foreground">URL de entrada · POST</p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-input p-3"><code className="min-w-0 flex-1 break-all text-xs">{url}</code>
            <button onClick={() => void copy(url)} aria-label={`Copiar URL de ${integration.name}`} className="rounded-lg p-2 text-primary hover:bg-muted"><Copy size={16} /></button></div></div>
        <p className="text-sm text-muted-foreground">As requisições usam uma assinatura secreta compartilhada com o sistema de origem. A chave fica no servidor.</p>
        {integration.lastEvent ? <div className="border-t border-border pt-3 text-sm">
          <p>Último evento confirmado: {new Date(integration.lastEvent.processedAt).toLocaleString("pt-BR")}</p>
          <p className="mt-1 break-all text-xs text-muted-foreground">{integration.lastEvent.eventType} · {integration.lastEvent.eventId} · {integration.lastEvent.outcome}</p>
        </div> : <p className="text-sm text-muted-foreground">Aguardando o primeiro evento.</p>}
        {!integration.accountId && <p className="text-xs text-muted-foreground">Recebimentos entram nos relatórios, sem alterar saldo bancário até haver uma conta vinculada.</p>}
        <ExistingClientLink integration={integration} workspaceId={resolvedWorkspace} />
      </article>;
    })}
    <p className="text-xs text-muted-foreground">As alterações recebidas aparecem no Financeiro e nos clientes do menu em até 10 segundos enquanto a página está aberta.</p>
  </section>;
}
