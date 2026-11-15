import type { DemoLead, WhatsappSettings } from "@workspace/db";
import { saoPauloNow } from "./whatsapp-compose";
import { firstName, greeting, renderTemplate } from "./whatsapp-templates";

export interface DefaultCadenceStepSeed {
  stepKind: "sequence" | "reaccess";
  stepOrder: number;
  title: string;
  delayMinutes: number;
  respectBusinessHours: boolean;
  businessStartHour: number;
  businessEndHour: number;
  bodyTemplate: string;
  enabled: boolean;
}

export function normalizeLeadPhone(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const beforeAt = raw.split("@")[0].split(":")[0];
  const trimmed = beforeAt.trim();
  if (!/^\+?[\d\s().-]+$/.test(trimmed)) return null;
  let digits = trimmed.replace(/\D/g, "");
  if (!trimmed.startsWith("+") && (digits.length === 10 || digits.length === 11)) {
    digits = `55${digits}`;
  }
  if (digits.length < 10 || digits.length > 15 || digits.startsWith("0")) return null;
  return digits;
}

export function canonicalLeadPhone(raw: string | null | undefined): string | null {
  const normalized = normalizeLeadPhone(raw);
  if (!normalized) return null;
  if (normalized.startsWith("55") && normalized.length === 12) {
    const ddd = normalized.slice(2, 4);
    const local = normalized.slice(4);
    if (/^[6-9]/.test(local)) {
      return `55${ddd}9${local}`;
    }
  }
  return normalized;
}

export function leadPhonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const canA = canonicalLeadPhone(a);
  const canB = canonicalLeadPhone(b);
  if (canA && canB && canA === canB) return true;
  const normA = normalizeLeadPhone(a);
  const normB = normalizeLeadPhone(b);
  if (normA && normB && normA === normB) return true;
  const digA = a.replace(/\D/g, "");
  const digB = b.replace(/\D/g, "");
  return Boolean(
    digA &&
      digB &&
      digA.length >= 10 &&
      digB.length >= 10 &&
      (digA === digB || digA.endsWith(digB) || digB.endsWith(digA)),
  );
}

export function buildDefaultCadenceSeeds(source: string, productLabel = "PDV Lojista"): DefaultCadenceStepSeed[] {
  const isPdv = /pdv|lojista/i.test(source) || /pdv|lojista/i.test(productLabel);

  if (isPdv) {
    return [
      {
        stepKind: "sequence",
        stepOrder: 1,
        title: "1. Boas-vindas Quente (Acesso à Demo)",
        delayMinutes: 2,
        respectBusinessHours: false,
        businessStartHour: 8,
        businessEndHour: 20,
        enabled: true,
        bodyTemplate: `{saudacao}, {nome}! Tudo bem? Vi que você acabou de abrir a demonstração gratuita do *{produto}* aqui na *{empresa}*.\n\nFique à vontade pra simular vendas no caixa, testar grade de tamanho/cor e olhar o financeiro. Qualquer dúvida enquanto testa, pode me chamar por aqui mesmo!`,
      },
      {
        stepKind: "sequence",
        stepOrder: 2,
        title: "2. Cutucada de Feedback Rápido",
        delayMinutes: 120,
        respectBusinessHours: true,
        businessStartHour: 8,
        businessEndHour: 20,
        enabled: true,
        bodyTemplate: `E aí, {nome}! Deu tempo de simular uma venda lá na demonstração do *{produto}*?\n\nMe conta sem filtro: o que você achou da velocidade da frente de caixa até agora? E faz sentido pra rotina da sua loja hoje?`,
      },
      {
        stepKind: "sequence",
        stepOrder: 3,
        title: "3. Provocação: Furo de Estoque & Grade",
        delayMinutes: 1320,
        respectBusinessHours: true,
        businessStartHour: 9,
        businessEndHour: 20,
        enabled: true,
        bodyTemplate: `{nome}, vou te falar uma realidade que vejo toda semana em loja:\n\nO cliente pede um tamanho M ou uma cor específica, no olho parece que tem, mas na hora de pegar já saiu — ou pior, some mercadoria e ninguém sabe onde foi parar.\n\nNo *{produto}*, cada tamanho e cor tem estoque próprio travado no caixa. Hoje você já controla isso certinho ou ainda sofre com furo de estoque?`,
      },
      {
        stepKind: "sequence",
        stepOrder: 4,
        title: "4. Provocação: Controle de Clientes & Crediário",
        delayMinutes: 1440,
        respectBusinessHours: true,
        businessStartHour: 9,
        businessEndHour: 20,
        enabled: true,
        bodyTemplate: `Sabe onde mais fica dinheiro parado na mesa de quem tem loja, {nome}?\n\nCliente sem histórico e crediário/fiado anotado no caderno ou planilha. Quem não controla cliente não sabe quem sumiu há 60 dias e perde dinheiro com atraso.\n\nNo *{produto}* você tem histórico completo de cada cliente, limite de crediário e *cobrança automática no WhatsApp* sem você passar constrangimento. Já pensou tirar esse peso das costas?`,
      },
      {
        stepKind: "sequence",
        stepOrder: 5,
        title: "5. Ecossistema Completo (Loja Virtual 24h + Fiscal)",
        delayMinutes: 2880,
        respectBusinessHours: true,
        businessStartHour: 9,
        businessEndHour: 20,
        enabled: true,
        bodyTemplate: `{nome}, olha tudo o que o *{produto}* coloca na sua mão num painel só:\n\n✅ Frente de Caixa rápida + troca de operador por PIN\n✅ Grade inteligente (Tamanho & Cor) + Etiquetas\n✅ *Loja Virtual integrada no mesmo estoque* (vendeu no link, baixou na loja na hora!)\n✅ Emissão de NFC-e descomplicada\n✅ Hub de Fornecedores de Atacado SP\n\nEnquanto o concorrente fecha a porta às 18h, sua vitrine online continua vendendo. Quer ver como fica com a logo da sua loja?`,
      },
      {
        stepKind: "sequence",
        stepOrder: 6,
        title: "6. Conta Fechada (ROI Irrecusável)",
        delayMinutes: 2880,
        respectBusinessHours: true,
        businessStartHour: 9,
        businessEndHour: 20,
        enabled: true,
        bodyTemplate: `Para pra fazer uma conta rápida comigo, {nome}:\n\n*Uma única peça* que deixa de sumir no estoque ou *um único cliente* que o sistema recupera no mês já paga a mensalidade inteira do *{produto}* e ainda sobra lucro limpo no seu caixa.\n\nContinuar no improviso custa muito mais caro do que ter controle profissional. Bora colocar sua loja pra rodar essa semana?`,
      },
      {
        stepKind: "sequence",
        stepOrder: 7,
        title: "7. Última Chamada (1, 2 ou 3)",
        delayMinutes: 4320,
        respectBusinessHours: true,
        businessStartHour: 9,
        businessEndHour: 20,
        enabled: true,
        bodyTemplate: `Fala, {nome}! Pra eu não ficar enchendo seu WhatsApp à toa, me responde só com um número pra eu saber em que pé você está sobre o *{produto}*:\n\n*1* — Quero implantar na minha loja agora\n*2* — Gostei, mas quero deixar pro próximo mês\n*3* — Não tenho interesse no momento`,
      },
      {
        stepKind: "reaccess",
        stepOrder: 99,
        title: "Gatilho Extra: Voltou na Demonstração",
        delayMinutes: 2,
        respectBusinessHours: false,
        businessStartHour: 8,
        businessEndHour: 21,
        enabled: true,
        bodyTemplate: `Opa, {nome}! Vi que você entrou de novo agora na demonstração do *{produto}* 👀\n\nFicou alguma dúvida específica em alguma tela? Se quiser, já libero o ambiente oficial com o nome da sua loja pra você testar na prática!`,
      },
    ];
  }

  return [
    {
      stepKind: "sequence",
      stepOrder: 1,
      title: "1. Boas-vindas na Demonstração",
      delayMinutes: 2,
      respectBusinessHours: false,
      businessStartHour: 8,
      businessEndHour: 20,
      enabled: true,
      bodyTemplate: `{saudacao}, {nome}! Vi que você acabou de acessar a demonstração gratuita do *{produto}* aqui na *{empresa}*. Qualquer dúvida enquanto explora o sistema, pode me chamar por aqui!`,
    },
    {
      stepKind: "sequence",
      stepOrder: 2,
      title: "2. Pedido de Feedback & Interesse",
      delayMinutes: 180,
      respectBusinessHours: true,
      businessStartHour: 9,
      businessEndHour: 20,
      enabled: true,
      bodyTemplate: `E aí, {nome}! O que achou da experiência no *{produto}* até agora? Atende o que você está buscando hoje?`,
    },
    {
      stepKind: "sequence",
      stepOrder: 3,
      title: "3. Provocação: Controle de Clientes & Gestão",
      delayMinutes: 1440,
      respectBusinessHours: true,
      businessStartHour: 9,
      businessEndHour: 20,
      enabled: true,
      bodyTemplate: `{nome}, quem deixa o controle de clientes e do financeiro no improviso acaba perdendo vendas todos os meses sem perceber. Com o *{produto}* você centraliza tudo em segundos. Bora ativar sua conta oficial?`,
    },
    {
      stepKind: "sequence",
      stepOrder: 4,
      title: "4. Última Chamada (1, 2 ou 3)",
      delayMinutes: 2880,
      respectBusinessHours: true,
      businessStartHour: 9,
      businessEndHour: 20,
      enabled: true,
      bodyTemplate: `Fala, {nome}! Me responde só com um número sobre o *{produto}*:\n\n*1* — Quero contratar agora\n*2* — Quero deixar pro próximo mês\n*3* — Não é o momento`,
    },
    {
      stepKind: "reaccess",
      stepOrder: 99,
      title: "Gatilho Extra: Voltou na Demonstração",
      delayMinutes: 2,
      respectBusinessHours: false,
      businessStartHour: 8,
      businessEndHour: 21,
      enabled: true,
      bodyTemplate: `Opa, {nome}! Vi que você voltou a testar a demonstração do *{produto}* agora. Quer que eu te ajude a configurar o seu ambiente oficial?`,
    },
  ];
}

const spPartsFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "America/Sao_Paulo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function getSaoPauloParts(d: Date) {
  const map = Object.fromEntries(spPartsFormatter.formatToParts(d).map((p) => [p.type, p.value]));
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour),
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

function fromSaoPauloWallClock(year: number, month: number, day: number, hour: number, minute: number, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour + 3, minute, second));
}

export function computeScheduledSendTime(
  baseDate: Date,
  delayMinutes: number,
  respectBusinessHours: boolean,
  businessStartHour = 9,
  businessEndHour = 20,
  deterministicJitterSec?: number,
): Date {
  const safeDelay = Math.max(0, delayMinutes);
  const candidate = new Date(baseDate.getTime() + safeDelay * 60_000);
  const startH = Math.min(22, Math.max(0, businessStartHour));
  const endH = Math.min(23, Math.max(startH + 1, businessEndHour));

  if (!respectBusinessHours) {
    const jitter = deterministicJitterSec ?? (5 + Math.floor(Math.random() * 15));
    return new Date(candidate.getTime() + jitter * 1000);
  }

  const sp = getSaoPauloParts(candidate);
  const jitter = deterministicJitterSec ?? (15 + Math.floor(Math.random() * 150));

  if (sp.hour < startH) {
    const aligned = fromSaoPauloWallClock(sp.year, sp.month, sp.day, startH, 5, 0);
    return new Date(aligned.getTime() + jitter * 1000);
  }

  if (sp.hour >= endH) {
    const nextDay = fromSaoPauloWallClock(sp.year, sp.month, sp.day + 1, startH, 5, 0);
    return new Date(nextDay.getTime() + jitter * 1000);
  }

  return new Date(candidate.getTime() + jitter * 1000);
}

export function renderLeadCadenceBody(
  bodyTemplate: string,
  lead: Pick<DemoLead, "name" | "sourceLabel" | "accessCount">,
  settings?: Pick<WhatsappSettings, "assistantName" | "companyName"> | null,
  now = new Date(),
): string {
  const { hour } = saoPauloNow(now);
  return renderTemplate(bodyTemplate, {
    saudacao: greeting(hour),
    nome: firstName(lead.name),
    cliente: lead.name,
    produto: lead.sourceLabel || "PDV Lojista",
    empresa: settings?.companyName || "Teltech",
    assistente: settings?.assistantName || "Nexus",
    acessos: String(lead.accessCount || 1),
  });
}
