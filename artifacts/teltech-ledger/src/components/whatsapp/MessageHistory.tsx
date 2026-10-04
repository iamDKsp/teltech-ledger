import { useMemo, useState } from "react";
import {
  AlertCircle,
  BellRing,
  CheckCircle2,
  ChevronDown,
  CircleSlash,
  Clock3,
  FlaskConical,
  HandCoins,
  Handshake,
  Hourglass,
  Loader2,
  RefreshCw,
  RotateCw,
  Send,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { WhatsAppMessage } from "./types";
import { Badge, Btn, Card, formatPhone, readableDate, WhatsAppText } from "./ui";

const kindInfo: Record<string, { label: string; icon: typeof Send }> = {
  manual_billing: { label: "Cobrança manual", icon: Send },
  billing_before: { label: "Lembrete antes do vencimento", icon: Clock3 },
  billing_due: { label: "Cobrança no vencimento", icon: BellRing },
  billing_overdue: { label: "Cobrança em atraso", icon: AlertCircle },
  payment_receipt: { label: "Confirmação de pagamento", icon: Handshake },
  withdrawal_alert: { label: "Aviso de retirada", icon: HandCoins },
  partner_withdrawal: { label: "Aviso de retirada", icon: HandCoins },
  payment_alert: { label: "Aviso de pagamento recebido", icon: CheckCircle2 },
  test_message: { label: "Mensagem de teste", icon: FlaskConical },
};

type StatusKey = "sent" | "queued" | "processing" | "retry" | "failed" | "skipped";

const statusInfo: Record<StatusKey, { label: string; tone: "success" | "primary" | "danger" | "muted" | "warning"; icon: typeof Send; tip: string }> = {
  sent: { label: "Enviada", tone: "success", icon: CheckCircle2, tip: "Entregue ao WhatsApp." },
  queued: { label: "Na fila", tone: "primary", icon: Hourglass, tip: "Aguardando a vez de ser enviada (menos de 1 minuto)." },
  processing: { label: "Enviando", tone: "primary", icon: Loader2, tip: "Sendo enviada agora." },
  retry: { label: "Tentando de novo", tone: "warning", icon: RotateCw, tip: "Houve uma falha temporária; o sistema tenta novamente sozinho." },
  failed: { label: "Falhou", tone: "danger", icon: AlertCircle, tip: "Todas as tentativas falharam. Veja o motivo e reenvie." },
  skipped: { label: "Ignorada", tone: "muted", icon: CircleSlash, tip: "Não foi enviada de propósito (ex.: parcela já paga ou cliente sem autorização)." },
};

type Filter = "all" | "sent" | "pending" | "problem";

const filters: { value: Filter; label: string; match: (status: string) => boolean }[] = [
  { value: "all", label: "Todas", match: () => true },
  { value: "sent", label: "Enviadas", match: (status) => status === "sent" },
  { value: "pending", label: "Pendentes", match: (status) => ["queued", "processing", "retry"].includes(status) },
  { value: "problem", label: "Falhas e ignoradas", match: (status) => ["failed", "skipped"].includes(status) },
];

export function MessageHistory({
  messages,
  refreshing,
  onRefresh,
}: {
  messages: WhatsAppMessage[];
  refreshing: boolean;
  onRefresh: () => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [retrying, setRetrying] = useState<string | null>(null);

  const counts = useMemo(
    () => Object.fromEntries(filters.map((item) => [item.value, messages.filter((message) => item.match(message.status ?? "queued")).length])) as Record<Filter, number>,
    [messages],
  );
  const visible = messages.filter((message) => filters.find((item) => item.value === filter)!.match(message.status ?? "queued"));

  const retry = async (message: WhatsAppMessage) => {
    if (!message.id) return;
    setRetrying(message.id);
    try {
      await API.post(`/whatsapp/messages/${message.id}/retry`, {});
      toast.success("Mensagem colocada de volta na fila.");
      onRefresh();
    } catch (cause) {
      toast.error(cause instanceof Error ? cause.message : "Não foi possível reenviar.");
    } finally {
      setRetrying(null);
    }
  };

  return (
    <Card
      icon={<Send size={19} />}
      title="Histórico de envios"
      description="Acompanhe o que foi enviado, o que está na fila e o que falhou, incluindo cobranças, confirmações e avisos."
      action={
        <Btn size="sm" icon={<RefreshCw size={14} className={cn(refreshing && "animate-spin")} />} onClick={onRefresh} disabled={refreshing} tip="Busca de novo as últimas 50 mensagens.">
          Atualizar histórico
        </Btn>
      }
    >
      <div className="mb-4 flex flex-wrap gap-2">
        {filters.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setFilter(item.value)}
            aria-pressed={filter === item.value}
            className={cn(
              "inline-flex items-center gap-2 rounded-lg border px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              filter === item.value ? "border-primary/60 bg-primary/12 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
            )}
          >
            {item.label}
            <span className={cn("rounded-full px-1.5 text-[10px]", filter === item.value ? "bg-primary/25 text-primary" : "bg-muted text-muted-foreground")}>{counts[item.value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
          {messages.length === 0 ? "Nenhuma mensagem registrada até agora." : "Nenhuma mensagem neste filtro."}
        </div>
      ) : (
        <ul className="space-y-2">
          {visible.map((message, index) => {
            const status = (message.status && message.status in statusInfo ? message.status : "queued") as StatusKey;
            const state = statusInfo[status];
            const kind = kindInfo[message.kind ?? ""] ?? { label: (message.kind ?? "Mensagem").replaceAll("_", " "), icon: Send };
            const KindIcon = kind.icon;
            const StateIcon = state.icon;
            const id = message.id ?? `${index}-${message.createdAt ?? ""}`;
            const expanded = openId === id;
            const recipient = message.clientName || formatPhone(message.recipient) || "Destinatário não informado";
            const canRetry = status === "failed" || status === "skipped";
            return (
              <li key={id} className="animate-fade-up overflow-hidden rounded-xl border border-border/80 bg-background/40 transition hover:border-primary/30">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-2 p-3.5">
                  <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border", status === "sent" ? "border-success/25 bg-success/10 text-success" : status === "failed" ? "border-destructive/25 bg-destructive/10 text-destructive" : "border-primary/20 bg-primary/10 text-primary")}>
                    <KindIcon size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">{kind.label}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {recipient} · {readableDate(message.sentAt ?? message.createdAt)}
                    </p>
                    {message.lastError && (
                      <p className={cn("mt-1 text-xs", status === "failed" ? "text-destructive" : status === "sent" ? "text-amber-400" : "text-muted-foreground")}>
                        {message.lastError}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge tone={state.tone}>
                      <StateIcon size={11} className={cn(status === "processing" && "animate-spin")} />
                      {state.label}
                    </Badge>
                    {canRetry && (
                      <Btn size="sm" icon={<RotateCw size={13} />} loading={retrying === message.id} onClick={() => void retry(message)} tip="Coloca esta mensagem de volta na fila. Antes de enviar, o sistema confere de novo se ela ainda faz sentido.">
                        Reenviar
                      </Btn>
                    )}
                    {message.body && (
                      <Btn variant="ghost" size="icon" onClick={() => setOpenId(expanded ? null : id)} tip={expanded ? "Ocultar o texto" : "Ver o texto enviado"} aria-expanded={expanded} aria-label="Ver texto da mensagem">
                        <ChevronDown size={16} className={cn("transition-transform", expanded && "rotate-180")} />
                      </Btn>
                    )}
                  </div>
                </div>
                {expanded && message.body && (
                  <div className="animate-fade-up border-t border-border/70 bg-card/40 p-4">
                    <div className="max-w-md whitespace-pre-wrap break-words rounded-2xl rounded-tl-sm border border-success/25 bg-success/[0.12] px-3.5 py-2.5 text-[13px] leading-relaxed text-foreground">
                      <WhatsAppText text={message.body} />
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
