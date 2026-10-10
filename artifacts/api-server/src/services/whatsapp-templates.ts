/**
 * Mensagens do WhatsApp com a personalidade do assistente (Nexus por padrão).
 *
 * Este módulo é puro (sem banco nem WhatsApp): recebe valores já formatados e
 * devolve o texto final. A mesma lógica gera o envio real, o teste e a prévia
 * exibida na tela de configurações.
 */

export type TemplateKind =
  | "billing_before"
  | "billing_due"
  | "billing_overdue"
  | "payment_receipt"
  | "withdrawal_alert"
  | "payment_alert"
  | "expense_registered"
  | "expense_paid"
  | "income_registered";

export type TemplateAudience = "client" | "partner";

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export interface TemplateMeta {
  kind: TemplateKind;
  label: string;
  description: string;
  audience: TemplateAudience;
  /** Cobranças podem levar o Pix (botão nativo ou código Copia e Cola). */
  supportsPix: boolean;
  variables: TemplateVariable[];
  defaultBody: string;
}

const COMMON_VARIABLES: TemplateVariable[] = [
  { key: "assistente", label: "Nome do assistente", example: "Nexus" },
  { key: "empresa", label: "Nome da empresa", example: "Teltech" },
  { key: "saudacao", label: "Bom dia / Boa tarde / Boa noite", example: "Boa tarde" },
];

const BILLING_VARIABLES: TemplateVariable[] = [
  ...COMMON_VARIABLES,
  { key: "cliente", label: "Nome completo do cliente", example: "Mariana Souza" },
  { key: "nome", label: "Primeiro nome do cliente", example: "Mariana" },
  { key: "descricao", label: "Descrição da parcela", example: "Site institucional (parcela 2/6)" },
  { key: "valor", label: "Valor da parcela", example: "R$ 1.250,00" },
  { key: "vencimento", label: "Data de vencimento", example: "07/10/2026" },
  { key: "prazo", label: "Prazo (em 3 dias, amanhã, hoje…)", example: "em 3 dias" },
  { key: "atraso", label: "Tempo de atraso", example: "3 dias de atraso" },
  { key: "pix", label: "Bloco com instruções do Pix", example: "🔑 Chave Pix (Celular): +5514998364338" },
];

const RECEIPT_VARIABLES: TemplateVariable[] = [
  ...COMMON_VARIABLES,
  { key: "cliente", label: "Nome completo do cliente", example: "Mariana Souza" },
  { key: "nome", label: "Primeiro nome do cliente", example: "Mariana" },
  { key: "descricao", label: "Descrição da parcela", example: "Site institucional (parcela 2/6)" },
  { key: "valor", label: "Valor recebido", example: "R$ 1.250,00" },
  { key: "data_pagamento", label: "Data do pagamento", example: "04/10/2026" },
];

const WITHDRAWAL_VARIABLES: TemplateVariable[] = [
  ...COMMON_VARIABLES,
  { key: "contato", label: "Como chamamos quem recebe", example: "Lucas" },
  { key: "socio", label: "Sócio que retirou", example: "Tarcísio" },
  { key: "valor", label: "Valor da retirada", example: "R$ 3.000,00" },
  { key: "descricao", label: "Descrição do lançamento", example: "Pró-labore de outubro" },
  { key: "conta", label: "Conta de origem", example: "Conta principal" },
  { key: "saldo", label: "Saldo após a retirada", example: "R$ 18.420,00" },
  { key: "data", label: "Data da retirada", example: "04/10/2026" },
  { key: "registrado_por", label: "Quem registrou", example: "Tarcísio" },
];

const PAYMENT_ALERT_VARIABLES: TemplateVariable[] = [
  ...COMMON_VARIABLES,
  { key: "contato", label: "Como chamamos quem recebe", example: "Lucas" },
  { key: "cliente", label: "Nome completo do cliente", example: "Mariana Souza" },
  { key: "descricao", label: "Descrição da parcela", example: "Site institucional (parcela 2/6)" },
  { key: "valor", label: "Valor recebido", example: "R$ 1.250,00" },
  { key: "data_pagamento", label: "Data do pagamento", example: "04/10/2026" },
  { key: "conta", label: "Conta que recebeu", example: "Conta principal" },
];

const EXPENSE_REGISTERED_VARIABLES: TemplateVariable[] = [
  ...COMMON_VARIABLES,
  { key: "contato", label: "Como chamamos quem recebe", example: "Lucas" },
  { key: "descricao", label: "Descrição da despesa", example: "Assinatura Servidor Cloud" },
  { key: "valor", label: "Valor da despesa", example: "R$ 350,00" },
  { key: "vencimento", label: "Data de vencimento", example: "20/10/2026" },
  { key: "categoria", label: "Categoria financeira", example: "Infraestrutura" },
  { key: "conta", label: "Conta bancária prevista", example: "Conta Principal" },
  { key: "registrado_por", label: "Quem registrou a despesa", example: "Tarcísio" },
];

const EXPENSE_PAID_VARIABLES: TemplateVariable[] = [
  ...COMMON_VARIABLES,
  { key: "contato", label: "Como chamamos quem recebe", example: "Lucas" },
  { key: "descricao", label: "Descrição da despesa", example: "Assinatura Servidor Cloud" },
  { key: "valor", label: "Valor pago", example: "R$ 350,00" },
  { key: "data_pagamento", label: "Data do pagamento / baixa", example: "10/10/2026" },
  { key: "categoria", label: "Categoria financeira", example: "Infraestrutura" },
  { key: "conta", label: "Conta bancária debitada", example: "Conta Principal" },
  { key: "saldo", label: "Saldo após o pagamento", example: "R$ 17.650,00" },
  { key: "liquidado_por", label: "Quem liquidou / pagou", example: "Tarcísio" },
];

const INCOME_REGISTERED_VARIABLES: TemplateVariable[] = [
  ...COMMON_VARIABLES,
  { key: "contato", label: "Como chamamos quem recebe", example: "Lucas" },
  { key: "cliente", label: "Nome do cliente ou pagador", example: "Acme Corp" },
  { key: "descricao", label: "Descrição da receita", example: "Desenvolvimento de App" },
  { key: "valor", label: "Valor previsto", example: "R$ 5.000,00" },
  { key: "vencimento", label: "Data de vencimento", example: "25/10/2026" },
  { key: "conta", label: "Conta bancária de destino", example: "Conta Principal" },
  { key: "registrado_por", label: "Quem registrou", example: "Tarcísio" },
];

const BILLING_CARD = `📄 {descricao}
💰 Valor: *{valor}*
📅 Vencimento: *{vencimento}*`;

export const TEMPLATE_META: Record<TemplateKind, TemplateMeta> = {
  billing_before: {
    kind: "billing_before",
    label: "Lembrete antes do vencimento",
    description: "Enviado alguns dias antes da parcela vencer.",
    audience: "client",
    supportsPix: true,
    variables: BILLING_VARIABLES,
    defaultBody: `{saudacao}, {nome}! Aqui é o *{assistente}*, assistente da *{empresa}* 🤖

Passando para avisar que a sua parcela vence *{prazo}*:

${BILLING_CARD}

{pix}

Depois de pagar, é só enviar o comprovante por aqui, por favor. 🙏`,
  },
  billing_due: {
    kind: "billing_due",
    label: "Cobrança no dia do vencimento",
    description: "Enviado na manhã em que a parcela vence.",
    audience: "client",
    supportsPix: true,
    variables: BILLING_VARIABLES,
    defaultBody: `{saudacao}, {nome}! Aqui é o *{assistente}* da *{empresa}* 🤖

Um lembrete rápido: a sua parcela vence *{prazo}*.

${BILLING_CARD}

{pix}

Assim que pagar, envie o comprovante por aqui, por favor. 🙏`,
  },
  billing_overdue: {
    kind: "billing_overdue",
    label: "Cobrança em atraso",
    description: "Enviado quando a parcela já venceu e continua em aberto.",
    audience: "client",
    supportsPix: true,
    variables: BILLING_VARIABLES,
    defaultBody: `{saudacao}, {nome}! Aqui é o *{assistente}* da *{empresa}* 🤖

Identificamos que a parcela abaixo continua em aberto ({atraso}):

${BILLING_CARD}

{pix}

Assim que pagar, envie o comprovante por aqui para darmos baixa. Se você já pagou, é só nos avisar! 🙏`,
  },
  payment_receipt: {
    kind: "payment_receipt",
    label: "Confirmação de pagamento",
    description: "Enviada ao cliente quando o pagamento é confirmado no caixa.",
    audience: "client",
    supportsPix: false,
    variables: RECEIPT_VARIABLES,
    defaultBody: `{saudacao}, {nome}! Aqui é o *{assistente}* da *{empresa}* 🤖

✅ Recebemos o seu pagamento!

📄 {descricao}
💰 Valor: *{valor}*
📅 Data: *{data_pagamento}*

Muito obrigado pela pontualidade e pela parceria! 🤝`,
  },
  withdrawal_alert: {
    kind: "withdrawal_alert",
    label: "Aviso de retirada de sócio",
    description: "Enviado aos sócios quando uma retirada é liquidada no caixa.",
    audience: "partner",
    supportsPix: false,
    variables: WITHDRAWAL_VARIABLES,
    defaultBody: `{saudacao}, {contato}! Aqui é o *{assistente}* 🤖

Uma retirada de sócio foi registrada no caixa:

👤 Sócio: *{socio}*
💰 Valor: *{valor}*
📝 Descrição: {descricao}
🏦 Conta: {conta}
💼 Saldo após a retirada: {saldo}
📅 Data: {data}
✍️ Registrado por: {registrado_por}`,
  },
  payment_alert: {
    kind: "payment_alert",
    label: "Aviso de pagamento recebido",
    description: "Enviado aos sócios quando um cliente paga uma parcela.",
    audience: "partner",
    supportsPix: false,
    variables: PAYMENT_ALERT_VARIABLES,
    defaultBody: `{saudacao}, {contato}! Aqui é o *{assistente}* 🤖

✅ O pagamento do cliente *{cliente}* foi confirmado!

📄 {descricao}
💰 Valor: *{valor}*
📅 Data: {data_pagamento}
🏦 Conta: {conta}`,
  },
  expense_registered: {
    kind: "expense_registered",
    label: "Aviso de despesa registrada",
    description: "Enviado aos sócios quando uma nova despesa é lançada no sistema.",
    audience: "partner",
    supportsPix: false,
    variables: EXPENSE_REGISTERED_VARIABLES,
    defaultBody: `{saudacao}, {contato}! Aqui é o *{assistente}* 🤖

📋 Uma nova despesa foi registrada no sistema:

📝 Descrição: *{descricao}*
💰 Valor: *{valor}*
📅 Vencimento: {vencimento}
🏷️ Categoria: {categoria}
🏦 Conta prevista: {conta}
✍️ Registrado por: {registrado_por}`,
  },
  expense_paid: {
    kind: "expense_paid",
    label: "Aviso de despesa paga / baixa efetuada",
    description: "Enviado aos sócios quando uma despesa é liquidada no caixa.",
    audience: "partner",
    supportsPix: false,
    variables: EXPENSE_PAID_VARIABLES,
    defaultBody: `{saudacao}, {contato}! Aqui é o *{assistente}* 🤖

💸 Pagamento de despesa registrado no caixa:

📝 Descrição: *{descricao}*
💰 Valor pago: *{valor}*
📅 Data: {data_pagamento}
🏷️ Categoria: {categoria}
🏦 Conta: {conta}
💼 Saldo após pagamento: {saldo}
✍️ Liquidado por: {liquidado_por}`,
  },
  income_registered: {
    kind: "income_registered",
    label: "Aviso de receita registrada",
    description: "Enviado aos sócios quando um novo recebível ou receita é registrado.",
    audience: "partner",
    supportsPix: false,
    variables: INCOME_REGISTERED_VARIABLES,
    defaultBody: `{saudacao}, {contato}! Aqui é o *{assistente}* 🤖

📈 Uma nova receita foi registrada a receber:

📝 Descrição: *{descricao}*
👤 Cliente/Origem: {cliente}
💰 Valor: *{valor}*
📅 Vencimento: {vencimento}
🏦 Conta prevista: {conta}
✍️ Registrado por: {registrado_por}`,
  },
};

export const TEMPLATE_KINDS = Object.keys(TEMPLATE_META) as TemplateKind[];

export function isTemplateKind(value: string): value is TemplateKind {
  return Object.prototype.hasOwnProperty.call(TEMPLATE_META, value);
}

export const MAX_TEMPLATE_LENGTH = 1800;

const PLACEHOLDER = /\{([a-z_]+)\}/g;

/** Variáveis usadas no texto que não existem para este tipo de mensagem. */
export function unknownVariables(kind: TemplateKind, body: string): string[] {
  const allowed = new Set(TEMPLATE_META[kind].variables.map((variable) => variable.key));
  const found = new Set<string>();
  for (const match of body.matchAll(PLACEHOLDER)) {
    if (!allowed.has(match[1])) found.add(match[1]);
  }
  return [...found];
}

/** Texto personalizado se existir e não estiver em branco, senão o padrão. */
export function resolveTemplate(kind: TemplateKind, custom?: Record<string, string> | null): string {
  const value = custom?.[kind];
  return typeof value === "string" && value.trim() ? value : TEMPLATE_META[kind].defaultBody;
}

/**
 * Substitui {variaveis}. Linhas cujas variáveis ficaram todas vazias somem
 * (ex.: "🏦 Conta: {conta}" sem conta), e espaços em branco extras são limpos.
 */
export function renderTemplate(body: string, vars: Record<string, string | undefined>): string {
  const lines = body.split(/\r?\n/).flatMap((line) => {
    const placeholders = [...line.matchAll(PLACEHOLDER)];
    if (!placeholders.length) return [line];
    const values = placeholders.map((match) => vars[match[1]] ?? "");
    if (values.every((value) => !value.trim())) return [];
    return [line.replace(PLACEHOLDER, (_whole, key: string) => vars[key] ?? "")];
  });
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function greeting(hour: number): string {
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function firstName(name: string | null | undefined): string {
  const first = (name ?? "").trim().split(/\s+/)[0];
  return first || "tudo bem";
}

/** "em 3 dias", "amanhã", "hoje", "ontem", "há 3 dias". */
export function deadlinePhrase(daysUntilDue: number): string {
  if (daysUntilDue === 0) return "hoje";
  if (daysUntilDue === 1) return "amanhã";
  if (daysUntilDue === -1) return "ontem";
  return daysUntilDue > 0 ? `em ${daysUntilDue} dias` : `há ${Math.abs(daysUntilDue)} dias`;
}

/** "1 dia de atraso", "3 dias de atraso" (vazio se não está atrasada). */
export function overduePhrase(daysUntilDue: number): string {
  if (daysUntilDue >= 0) return "";
  const days = Math.abs(daysUntilDue);
  return `${days} ${days === 1 ? "dia" : "dias"} de atraso`;
}

export interface PixTextOptions {
  mode: "native" | "text";
  /** Chave exatamente como cadastrada. */
  key: string;
  typeLabel: string;
}

/** Bloco {pix}: instrução curta que acompanha o botão ou o código Copia e Cola. */
export function pixInstructions(options: PixTextOptions): string {
  if (options.mode === "native") return "Para pagar, toque no botão de *Pix* logo abaixo. 👇";
  return [
    `🔑 *Chave Pix* (${options.typeLabel}): ${options.key}`,
    "O código *Pix Copia e Cola* vai na mensagem a seguir. 👇",
  ].join("\n");
}

export const OPT_OUT_FOOTER = "Já pagou? Pode ignorar este aviso. Para não receber mais lembretes, responda PARAR.";

/** Valores de exemplo (para prévia e mensagens de teste). */
export function sampleVariables(kind: TemplateKind, base: Record<string, string>): Record<string, string> {
  const vars: Record<string, string> = { ...base };
  for (const variable of TEMPLATE_META[kind].variables) {
    if (vars[variable.key] === undefined) vars[variable.key] = variable.example;
  }
  return vars;
}
