import { AlertCircle, CheckCircle2, Loader2, MessageCircle, Power, QrCode, RefreshCw, ShieldAlert, Smartphone } from "lucide-react";
import { cn } from "@/lib/utils";
import type { WhatsAppStatus } from "./types";
import { Badge, Btn, formatPhone, timeAgo } from "./ui";

const statusCopy = {
  disconnected: {
    label: "Desconectado",
    detail: "Conecte o número da empresa para habilitar os envios.",
    dot: "bg-muted-foreground",
    text: "text-muted-foreground",
  },
  connecting: {
    label: "Conectando…",
    detail: "Aguardando a sessão do WhatsApp responder.",
    dot: "bg-primary animate-pulse",
    text: "text-primary",
  },
  qr: {
    label: "Aguardando leitura do QR",
    detail: "No WhatsApp da empresa, abra Aparelhos conectados e leia o código.",
    dot: "bg-primary animate-pulse",
    text: "text-primary",
  },
  connected: {
    label: "Conectado",
    detail: "A conexão está pronta para os envios configurados.",
    dot: "bg-success animate-pulse-ring",
    text: "text-success",
  },
} as const;

export function ConnectionCard({
  connection,
  loading,
  busy,
  onRefresh,
  onConnect,
  onDisconnect,
}: {
  connection: WhatsAppStatus;
  loading: boolean;
  busy: "connect" | "disconnect" | "save" | null;
  onRefresh: () => void;
  onConnect: () => void;
  onDisconnect: () => void;
}) {
  const copy = statusCopy[connection.status] ?? statusCopy.disconnected;
  const connected = connection.status === "connected";
  const qrIsImage = Boolean(connection.qr && (/^data:image\//.test(connection.qr) || /^https?:\/\//.test(connection.qr)));
  const since = timeAgo(connection.connectedAt);

  return (
    <section
      aria-label="Conexão WhatsApp"
      className="glass shadow-card relative overflow-hidden rounded-xl p-5 sm:p-6"
    >
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full blur-3xl transition-colors duration-700",
          connected ? "bg-success/15" : "bg-primary/15",
        )}
      />
      <div className="relative flex flex-wrap items-center justify-between gap-5">
        <div className="flex items-center gap-4">
          <div
            className={cn(
              "flex h-14 w-14 items-center justify-center rounded-2xl border transition-colors",
              connected ? "border-success/30 bg-success/10 text-success" : "border-primary/25 bg-primary/10 text-primary",
            )}
          >
            <MessageCircle size={26} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-base font-semibold text-foreground">Número da empresa</h2>
              <span className={cn("inline-flex items-center gap-2 text-sm font-semibold", copy.text)}>
                <span className={cn("h-2.5 w-2.5 rounded-full", copy.dot)} />
                {loading ? "Carregando…" : copy.label}
              </span>
            </div>
            <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {connection.phone ? (
                <>
                  <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
                    <Smartphone size={14} className="text-muted-foreground" />
                    {formatPhone(connection.phone)}
                  </span>
                  {connected && since && <span className="text-xs">conectado {since}</span>}
                </>
              ) : connection.paired && !connected ? (
                "Aparelho pareado. Aguardando a conexão."
              ) : (
                copy.detail
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Btn
            size="sm"
            icon={<RefreshCw size={14} className={cn(loading && "animate-spin")} />}
            onClick={onRefresh}
            disabled={loading || busy !== null}
            tip="Consulta de novo o estado da conexão, as regras e o histórico."
          >
            Atualizar
          </Btn>
          {connection.status === "disconnected" ? (
            <Btn
              variant="primary"
              size="sm"
              icon={<Power size={14} />}
              onClick={onConnect}
              loading={busy === "connect"}
              disabled={loading || busy !== null || connection.configured === false}
              tip={
                connection.configured === false
                  ? "O servidor ainda não tem a chave WHATSAPP_SESSION_KEY configurada."
                  : "Gera um QR Code para parear o WhatsApp da empresa."
              }
            >
              {busy === "connect" ? "Conectando…" : "Conectar"}
            </Btn>
          ) : (
            <Btn
              variant="danger"
              size="sm"
              icon={<Power size={14} />}
              onClick={onDisconnect}
              loading={busy === "disconnect"}
              disabled={loading || busy !== null}
              tip="Encerra a sessão e interrompe todos os envios até conectar de novo."
            >
              {busy === "disconnect" ? "Desconectando…" : "Desconectar"}
            </Btn>
          )}
        </div>
      </div>

      {connection.configured === false && (
        <p role="alert" className="relative mt-4 flex items-start gap-2 rounded-lg border border-primary/30 bg-primary/10 p-3 text-xs text-foreground">
          <ShieldAlert size={15} className="mt-0.5 shrink-0 text-primary" />
          <span>
            A conexão precisa ser habilitada no servidor. Configure <code className="rounded bg-muted px-1">WHATSAPP_SESSION_KEY</code> e atualize esta página.
          </span>
        </p>
      )}
      {connection.lastError && !connected && (
        <p role="alert" className="relative mt-4 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
          <AlertCircle size={15} className="mt-0.5 shrink-0" />
          Última falha da conexão: {connection.lastError}
        </p>
      )}

      {connection.status === "qr" && (
        <div className="relative mt-6 grid items-center gap-6 rounded-xl border border-border bg-background/60 p-5 sm:grid-cols-[auto_1fr]">
          {qrIsImage ? (
            <img
              src={connection.qr ?? undefined}
              alt="Código QR para conectar o WhatsApp da empresa"
              className="mx-auto h-52 w-52 rounded-xl bg-white p-2.5 shadow-elegant"
            />
          ) : (
            <div className="mx-auto flex h-52 w-52 flex-col items-center justify-center gap-2 rounded-xl border border-border bg-input p-4 text-center text-xs text-muted-foreground">
              <Loader2 className="animate-spin text-primary" />
              Gerando o QR Code…
            </div>
          )}
          <ol className="space-y-3 text-sm text-muted-foreground">
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">1</span>
              Abra o WhatsApp no celular da empresa.
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">2</span>
              Toque em <strong className="text-foreground">Aparelhos conectados → Conectar aparelho</strong>.
            </li>
            <li className="flex items-start gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">3</span>
              Aponte a câmera para o QR ao lado.
            </li>
            <li>
              <Badge tone="primary">
                <QrCode size={12} /> O código renova sozinho a cada ~20 segundos
              </Badge>
            </li>
          </ol>
        </div>
      )}

      {connected && (
        <div className="relative mt-4 flex items-center gap-2 text-xs text-success">
          <CheckCircle2 size={14} /> Pronto para enviar. Use a aba <strong>Teste de envio</strong> para confirmar com uma mensagem real.
        </div>
      )}
    </section>
  );
}
