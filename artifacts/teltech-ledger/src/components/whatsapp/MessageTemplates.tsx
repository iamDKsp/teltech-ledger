import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Bot, CheckCheck, Eraser, Handshake, RotateCcw, Sparkles, TriangleAlert, Users } from "lucide-react";
import { API } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PreviewResult, TemplateInfo, TemplateKind, WhatsAppSettings } from "./types";
import { Badge, Btn, Card, Field, SubHeading, TextInput, Tip, WhatsAppText } from "./ui";

const MAX_LENGTH = 1800;

/** Avatar do assistente, com anel pulsante quando está "online". */
export function AssistantAvatar({ size = 48, pulse = false }: { size?: number; pulse?: boolean }) {
  return (
    <div
      className={cn("flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-glow text-primary-foreground shadow-glow", pulse && "animate-pulse-ring")}
      style={{ width: size, height: size }}
    >
      <Bot size={size * 0.5} />
    </div>
  );
}

function PhonePreview({ assistant, preview, loading, audience }: { assistant: string; preview: PreviewResult | null; loading: boolean; audience: TemplateInfo["audience"] }) {
  return (
    <div className="mx-auto w-full max-w-[22rem] overflow-hidden rounded-[1.75rem] border border-border bg-background shadow-elegant">
      <div className="flex items-center gap-3 border-b border-border bg-card/80 px-4 py-3">
        <AssistantAvatar size={34} />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-foreground">{assistant || "Nexus"}</p>
          <p className="text-[11px] text-success">online</p>
        </div>
        <Badge tone="muted" className="ml-auto">{audience === "client" ? "cliente" : "sócio"}</Badge>
      </div>
      <div className={cn("min-h-[22rem] space-y-2 bg-mesh p-3 transition-opacity", loading && "opacity-60")}>
        {preview ? (
          <>
            <div className="animate-fade-up max-w-[92%] rounded-2xl rounded-tl-sm border border-success/25 bg-success/[0.14] px-3 py-2 text-[13px] leading-relaxed text-foreground">
              <div className="whitespace-pre-wrap break-words">
                <WhatsAppText text={preview.text} />
              </div>
              {preview.footer && <p className="mt-2 text-[11px] italic text-muted-foreground">{preview.footer}</p>}
              <p className="mt-1 flex items-center justify-end gap-1 text-[10px] text-muted-foreground">
                agora <CheckCheck size={12} className="text-primary" />
              </p>
            </div>
            {preview.pix && preview.pix.mode === "native" && (
              <div className="animate-fade-up max-w-[92%] overflow-hidden rounded-2xl border border-border bg-card/90">
                <div className="px-3 py-2.5">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Pagamento via Pix</p>
                  <p className="text-sm font-semibold text-foreground">{(preview.pix.amountCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}</p>
                  <p className="truncate text-[11px] text-muted-foreground">{preview.pix.merchantName}</p>
                </div>
                <div className="border-t border-border py-2 text-center text-xs font-semibold text-primary">Pagar com Pix</div>
              </div>
            )}
            {preview.pix && preview.pix.mode === "text" && (
              <div className="animate-fade-up max-w-[92%] rounded-2xl rounded-tl-sm border border-success/25 bg-success/[0.14] px-3 py-2">
                <p className="break-all font-mono text-[11px] leading-snug text-foreground">{preview.pix.code}</p>
              </div>
            )}
          </>
        ) : (
          <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">Gerando prévia…</div>
        )}
      </div>
    </div>
  );
}

function TemplateTab({ info, active, custom, onClick }: { info: TemplateInfo; active: boolean; custom: boolean; onClick: () => void }) {
  return (
    <Tip content={info.description}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={active}
        className={cn(
          "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
          active ? "border-primary/60 bg-primary/12 text-foreground" : "border-border bg-background/40 text-muted-foreground hover:border-primary/30 hover:text-foreground",
        )}
      >
        {info.label}
        {custom && <span className="h-1.5 w-1.5 rounded-full bg-primary" aria-label="personalizada" />}
      </button>
    </Tip>
  );
}

export function MessageTemplates({
  templates,
  settings,
  onChange,
}: {
  templates: TemplateInfo[];
  settings: WhatsAppSettings;
  onChange: (patch: Partial<WhatsAppSettings>) => void;
}) {
  const [kind, setKind] = useState<TemplateKind>("billing_before");
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [loading, setLoading] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const current = templates.find((template) => template.kind === kind) ?? templates[0];
  const customBody = current ? settings.templates[current.kind] : undefined;
  const body = customBody ?? current?.defaultBody ?? "";
  const isCustom = customBody !== undefined;

  const unknown = useMemo(() => {
    if (!current) return [] as string[];
    const allowed = new Set(current.variables.map((variable) => variable.key));
    return [...new Set([...body.matchAll(/\{([a-z_]+)\}/g)].map((match) => match[1]).filter((name) => !allowed.has(name)))];
  }, [body, current]);

  useEffect(() => {
    if (!current) return;
    setLoading(true);
    const timer = window.setTimeout(() => {
      API.post<PreviewResult>("/whatsapp/preview", {
        kind: current.kind,
        template: customBody ?? null,
        overrides: {
          assistantName: settings.assistantName,
          companyName: settings.companyName,
          pixKey: settings.pixKey,
          pixKeyType: settings.pixKeyType,
          pixMerchantName: settings.pixMerchantName,
          pixMerchantCity: settings.pixMerchantCity,
          pixDeliveryMode: settings.pixDeliveryMode,
          optOutHintEnabled: settings.optOutHintEnabled,
        },
      })
        .then(setPreview)
        .catch(() => undefined)
        .finally(() => setLoading(false));
    }, 450);
    return () => window.clearTimeout(timer);
  }, [current, customBody, settings.assistantName, settings.companyName, settings.pixKey, settings.pixKeyType, settings.pixMerchantName, settings.pixMerchantCity, settings.pixDeliveryMode, settings.optOutHintEnabled]);

  if (!current) {
    return <Card title="Mensagens do assistente"><p className="text-sm text-muted-foreground">Carregando modelos…</p></Card>;
  }

  const setBody = (value: string) => {
    const next = { ...settings.templates };
    if (value === current.defaultBody || !value.trim()) delete next[current.kind];
    else next[current.kind] = value;
    onChange({ templates: next });
  };

  const insertVariable = (key: string) => {
    const field = textareaRef.current;
    const token = `{${key}}`;
    if (!field) {
      setBody(`${body}${token}`);
      return;
    }
    const start = field.selectionStart ?? body.length;
    const end = field.selectionEnd ?? body.length;
    setBody(`${body.slice(0, start)}${token}${body.slice(end)}`);
    requestAnimationFrame(() => {
      field.focus();
      field.setSelectionRange(start + token.length, start + token.length);
    });
  };

  const groups: { title: string; icon: ReactNode; items: TemplateInfo[] }[] = [
    { title: "Para clientes", icon: <Handshake size={14} />, items: templates.filter((template) => template.audience === "client") },
    { title: "Para sócios", icon: <Users size={14} />, items: templates.filter((template) => template.audience === "partner") },
  ];

  return (
    <div className="space-y-6">
      <Card
        icon={<Sparkles size={19} />}
        title="Personalidade do assistente"
        description="Todas as mensagens saem em nome do assistente, com saudação pelo horário (bom dia, boa tarde, boa noite) e o nome de quem recebe."
      >
        <div className="flex flex-wrap items-center gap-5">
          <AssistantAvatar size={56} pulse />
          <div className="grid min-w-[16rem] flex-1 gap-4 sm:grid-cols-2">
            <Field label="Nome do assistente" help="Como ele se apresenta: “Aqui é o Nexus…”.">
              <TextInput maxLength={30} value={settings.assistantName} onChange={(event) => onChange({ assistantName: event.target.value })} placeholder="Nexus" />
            </Field>
            <Field label="Nome da empresa" help="Usado como “assistente da Teltech” e, se você não definir outro, como nome do recebedor no Pix.">
              <TextInput maxLength={40} value={settings.companyName} onChange={(event) => onChange({ companyName: event.target.value })} placeholder="Teltech" />
            </Field>
          </div>
        </div>
      </Card>

      <Card
        title="Modelos de mensagem"
        description="Escolha a mensagem, ajuste o texto e acompanhe a prévia ao vivo. Clique em uma variável para inserir no texto."
      >
        <div className="mb-6 space-y-3">
          {groups.map((group) => (
            <div key={group.title} className="flex flex-wrap items-center gap-2">
              <span className="flex w-28 shrink-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                {group.icon} {group.title}
              </span>
              {group.items.map((item) => (
                <TemplateTab key={item.kind} info={item} active={item.kind === current.kind} custom={settings.templates[item.kind] !== undefined} onClick={() => setKind(item.kind)} />
              ))}
            </div>
          ))}
        </div>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <div className="min-w-0 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-foreground">{current.label}</h3>
                <p className="text-xs text-muted-foreground">{current.description}</p>
              </div>
              <div className="flex items-center gap-2">
                {isCustom ? <Badge tone="primary">personalizada</Badge> : <Badge tone="muted">texto padrão</Badge>}
                <Btn
                  size="sm"
                  icon={<RotateCcw size={13} />}
                  disabled={!isCustom}
                  onClick={() => setBody(current.defaultBody)}
                  tip={isCustom ? "Descarta a sua edição e volta ao texto padrão do Nexus." : "Você ainda não alterou este modelo."}
                >
                  Restaurar padrão
                </Btn>
              </div>
            </div>

            <div>
              <textarea
                ref={textareaRef}
                value={body}
                onChange={(event) => setBody(event.target.value)}
                rows={13}
                maxLength={MAX_LENGTH}
                spellCheck
                className="w-full resize-y rounded-lg border border-border bg-input px-3.5 py-3 font-mono text-[13px] leading-relaxed text-foreground outline-none transition hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20"
                aria-label={`Texto de ${current.label}`}
              />
              <div className="mt-1.5 flex items-center justify-between text-[11px] text-muted-foreground">
                <span>
                  Use <code className="rounded bg-muted px-1">*negrito*</code> e <code className="rounded bg-muted px-1">_itálico_</code> como no WhatsApp.
                </span>
                <span className={cn(body.length > MAX_LENGTH * 0.9 && "text-amber-400")}>{body.length}/{MAX_LENGTH}</span>
              </div>
              {unknown.length > 0 && (
                <p role="alert" className="mt-2 flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/10 p-2.5 text-xs text-destructive">
                  <TriangleAlert size={14} className="mt-0.5 shrink-0" />
                  Variável desconhecida: {unknown.map((name) => `{${name}}`).join(", ")}. Use apenas as variáveis abaixo.
                </p>
              )}
            </div>

            <div>
              <SubHeading hint="Cada variável é trocada pelo dado real na hora do envio. Se uma variável ficar vazia, a linha dela some sozinha.">Variáveis</SubHeading>
              <div className="flex flex-wrap gap-1.5">
                {current.variables.map((variable) => (
                  <Tip key={variable.key} content={<><strong>{variable.label}</strong><br />Exemplo: {variable.example}</>}>
                    <button
                      type="button"
                      onClick={() => insertVariable(variable.key)}
                      className="rounded-md border border-primary/25 bg-primary/10 px-2 py-1 font-mono text-[11px] font-medium text-primary transition hover:border-primary/60 hover:bg-primary/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
                    >
                      {`{${variable.key}}`}
                    </button>
                  </Tip>
                ))}
              </div>
              {current.supportsPix && (
                <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">
                  <code className="rounded bg-muted px-1">{"{pix}"}</code> posiciona as instruções do Pix. O botão ou o código Copia e Cola é sempre anexado quando há chave cadastrada.
                </p>
              )}
            </div>
          </div>

          <div className="space-y-3">
            <SubHeading hint="Dados de exemplo. O texto real usa o cliente, a parcela e as datas de cada envio.">Prévia</SubHeading>
            <PhonePreview assistant={settings.assistantName} preview={preview} loading={loading} audience={current.audience} />
            {preview?.pix?.mode === "native" && (
              <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                <Eraser size={12} className="mt-0.5 shrink-0" />
                Se o botão não puder ser entregue, o cliente recebe o texto com Pix Copia e Cola.
              </p>
            )}
          </div>
        </div>
      </Card>
    </div>
  );
}
