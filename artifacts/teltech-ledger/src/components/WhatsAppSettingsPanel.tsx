import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, FlaskConical, History, MessageCircle, MessageSquareText, RotateCcw, Save, Users, WalletCards } from "lucide-react";
import { toast } from "sonner";
import { API } from "../lib/api";
import { cn } from "@/lib/utils";
import { BillingRules } from "./whatsapp/BillingRules";
import { ConnectionCard } from "./whatsapp/ConnectionCard";
import { MessageHistory } from "./whatsapp/MessageHistory";
import { AssistantAvatar, MessageTemplates } from "./whatsapp/MessageTemplates";
import { PartnerContacts } from "./whatsapp/PartnerContacts";
import { TestSender } from "./whatsapp/TestSender";
import {
  emptySettings,
  type TemplateInfo,
  type WhatsAppContact,
  type WhatsAppMessage,
  type WhatsAppSettings,
  type WhatsAppStatus,
  type WorkspaceMemberOption,
} from "./whatsapp/types";
import { Btn, Tip, WhatsAppTooltipProvider } from "./whatsapp/ui";

type TabKey = "test" | "billing" | "messages" | "partners" | "history";

const tabs: { key: TabKey; label: string; icon: typeof Users; tip: string }[] = [
  { key: "test", label: "Teste de envio", icon: FlaskConical, tip: "Confirme que o número funciona enviando uma mensagem real." },
  { key: "billing", label: "Cobrança & Pix", icon: WalletCards, tip: "Quando cobrar, chave Pix e forma de envio." },
  { key: "messages", label: "Mensagens do Nexus", icon: MessageSquareText, tip: "Personalidade do assistente e texto de cada mensagem." },
  { key: "partners", label: "Sócios & avisos", icon: Users, tip: "Quem recebe os avisos internos e como é chamado." },
  { key: "history", label: "Histórico", icon: History, tip: "Tudo o que foi enviado, na fila ou com falha." },
];

function normalizeSettings(raw?: Partial<WhatsAppSettings>): WhatsAppSettings {
  return {
    ...emptySettings,
    ...raw,
    pixKey: raw?.pixKey ?? "",
    pixMerchantName: raw?.pixMerchantName ?? "",
    pixMerchantCity: raw?.pixMerchantCity ?? "",
    templates: raw?.templates ?? {},
  };
}

/** Compara apenas o que o usuário pode editar (ignora campos calculados pelo servidor). */
function editableSnapshot(settings: WhatsAppSettings): string {
  const { pixKeyResolved: _ignored, templates, ...rest } = settings;
  return JSON.stringify([Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)), Object.entries(templates).sort(([a], [b]) => a.localeCompare(b))]);
}

export function WhatsAppSettingsPanel() {
  const [connection, setConnection] = useState<WhatsAppStatus>({ status: "disconnected" });
  const [saved, setSaved] = useState<WhatsAppSettings>(emptySettings);
  const [draft, setDraft] = useState<WhatsAppSettings>(emptySettings);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [contacts, setContacts] = useState<WhatsAppContact[]>([]);
  const [members, setMembers] = useState<WorkspaceMemberOption[]>([]);
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshingHistory, setRefreshingHistory] = useState(false);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "save" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>("test");

  const dirty = useMemo(() => editableSnapshot(draft) !== editableSnapshot(saved), [draft, saved]);
  const patchDraft = useCallback((patch: Partial<WhatsAppSettings>) => setDraft((current) => ({ ...current, ...patch })), []);

  const loadStatus = useCallback(async () => {
    setConnection(await API.get<WhatsAppStatus>("/whatsapp/status"));
  }, []);

  const loadMessages = useCallback(async () => {
    const result = await API.get<{ messages: WhatsAppMessage[] }>("/whatsapp/messages");
    setMessages(Array.isArray(result.messages) ? result.messages : []);
  }, []);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statusResult, settingsResult, messagesResult] = await Promise.all([
        API.get<WhatsAppStatus>("/whatsapp/status"),
        API.get<{ settings: WhatsAppSettings }>("/whatsapp/settings"),
        API.get<{ messages: WhatsAppMessage[] }>("/whatsapp/messages"),
      ]);
      const normalized = normalizeSettings(settingsResult.settings);
      setConnection(statusResult);
      setSaved(normalized);
      setDraft(normalized);
      setMessages(Array.isArray(messagesResult.messages) ? messagesResult.messages : []);
      // Dados auxiliares: se falharem, o restante do painel continua funcionando.
      const [contactsResult, membersResult, templatesResult] = await Promise.allSettled([
        API.get<{ contacts: WhatsAppContact[] }>("/whatsapp/contacts"),
        API.get<{ members: WorkspaceMemberOption[] }>("/whatsapp/members"),
        API.get<{ templates: TemplateInfo[] }>("/whatsapp/templates"),
      ]);
      if (contactsResult.status === "fulfilled") setContacts(contactsResult.value.contacts ?? []);
      if (membersResult.status === "fulfilled") setMembers(membersResult.value.members ?? []);
      if (templatesResult.status === "fulfilled") setTemplates(templatesResult.value.templates ?? []);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o WhatsApp.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  // Enquanto conecta, confere a cada 5 s; conectado, confere a cada 30 s para perceber quedas.
  useEffect(() => {
    const waiting = connection.status === "connecting" || connection.status === "qr";
    if (!waiting && connection.status !== "connected") return;
    const interval = window.setInterval(() => void loadStatus().catch(() => undefined), waiting ? 5000 : 30000);
    return () => window.clearInterval(interval);
  }, [connection.status, loadStatus]);

  useEffect(() => {
    if (tab !== "history") return;
    const interval = window.setInterval(() => void loadMessages().catch(() => undefined), 20000);
    return () => window.clearInterval(interval);
  }, [tab, loadMessages]);

  const refreshHistory = useCallback(() => {
    setRefreshingHistory(true);
    loadMessages()
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível atualizar o histórico."))
      .finally(() => setRefreshingHistory(false));
  }, [loadMessages]);

  const connect = async () => {
    setBusy("connect");
    setError(null);
    try {
      await API.post("/whatsapp/connect", {});
      await loadStatus();
      toast.success("Conexão iniciada. Leia o QR com o WhatsApp da empresa.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível iniciar a conexão.");
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (!window.confirm("Desconectar o WhatsApp da empresa? Os envios serão interrompidos.")) return;
    setBusy("disconnect");
    setError(null);
    try {
      await API.post("/whatsapp/disconnect", {});
      await loadStatus();
      toast.success("WhatsApp desconectado.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível desconectar.");
    } finally {
      setBusy(null);
    }
  };

  const save = async () => {
    const numbers = [draft.daysBeforeDue, draft.daysAfterDue, draft.dailySendHour, draft.dailyMessageLimit];
    if (numbers.some((value) => !Number.isInteger(value))) return setError("Preencha todos os números das regras de cobrança.");
    if (draft.daysBeforeDue < 0 || draft.daysBeforeDue > 30 || draft.daysAfterDue < 0 || draft.daysAfterDue > 30) {
      return setError("Os dias antes e depois do vencimento devem estar entre 0 e 30.");
    }
    if (draft.dailySendHour < 0 || draft.dailySendHour > 23) return setError("O horário de envio deve estar entre 0 e 23.");
    if (draft.dailyMessageLimit < 1 || draft.dailyMessageLimit > 500) return setError("O limite de mensagens deve estar entre 1 e 500.");
    if (!draft.assistantName.trim() || !draft.companyName.trim()) return setError("Informe o nome do assistente e da empresa.");
    if (draft.autoBillingEnabled && !draft.pixKey.trim()) {
      setTab("billing");
      return setError("Cadastre a chave Pix antes de ativar as cobranças automáticas.");
    }
    setBusy("save");
    setError(null);
    try {
      const templatePatch: Record<string, string | null> = {};
      for (const key of new Set([...Object.keys(saved.templates), ...Object.keys(draft.templates)])) {
        templatePatch[key] = draft.templates[key] ?? null;
      }
      const { pixKeyResolved: _ignored, templates: _templates, ...rest } = draft;
      const result = await API.put<{ settings: WhatsAppSettings }>("/whatsapp/settings", {
        ...rest,
        pixKey: draft.pixKey.trim(),
        pixMerchantName: draft.pixMerchantName.trim(),
        pixMerchantCity: draft.pixMerchantCity.trim(),
        assistantName: draft.assistantName.trim(),
        companyName: draft.companyName.trim(),
        templates: templatePatch,
      });
      const normalized = normalizeSettings(result.settings);
      setSaved(normalized);
      setDraft(normalized);
      toast.success("Configurações do WhatsApp salvas.");
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível salvar as configurações.";
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  };

  const problems = messages.filter((message) => message.status === "failed").length;
  const pending = messages.filter((message) => ["queued", "processing", "retry"].includes(message.status ?? "")).length;

  return (
    <WhatsAppTooltipProvider>
      <div className="mx-auto w-full max-w-5xl space-y-6 pb-4 animate-fade-up">
        <header className="flex items-center gap-4">
          <AssistantAvatar size={52} pulse={connection.status === "connected"} />
          <div>
            <div className="mb-1 flex items-center gap-2 text-primary">
              <MessageCircle size={16} />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Canal da empresa</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">WhatsApp</h1>
            <p className="mt-1 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Conecte o número corporativo, defina quando e como cobrar, e deixe o {draft.assistantName || "Nexus"} falar com clientes e sócios.
            </p>
          </div>
        </header>

        {error && (
          <div role="alert" className="animate-shake flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">
            <AlertCircle size={17} className="mt-0.5 shrink-0" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={() => setError(null)} className="text-xs font-semibold underline-offset-2 hover:underline">
              Fechar
            </button>
          </div>
        )}

        <ConnectionCard
          connection={connection}
          loading={loading}
          busy={busy}
          onRefresh={() => void loadAll()}
          onConnect={() => void connect()}
          onDisconnect={() => void disconnect()}
        />

        <nav aria-label="Seções do WhatsApp" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1">
          {tabs.map((item) => {
            const Icon = item.icon;
            const active = tab === item.key;
            const count = item.key === "history" ? (problems > 0 ? problems : pending) : item.key === "partners" ? contacts.length : 0;
            return (
              <Tip key={item.key} content={item.tip}>
                <button
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setTab(item.key)}
                  className={cn(
                    "relative inline-flex shrink-0 items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                    active ? "border-primary/50 bg-primary/12 text-foreground shadow-glow" : "border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                  )}
                >
                  <Icon size={16} className={cn(active && "text-primary")} />
                  {item.label}
                  {count > 0 && (
                    <span className={cn("rounded-full px-1.5 text-[10px] font-bold", item.key === "history" && problems > 0 ? "bg-destructive/20 text-destructive" : "bg-primary/20 text-primary")}>{count}</span>
                  )}
                </button>
              </Tip>
            );
          })}
        </nav>

        <div key={tab} className="animate-fade-up">
          {tab === "test" && <TestSender connection={connection} settings={saved} contacts={contacts} templates={templates} onSent={() => void loadMessages().catch(() => undefined)} />}
          {tab === "billing" && <BillingRules settings={draft} onChange={patchDraft} />}
          {tab === "messages" && <MessageTemplates templates={templates} settings={draft} onChange={patchDraft} />}
          {tab === "partners" && (
            <PartnerContacts contacts={contacts} members={members} settings={draft} onSettings={patchDraft} onContactsChange={setContacts} />
          )}
          {tab === "history" && <MessageHistory messages={messages} refreshing={refreshingHistory} onRefresh={refreshHistory} />}
        </div>

        {dirty && (
          <div className="glass shadow-elegant animate-fade-up sticky bottom-4 z-20 flex flex-wrap items-center justify-between gap-3 rounded-xl border-primary/40 px-4 py-3">
            <p className="flex items-center gap-2 text-sm font-medium text-foreground">
              <span className="h-2 w-2 animate-pulse rounded-full bg-primary" /> Você tem alterações não salvas
            </p>
            <div className="flex gap-2">
              <Btn size="sm" icon={<RotateCcw size={14} />} onClick={() => setDraft(saved)} disabled={busy !== null} tip="Descarta tudo o que foi alterado desde o último salvamento.">
                Descartar
              </Btn>
              <Btn variant="primary" size="sm" icon={<Save size={14} />} loading={busy === "save"} disabled={loading || busy !== null} onClick={() => void save()} tip="Salva cobrança, Pix, mensagens e avisos de uma vez.">
                {busy === "save" ? "Salvando…" : "Salvar alterações"}
              </Btn>
            </div>
          </div>
        )}
      </div>
    </WhatsAppTooltipProvider>
  );
}
