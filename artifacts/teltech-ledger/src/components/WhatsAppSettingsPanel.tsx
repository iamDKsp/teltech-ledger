import { useCallback, useEffect, useState, type FormEvent } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clock3,
  MessageCircle,
  Power,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "../lib/api";

type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

interface WhatsAppStatus {
  status: ConnectionStatus;
  qr?: string;
  phone?: string;
  configured?: boolean;
  paired?: boolean;
  lastError?: string;
}

interface WhatsAppSettings {
  autoBillingEnabled: boolean;
  daysBeforeDue: number;
  sendOnDueDate: boolean;
  daysAfterDue: number;
  dailySendHour: number;
  pixKey: string;
  internalAlertPhone: string;
  withdrawalAlertsEnabled: boolean;
}

interface WhatsAppMessage {
  id?: string;
  type?: string;
  kind?: string;
  eventType?: string;
  status?: string;
  clientName?: string;
  recipient?: string;
  recipientPhone?: string;
  phone?: string;
  to?: string;
  error?: string;
  errorMessage?: string;
  lastError?: string;
  createdAt?: string;
  sentAt?: string;
}

const emptySettings: WhatsAppSettings = {
  autoBillingEnabled: false,
  daysBeforeDue: 3,
  sendOnDueDate: true,
  daysAfterDue: 3,
  dailySendHour: 10,
  pixKey: "",
  internalAlertPhone: "",
  withdrawalAlertsEnabled: false,
};

const statusCopy: Record<
  ConnectionStatus,
  { label: string; detail: string; tone: string }
> = {
  disconnected: {
    label: "Desconectado",
    detail: "Conecte o número da empresa para habilitar os envios.",
    tone: "text-muted-foreground",
  },
  connecting: {
    label: "Conectando",
    detail: "Aguardando a sessão do WhatsApp.",
    tone: "text-primary",
  },
  qr: {
    label: "Aguardando leitura do QR",
    detail:
      "No WhatsApp da empresa, abra Aparelhos conectados e leia o código.",
    tone: "text-primary",
  },
  connected: {
    label: "Conectado",
    detail: "A conexão está pronta para os envios configurados.",
    tone: "text-success",
  },
};

function readableDate(value?: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function messageLabel(message: WhatsAppMessage) {
  const type = message.type ?? message.kind ?? message.eventType;
  if (type === "manual_billing") return "Cobrança manual";
  if (type === "billing_before") return "Lembrete antes do vencimento";
  if (type === "billing_due") return "Cobrança no vencimento";
  if (type === "billing_overdue") return "Cobrança em atraso";
  if (type === "partner_withdrawal") return "Aviso de retirada";
  return type ? type.replaceAll("_", " ") : "Mensagem";
}

const fieldClass =
  "mt-2 w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/20";

export function WhatsAppSettingsPanel() {
  const [connection, setConnection] = useState<WhatsAppStatus>({
    status: "disconnected",
  });
  const [settings, setSettings] = useState<WhatsAppSettings>(emptySettings);
  const [messages, setMessages] = useState<WhatsAppMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<"connect" | "disconnect" | "save" | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    const result = await API.get<WhatsAppStatus>("/whatsapp/status");
    setConnection(result);
  }, []);

  const loadMessages = useCallback(async () => {
    const result = await API.get<{ messages: WhatsAppMessage[] }>(
      "/whatsapp/messages",
    );
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
      setConnection(statusResult);
      setSettings({
        ...emptySettings,
        ...settingsResult.settings,
        pixKey: settingsResult.settings?.pixKey ?? "",
        internalAlertPhone: settingsResult.settings?.internalAlertPhone ?? "",
      });
      setMessages(
        Array.isArray(messagesResult.messages) ? messagesResult.messages : [],
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar o WhatsApp.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    if (connection.status !== "connecting" && connection.status !== "qr")
      return;
    const interval = window.setInterval(() => {
      void loadStatus().catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(interval);
  }, [connection.status, loadStatus]);

  const connect = async () => {
    setBusy("connect");
    setError(null);
    try {
      await API.post("/whatsapp/connect", {});
      await loadStatus();
      toast.success("Conexão iniciada. Leia o QR com o WhatsApp da empresa.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível iniciar a conexão.",
      );
    } finally {
      setBusy(null);
    }
  };

  const disconnect = async () => {
    if (
      !window.confirm(
        "Desconectar o WhatsApp da empresa? Os envios serão interrompidos.",
      )
    )
      return;
    setBusy("disconnect");
    setError(null);
    try {
      await API.post("/whatsapp/disconnect", {});
      await loadStatus();
      toast.success("WhatsApp desconectado.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível desconectar.",
      );
    } finally {
      setBusy(null);
    }
  };

  const saveSettings = async (event: FormEvent) => {
    event.preventDefault();
    if (
      [
        settings.daysBeforeDue,
        settings.daysAfterDue,
        settings.dailySendHour,
      ].some((value) => !Number.isInteger(value)) ||
      settings.daysBeforeDue < 0 ||
      settings.daysBeforeDue > 30 ||
      settings.daysAfterDue < 0 ||
      settings.daysAfterDue > 30 ||
      settings.dailySendHour < 0 ||
      settings.dailySendHour > 23
    ) {
      setError("Informe dias entre 0 e 30 e horário entre 0 e 23.");
      return;
    }
    if (settings.autoBillingEnabled && !settings.pixKey.trim()) {
      setError(
        "Cadastre a chave Pix antes de ativar as cobranças automáticas.",
      );
      return;
    }
    if (
      settings.withdrawalAlertsEnabled &&
      !settings.internalAlertPhone.trim()
    ) {
      setError(
        "Cadastre o WhatsApp interno antes de ativar os avisos de retirada.",
      );
      return;
    }
    setBusy("save");
    setError(null);
    try {
      const result = await API.put<{ settings: WhatsAppSettings }>(
        "/whatsapp/settings",
        {
          ...settings,
          pixKey: (settings.pixKey ?? "").trim(),
          internalAlertPhone: (settings.internalAlertPhone ?? "").replace(
            /\D/g,
            "",
          ),
        },
      );
      setSettings({
        ...emptySettings,
        ...result.settings,
        pixKey: result.settings?.pixKey ?? "",
        internalAlertPhone: result.settings?.internalAlertPhone ?? "",
      });
      toast.success("Regras de WhatsApp salvas.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar as regras.",
      );
    } finally {
      setBusy(null);
    }
  };

  const copy = statusCopy[connection.status] ?? statusCopy.disconnected;
  const qrIsImage = Boolean(
    connection.qr &&
    (/^data:image\//.test(connection.qr) || /^https?:\/\//.test(connection.qr)),
  );

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 animate-fade-up">
      <div>
        <div className="mb-2 flex items-center gap-3 text-primary">
          <MessageCircle size={22} />
          <span className="text-xs font-bold uppercase tracking-[0.2em]">
            Canal da empresa
          </span>
        </div>
        <h1 className="text-2xl font-bold text-foreground">WhatsApp</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
          Conecte o número corporativo, defina quando cobrar parcelas e receba
          avisos de retiradas registradas no caixa.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive"
        >
          <AlertCircle size={17} className="mt-0.5 shrink-0" />
          {error}
        </div>
      )}

      <section
        className="glass shadow-card rounded-xl p-5 sm:p-6"
        aria-label="Conexão WhatsApp"
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="rounded-xl border border-primary/20 bg-primary/10 p-3 text-primary">
              <MessageCircle size={23} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Número conectado
              </h2>
              <div
                className={`mt-1 flex items-center gap-2 text-sm font-semibold ${copy.tone}`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${connection.status === "connected" ? "bg-success" : connection.status === "disconnected" ? "bg-muted-foreground" : "bg-primary animate-pulse"}`}
                />
                {loading ? "Carregando..." : copy.label}
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                {connection.phone
                  ? `+${connection.phone.replace(/\D/g, "")}`
                  : connection.paired && connection.status !== "connected"
                    ? "Aparelho pareado. Aguardando a conexão."
                    : copy.detail}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                void loadAll();
              }}
              disabled={loading || busy !== null}
              className="inline-flex items-center gap-2 rounded-lg border border-border bg-muted/40 px-3 py-2 text-xs font-semibold text-foreground transition hover:bg-muted disabled:opacity-50"
            >
              <RefreshCw size={14} /> Atualizar
            </button>
            {connection.status === "disconnected" ? (
              <button
                type="button"
                onClick={() => {
                  void connect();
                }}
                disabled={
                  loading || busy !== null || connection.configured === false
                }
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-50"
              >
                <Power size={14} />{" "}
                {busy === "connect" ? "Conectando..." : "Conectar"}
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  void disconnect();
                }}
                disabled={loading || busy !== null}
                className="inline-flex items-center gap-2 rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-2 text-xs font-semibold text-destructive transition hover:bg-destructive/20 disabled:opacity-50"
              >
                <Power size={14} />{" "}
                {busy === "disconnect" ? "Desconectando..." : "Desconectar"}
              </button>
            )}
          </div>
        </div>
        {connection.configured === false && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground"
          >
            A conexão precisa ser habilitada no servidor. Configure{" "}
            <code>WHATSAPP_SESSION_KEY</code> e atualize o estado desta página.
          </p>
        )}
        {connection.lastError && (
          <p
            role="alert"
            className="mt-4 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive"
          >
            Última falha da conexão: {connection.lastError}
          </p>
        )}
        {connection.status === "qr" && (
          <div className="mt-6 flex flex-col items-center rounded-xl border border-border bg-background/70 p-5 text-center">
            {qrIsImage ? (
              <img
                src={connection.qr}
                alt="Código QR para conectar o WhatsApp da empresa"
                className="h-56 w-56 rounded-lg bg-white p-2"
              />
            ) : (
              <div className="flex h-56 w-56 items-center justify-center rounded-lg border border-border bg-input p-4 text-xs text-muted-foreground">
                Aguardando a imagem do QR. Atualize a conexão se necessário.
              </div>
            )}
            <p className="mt-3 text-xs text-muted-foreground">
              WhatsApp da empresa → Aparelhos conectados → Conectar aparelho
            </p>
          </div>
        )}
      </section>

      <form
        onSubmit={(event) => {
          void saveSettings(event);
        }}
        className="glass shadow-card space-y-6 rounded-xl p-5 sm:p-6"
      >
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2.5 text-primary">
            <Clock3 size={19} />
          </div>
          <div>
            <h2 className="text-base font-semibold text-foreground">
              Cobrança de parcelas
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Mensagens apenas para lançamentos a receber de clientes com
              autorização registrada.
            </p>
          </div>
        </div>
        <label className="flex cursor-pointer items-start justify-between gap-4 rounded-xl border border-border bg-background/50 p-4">
          <span>
            <span className="block text-sm font-semibold text-foreground">
              Cobrança automática
            </span>
            <span className="mt-1 block text-xs text-muted-foreground">
              Envie lembretes conforme o vencimento da parcela.
            </span>
          </span>
          <input
            type="checkbox"
            checked={settings.autoBillingEnabled}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                autoBillingEnabled: event.target.checked,
              }))
            }
            className="mt-1 h-4 w-4 accent-primary"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="text-xs font-semibold text-muted-foreground">
            Dias antes do vencimento
            <input
              className={fieldClass}
              type="number"
              min={0}
              max={30}
              value={settings.daysBeforeDue}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  daysBeforeDue: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Dias após o vencimento
            <input
              className={fieldClass}
              type="number"
              min={0}
              max={30}
              value={settings.daysAfterDue}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  daysAfterDue: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="text-xs font-semibold text-muted-foreground">
            Horário diário (Brasília)
            <input
              className={fieldClass}
              type="number"
              min={0}
              max={23}
              value={settings.dailySendHour}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  dailySendHour: Number(event.target.value),
                }))
              }
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
          <input
            type="checkbox"
            checked={settings.sendOnDueDate}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                sendOnDueDate: event.target.checked,
              }))
            }
            className="h-4 w-4 accent-primary"
          />{" "}
          Enviar também no dia do vencimento
        </label>
        <label className="block text-xs font-semibold text-muted-foreground">
          Chave Pix da empresa
          <input
            className={fieldClass}
            type="text"
            autoComplete="off"
            value={settings.pixKey}
            onChange={(event) =>
              setSettings((current) => ({
                ...current,
                pixKey: event.target.value,
              }))
            }
            placeholder="CNPJ, e-mail, telefone ou chave aleatória"
          />
          <span className="mt-1 block font-normal">
            A chave salva aqui será usada nas mensagens de cobrança.
          </span>
        </label>

        <div className="border-t border-border/70 pt-6">
          <div className="mb-4 flex items-start gap-3">
            <div className="rounded-lg bg-success/10 p-2.5 text-success">
              <ShieldCheck size={19} />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">
                Avisos internos de retirada
              </h2>
              <p className="mt-1 text-xs text-muted-foreground">
                Informe o número que receberá o aviso quando uma retirada de
                sócio for liquidada no caixa.
              </p>
            </div>
          </div>
          <label className="flex cursor-pointer items-center gap-3 text-sm text-foreground">
            <input
              type="checkbox"
              checked={settings.withdrawalAlertsEnabled}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  withdrawalAlertsEnabled: event.target.checked,
                }))
              }
              className="h-4 w-4 accent-primary"
            />{" "}
            Avisar retiradas de pró-labore e sócios
          </label>
          <label className="mt-4 block text-xs font-semibold text-muted-foreground">
            WhatsApp interno para avisos
            <input
              className={fieldClass}
              type="tel"
              inputMode="tel"
              value={settings.internalAlertPhone}
              onChange={(event) =>
                setSettings((current) => ({
                  ...current,
                  internalAlertPhone: event.target.value,
                }))
              }
              placeholder="55 11 99999-9999"
            />
          </label>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading || busy !== null}
            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-bold text-primary-foreground shadow-glow transition hover:brightness-110 disabled:opacity-50"
          >
            <Save size={15} />{" "}
            {busy === "save" ? "Salvando..." : "Salvar regras"}
          </button>
        </div>
      </form>

      <section
        className="glass shadow-card rounded-xl p-5 sm:p-6"
        aria-label="Histórico de mensagens"
      >
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-base font-semibold text-foreground">
              <Send size={18} className="text-primary" /> Histórico de envios
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Acompanhe mensagens enviadas, pendências e falhas das cobranças e
              avisos.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              void loadMessages().catch((cause) =>
                setError(
                  cause instanceof Error
                    ? cause.message
                    : "Não foi possível atualizar o histórico.",
                ),
              );
            }}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
          >
            <RefreshCw size={14} /> Atualizar histórico
          </button>
        </div>
        {messages.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            Nenhuma mensagem registrada até agora.
          </div>
        ) : (
          <div className="divide-y divide-border/60">
            {messages.map((message, index) => {
              const recipient =
                message.clientName ??
                message.recipient ??
                message.recipientPhone ??
                message.phone ??
                message.to ??
                "Destinatário não informado";
              const messageStatus = message.status ?? "pending";
              const success = messageStatus === "sent";
              const failed = messageStatus === "failed";
              return (
                <div
                  key={message.id ?? `${index}-${message.createdAt ?? ""}`}
                  className="flex flex-wrap items-center justify-between gap-3 py-3"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                      {success ? (
                        <CheckCircle2 size={15} className="text-success" />
                      ) : failed ? (
                        <AlertCircle size={15} className="text-destructive" />
                      ) : (
                        <Clock3 size={15} className="text-primary" />
                      )}
                      {messageLabel(message)}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {recipient} ·{" "}
                      {readableDate(message.sentAt ?? message.createdAt)}
                    </p>
                    {(message.lastError ??
                      message.error ??
                      message.errorMessage) && (
                      <p className="mt-1 text-xs text-destructive">
                        {message.lastError ??
                          message.error ??
                          message.errorMessage}
                      </p>
                    )}
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-1 text-xs font-semibold ${success ? "bg-success/10 text-success" : failed ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}
                  >
                    {success ? "Enviada" : failed ? "Falhou" : "Pendente"}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
