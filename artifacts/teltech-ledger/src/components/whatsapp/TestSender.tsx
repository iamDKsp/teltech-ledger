import { useMemo, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, CircleDashed, Send, Smartphone, UserRound, XCircle, Zap } from "lucide-react";
import { toast } from "sonner";
import { API } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { TemplateInfo, TestKind, TestResult, WhatsAppContact, WhatsAppSettings, WhatsAppStatus } from "./types";
import { Badge, Btn, Card, Field, formatPhone, Segmented, SelectInput, SubHeading, TextInput, Tip } from "./ui";

type Target = "self" | "contact" | "custom";

const modeLabel: Record<TestResult["mode"], string> = {
  native: "Botão de Pix nativo",
  text_with_code: "Texto + Pix Copia e Cola",
  plain: "Mensagem de texto",
};

interface ReadinessItem {
  ok: boolean;
  optional?: boolean;
  label: string;
  tip: string;
}

export function TestSender({
  connection,
  settings,
  contacts,
  templates,
  onSent,
}: {
  connection: WhatsAppStatus;
  settings: WhatsAppSettings;
  contacts: WhatsAppContact[];
  templates: TemplateInfo[];
  onSent: () => void;
}) {
  const connected = connection.status === "connected";
  const [target, setTarget] = useState<Target>("self");
  const [contactId, setContactId] = useState("");
  const [phone, setPhone] = useState("");
  const [kind, setKind] = useState<TestKind>("connection");
  const [sending, setSending] = useState(false);
  const [checking, setChecking] = useState(false);
  const [exists, setExists] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<(TestResult & { at: number; kindLabel: string; targetLabel: string })[]>([]);

  const kindOptions = useMemo(
    () => [{ kind: "connection" as TestKind, label: "Teste de conexão", description: "Mensagem simples para confirmar que tudo funciona." }, ...templates],
    [templates],
  );
  const selectedKind = kindOptions.find((option) => option.kind === kind);
  const activeContacts = contacts.filter((contact) => contact.active);
  const selectedContact = contacts.find((contact) => contact.id === contactId);
  const targetReady = target === "self" || (target === "contact" && Boolean(contactId)) || (target === "custom" && phone.replace(/\D/g, "").length >= 10);

  const readiness: ReadinessItem[] = [
    { ok: connection.configured !== false, label: "Servidor habilitado", tip: "A chave WHATSAPP_SESSION_KEY está configurada no servidor." },
    { ok: connected, label: "Número conectado", tip: "A sessão do WhatsApp da empresa está ativa agora." },
    { ok: Boolean(settings.pixKey.trim()), label: "Chave Pix cadastrada", tip: "Necessária para enviar cobranças com Pix." },
    { ok: settings.autoBillingEnabled, optional: true, label: "Cobrança automática ligada", tip: "Opcional: sem ela, só cobranças manuais são enviadas." },
    { ok: activeContacts.length > 0, optional: true, label: "Sócios cadastrados", tip: "Opcional: necessários para os avisos internos de retirada e pagamento." },
  ];

  const checkNumber = async () => {
    setChecking(true);
    setError(null);
    setExists(null);
    try {
      const result = await API.post<{ exists: boolean }>("/whatsapp/check-number", { phone });
      setExists(result.exists);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível verificar o número.");
    } finally {
      setChecking(false);
    }
  };

  const send = async () => {
    setSending(true);
    setError(null);
    try {
      const result = await API.post<TestResult>("/whatsapp/test", {
        kind,
        target,
        ...(target === "contact" ? { contactId } : {}),
        ...(target === "custom" ? { phone } : {}),
      });
      const targetLabel =
        target === "self" ? "Número conectado" : target === "contact" ? (selectedContact?.name ?? "Sócio") : formatPhone(result.phone);
      setResults((current) => [{ ...result, at: Date.now(), kindLabel: selectedKind?.label ?? "Teste", targetLabel }, ...current].slice(0, 5));
      toast.success(`Teste enviado para ${formatPhone(result.phone)}.`);
      onSent();
    } catch (cause) {
      const message = cause instanceof Error ? cause.message : "Não foi possível enviar o teste.";
      setError(message);
      toast.error(message);
    } finally {
      setSending(false);
    }
  };

  const disabledReason = !connected
    ? "Conecte o WhatsApp da empresa para enviar um teste."
    : !targetReady
      ? target === "contact"
        ? "Escolha um sócio para receber o teste."
        : "Informe o número de destino com DDD."
      : undefined;

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card
        icon={<Zap size={19} />}
        title="Enviar mensagem de teste"
        description="Envia uma mensagem real, na hora, para confirmar que o número está conectado e ver como o Nexus fala com seus clientes e sócios."
      >
        <div className="space-y-6">
          <div>
            <SubHeading hint="Quem vai receber a mensagem de teste.">Destino</SubHeading>
            <Segmented<Target>
              value={target}
              onChange={(value) => {
                setTarget(value);
                setExists(null);
                setError(null);
              }}
              options={[
                {
                  value: "self",
                  icon: <Smartphone size={15} />,
                  label: "Meu número conectado",
                  description: connection.phone ? `Envia para ${formatPhone(connection.phone)} (aparece em “Conversa comigo”).` : "Envia para o próprio número da empresa.",
                  tip: "Forma mais rápida de validar a conexão, sem incomodar ninguém.",
                },
                {
                  value: "contact",
                  icon: <UserRound size={15} />,
                  label: "Um sócio",
                  description: "Usa o nome cadastrado para personalizar a saudação.",
                  tip: "Escolha um contato da aba Sócios & avisos.",
                },
              ]}
            />
            <button
              type="button"
              onClick={() => {
                setTarget("custom");
                setExists(null);
              }}
              className={cn(
                "mt-2 w-full rounded-xl border p-3 text-left text-xs transition",
                target === "custom" ? "border-primary/60 bg-primary/10 text-foreground" : "border-dashed border-border text-muted-foreground hover:border-primary/40 hover:text-foreground",
              )}
            >
              Ou testar outro número…
            </button>

            {target === "contact" && (
              <Field label="Sócio" className="mt-4" hint={activeContacts.length === 0 ? "Nenhum sócio ativo. Cadastre na aba Sócios & avisos." : undefined}>
                <SelectInput value={contactId} onChange={(event) => setContactId(event.target.value)} disabled={activeContacts.length === 0}>
                  <option value="">Selecione…</option>
                  {activeContacts.map((contact) => (
                    <option key={contact.id} value={contact.id}>
                      {contact.name} · {formatPhone(contact.phone)}
                    </option>
                  ))}
                </SelectInput>
              </Field>
            )}

            {target === "custom" && (
              <Field
                label="Número de destino"
                className="mt-4"
                help="Digite com DDD. Dá para verificar antes se o número tem WhatsApp."
                error={exists === false ? "Este número não possui WhatsApp." : undefined}
                hint={exists === true ? undefined : "Ex: 14 99836-4338"}
              >
                <div className="flex gap-2">
                  <TextInput
                    value={phone}
                    onChange={(event) => {
                      setPhone(event.target.value);
                      setExists(null);
                    }}
                    placeholder="(14) 99999-9999"
                    inputMode="tel"
                  />
                  <Btn
                    onClick={() => void checkNumber()}
                    loading={checking}
                    disabled={!connected || phone.replace(/\D/g, "").length < 10}
                    tip={connected ? "Consulta o WhatsApp para saber se o número existe, sem enviar mensagem." : "Conecte o WhatsApp para verificar números."}
                    className="shrink-0"
                  >
                    Verificar
                  </Btn>
                </div>
                {exists === true && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-[11px] font-medium text-success">
                    <BadgeCheck size={13} /> Número válido: tem WhatsApp.
                  </p>
                )}
              </Field>
            )}
          </div>

          <div>
            <SubHeading hint="Mensagens de cobrança e avisos usam dados fictícios (cliente Mariana, parcela de R$ 1.250,00).">Mensagem</SubHeading>
            <div className="grid gap-2 sm:grid-cols-2">
              {kindOptions.map((option) => {
                const active = option.kind === kind;
                return (
                  <Tip key={option.kind} content={option.description}>
                    <button
                      type="button"
                      onClick={() => setKind(option.kind)}
                      aria-pressed={active}
                      className={cn(
                        "flex items-center gap-2 rounded-lg border px-3 py-2.5 text-left text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                        active ? "border-primary/60 bg-primary/10 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
                      )}
                    >
                      <span className={cn("h-1.5 w-1.5 shrink-0 rounded-full", active ? "bg-primary" : "bg-muted-foreground/40")} />
                      {option.label}
                    </button>
                  </Tip>
                );
              })}
            </div>
            {selectedKind && <p className="mt-2 text-[11px] text-muted-foreground">{selectedKind.description}</p>}
            {kind.startsWith("billing") && (
              <p className="mt-2 flex items-start gap-1.5 rounded-lg border border-amber-500/25 bg-amber-500/10 p-2.5 text-[11px] text-amber-300">
                <AlertTriangle size={13} className="mt-0.5 shrink-0" />
                O teste de cobrança leva um Pix de exemplo de R$ 1.250,00 com a sua chave. Envie apenas para números internos.
              </p>
            )}
          </div>

          {error && (
            <p role="alert" className="animate-shake flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-xs text-destructive">
              <XCircle size={15} className="mt-0.5 shrink-0" /> {error}
            </p>
          )}

          <div className="flex justify-end">
            <Btn variant="primary" icon={<Send size={15} />} loading={sending} disabled={Boolean(disabledReason)} tip={disabledReason ?? "Envia agora, sem fila. O resultado aparece ao lado."} onClick={() => void send()}>
              {sending ? "Enviando…" : "Enviar teste"}
            </Btn>
          </div>
        </div>
      </Card>

      <div className="space-y-6">
        <Card icon={<CheckCircle2 size={19} />} tone="success" title="Checklist de prontidão" description="O que precisa estar certo para as mensagens saírem.">
          <ul className="space-y-2">
            {readiness.map((item) => (
              <li key={item.label}>
                <Tip content={item.tip} side="left">
                  <div className="flex items-center justify-between gap-3 rounded-lg border border-border/70 bg-background/40 px-3 py-2 text-xs">
                    <span className="flex items-center gap-2 font-medium text-foreground">
                      {item.ok ? <CheckCircle2 size={15} className="text-success" /> : item.optional ? <CircleDashed size={15} className="text-muted-foreground" /> : <XCircle size={15} className="text-destructive" />}
                      {item.label}
                    </span>
                    {!item.ok && <Badge tone={item.optional ? "muted" : "danger"}>{item.optional ? "opcional" : "pendente"}</Badge>}
                  </div>
                </Tip>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="Resultado dos testes" description="Últimos envios feitos nesta tela.">
          {results.length === 0 ? (
            <div className="rounded-xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">Nenhum teste enviado ainda.</div>
          ) : (
            <ul className="space-y-2">
              {results.map((result, index) => (
                <li key={result.at} className={cn("rounded-xl border p-3 text-xs", index === 0 ? "border-success/30 bg-success/[0.07]" : "border-border/70 bg-background/40")}>
                  <div className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-1.5 font-semibold text-foreground">
                      <CheckCircle2 size={14} className="text-success" /> {result.kindLabel}
                    </span>
                    <span className="text-muted-foreground">{result.latencyMs} ms</span>
                  </div>
                  <p className="mt-1 text-muted-foreground">
                    Para {result.targetLabel} · {formatPhone(result.phone)}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    <Badge tone={result.mode === "native" ? "primary" : "muted"}>{modeLabel[result.mode]}</Badge>
                    {result.fallbackReason && (
                      <Tip content={result.fallbackReason}>
                        <span>
                          <Badge tone="warning">
                            <AlertTriangle size={11} /> Botão indisponível, enviado como texto
                          </Badge>
                        </span>
                      </Tip>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
