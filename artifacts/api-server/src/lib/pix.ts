/**
 * Utilitário para geração de Payload Pix (BR Code / Pix Copia e Cola)
 * Padrão Banco Central do Brasil (EMV QRCPS-MPM).
 */

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
  amountCents?: number;
  merchantName?: string;
  merchantCity?: string;
  txId?: string;
}

/**
 * Gera a string do Pix Copia e Cola padrão BACEN
 */
export function generatePixPayload(options: GeneratePixPayloadOptions): string {
  const key = options.pixKey.trim();
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
  payload += formatTLV("53", "986");  // Currency (986 = BRL)

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
