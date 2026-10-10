export type ConnectionStatus = "disconnected" | "connecting" | "qr" | "connected";

export interface WhatsAppStatus {
  status: ConnectionStatus;
  qr?: string | null;
  phone?: string | null;
  configured?: boolean;
  paired?: boolean;
  connectedAt?: string | null;
  lastError?: string | null;
}

export type PixKeyTypeSetting = "auto" | "cpf" | "cnpj" | "phone" | "email" | "random";
export type PixDeliveryMode = "text" | "native";

export interface WhatsAppSettings {
  autoBillingEnabled: boolean;
  daysBeforeDue: number;
  sendOnDueDate: boolean;
  daysAfterDue: number;
  dailySendHour: number;
  pixKey: string;
  pixKeyType: PixKeyTypeSetting;
  pixMerchantName: string;
  pixMerchantCity: string;
  pixDeliveryMode: PixDeliveryMode;
  withdrawalAlertsEnabled: boolean;
  expenseAlertsEnabled: boolean;
  movementAlertsEnabled: boolean;
  clientMessagePushEnabled: boolean;
  paymentAlertsEnabled: boolean;
  receiptEnabled: boolean;
  optOutHintEnabled: boolean;
  dailyMessageLimit: number;
  assistantName: string;
  companyName: string;
  /** Custom bodies by template kind; a missing key means the built-in default. */
  templates: Record<string, string>;
  pixKeyResolved?: { type: string; label: string; key: string } | null;
}

export const emptySettings: WhatsAppSettings = {
  autoBillingEnabled: false,
  daysBeforeDue: 3,
  sendOnDueDate: true,
  daysAfterDue: 3,
  dailySendHour: 10,
  pixKey: "",
  pixKeyType: "auto",
  pixMerchantName: "",
  pixMerchantCity: "",
  pixDeliveryMode: "text",
  withdrawalAlertsEnabled: false,
  expenseAlertsEnabled: true,
  movementAlertsEnabled: true,
  clientMessagePushEnabled: true,
  paymentAlertsEnabled: false,
  receiptEnabled: true,
  optOutHintEnabled: true,
  dailyMessageLimit: 100,
  assistantName: "Nexus",
  companyName: "Teltech",
  templates: {},
  pixKeyResolved: null,
};

export interface WhatsAppMessage {
  id?: string;
  kind?: string;
  status?: string;
  clientName?: string | null;
  recipient?: string;
  body?: string;
  attempts?: number;
  lastError?: string | null;
  createdAt?: string;
  sentAt?: string | null;
}

export interface WhatsAppContact {
  id: string;
  userId: string | null;
  name: string;
  nickname: string | null;
  roleLabel: string | null;
  phone: string;
  callName: string;
  active: boolean;
  notifyWithdrawals: boolean;
  notifyPayments: boolean;
  notifyExpenses: boolean;
  notifyMovements: boolean;
}

export interface WorkspaceMemberOption {
  id: string;
  name: string;
  phone: string | null;
  role: string;
}

export interface TemplateVariable {
  key: string;
  label: string;
  example: string;
}

export type TemplateKind =
  | "billing_before"
  | "billing_due"
  | "billing_overdue"
  | "payment_receipt"
  | "withdrawal_alert"
  | "payment_alert";

export interface TemplateInfo {
  kind: TemplateKind;
  label: string;
  description: string;
  audience: "client" | "partner";
  supportsPix: boolean;
  variables: TemplateVariable[];
  defaultBody: string;
}

export interface PreviewResult {
  text: string;
  fallbackText: string | null;
  footer: string | null;
  pix: {
    mode: PixDeliveryMode;
    key: string;
    keyType: string;
    code: string;
    merchantName: string;
    amountCents: number;
  } | null;
  unknownVariables: string[];
}

export interface TestResult {
  phone: string;
  mode: "plain" | "native" | "text_with_code";
  fallbackReason?: string;
  latencyMs: number;
  waMessageId: string | null;
  messageId: string;
}

export type TestKind = "connection" | TemplateKind;
