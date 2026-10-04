/**
 * Utilitário para geração de Payload Pix (BR Code / Pix Copia e Cola)
 * Padrão Banco Central do Brasil (EMV QRCPS-MPM).
 */

export type PixKeyType = "cpf" | "cnpj" | "phone" | "email" | "random";

/** Rótulos usados pelo WhatsApp (payment_settings.key_type). */
export const PIX_KEY_TYPE_WHATSAPP: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  phone: "PHONE",
  email: "EMAIL",
  random: "EVP",
};

export const PIX_KEY_TYPE_LABEL: Record<PixKeyType, string> = {
  cpf: "CPF",
  cnpj: "CNPJ",
  phone: "Celular",
  email: "E-mail",
  random: "Chave aleatória",
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function onlyDigits(value: string): string {
  return value.replace(/\D/g, "");
}

function isValidCpf(digits: string): boolean {
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (const length of [9, 10]) {
    let sum = 0;
    for (let i = 0; i < length; i++) sum += Number(digits[i]) * (length + 1 - i);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(digits[length])) return false;
  }
  return true;
}

/**
 * Descobre o tipo da chave. Com 11 dígitos CPF e celular se confundem; nesse
 * caso o dígito verificador do CPF decide (e o usuário pode forçar o tipo).
 */
export function detectPixKeyType(raw: string): PixKeyType | null {
  const key = raw.trim();
  if (!key) return null;
  if (key.includes("@")) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(key) ? "email" : null;
  if (UUID_RE.test(key)) return "random";
  if (key.startsWith("+")) return /^\+\d{10,15}$/.test(`+${onlyDigits(key)}`) ? "phone" : null;
  if (!/^[\d\s().\-/]+$/.test(key)) return null;
  const digits = onlyDigits(key);
  if (digits.length === 14) return "cnpj";
  if (digits.length === 11) return isValidCpf(digits) ? "cpf" : "phone";
  if (digits.length === 10) return "phone";
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith("55")) return "phone";
  return null;
}

/** Converte a chave digitada para o formato aceito no BR Code. */
export function normalizePixKey(raw: string, type: PixKeyType | "auto" = "auto"): { key: string; type: PixKeyType } | null {
  const trimmed = raw.trim();
  const resolved = type === "auto" ? detectPixKeyType(trimmed) : type;
  if (!resolved) return null;
  switch (resolved) {
    case "email":
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed) ? { key: trimmed.toLowerCase(), type: resolved } : null;
    case "random":
      return UUID_RE.test(trimmed) ? { key: trimmed.toLowerCase(), type: resolved } : null;
    case "cpf": {
      const digits = onlyDigits(trimmed);
      return digits.length === 11 ? { key: digits, type: resolved } : null;
    }
    case "cnpj": {
      const digits = onlyDigits(trimmed);
      return digits.length === 14 ? { key: digits, type: resolved } : null;
    }
    case "phone": {
      let digits = onlyDigits(trimmed);
      if (!trimmed.startsWith("+") && (digits.length === 10 || digits.length === 11)) digits = `55${digits}`;
      return digits.length >= 12 && digits.length <= 15 ? { key: `+${digits}`, type: resolved } : null;
    }
  }
}

function formatTLV(id: string, value: string): string {
  const len = value.length.toString().padStart(2, "0");
  return `${id}${len}${value}`;
}

function normalizeText(text: string, maxLen: number): string {
  return text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9 ]/g, "")
    .trim()
    .slice(0, maxLen)
    .toUpperCase();
}

/**
 * Calcula o CRC16-CCITT (polinômio 0x1021, valor inicial 0xFFFF)
 */
function crc16(str: string): string {
  let crc = 0xffff;
  const polynomial = 0x1021;

  for (let i = 0; i < str.length; i++) {
    crc ^= str.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) {
      if ((crc & 0x8000) !== 0) {
        crc = ((crc << 1) ^ polynomial) & 0xffff;
      } else {
        crc = (crc << 1) & 0xffff;
      }
    }
  }

  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export interface GeneratePixPayloadOptions {
  pixKey: string;
  /** Força o tipo da chave; "auto" detecta a partir do valor. */
  pixKeyType?: PixKeyType | "auto";
  amountCents?: number;
  merchantName?: string;
  merchantCity?: string;
  txId?: string;
}

/**
 * Gera a string do Pix Copia e Cola padrão BACEN
 */
export function generatePixPayload(options: GeneratePixPayloadOptions): string {
  const normalized = normalizePixKey(options.pixKey, options.pixKeyType ?? "auto");
  // Chaves não reconhecidas continuam sendo usadas como digitadas, preservando o comportamento anterior.
  const key = normalized?.key ?? options.pixKey.trim();
  if (!key) return "";

  const merchantName = normalizeText(options.merchantName || "TELTECH", 25) || "TELTECH";
  const merchantCity = normalizeText(options.merchantCity || "SAO PAULO", 15) || "SAO PAULO";

  // Limpa txId para caracteres alfanuméricos válidos
  let txId = (options.txId || "***").replace(/[^a-zA-Z0-9]/g, "").slice(0, 25);
  if (!txId) txId = "***";

  // Subtags do Campo 26 (Merchant Account Information)
  const mai00 = formatTLV("00", "BR.GOV.BCB.PIX");
  const mai01 = formatTLV("01", key);
  const tag26 = formatTLV("26", `${mai00}${mai01}`);

  // Subtags do Campo 62 (Additional Data Field)
  const adf05 = formatTLV("05", txId);
  const tag62 = formatTLV("62", adf05);

  let payload = "";
  payload += formatTLV("00", "01"); // Payload Format Indicator
  payload += tag26;
  payload += formatTLV("52", "0000"); // Merchant Category Code
  payload += formatTLV("53", "986"); // Currency (986 = BRL)

  if (options.amountCents && options.amountCents > 0) {
    const amountStr = (options.amountCents / 100).toFixed(2);
    payload += formatTLV("54", amountStr);
  }

  payload += formatTLV("58", "BR"); // Country Code
  payload += formatTLV("59", merchantName);
  payload += formatTLV("60", merchantCity);
  payload += tag62;

  // Tag 63: CRC16 (prefixo de 4 caracteres de tamanho fixo para o CRC)
  const payloadWithCrcPrefix = `${payload}6304`;
  const checksum = crc16(payloadWithCrcPrefix);

  return `${payloadWithCrcPrefix}${checksum}`;
}
