import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  MessageSquare,
  Bot,
  Send,
  Search,
  Check,
  CheckCheck,
  Clock,
  AlertTriangle,
  Calendar,
  DollarSign,
  Copy,
  ExternalLink,
  RefreshCw,
  User,
  Phone,
  Shield,
  Filter,
  ArrowLeft,
  Sparkles,
  Zap,
  TrendingUp,
  AlertCircle,
  HelpCircle,
  FileText,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";

interface ConversationItem {
  id: string;
  clientId: string | null;
  clientName: string;
  phone: string;
  document: string | null;
  optIn: boolean;
  lastMessage: {
    id: string;
    body: string;
    sentAt: string;
    direction: "outbound" | "inbound";
    kind: string;
    status: string;
    senderName?: string | null;
  } | null;
  totalMessages: number;
  inboundCount: number;
  outboundCount: number;
  unreadCount: number;
  hasReplied: boolean;
  financialInfo: {
    pendingCount: number;
    overdueCount: number;
    totalPendingCents: number;
    totalOverdueCents: number;
    nextDueDate: string | null;
    status: "overdue" | "pending" | "paid_up";
  };
}

interface ChatMessage {
  id: string;
  kind: string;
  recipient: string;
  senderPhone?: string | null;
  senderName?: string | null;
  direction: "outbound" | "inbound";
  body: string;
  status: string;
  isRead: boolean;
  sentAt?: string | null;
  createdAt: string;
  waMessageId?: string | null;
  transaction?: {
    id: string;
    amount: number;
    dueDate: string;
    description: string;
    status: string;
  } | null;
}

interface MonitoringStats {
  status: {
    status: "connecting" | "qr" | "connected" | "disconnected";
    connected: boolean;
    configured: boolean;
    paired: boolean;
    phone: string | null;
  };
  totalConversations: number;
  totalSent: number;
  totalReceived: number;
  responseRate: number;
  overdueCount: number;
  totalOverdueCents: number;
  totalPendingCents: number;
}

function formatCents(cents: number): string {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    const d = new Date(iso);
    const now = new Date();
    const isToday = d.toDateString() === now.toDateString();
    const isYesterday = new Date(now.setDate(now.getDate() - 1)).toDateString() === d.toDateString();

    const timeStr = d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
    if (isToday) return timeStr;
    if (isYesterday) return `Ontem, ${timeStr}`;
    return `${d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })} ${timeStr}`;
  } catch {
    return "";
  }
}

function formatPhoneDisplay(raw: string): string {
  if (!raw) return "";
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 13 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`;
  }
  if (digits.length === 12 && digits.startsWith("55")) {
    return `+55 (${digits.slice(2, 4)}) ${digits.slice(4, 8)}-${digits.slice(8)}`;
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  return raw;
}

function kindBadge(kind: string): { label: string; color: string } {
  switch (kind) {
    case "before_due":
      return { label: "Cobrança Preventiva", color: "#3B82F6" };
    case "due_date":
      return { label: "Vence Hoje", color: "#F59E0B" };
    case "after_due":
      return { label: "Aviso de Atraso", color: "#EF4444" };
    case "receipt":
      return { label: "Comprovante", color: "#10B981" };
    case "client_reply":
      return { label: "Resposta do Cliente", color: "#10B981" };
    case "manual_chat":
      return { label: "Chat Direto", color: "#7C5AC2" };
    default:
      return { label: "Notificação", color: "#8B5CF6" };
  }
}

export function MonitoramentoPage() {
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openTransactions, setOpenTransactions] = useState<any[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "replied" | "waiting" | "overdue">("all");
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isTriggeringBilling, setIsTriggeringBilling] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isPollingRef = useRef(false);

  // Carregar dados de estatísticas
  const fetchStats = useCallback(async () => {
    try {
      const data = await API.get<MonitoringStats>("/whatsapp/monitoring/stats");
      setStats(data);
    } catch (err) {
      console.error("Falha ao carregar estatísticas do WhatsApp", err);
    }
  }, []);

  // Carregar conversas
  const fetchConversations = useCallback(async (isInitial = false) => {
    if (isInitial) setIsLoadingConversations(true);
    try {
      const params = new URLSearchParams();
      if (search) params.set("search", search);
      if (filter !== "all") params.set("filter", filter);

      const res = await API.get<{ conversations: ConversationItem[] }>(
        `/whatsapp/monitoring/conversations?${params.toString()}`
      );
      setConversations(res?.conversations ?? []);
    } catch (err) {
      console.error("Falha ao carregar conversas de monitoramento", err);
    } finally {
      if (isInitial) setIsLoadingConversations(false);
    }
  }, [search, filter]);

  // Carregar mensagens da conversa ativa
  const fetchMessages = useCallback(async (target: string, isSilent = false) => {
    if (!isSilent) setIsLoadingMessages(true);
    try {
      const res = await API.get<{
        messages: ChatMessage[];
        client: any;
        openTransactions: any[];
      }>(`/whatsapp/monitoring/conversations/${target}/messages`);

      setMessages(res?.messages ?? []);
      setSelectedClient(res?.client ?? null);
      setOpenTransactions(res?.openTransactions ?? []);
    } catch (err) {
      console.error("Falha ao carregar mensagens da conversa", err);
    } finally {
      if (!isSilent) setIsLoadingMessages(false);
    }
  }, []);

  // Inicialização e Polling em background a cada 6s
  useEffect(() => {
    fetchStats();
    fetchConversations(true);

    const interval = setInterval(() => {
      if (isPollingRef.current) return;
      isPollingRef.current = true;
      Promise.all([
        fetchStats(),
        fetchConversations(false),
        selectedTarget ? fetchMessages(selectedTarget, true) : Promise.resolve(),
      ]).finally(() => {
        isPollingRef.current = false;
      });
    }, 6000);

    return () => clearInterval(interval);
  }, [fetchStats, fetchConversations, selectedTarget, fetchMessages]);

  // Selecionar primeira conversa se nenhuma estiver ativa
  useEffect(() => {
    if (!selectedTarget && conversations.length > 0) {
      const firstWithMessages = conversations.find((c) => c.totalMessages > 0) || conversations[0];
      if (firstWithMessages) {
        setSelectedTarget(firstWithMessages.id);
      }
    }
  }, [conversations, selectedTarget]);

  // Quando o target muda, busca mensagens
  useEffect(() => {
    if (selectedTarget) {
      fetchMessages(selectedTarget);
    } else {
      setMessages([]);
      setSelectedClient(null);
      setOpenTransactions([]);
    }
  }, [selectedTarget, fetchMessages]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Enviar mensagem manual
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? messageInput).trim();
    if (!text || !selectedTarget || isSending) return;

    setIsSending(true);
    try {
      const res = await API.post(`/whatsapp/monitoring/conversations/${selectedTarget}/messages`, {
        text,
        transactionId: openTransactions[0]?.id ?? null,
      });

      if (res?.message) {
        setMessageInput("");
        toast.success("Mensagem enviada via WhatsApp!");
        await fetchMessages(selectedTarget, true);
        await fetchConversations(false);
        await fetchStats();
      }
    } catch (err: any) {
      toast.error(err.message || "Não foi possível enviar a mensagem.");
    } finally {
      setIsSending(false);
    }
  };

  // Disparo imediato de cobrança pelo Nexus
  const handleTriggerBilling = async (transactionId: string) => {
    if (!selectedTarget || isTriggeringBilling) return;
    setIsTriggeringBilling(true);
    try {
      const res = await API.post(`/whatsapp/monitoring/conversations/${selectedTarget}/send-pix`, {
        transactionId,
      });
      if (res?.ok) {
        toast.success("Cobrança e Pix disparados por Nexus!");
        await fetchMessages(selectedTarget, true);
        await fetchConversations(false);
        await fetchStats();
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao disparar cobrança");
    } finally {
      setIsTriggeringBilling(false);
    }
  };

  // Conversa ativa selecionada
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedTarget) || null;
  }, [conversations, selectedTarget]);

  // Copiar código Pix
  const handleCopyPix = (pixCode: string) => {
    navigator.clipboard.writeText(pixCode);
    toast.success("Código Pix copiado para a área de transferência!");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#111113", color: "#fafafa" }}>
      {/* ─── Top Stats & Status Bar ─── */}
      <div
        style={{
          padding: "16px 24px",
          background: "linear-gradient(180deg, #18181c 0%, #121215 100%)",
          borderBottom: "1px solid #27272e",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              background: "linear-gradient(135deg, hsl(265 85% 62% / 0.3), hsl(152 65% 45% / 0.2))",
              border: "1px solid hsl(265 85% 62% / 0.4)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c4a3ff",
              boxShadow: "0 0 20px hsl(265 85% 62% / 0.25)",
            }}
          >
            <Bot size={24} />
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 style={{ fontSize: 18, fontWeight: 700, margin: 0, letterSpacing: "-0.02em", color: "#fff" }}>
                Monitoramento Nexus • Chat de Cobranças
              </h1>
              {stats?.status.connected ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 9px",
                    borderRadius: 20,
                    background: "hsl(152 65% 45% / 0.15)",
                    border: "1px solid hsl(152 65% 45% / 0.4)",
                    color: "hsl(152 65% 55%)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "hsl(152 65% 50%)", boxShadow: "0 0 8px hsl(152 65% 50%)" }} />
                  Online {stats.status.phone ? `(${stats.status.phone})` : ""}
                </div>
              ) : (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 9px",
                    borderRadius: 20,
                    background: "hsl(0 70% 58% / 0.15)",
                    border: "1px solid hsl(0 70% 58% / 0.4)",
                    color: "hsl(0 70% 68%)",
                    fontSize: 11,
                    fontWeight: 600,
                  }}
                >
                  <span style={{ width: 7, height: 7, borderRadius: "50%", background: "hsl(0 70% 58%)" }} />
                  WhatsApp Desconectado
                </div>
              )}
            </div>
            <p style={{ fontSize: 12, color: "#8a8a93", margin: "2px 0 0 0" }}>
              Visualização unificada de todas as cobranças disparadas por Nexus e respostas em tempo real dos clientes.
            </p>
          </div>
        </div>

        {/* Mini KPI Cards */}
        <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
          <div
            style={{
              padding: "8px 14px",
              background: "#1c1c22",
              border: "1px solid #2b2b36",
              borderRadius: 10,
              minWidth: 120,
            }}
          >
            <div style={{ fontSize: 10, color: "#8a8a93", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Clientes Contatados
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f4", marginTop: 2 }}>
              {stats?.totalConversations ?? 0}
            </div>
          </div>

          <div
            style={{
              padding: "8px 14px",
              background: "#1c1c22",
              border: "1px solid #2b2b36",
              borderRadius: 10,
              minWidth: 120,
            }}
          >
            <div style={{ fontSize: 10, color: "#8a8a93", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Nexus Disparou
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#c4a3ff", marginTop: 2 }}>
              {stats?.totalSent ?? 0} msgs
            </div>
          </div>

          <div
            style={{
              padding: "8px 14px",
              background: "#1c1c22",
              border: "1px solid #2b2b36",
              borderRadius: 10,
              minWidth: 130,
            }}
          >
            <div style={{ fontSize: 10, color: "#8a8a93", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Clientes Responderam
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: "hsl(152 65% 55%)", marginTop: 2, display: "flex", alignItems: "baseline", gap: 6 }}>
              <span>{stats?.totalReceived ?? 0}</span>
              <span style={{ fontSize: 11, color: "#8a8a93", fontWeight: 500 }}>({stats?.responseRate ?? 0}%)</span>
            </div>
          </div>

          <div
            style={{
              padding: "8px 14px",
              background: "#1c1c22",
              border: "1px solid #2b2b36",
              borderRadius: 10,
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 10, color: "#8a8a93", textTransform: "uppercase", fontWeight: 700, letterSpacing: "0.05em" }}>
              Inadimplência Monitorada
            </div>
            <div style={{ fontSize: 16, fontWeight: 700, color: (stats?.totalOverdueCents ?? 0) > 0 ? "hsl(0 70% 65%)" : "hsl(152 65% 55%)", marginTop: 2 }}>
              {formatCents(stats?.totalOverdueCents ?? 0)}
            </div>
          </div>
        </div>
      </div>

      {/* ─── Main Two-Column Layout ─── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden" }}>
        {/* ─── Left Pane: Conversations List ─── */}
        <div
          style={{
            width: 380,
            minWidth: 320,
            maxWidth: 420,
            borderRight: "1px solid #27272e",
            background: "#151518",
            display: "flex",
            flexDirection: "column",
            height: "100%",
          }}
        >
          {/* Search & Filter Bar */}
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #222228", display: "flex", flexDirection: "column", gap: 10 }}>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                background: "#1e1e24",
                border: "1px solid #2f2f3a",
                borderRadius: 8,
                padding: "8px 12px",
              }}
            >
              <Search size={16} color="#777" />
              <input
                type="text"
                placeholder="Buscar cliente, telefone ou texto..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{
                  background: "transparent",
                  border: "none",
                  outline: "none",
                  color: "#eee",
                  fontSize: 13,
                  width: "100%",
                }}
              />
              {search && (
                <button
                  onClick={() => setSearch("")}
                  style={{ background: "transparent", border: "none", color: "#777", cursor: "pointer", fontSize: 12 }}
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter pills */}
            <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
              {[
                { id: "all", label: "Todos" },
                { id: "replied", label: "💬 Responderam" },
                { id: "waiting", label: "⏳ Aguardando" },
                { id: "overdue", label: "⚠️ Em Atraso" },
              ].map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    style={{
                      padding: "4px 10px",
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: active ? 600 : 400,
                      background: active ? "hsl(265 85% 62% / 0.25)" : "#202028",
                      color: active ? "#c4a3ff" : "#888",
                      border: active ? "1px solid hsl(265 85% 62% / 0.5)" : "1px solid #2c2c36",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Conversations List Scroll Area */}
          <div style={{ flex: 1, overflowY: "auto" }}>
            {isLoadingConversations ? (
              <div style={{ padding: 32, textAlign: "center", color: "#666", fontSize: 13 }}>
                <RefreshCw size={20} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                Carregando conversas...
              </div>
            ) : conversations.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#777" }}>
                <MessageSquare size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "#aaa", margin: "0 0 4px" }}>Nenhuma conversa encontrada</p>
                <p style={{ fontSize: 12, margin: 0, color: "#666" }}>
                  {search ? "Tente outro termo de busca." : "Nenhum cliente conversou com Nexus ainda."}
                </p>
              </div>
            ) : (
              conversations.map((item) => {
                const isSelected = selectedTarget === item.id;
                const hasOverdue = item.financialInfo.overdueCount > 0;

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedTarget(item.id)}
                    style={{
                      padding: "12px 16px",
                      borderBottom: "1px solid #1f1f26",
                      cursor: "pointer",
                      background: isSelected ? "linear-gradient(90deg, hsl(265 85% 62% / 0.15) 0%, transparent 100%)" : "transparent",
                      borderLeft: isSelected ? "3px solid hsl(265 85% 62%)" : "3px solid transparent",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "#1a1a20";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                      {/* Avatar */}
                      <div
                        style={{
                          width: 40,
                          height: 40,
                          borderRadius: "50%",
                          background: isSelected ? "hsl(265 85% 62% / 0.3)" : "#252530",
                          border: isSelected ? "1px solid hsl(265 85% 62% / 0.6)" : "1px solid #333342",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: isSelected ? "#d4b8ff" : "#aaa",
                          fontWeight: 700,
                          fontSize: 14,
                          flexShrink: 0,
                          position: "relative",
                        }}
                      >
                        {item.clientName.slice(0, 2).toUpperCase()}
                        {item.hasReplied && (
                          <span
                            title="Cliente respondeu"
                            style={{
                              position: "absolute",
                              bottom: -1,
                              right: -1,
                              width: 10,
                              height: 10,
                              borderRadius: "50%",
                              background: "hsl(152 65% 50%)",
                              border: "2px solid #151518",
                            }}
                          />
                        )}
                      </div>

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight: isSelected ? 700 : 600,
                              color: isSelected ? "#fff" : "#eee",
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: 180,
                            }}
                          >
                            {item.clientName}
                          </span>
                          <span style={{ fontSize: 10, color: "#777", flexShrink: 0 }}>
                            {formatTime(item.lastMessage?.sentAt)}
                          </span>
                        </div>

                        {/* Phone & Status Badges */}
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 5, flexWrap: "wrap" }}>
                          <span style={{ fontSize: 11, color: "#888" }}>
                            {formatPhoneDisplay(item.phone)}
                          </span>

                          {hasOverdue && (
                            <span
                              style={{
                                fontSize: 9,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "hsl(0 70% 58% / 0.15)",
                                color: "hsl(0 70% 68%)",
                                fontWeight: 700,
                              }}
                            >
                              Vencido: {formatCents(item.financialInfo.totalOverdueCents)}
                            </span>
                          )}

                          {item.hasReplied && (
                            <span
                              style={{
                                fontSize: 9,
                                padding: "1px 6px",
                                borderRadius: 4,
                                background: "hsl(152 65% 45% / 0.15)",
                                color: "hsl(152 65% 55%)",
                                fontWeight: 600,
                              }}
                            >
                              Respondeu
                            </span>
                          )}
                        </div>

                        {/* Last message snippet */}
                        <div
                          style={{
                            fontSize: 11,
                            color: item.unreadCount > 0 ? "#fff" : "#888",
                            fontWeight: item.unreadCount > 0 ? 600 : 400,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {item.lastMessage ? (
                            <>
                              {item.lastMessage.direction === "outbound" ? (
                                <span style={{ color: "#a78bfa", flexShrink: 0 }}>🤖 Nexus:</span>
                              ) : (
                                <span style={{ color: "hsl(152 65% 55%)", flexShrink: 0 }}>💬 Cliente:</span>
                              )}
                              <span>{item.lastMessage.body}</span>
                            </>
                          ) : (
                            <span style={{ color: "#555", fontStyle: "italic" }}>Nenhuma mensagem trocada ainda</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* ─── Right Pane: WhatsApp Chat Window ─── */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", background: "#0d0d0f" }}>
          {!selectedTarget ? (
            <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, color: "#666" }}>
              <div
                style={{
                  width: 72,
                  height: 72,
                  borderRadius: 20,
                  background: "linear-gradient(135deg, hsl(265 85% 62% / 0.2), hsl(152 65% 45% / 0.15))",
                  border: "1px solid hsl(265 85% 62% / 0.3)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#a78bfa",
                  marginBottom: 18,
                }}
              >
                <Bot size={36} />
              </div>
              <h2 style={{ fontSize: 18, fontWeight: 700, color: "#ddd", margin: "0 0 6px" }}>Módulo de Monitoramento Nexus</h2>
              <p style={{ fontSize: 13, color: "#777", maxWidth: 440, textAlign: "center", lineHeight: 1.5 }}>
                Selecione uma conversa ao lado para acompanhar as mensagens de cobrança enviadas pelo sistema e o que o cliente respondeu no WhatsApp.
              </p>
            </div>
          ) : (
            <>
              {/* Chat Header */}
              <div
                style={{
                  padding: "14px 24px",
                  background: "#18181c",
                  borderBottom: "1px solid #27272e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: "50%",
                      background: "linear-gradient(135deg, hsl(265 85% 62% / 0.3), #202028)",
                      border: "1px solid hsl(265 85% 62% / 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#c4a3ff",
                      fontWeight: 700,
                      fontSize: 16,
                    }}
                  >
                    {(activeConversation?.clientName || "C").slice(0, 2).toUpperCase()}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <span style={{ fontSize: 15, fontWeight: 700, color: "#fff" }}>
                        {activeConversation?.clientName || "Contato"}
                      </span>
                      {activeConversation?.optIn ? (
                        <span
                          title="Cliente optou por receber mensagens via WhatsApp"
                          style={{
                            fontSize: 10,
                            padding: "2px 7px",
                            borderRadius: 12,
                            background: "hsl(152 65% 45% / 0.15)",
                            color: "hsl(152 65% 55%)",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <Shield size={11} /> Opt-in Ativo
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 7px",
                            borderRadius: 12,
                            background: "#25252b",
                            color: "#888",
                            fontWeight: 500,
                          }}
                        >
                          Sem Opt-in
                        </span>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 12, color: "#888" }}>
                      <span>{formatPhoneDisplay(activeConversation?.phone || "")}</span>
                      {activeConversation?.document && <span>• Doc: {activeConversation.document}</span>}
                    </div>
                  </div>
                </div>

                {/* Right side header actions & Financial summary */}
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  {openTransactions.length > 0 && (
                    <div
                      style={{
                        padding: "6px 12px",
                        borderRadius: 8,
                        background: openTransactions.some((t) => new Date(t.dueDate) < new Date() && t.status === "pending")
                          ? "hsl(0 70% 58% / 0.15)"
                          : "hsl(265 85% 62% / 0.15)",
                        border: openTransactions.some((t) => new Date(t.dueDate) < new Date() && t.status === "pending")
                          ? "1px solid hsl(0 70% 58% / 0.35)"
                          : "1px solid hsl(265 85% 62% / 0.35)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <DollarSign size={14} color={openTransactions.some((t) => new Date(t.dueDate) < new Date() && t.status === "pending") ? "#ff7b7b" : "#c4a3ff"} />
                      <div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#eee" }}>
                          {openTransactions.length} fatura(s) pendente(s)
                        </div>
                        <div style={{ fontSize: 10, color: "#aaa" }}>
                          Total: {formatCents(openTransactions.reduce((acc, t) => acc + (t.status === "pending" ? t.amount : 0), 0))}
                        </div>
                      </div>
                    </div>
                  )}

                  {openTransactions.length > 0 && (
                    <button
                      onClick={() => handleTriggerBilling(openTransactions[0].id)}
                      disabled={isTriggeringBilling}
                      title="Dispara cobrança imediata com chave Pix para o cliente via Nexus"
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "8px 12px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 52%))",
                        border: "none",
                        color: "#fff",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: isTriggeringBilling ? "not-allowed" : "pointer",
                        opacity: isTriggeringBilling ? 0.7 : 1,
                        boxShadow: "0 0 16px hsl(265 85% 62% / 0.35)",
                      }}
                    >
                      <Zap size={14} />
                      {isTriggeringBilling ? "Disparando..." : "Cobrar via Nexus"}
                    </button>
                  )}

                  <button
                    onClick={() => fetchMessages(selectedTarget)}
                    title="Recarregar histórico de mensagens"
                    style={{
                      background: "#22222a",
                      border: "1px solid #333342",
                      color: "#aaa",
                      padding: 8,
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={15} />
                  </button>
                </div>
              </div>

              {/* Chat Messages Timeline */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: 14,
                  backgroundImage: `radial-gradient(#1c1c24 1px, transparent 1px)`,
                  backgroundSize: "20px 20px",
                }}
              >
                {isLoadingMessages ? (
                  <div style={{ textAlign: "center", padding: 40, color: "#666" }}>
                    <RefreshCw size={24} className="animate-spin" style={{ margin: "0 auto 8px" }} />
                    Carregando mensagens da conversa...
                  </div>
                ) : messages.length === 0 ? (
                  <div style={{ textAlign: "center", padding: 50, color: "#777", maxWidth: 400, margin: "auto" }}>
                    <Bot size={44} style={{ margin: "0 auto 12px", opacity: 0.3, color: "#c4a3ff" }} />
                    <h3 style={{ fontSize: 15, fontWeight: 600, color: "#bbb", margin: "0 0 6px" }}>Nenhuma mensagem registrada</h3>
                    <p style={{ fontSize: 12, color: "#666", lineHeight: 1.5 }}>
                      Nexus ainda não conversou com este cliente. Você pode disparar uma cobrança automática ou enviar uma mensagem direta abaixo.
                    </p>
                  </div>
                ) : (
                  messages.map((msg, index) => {
                    const isOutbound = msg.direction === "outbound";
                    const isClientReply = msg.direction === "inbound";
                    const badge = kindBadge(msg.kind);

                    return (
                      <motion.div
                        key={msg.id || index}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.2 }}
                        style={{
                          display: "flex",
                          justifyContent: isOutbound ? "flex-end" : "flex-start",
                          width: "100%",
                        }}
                      >
                        <div
                          style={{
                            maxWidth: "75%",
                            minWidth: 260,
                            borderRadius: 14,
                            padding: "12px 16px",
                            background: isOutbound
                              ? "linear-gradient(135deg, #241b36 0%, #1e172e 100%)"
                              : "#1d1d24",
                            border: isOutbound
                              ? "1px solid hsl(265 85% 62% / 0.35)"
                              : "1px solid #2e2e38",
                            boxShadow: isOutbound
                              ? "0 4px 20px -5px hsl(265 85% 62% / 0.15)"
                              : "0 4px 16px -5px rgba(0,0,0,0.4)",
                            borderTopRightRadius: isOutbound ? 2 : 14,
                            borderTopLeftRadius: isClientReply ? 2 : 14,
                          }}
                        >
                          {/* Bubble Header */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: 8,
                              gap: 8,
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              {isOutbound ? (
                                <>
                                  <Bot size={14} color="#c4a3ff" />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#d6beff" }}>
                                    {msg.senderName || "Nexus (Teltech)"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <User size={14} color="hsl(152 65% 55%)" />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "hsl(152 65% 65%)" }}>
                                    {msg.senderName || activeConversation?.clientName || "Cliente"}
                                  </span>
                                </>
                              )}
                            </div>

                            <span
                              style={{
                                fontSize: 9,
                                padding: "2px 7px",
                                borderRadius: 10,
                                background: `${badge.color}22`,
                                color: badge.color,
                                fontWeight: 700,
                                textTransform: "uppercase",
                                letterSpacing: "0.03em",
                              }}
                            >
                              {badge.label}
                            </span>
                          </div>

                          {/* Message Body */}
                          <div
                            style={{
                              fontSize: 13,
                              color: "#eaeaf0",
                              lineHeight: 1.55,
                              whiteSpace: "pre-wrap",
                              wordBreak: "break-word",
                            }}
                          >
                            {msg.body}
                          </div>

                          {/* Embedded Transaction Card (if linked) */}
                          {msg.transaction && (
                            <div
                              style={{
                                marginTop: 10,
                                padding: "8px 12px",
                                borderRadius: 8,
                                background: "rgba(0,0,0,0.3)",
                                border: "1px solid rgba(255,255,255,0.08)",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: 10,
                              }}
                            >
                              <div>
                                <div style={{ fontSize: 11, fontWeight: 600, color: "#ccc" }}>
                                  {msg.transaction.description || "Fatura / Cobrança"}
                                </div>
                                <div style={{ fontSize: 10, color: "#888" }}>
                                  Vencimento: {new Date(msg.transaction.dueDate).toLocaleDateString("pt-BR")}
                                </div>
                              </div>
                              <div style={{ textAlign: "right" }}>
                                <div style={{ fontSize: 13, fontWeight: 700, color: "#c4a3ff" }}>
                                  {formatCents(msg.transaction.amount)}
                                </div>
                                <span
                                  style={{
                                    fontSize: 9,
                                    color: msg.transaction.status === "paid" ? "hsl(152 65% 55%)" : "hsl(0 70% 65%)",
                                    fontWeight: 600,
                                    textTransform: "uppercase",
                                  }}
                                >
                                  {msg.transaction.status === "paid" ? "Pago" : "Pendente"}
                                </span>
                              </div>
                            </div>
                          )}

                          {/* Bubble Footer: Time + Status ticks */}
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "flex-end",
                              gap: 4,
                              marginTop: 6,
                              fontSize: 10,
                              color: "#777",
                            }}
                          >
                            <span>{formatTime(msg.sentAt || msg.createdAt)}</span>
                            {isOutbound && (
                              <CheckCheck size={13} color={msg.status === "sent" ? "hsl(152 65% 55%)" : "#888"} />
                            )}
                          </div>
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Chat Input Bar & Quick Replies */}
              <div
                style={{
                  padding: "12px 20px 16px",
                  background: "#16161a",
                  borderTop: "1px solid #27272e",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Quick Reply Pills */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2 }}>
                  {[
                    "👋 Olá! Segue o lembrete da sua fatura.",
                    "💳 Segue a nossa chave Pix para pagamento:",
                    "📄 Pode nos enviar o comprovante por aqui?",
                    "🤝 Conseguimos negociar um novo prazo caso precise.",
                  ].map((phrase, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(phrase)}
                      disabled={isSending}
                      style={{
                        padding: "4px 10px",
                        borderRadius: 14,
                        background: "#22222a",
                        border: "1px solid #2f2f3c",
                        color: "#aaa",
                        fontSize: 11,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        transition: "all 0.15s ease",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = "#c4a3ff";
                        e.currentTarget.style.borderColor = "hsl(265 85% 62% / 0.4)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = "#aaa";
                        e.currentTarget.style.borderColor = "#2f2f3c";
                      }}
                    >
                      {phrase}
                    </button>
                  ))}
                </div>

                {/* Main Input Textarea & Send button */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: 10,
                    background: "#1d1d24",
                    border: "1px solid #31313e",
                    borderRadius: 12,
                    padding: "8px 12px",
                  }}
                >
                  <textarea
                    rows={2}
                    placeholder="Digite uma mensagem para o cliente (Nexus enviará via WhatsApp)..."
                    value={messageInput}
                    onChange={(e) => setMessageInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        handleSendMessage();
                      }
                    }}
                    style={{
                      flex: 1,
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: "#fafafa",
                      fontSize: 13,
                      resize: "none",
                      lineHeight: 1.4,
                    }}
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={!messageInput.trim() || isSending}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: messageInput.trim()
                        ? "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 50%))"
                        : "#282832",
                      border: "none",
                      color: messageInput.trim() ? "#fff" : "#666",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: messageInput.trim() && !isSending ? "pointer" : "not-allowed",
                      boxShadow: messageInput.trim() ? "0 0 16px hsl(265 85% 62% / 0.4)" : "none",
                      transition: "all 0.15s ease",
                      flexShrink: 0,
                    }}
                  >
                    {isSending ? <RefreshCw size={16} className="animate-spin" /> : <Send size={16} />}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default MonitoramentoPage;
