import { useEffect, useState } from "react";
import { BellRing, CalendarClock, CheckCheck, CircleAlert, Clock3, Flame, QrCode, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { API } from "@/lib/api";
import { cn } from "@/lib/utils";
import type { PixKeyTypeSetting, WhatsAppSettings } from "./types";
import { Badge, Card, Field, NumberInput, Segmented, SelectInput, SubHeading, TextInput, ToggleRow } from "./ui";

type Patch = (patch: Partial<WhatsAppSettings>) => void;

const keyTypeOptions: { value: PixKeyTypeSetting; label: string }[] = [
  { value: "auto", label: "Detectar automaticamente" },
  { value: "phone", label: "Celular" },
  { value: "cpf", label: "CPF" },
  { value: "cnpj", label: "CNPJ" },
  { value: "email", label: "E-mail" },
  { value: "random", label: "Chave aleatória" },
];

function TimelineStep({ active, title, subtitle, icon, tone }: { active: boolean; title: string; subtitle: string; icon: React.ReactNode; tone: "primary" | "warning" | "danger" }) {
  const toneClass = {
    primary: "border-primary/40 bg-primary/15 text-primary",
    warning: "border-amber-500/40 bg-amber-500/15 text-amber-400",
    danger: "border-destructive/40 bg-destructive/15 text-destructive",
  }[tone];
  return (
    <div className={cn("relative z-10 flex flex-col items-center gap-2 text-center transition", !active && "opacity-40 grayscale")}>
      <div className={cn("flex h-11 w-11 items-center justify-center rounded-full border backdrop-blur", active ? toneClass : "border-border bg-muted text-muted-foreground")}>{icon}</div>
      <div>
        <p className="text-xs font-semibold text-foreground">{title}</p>
        <p className="text-[11px] text-muted-foreground">{active ? subtitle : "desligado"}</p>
      </div>
    </div>
  );
}

export function BillingRules({ settings, onChange }: { settings: WhatsAppSettings; onChange: Patch }) {
  const [detected, setDetected] = useState<{ type: string | null; label: string | null } | null>(null);

  useEffect(() => {
    const key = settings.pixKey.trim();
    if (!key) {
      setDetected(null);
      return;
    }
    const timer = window.setTimeout(() => {
      API.post<{ type: string | null; label: string | null }>("/whatsapp/pix/detect", { key })
        .then(setDetected)
        .catch(() => setDetected(null));
    }, 350);
    return () => window.clearTimeout(timer);
  }, [settings.pixKey]);

  const number = (value: string) => (value === "" ? Number.NaN : Number(value));
  const hour = Number.isFinite(settings.dailySendHour) ? `${String(settings.dailySendHour).padStart(2, "0")}:00` : "--:--";
  const keyFilled = settings.pixKey.trim().length > 0;

  return (
    <div className="space-y-6">
      <Card
        icon={<CalendarClock size={19} />}
        title="Cobrança automática de parcelas"
        description="O Nexus lembra seus clientes sozinho, apenas em lançamentos a receber de clientes com autorização de WhatsApp registrada."
      >
        <div className="space-y-5">
          <ToggleRow
            icon={<BellRing size={18} />}
            title="Cobrança automática"
            description="Envia lembretes conforme o vencimento de cada parcela."
            help="Desligada, nenhuma cobrança sai sozinha. Você ainda pode cobrar manualmente pelo financeiro."
            checked={settings.autoBillingEnabled}
            onChange={(value) => onChange({ autoBillingEnabled: value })}
          />

          <div className="relative rounded-xl border border-border bg-background/40 px-4 py-6">
            <div aria-hidden className="absolute left-[16.6%] right-[16.6%] top-[3.25rem] h-px bg-gradient-to-r from-primary/60 via-amber-500/60 to-destructive/60" />
            <div className="grid grid-cols-3">
              <TimelineStep
                active={settings.autoBillingEnabled && settings.daysBeforeDue > 0}
                title="Lembrete"
                subtitle={`${settings.daysBeforeDue} dia(s) antes · ${hour}`}
                icon={<Clock3 size={18} />}
                tone="primary"
              />
              <TimelineStep
                active={settings.autoBillingEnabled && settings.sendOnDueDate}
                title="Vencimento"
                subtitle={`no dia · ${hour}`}
                icon={<Flame size={18} />}
                tone="warning"
              />
              <TimelineStep
                active={settings.autoBillingEnabled && settings.daysAfterDue > 0}
                title="Atraso"
                subtitle={`${settings.daysAfterDue} dia(s) depois · ${hour}`}
                icon={<CircleAlert size={18} />}
                tone="danger"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Dias antes do vencimento" help="Quantos dias antes de vencer o cliente recebe o lembrete. Use 0 para não enviar.">
              <NumberInput min={0} max={30} suffix="dias" value={Number.isNaN(settings.daysBeforeDue) ? "" : settings.daysBeforeDue} onChange={(event) => onChange({ daysBeforeDue: number(event.target.value) })} />
            </Field>
            <Field label="Dias após o vencimento" help="Quantos dias depois de vencida a parcela em aberto recebe a cobrança. Use 0 para não enviar.">
              <NumberInput min={0} max={30} suffix="dias" value={Number.isNaN(settings.daysAfterDue) ? "" : settings.daysAfterDue} onChange={(event) => onChange({ daysAfterDue: number(event.target.value) })} />
            </Field>
            <Field label="Horário de envio" help="Horário de Brasília em que as mensagens do dia começam a sair." hint={`Todos os dias a partir das ${hour}.`}>
              <NumberInput min={0} max={23} suffix="h" value={Number.isNaN(settings.dailySendHour) ? "" : settings.dailySendHour} onChange={(event) => onChange({ dailySendHour: number(event.target.value) })} />
            </Field>
          </div>

          <ToggleRow
            title="Enviar também no dia do vencimento"
            description="Um lembrete extra na manhã em que a parcela vence."
            checked={settings.sendOnDueDate}
            onChange={(value) => onChange({ sendOnDueDate: value })}
          />
        </div>
      </Card>

      <Card
        icon={<WalletCards size={19} />}
        title="Pix da empresa"
        description="A chave e o código Pix Copia e Cola (com o valor da parcela) vão junto de cada cobrança."
      >
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
            <Field
              label="Chave Pix"
              help="CPF, CNPJ, celular, e-mail ou chave aleatória. O celular é convertido para o formato +55 exigido pelo Pix."
              hint={keyFilled ? undefined : "Cadastre a chave para habilitar cobranças com Pix."}
            >
              <div className="relative">
                <TextInput
                  autoComplete="off"
                  value={settings.pixKey}
                  onChange={(event) => onChange({ pixKey: event.target.value })}
                  placeholder="CNPJ, e-mail, celular ou chave aleatória"
                  className="pr-28"
                />
                {keyFilled && settings.pixKeyType === "auto" && detected && (
                  <span className="absolute inset-y-0 right-2 flex items-center">
                    {detected.type ? (
                      <Badge tone="success">
                        <CheckCheck size={11} /> {detected.label}
                      </Badge>
                    ) : (
                      <Badge tone="danger">não reconhecida</Badge>
                    )}
                  </span>
                )}
              </div>
            </Field>
            <Field label="Tipo da chave" help="Deixe em automático. Escolha manualmente só se o tipo detectado estiver errado (ex.: celular com 11 dígitos que parece CPF).">
              <SelectInput value={settings.pixKeyType} onChange={(event) => onChange({ pixKeyType: event.target.value as PixKeyTypeSetting })}>
                {keyTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectInput>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nome do recebedor" help="Aparece no app do banco quando o cliente confere o Pix. Máximo de 25 caracteres, sem acentos." hint={`Em branco: usa “${settings.companyName || "Teltech"}”.`}>
              <TextInput maxLength={25} value={settings.pixMerchantName} onChange={(event) => onChange({ pixMerchantName: event.target.value })} placeholder={settings.companyName || "Teltech"} />
            </Field>
            <Field label="Cidade do recebedor" help="Cidade exibida no Pix. Máximo de 15 caracteres, sem acentos." hint="Em branco: usa “SAO PAULO”.">
              <TextInput maxLength={15} value={settings.pixMerchantCity} onChange={(event) => onChange({ pixMerchantCity: event.target.value })} placeholder="SAO PAULO" />
            </Field>
          </div>

          <div>
            <SubHeading hint="Define como o Pix chega no WhatsApp do cliente. Teste na aba “Teste de envio” antes de ativar o botão nativo.">Como enviar o Pix</SubHeading>
            <Segmented<WhatsAppSettings["pixDeliveryMode"]>
              value={settings.pixDeliveryMode}
              onChange={(value) => onChange({ pixDeliveryMode: value })}
              options={[
                {
                  value: "text",
                  icon: <QrCode size={15} />,
                  label: "Texto + Copia e Cola",
                  badge: <Badge tone="success"><ShieldCheck size={11} /> recomendado</Badge>,
                  description: "Envia a chave e, logo depois, uma mensagem só com o código Pix, fácil de copiar com um toque.",
                  tip: "Funciona em qualquer celular e com qualquer número de WhatsApp.",
                },
                {
                  value: "native",
                  icon: <Sparkles size={15} />,
                  label: "Botão de Pix do WhatsApp",
                  badge: <Badge tone="warning">experimental</Badge>,
                  description: "Mostra o botão exclusivo de Pix dentro da conversa. Se não puder ser entregue, volta sozinho para texto + Copia e Cola.",
                  tip: "Recurso nativo e não oficial do WhatsApp: pode não aparecer em todos os aparelhos. Use “Teste de envio” no seu celular para conferir antes de ativar.",
                },
              ]}
            />
          </div>
        </div>
      </Card>

      <Card
        icon={<ShieldCheck size={19} />}
        tone="success"
        title="Comportamento das mensagens"
        description="Ajustes finos que valem para todos os envios."
      >
        <div className="space-y-3">
          <ToggleRow
            title="Confirmar pagamento ao cliente"
            description="Quando um pagamento é confirmado no caixa, o Nexus agradece ao cliente."
            checked={settings.receiptEnabled}
            onChange={(value) => onChange({ receiptEnabled: value })}
          />
          <ToggleRow
            title="Aviso de “PARAR” nas cobranças"
            description="Inclui no rodapé que o cliente pode responder PARAR para não receber mais lembretes."
            help="Boa prática e reduz denúncias de spam, que podem levar ao bloqueio do número."
            checked={settings.optOutHintEnabled}
            onChange={(value) => onChange({ optOutHintEnabled: value })}
          />
          <Field label="Limite de mensagens em 24 horas" help="Trava de segurança: ao atingir o limite, as próximas mensagens aguardam. Evita rajadas que o WhatsApp interpreta como spam." className="max-w-xs pt-2">
            <NumberInput min={1} max={500} suffix="msgs" value={Number.isNaN(settings.dailyMessageLimit) ? "" : settings.dailyMessageLimit} onChange={(event) => onChange({ dailyMessageLimit: number(event.target.value) })} />
          </Field>
        </div>
      </Card>
    </div>
  );
}
