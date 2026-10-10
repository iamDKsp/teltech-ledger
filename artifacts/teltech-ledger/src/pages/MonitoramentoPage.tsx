import { useState, useEffect, useRef, useMemo, useCallback } from "react";
import {
  Bell,
  BellRing,
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
  ChevronRight,
  QrCode,
  X,
  CreditCard,
  CheckCircle2,
  SlidersHorizontal,
  ChevronDown,
  Smartphone,
  UserCheck,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Maximize2,
  Image as ImageIcon,
  Paperclip,
  Film,
  Mic,
  Music,
  FileSpreadsheet,
  FileArchive,
  Eye,
} from "lucide-react";
import { toast } from "sonner";
import { API } from "../lib/api";
import { motion, AnimatePresence } from "framer-motion";
import { useIsMobile } from "../hooks/use-mobile";
import {
  checkPushSupport,
  getCurrentPushSubscription,
  subscribeToPushNotifications,
  testPushNotification,
  unsubscribeFromPushNotifications,
  type PushSupportStatus,
} from "../lib/push-notifications";

interface ConversationItem {
  id: string;
  clientId: string | null;
  partnerId?: string | null;
  contactType?: "client" | "partner" | "unknown";
  clientName: string;
  nickname?: string | null;
  roleLabel?: string | null;
  isPartner?: boolean;
  photoUrl?: string | null;
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
    mediaType?: "image" | "audio" | "video" | "document" | null;
    mediaUrl?: string | null;
    mediaFilename?: string | null;
    mediaDuration?: number | null;
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
    status: "overdue" | "pending" | "paid_up" | "partner";
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
  mediaType?: "image" | "audio" | "video" | "document" | null;
  mediaUrl?: string | null;
  mediaMimeType?: string | null;
  mediaFilename?: string | null;
  mediaSize?: number | null;
  mediaDuration?: number | null;
  transaction?: {
    id: string;
    amount: number;
    dueDate: string;
    description: string;
    status: string;
  } | null;
}

interface FinancialTransactionItem {
  id: string;
  amount: number;
  dueDate: string;
  description: string;
  status: "pending" | "paid" | "canceled";
  paidAt?: string | null;
  type: string;
}

interface MonitoringStats {
  status: {
    status: "connecting" | "qr" | "connected" | "disconnected";
    connected: boolean;
    configured: boolean;
    paired: boolean;
    phone: string | null;
    qr?: string | null;
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
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return raw;
}

function getContactInitials(name: string): string {
  if (!name) return "?";
  const clean = name.replace(/\+55\s*/, "").replace(/[()\-]/g, "").trim();
  const parts = clean.split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  return clean.slice(0, 2).toUpperCase();
}

function kindBadge(kind: string): { label: string; color: string } {
  switch (kind) {
    case "before_due":
      return { label: "Cobrança Preventiva", color: "#3B82F6" };
    case "due_date":
      return { label: "Vence Hoje", color: "#F59E0B" };
    case "after_due":
      return { label: "Aviso de Atraso", color: "#EF4444" };
    case "payment_receipt":
    case "receipt":
      return { label: "Comprovante / Quitação", color: "#10B981" };
    case "partner_reply":
      return { label: "Resposta do Sócio", color: "#A78BFA" };
    case "client_reply":
      return { label: "Resposta do Cliente", color: "#10B981" };
    case "manual_chat":
      return { label: "Chat Direto", color: "#8B5CF6" };
    case "manual_billing":
      return { label: "Cobrança Manual", color: "#A855F7" };
    default:
      return { label: "Notificação", color: "#8B5CF6" };
  }
}

/**
 * Subcomponent to render rich WhatsApp message text (bold, italic, links, emojis)
 * and isolate Pix Copia e Cola codes into an interactive card.
 */
function FormattedWhatsAppBody({ text, amount }: { text: string; amount?: number | null }) {
  // Regex to extract Brazilian BR Code Pix: starts with 000201...
  const pixRegex = /(000201[0-9]{2}[0-9A-Za-z.+_\-]{30,})/;
  const match = text.match(pixRegex);
  const pixCode = match ? match[1] : null;

  // Clean the text to avoid repeating the huge code
  let cleanText = text;
  if (pixCode) {
    cleanText = cleanText
      .replace(pixCode, "")
      .replace(/Pix Copia e Cola:?/gi, "")
      .trim();
  }

  // Parse basic WhatsApp markup (*bold*, _italic_, ~strike~)
  const renderFormatted = (raw: string) => {
    const lines = raw.split("\n");
    return lines.map((line, lineIdx) => {
      // Bold regex: \*([^*]+)\*
      // Italic regex: _([^_]+)_
      const parts = line.split(/(\*[^*]+\*|_[^_]+_)/g);
      return (
        <div key={lineIdx} style={{ minHeight: line === "" ? "0.8em" : undefined }}>
          {parts.map((part, partIdx) => {
            if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
              return (
                <strong key={partIdx} style={{ fontWeight: 700, color: "#fff" }}>
                  {part.slice(1, -1)}
                </strong>
              );
            }
            if (part.startsWith("_") && part.endsWith("_") && part.length > 2) {
              return (
                <em key={partIdx} style={{ fontStyle: "italic", color: "#aaa" }}>
                  {part.slice(1, -1)}
                </em>
              );
            }
            return <span key={partIdx}>{part}</span>;
          })}
        </div>
      );
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 13, color: "#eaeaf0", lineHeight: 1.55, wordBreak: "break-word" }}>
        {renderFormatted(cleanText)}
      </div>

      {pixCode && <PixPaymentCard pixCode={pixCode} amount={amount} />}
    </div>
  );
}

/**
 * Dedicated Interactive Pix Card with 1-click copy, QR code expander, and visual status.
 */
function PixPaymentCard({ pixCode, amount }: { pixCode: string; amount?: number | null }) {
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(pixCode);
    setCopied(true);
    toast.success("Código Pix Copia e Cola copiado com sucesso!");
    setTimeout(() => setCopied(false), 2500);
  };

  // Safe fallback QR server URL
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(pixCode)}`;

  return (
    <div
      style={{
        marginTop: 6,
        padding: "12px 14px",
        borderRadius: 12,
        background: "linear-gradient(135deg, rgba(139, 92, 246, 0.12), rgba(16, 185, 129, 0.08))",
        border: "1px solid hsl(265 85% 62% / 0.4)",
        boxShadow: "0 4px 18px -4px rgba(139, 92, 246, 0.25)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: 24,
              height: 24,
              borderRadius: 6,
              background: "hsl(265 85% 62% / 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#c4a3ff",
            }}
          >
            <CreditCard size={14} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: "#e4d4ff" }}>Pix Copia e Cola</span>
        </div>

        {amount && (
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              padding: "2px 8px",
              borderRadius: 6,
              background: "hsl(152 65% 45% / 0.2)",
              border: "1px solid hsl(152 65% 45% / 0.4)",
              color: "hsl(152 65% 60%)",
            }}
          >
            {formatCents(amount)}
          </span>
        )}
      </div>

      {/* Code Snippet Box */}
      <div
        style={{
          background: "#121217",
          border: "1px solid #2a2a36",
          borderRadius: 8,
          padding: "8px 10px",
          fontFamily: "monospace",
          fontSize: 11,
          color: "#9ca3af",
          maxHeight: 50,
          overflowY: "auto",
          wordBreak: "break-all",
          userSelect: "all",
          marginBottom: 10,
        }}
      >
        {pixCode}
      </div>

      {/* Action Buttons */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          onClick={handleCopy}
          style={{
            flex: 1,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "7px 12px",
            borderRadius: 8,
            background: copied
              ? "linear-gradient(135deg, hsl(152 65% 45%), hsl(152 65% 38%))"
              : "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 52%))",
            border: "none",
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            transition: "all 0.2s ease",
            boxShadow: copied ? "0 0 12px hsl(152 65% 45% / 0.4)" : "0 0 14px hsl(265 85% 62% / 0.35)",
          }}
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? "Copiado!" : "Copiar Código Pix"}
        </button>

        <button
          onClick={() => setShowQr(!showQr)}
          title="Exibir QR Code para leitura por celular"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 6,
            padding: "7px 10px",
            borderRadius: 8,
            background: showQr ? "#322744" : "#202028",
            border: "1px solid #363645",
            color: showQr ? "#c4a3ff" : "#bbb",
            fontSize: 11,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <QrCode size={14} />
          {showQr ? "Ocultar QR" : "Ver QR Code"}
        </button>
      </div>

      {/* Expandable QR Code */}
      <AnimatePresence>
        {showQr && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            style={{
              overflow: "hidden",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              paddingTop: 12,
            }}
          >
            <div
              style={{
                padding: 10,
                background: "#fff",
                borderRadius: 12,
                boxShadow: "0 4px 20px rgba(0,0,0,0.6)",
              }}
            >
              <img src={qrUrl} alt="QR Code Pix" style={{ width: 170, height: 170, display: "block" }} />
            </div>
            <span style={{ fontSize: 10, color: "#888", marginTop: 6 }}>
              Aponte o app do banco para pagar instantaneamente
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function resolveMediaSrc(mediaUrl?: string | null): string {
  if (!mediaUrl) return "";
  if (mediaUrl.startsWith("http://") || mediaUrl.startsWith("https://")) return mediaUrl;
  const base = API.baseUrl ? API.baseUrl.replace(/\/$/, "") : "";
  return `${base}${mediaUrl.startsWith("/") ? "" : "/"}${mediaUrl}`;
}

function formatFileSize(bytes?: number | null): string {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatAudioTime(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
}

function WhatsAppAudioPlayer({
  src,
  durationSec,
  isOutbound,
}: {
  src?: string | null;
  durationSec?: number | null;
  isOutbound: boolean;
}) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const [playbackRate, setPlaybackRate] = useState<1 | 1.5 | 2>(1);

  const mediaSrc = resolveMediaSrc(src);

  const togglePlay = () => {
    if (!audioRef.current || !mediaSrc) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current
        .play()
        .then(() => setIsPlaying(true))
        .catch((e) => console.warn("Audio play failed", e));
    }
  };

  const toggleRate = () => {
    const nextRate: 1 | 1.5 | 2 = playbackRate === 1 ? 1.5 : playbackRate === 1.5 ? 2 : 1;
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!audioRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percent = Math.max(0, Math.min(1, clickX / rect.width));
    const newTime = percent * duration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: "10px 14px",
        background: isOutbound ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.35)",
        borderRadius: 12,
        border: isOutbound ? "1px solid hsl(265 85% 62% / 0.3)" : "1px solid rgba(255,255,255,0.1)",
        minWidth: "min(100%, 230px)",
        maxWidth: "100%",
      }}
    >
      {mediaSrc && (
        <audio
          ref={audioRef}
          src={mediaSrc}
          preload="metadata"
          onTimeUpdate={() => {
            if (audioRef.current) setCurrentTime(audioRef.current.currentTime);
          }}
          onLoadedMetadata={() => {
            if (audioRef.current && audioRef.current.duration) {
              setDuration(audioRef.current.duration);
            }
          }}
          onEnded={() => {
            setIsPlaying(false);
            setCurrentTime(0);
          }}
        />
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        {/* Play / Pause Button */}
        <button
          onClick={togglePlay}
          disabled={!mediaSrc}
          title={isPlaying ? "Pausar áudio" : "Ouvir áudio"}
          style={{
            width: 38,
            height: 38,
            borderRadius: "50%",
            background: isPlaying
              ? "hsl(152 65% 45%)"
              : isOutbound
              ? "hsl(265 85% 62%)"
              : "hsl(265 85% 62% / 0.4)",
            border: "none",
            color: "#fff",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: mediaSrc ? "pointer" : "default",
            flexShrink: 0,
            transition: "all 0.15s ease",
            boxShadow: isPlaying ? "0 0 12px hsl(152 65% 45% / 0.5)" : "none",
          }}
        >
          {isPlaying ? <Pause size={18} /> : <Play size={18} style={{ marginLeft: 2 }} />}
        </button>

        {/* Waveform Scrubber & Progress */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 5 }}>
          <div
            onClick={handleSeek}
            style={{
              height: 24,
              display: "flex",
              alignItems: "center",
              gap: 3,
              cursor: mediaSrc ? "pointer" : "default",
              position: "relative",
            }}
          >
            {/* WhatsApp-style audio waveform bars */}
            {Array.from({ length: 24 }).map((_, i) => {
              const barProgress = (i / 24) * 100;
              const isFilled = barProgress <= progress;
              const heights = [8, 14, 20, 12, 18, 22, 10, 16, 24, 18, 12, 22, 16, 10, 18, 24, 14, 8, 16, 20, 12, 18, 14, 8];
              const h = heights[i % heights.length];
              return (
                <div
                  key={i}
                  style={{
                    width: 3,
                    height: h,
                    borderRadius: 2,
                    background: isFilled
                      ? isOutbound
                        ? "#c4a3ff"
                        : "hsl(152 65% 55%)"
                      : "rgba(255,255,255,0.2)",
                    transition: "background 0.1s ease",
                  }}
                />
              );
            })}
          </div>

          {/* Time Display */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10, color: "#aaa" }}>
            <span>{formatAudioTime(currentTime)}</span>
            <span>{formatAudioTime(duration || durationSec || 0)}</span>
          </div>
        </div>

        {/* Speed Toggle */}
        <button
          onClick={toggleRate}
          title="Alternar velocidade de reprodução"
          style={{
            padding: "2px 6px",
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 700,
            background: playbackRate > 1 ? "hsl(265 85% 62% / 0.3)" : "rgba(255,255,255,0.08)",
            color: playbackRate > 1 ? "#c4a3ff" : "#888",
            border: "1px solid rgba(255,255,255,0.1)",
            cursor: "pointer",
            flexShrink: 0,
          }}
        >
          {playbackRate}x
        </button>
      </div>

      {/* Audio footer actions */}
      {mediaSrc && (
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: 6, marginTop: 2 }}>
          <a
            href={mediaSrc}
            download="audio-whatsapp.ogg"
            style={{
              fontSize: 10,
              color: "#aaa",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
              transition: "color 0.15s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#c4a3ff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#aaa")}
          >
            <Download size={11} /> Baixar Áudio
          </a>
        </div>
      )}
    </div>
  );
}

function WhatsAppVideoPlayer({
  src,
  caption,
  isOutbound,
}: {
  src?: string | null;
  caption?: string | null;
  isOutbound: boolean;
}) {
  const mediaSrc = resolveMediaSrc(src);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxWidth: "100%",
        width: "100%",
        borderRadius: 12,
        overflow: "hidden",
        background: "#0f0f12",
        border: isOutbound ? "1px solid hsl(265 85% 62% / 0.3)" : "1px solid rgba(255,255,255,0.1)",
      }}
    >
      {mediaSrc ? (
        <video
          src={mediaSrc}
          controls
          playsInline
          preload="metadata"
          style={{
            width: "100%",
            maxHeight: 260,
            borderRadius: 10,
            background: "#000",
            display: "block",
          }}
        />
      ) : (
        <div style={{ padding: 24, textAlign: "center", color: "#888", fontSize: 12 }}>
          <Film size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
          <div>Vídeo do WhatsApp</div>
        </div>
      )}

      {caption && (
        <div style={{ padding: "6px 10px", fontSize: 12, color: "#eee", lineHeight: 1.4 }}>
          {caption}
        </div>
      )}

      {mediaSrc && (
        <div style={{ display: "flex", justifyContent: "flex-end", padding: "4px 10px 8px" }}>
          <a
            href={mediaSrc}
            download="video-whatsapp.mp4"
            style={{
              fontSize: 10,
              color: "#aaa",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: 4,
            }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#c4a3ff")}
            onMouseLeave={(e) => (e.currentTarget.style.color = "#aaa")}
          >
            <Download size={11} /> Baixar Vídeo
          </a>
        </div>
      )}
    </div>
  );
}

function WhatsAppImageViewer({
  src,
  caption,
  isOutbound,
  onOpenLightbox,
}: {
  src?: string | null;
  caption?: string | null;
  isOutbound: boolean;
  onOpenLightbox: (src: string, caption?: string | null) => void;
}) {
  const mediaSrc = resolveMediaSrc(src);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        maxWidth: "100%",
        width: "100%",
      }}
    >
      {mediaSrc ? (
        <div
          onClick={() => onOpenLightbox(mediaSrc, caption)}
          style={{
            position: "relative",
            borderRadius: 10,
            overflow: "hidden",
            cursor: "pointer",
            background: "#0c0c10",
            border: isOutbound ? "1px solid hsl(265 85% 62% / 0.3)" : "1px solid rgba(255,255,255,0.1)",
          }}
        >
          <img
            src={mediaSrc}
            alt={caption || "Foto enviada"}
            style={{
              width: "100%",
              maxHeight: 260,
              objectFit: "cover",
              display: "block",
              transition: "transform 0.2s ease",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.02)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          />
          <div
            style={{
              position: "absolute",
              bottom: 6,
              right: 6,
              padding: "3px 6px",
              borderRadius: 6,
              background: "rgba(0,0,0,0.6)",
              color: "#fff",
              fontSize: 10,
              display: "flex",
              alignItems: "center",
              gap: 4,
            }}
          >
            <Maximize2 size={10} /> Ampliar
          </div>
        </div>
      ) : (
        <div style={{ padding: 20, textAlign: "center", color: "#888", fontSize: 12 }}>
          <ImageIcon size={28} style={{ margin: "0 auto 8px", opacity: 0.5 }} />
          <div>Foto enviada via WhatsApp</div>
        </div>
      )}

      {caption && (
        <div style={{ fontSize: 12, color: "#eee", lineHeight: 1.4, padding: "2px 4px" }}>
          {caption}
        </div>
      )}
    </div>
  );
}

function WhatsAppDocumentCard({
  src,
  filename,
  size,
  caption,
  isOutbound,
}: {
  src?: string | null;
  filename?: string | null;
  size?: number | null;
  caption?: string | null;
  isOutbound: boolean;
}) {
  const mediaSrc = resolveMediaSrc(src);
  const isPdf = filename?.toLowerCase().endsWith(".pdf") || caption?.toLowerCase().includes("pdf");
  const isSheet = filename?.match(/\.(xlsx?|csv)$/i);
  const isArchive = filename?.match(/\.(zip|rar|7z|tar|gz)$/i);
  const safeName = filename || (isPdf ? "Documento.pdf" : "Arquivo");

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 6,
        minWidth: "min(100%, 220px)",
        maxWidth: "100%",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          padding: "10px 14px",
          background: isOutbound ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.35)",
          borderRadius: 10,
          border: isPdf
            ? "1px solid rgba(239, 68, 68, 0.35)"
            : isOutbound
            ? "1px solid hsl(265 85% 62% / 0.3)"
            : "1px solid rgba(255,255,255,0.1)",
        }}
      >
        <div
          style={{
            width: 38,
            height: 38,
            borderRadius: 8,
            background: isPdf
              ? "rgba(239, 68, 68, 0.15)"
              : isSheet
              ? "rgba(16, 185, 129, 0.15)"
              : isArchive
              ? "rgba(245, 158, 11, 0.15)"
              : "rgba(255,255,255,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          {isPdf ? (
            <FileText size={20} color="#f87171" />
          ) : isSheet ? (
            <FileSpreadsheet size={20} color="#34d399" />
          ) : isArchive ? (
            <FileArchive size={20} color="#fbbf24" />
          ) : (
            <FileText size={20} color="#c4a3ff" />
          )}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              fontSize: 12,
              fontWeight: 600,
              color: "#fff",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
            title={safeName}
          >
            {safeName}
          </div>
          <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
            {isPdf ? "Documento PDF" : "Arquivo"} {formatFileSize(size)}
          </div>
        </div>

        {mediaSrc && (
          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <a
              href={mediaSrc}
              target="_blank"
              rel="noreferrer"
              title="Visualizar em nova aba"
              style={{
                padding: 6,
                borderRadius: 6,
                background: "rgba(255,255,255,0.08)",
                color: "#ddd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
            >
              <Eye size={14} />
            </a>
            <a
              href={mediaSrc}
              download={safeName}
              title="Baixar arquivo"
              style={{
                padding: 6,
                borderRadius: 6,
                background: isPdf ? "rgba(239, 68, 68, 0.2)" : "rgba(255,255,255,0.08)",
                color: isPdf ? "#fca5a5" : "#ddd",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                textDecoration: "none",
              }}
            >
              <Download size={14} />
            </a>
          </div>
        )}
      </div>

      {caption && (
        <div style={{ fontSize: 12, color: "#eee", padding: "2px 4px", lineHeight: 1.4 }}>
          {caption}
        </div>
      )}
    </div>
  );
}

function ContactAvatar({
  name,
  photoUrl,
  isPartner,
  isSelected,
  size = 40,
  hasReplied,
}: {
  name: string;
  photoUrl?: string | null;
  isPartner?: boolean;
  isSelected?: boolean;
  size?: number;
  hasReplied?: boolean;
}) {
  const [imgError, setImgError] = useState(false);
  const src = photoUrl && !imgError ? resolveMediaSrc(photoUrl) : null;

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: isSelected
          ? (isPartner ? "hsl(265 85% 62% / 0.35)" : "hsl(265 85% 62% / 0.3)")
          : (isPartner ? "hsl(265 85% 62% / 0.15)" : "#252530"),
        border: isSelected
          ? (isPartner ? "1px solid hsl(265 85% 62% / 0.8)" : "1px solid hsl(265 85% 62% / 0.6)")
          : (isPartner ? "1px solid hsl(265 85% 62% / 0.35)" : "1px solid #333342"),
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: isPartner ? "#c4a3ff" : (isSelected ? "#d4b8ff" : "#aaa"),
        fontWeight: 700,
        fontSize: Math.max(11, Math.round(size * 0.36)),
        flexShrink: 0,
        position: "relative",
      }}
    >
      {src ? (
        <img
          src={src}
          alt={name}
          onError={() => setImgError(true)}
          style={{ width: "100%", height: "100%", objectFit: "cover", borderRadius: "50%" }}
        />
      ) : (
        <span>{getContactInitials(name)}</span>
      )}
      {hasReplied && (
        <span
          title="Contato respondeu"
          style={{
            position: "absolute",
            bottom: -1,
            right: -1,
            width: Math.max(9, Math.round(size * 0.25)),
            height: Math.max(9, Math.round(size * 0.25)),
            borderRadius: "50%",
            background: "hsl(152 65% 50%)",
            border: "2px solid #151518",
            zIndex: 2,
          }}
        />
      )}
    </div>
  );
}

export function MonitoramentoPage() {
  const isMobile = useIsMobile();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [stats, setStats] = useState<MonitoringStats | null>(null);
  const [selectedTarget, setSelectedTarget] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [openTransactions, setOpenTransactions] = useState<FinancialTransactionItem[]>([]);
  const [allTransactions, setAllTransactions] = useState<FinancialTransactionItem[]>([]);
  const [selectedClient, setSelectedClient] = useState<any>(null);
  const [selectedPartner, setSelectedPartner] = useState<any>(null);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "partners" | "clients" | "replied" | "waiting" | "overdue">("all");
  const [messageInput, setMessageInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isTriggeringBilling, setIsTriggeringBilling] = useState(false);

  // New Drawer & Reconnection Modal States
  const [showClientDrawer, setShowClientDrawer] = useState(false);
  const [showReconnectModal, setShowReconnectModal] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isMarkingPaid, setIsMarkingPaid] = useState<string | null>(null);
  const [isTogglingOptIn, setIsTogglingOptIn] = useState(false);
  const [showInvoiceSelector, setShowInvoiceSelector] = useState(false);

  // Push Notification States
  const [pushStatus, setPushStatus] = useState<PushSupportStatus | null>(null);
  const [isPushSubscribed, setIsPushSubscribed] = useState(false);
  const [pushLoading, setPushLoading] = useState(false);
  const [showIosPushModal, setShowIosPushModal] = useState(false);

  // Media Lightbox & Attachment States
  const [lightboxImage, setLightboxImage] = useState<{ src: string; caption?: string | null } | null>(null);
  const [selectedAttachment, setSelectedAttachment] = useState<{
    file: File;
    previewUrl: string;
    type: "image" | "audio" | "video" | "document";
  } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSelectAttachment = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    let type: "image" | "audio" | "video" | "document" = "document";
    if (file.type.startsWith("image/")) type = "image";
    else if (file.type.startsWith("video/")) type = "video";
    else if (file.type.startsWith("audio/")) type = "audio";

    const previewUrl = URL.createObjectURL(file);
    setSelectedAttachment({ file, previewUrl, type });
  };

  const handleClearAttachment = () => {
    if (selectedAttachment?.previewUrl) {
      URL.revokeObjectURL(selectedAttachment.previewUrl);
    }
    setSelectedAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

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

      const res = await API.get<{ conversations: ConversationItem[] }>(
        `/whatsapp/monitoring/conversations?${params.toString()}`
      );
      setConversations(res?.conversations ?? []);
    } catch (err) {
      console.error("Falha ao carregar conversas de monitoramento", err);
    } finally {
      if (isInitial) setIsLoadingConversations(false);
    }
  }, [search]);

  // Carregar mensagens da conversa ativa
  const fetchMessages = useCallback(async (target: string, isSilent = false) => {
    if (!isSilent) setIsLoadingMessages(true);
    try {
      const res = await API.get<{
        messages: ChatMessage[];
        client: any;
        partner?: any;
        isPartner?: boolean;
        openTransactions: FinancialTransactionItem[];
        allTransactions?: FinancialTransactionItem[];
      }>(`/whatsapp/monitoring/conversations/${target}/messages`);

      const rawMsgs = res?.messages ?? [];
      const seenMsgKeys = new Set<string>();
      const cleanMsgs = rawMsgs.filter((m) => {
        const k = m.waMessageId ? `wa:${m.waMessageId}` : (m.id ? `id:${m.id}` : `${m.direction}:${m.body}:${m.sentAt}`);
        if (seenMsgKeys.has(k)) return false;
        seenMsgKeys.add(k);
        return true;
      });

      setMessages(cleanMsgs);
      setSelectedClient(res?.client ?? null);
      setSelectedPartner(res?.partner ?? null);
      setOpenTransactions(res?.openTransactions ?? []);
      setAllTransactions(res?.allTransactions ?? res?.openTransactions ?? []);
    } catch (err) {
      console.error("Falha ao carregar mensagens da conversa", err);
    } finally {
      if (!isSilent) setIsLoadingMessages(false);
    }
  }, []);

  // Polling em background a cada 6s
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
      setAllTransactions([]);
    }
  }, [selectedTarget, fetchMessages]);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Conversa ativa selecionada
  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === selectedTarget) || null;
  }, [conversations, selectedTarget]);

  // Enviar mensagem manual (texto ou anexo de mídia)
  const handleSendMessage = async (textToSend?: string) => {
    const text = (textToSend ?? messageInput).trim();
    if ((!text && !selectedAttachment) || !selectedTarget || isSending) return;

    setIsSending(true);
    try {
      if (selectedAttachment) {
        const formData = new FormData();
        formData.append("file", selectedAttachment.file);
        if (text) {
          formData.append("caption", text);
        }
        if (openTransactions[0]?.id) {
          formData.append("transactionId", openTransactions[0].id);
        }

        await API.postForm(`/whatsapp/monitoring/conversations/${selectedTarget}/send-media`, formData);
        handleClearAttachment();
        setMessageInput("");
        toast.success("Mídia enviada via WhatsApp!");
      } else {
        const res = await API.post(`/whatsapp/monitoring/conversations/${selectedTarget}/messages`, {
          text,
          transactionId: openTransactions[0]?.id ?? null,
        });

        if (res?.message) {
          setMessageInput("");
          toast.success("Mensagem enviada via WhatsApp!");
        }
      }

      await fetchMessages(selectedTarget, true);
      await fetchConversations(false);
      await fetchStats();
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
        setShowInvoiceSelector(false);
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

  // Baixa manual e quitação da fatura diretamente pelo Chat/Drawer
  const handleMarkPaid = async (transactionId: string) => {
    if (!selectedTarget || isMarkingPaid) return;
    setIsMarkingPaid(transactionId);
    try {
      const res = await API.post(`/whatsapp/monitoring/conversations/${selectedTarget}/mark-paid`, {
        transactionId,
        sendReceipt: true,
      });
      if (res?.ok) {
        toast.success("Fatura liquidada! Recibo de quitação disparado via WhatsApp.");
        await fetchMessages(selectedTarget, true);
        await fetchConversations(false);
        await fetchStats();
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao marcar fatura como paga");
    } finally {
      setIsMarkingPaid(null);
    }
  };

  // Alternar Opt-in do cliente diretamente no chat
  const handleToggleOptIn = async () => {
    if (!selectedTarget || isTogglingOptIn) return;
    const currentOptIn = activeConversation?.optIn ?? false;
    setIsTogglingOptIn(true);
    try {
      const res = await API.post(`/whatsapp/monitoring/conversations/${selectedTarget}/toggle-optin`, {
        optIn: !currentOptIn,
      });
      if (res?.ok) {
        toast.success(!currentOptIn ? "Opt-in do WhatsApp ativado!" : "Opt-in do WhatsApp desativado.");
        await fetchConversations(false);
        if (selectedClient) {
          setSelectedClient({ ...selectedClient, whatsappOptIn: !currentOptIn });
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao alterar consentimento");
    } finally {
      setIsTogglingOptIn(false);
    }
  };

  // Solicitar reconexão do WhatsApp diretamente
  const handleReconnectWhatsApp = async () => {
    setIsReconnecting(true);
    try {
      const res = await API.post<{ ok: boolean; status: any }>("/whatsapp/monitoring/reconnect");
      if (res?.ok) {
        toast.success("Reconexão solicitada! Escaneie o QR Code.");
        await fetchStats();
      }
    } catch (err: any) {
      toast.error(err.message || "Falha ao solicitar reconexão");
    } finally {
      setIsReconnecting(false);
    }
  };

  // Inicialização e checagem de suporte a Web Push
  useEffect(() => {
    const status = checkPushSupport();
    setPushStatus(status);
    getCurrentPushSubscription()
      .then((sub) => {
        setIsPushSubscribed(Boolean(sub));
      })
      .catch((err) => console.error("Falha ao checar inscrição push:", err));
  }, []);

  const handleTogglePush = async () => {
    if (pushLoading) return;
    const status = checkPushSupport();
    setPushStatus(status);

    if (status.isIOS && !status.isStandalone) {
      setShowIosPushModal(true);
      return;
    }

    setPushLoading(true);
    try {
      if (isPushSubscribed) {
        const res = await unsubscribeFromPushNotifications();
        if (res.ok) {
          setIsPushSubscribed(false);
          toast.success("Notificações push desativadas neste dispositivo.");
        } else {
          toast.error(res.reason || "Erro ao desativar notificações.");
        }
      } else {
        const res = await subscribeToPushNotifications();
        if (res.ok) {
          setIsPushSubscribed(true);
          toast.success("Notificações no celular ativadas com sucesso!");
        } else {
          if (status.isIOS && !status.isStandalone) {
            setShowIosPushModal(true);
          } else {
            toast.error(res.reason || "Não foi possível ativar as notificações.");
          }
        }
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao processar notificações push");
    } finally {
      setPushLoading(false);
    }
  };

  const handleTestPush = async () => {
    try {
      toast.info("Enviando notificação de teste...");
      const res = await testPushNotification();
      if (res.ok && (res.sent ?? 0) > 0) {
        toast.success("Notificação enviada! Verifique seu dispositivo.");
      } else {
        toast.warning("Nenhum dispositivo ativo inscrito para receber o push.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erro ao enviar teste push");
    }
  };

  // Dynamic filter counts and filtering
  const filterCounts = useMemo(() => {
    return {
      all: conversations.length,
      partners: conversations.filter((c) => c.isPartner).length,
      clients: conversations.filter((c) => !c.isPartner).length,
      replied: conversations.filter((c) => c.hasReplied).length,
      waiting: conversations.filter((c) => !c.hasReplied && c.totalMessages > 0).length,
      overdue: conversations.filter((c) => c.financialInfo.overdueCount > 0).length,
    };
  }, [conversations]);

  const filteredConversations = useMemo(() => {
    let list = conversations;
    if (filter === "partners") {
      list = list.filter((c) => c.isPartner);
    } else if (filter === "clients") {
      list = list.filter((c) => !c.isPartner);
    } else if (filter === "replied") {
      list = list.filter((c) => c.hasReplied);
    } else if (filter === "waiting") {
      list = list.filter((c) => !c.hasReplied && c.totalMessages > 0);
    } else if (filter === "overdue") {
      list = list.filter((c) => c.financialInfo.overdueCount > 0);
    }
    return list;
  }, [conversations, filter]);

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", width: "100%", background: "#111113", color: "#fafafa" }}>
      {/* ─── Top Stats & Status Bar ─── */}
      {(!isMobile || !selectedTarget) && (
        <div
          style={{
            padding: isMobile ? "12px 16px" : "16px 24px",
            background: "linear-gradient(180deg, #18181c 0%, #121215 100%)",
            borderBottom: "1px solid #27272e",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: isMobile ? 12 : 16,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 10 : 14 }}>
            <div
              style={{
                width: isMobile ? 38 : 44,
                height: isMobile ? 38 : 44,
                borderRadius: 12,
                background: "linear-gradient(135deg, hsl(265 85% 62% / 0.3), hsl(152 65% 45% / 0.2))",
                border: "1px solid hsl(265 85% 62% / 0.4)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#c4a3ff",
                boxShadow: "0 0 20px hsl(265 85% 62% / 0.25)",
                flexShrink: 0,
              }}
            >
              <Bot size={isMobile ? 20 : 24} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h1 style={{ fontSize: isMobile ? 15 : 18, fontWeight: 700, margin: 0, letterSpacing: "-0.02em", color: "#fff" }}>
                  Monitoramento Nexus
                </h1>

                {/* Status Badge with Reconnection Button */}
                {stats?.status.connected ? (
                  <div
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: "hsl(152 65% 45% / 0.15)",
                      border: "1px solid hsl(152 65% 45% / 0.4)",
                      color: "hsl(152 65% 55%)",
                      fontSize: 11,
                      fontWeight: 600,
                    }}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "hsl(152 65% 50%)", boxShadow: "0 0 8px hsl(152 65% 50%)" }} />
                    Online {stats.status.phone ? `(${formatPhoneDisplay(stats.status.phone)})` : ""}
                  </div>
                ) : (
                  <button
                    onClick={() => setShowReconnectModal(true)}
                    title="Clique para conectar ou escanear QR Code"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "3px 10px",
                      borderRadius: 20,
                      background: "hsl(0 70% 58% / 0.15)",
                      border: "1px solid hsl(0 70% 58% / 0.4)",
                      color: "hsl(0 70% 68%)",
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "hsl(0 70% 58% / 0.25)")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = "hsl(0 70% 58% / 0.15)")}
                  >
                    <span style={{ width: 7, height: 7, borderRadius: "50%", background: "hsl(0 70% 58%)" }} />
                    WhatsApp Desconectado • Conectar
                  </button>
                )}

                {/* Push Notifications Toggle */}
                <button
                  onClick={handleTogglePush}
                  disabled={pushLoading}
                  title={
                    isPushSubscribed
                      ? "Notificações push ativas neste aparelho. Clique para desativar."
                      : "Clique para ativar notificações push no celular"
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "3px 10px",
                    borderRadius: 20,
                    background: isPushSubscribed
                      ? "hsl(265 85% 62% / 0.18)"
                      : "rgba(255, 255, 255, 0.06)",
                    border: isPushSubscribed
                      ? "1px solid hsl(265 85% 62% / 0.5)"
                      : "1px solid rgba(255, 255, 255, 0.15)",
                    color: isPushSubscribed ? "#c4a3ff" : "#aaa",
                    fontSize: 11,
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {isPushSubscribed ? <BellRing size={12} color="#c4a3ff" /> : <Bell size={12} />}
                  {pushLoading
                    ? "Configurando..."
                    : isPushSubscribed
                    ? "Push Celular Ativo"
                    : "Ativar Push Celular"}
                </button>

                {isPushSubscribed && (
                  <button
                    onClick={handleTestPush}
                    title="Enviar notificação de teste push agora"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      padding: "3px 8px",
                      borderRadius: 16,
                      background: "rgba(255, 255, 255, 0.05)",
                      border: "1px solid rgba(255, 255, 255, 0.12)",
                      color: "#bbb",
                      fontSize: 10,
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    Testar
                  </button>
                )}
              </div>
              {!isMobile && (
                <p style={{ fontSize: 12, color: "#8a8a93", margin: "2px 0 0 0" }}>
                  Visualização unificada de todas as cobranças disparadas por Nexus e respostas em tempo real dos clientes.
                </p>
              )}
            </div>
          </div>

          {/* Mini KPI Cards - Interactive */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              flexWrap: isMobile ? "nowrap" : "wrap",
              overflowX: isMobile ? "auto" : undefined,
              width: isMobile ? "100%" : undefined,
              paddingBottom: isMobile ? 4 : 0,
              scrollbarWidth: "none",
            }}
          >
            <div
              style={{
                padding: "8px 14px",
                background: "#1c1c22",
                border: "1px solid #2b2b36",
                borderRadius: 10,
                minWidth: 120,
                flexShrink: 0,
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
                flexShrink: 0,
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
              onClick={() => setFilter("replied")}
              style={{
                padding: "8px 14px",
                background: filter === "replied" ? "hsl(152 65% 45% / 0.15)" : "#1c1c22",
                border: filter === "replied" ? "1px solid hsl(152 65% 45% / 0.4)" : "1px solid #2b2b36",
                borderRadius: 10,
                minWidth: 130,
                cursor: "pointer",
                flexShrink: 0,
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
              onClick={() => setFilter("overdue")}
              style={{
                padding: "8px 14px",
                background: filter === "overdue" ? "hsl(0 70% 58% / 0.15)" : "#1c1c22",
                border: filter === "overdue" ? "1px solid hsl(0 70% 58% / 0.5)" : "1px solid #2b2b36",
                borderRadius: 10,
                minWidth: 140,
                cursor: "pointer",
                flexShrink: 0,
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
      )}

      {/* ─── iOS Banner (quando acessado via Safari no iPhone e não PWA) ─── */}
      {(!isMobile || !selectedTarget) && pushStatus?.isIOS && !pushStatus?.isStandalone && (
        <div
          style={{
            padding: isMobile ? "8px 16px" : "9px 24px",
            background: "linear-gradient(90deg, rgba(139, 92, 246, 0.2), rgba(59, 130, 246, 0.15))",
            borderBottom: "1px solid hsl(265 85% 62% / 0.35)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: isMobile ? 11 : 12,
            color: "#eaeaf0",
            gap: 12,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <BellRing size={16} style={{ color: "hsl(265 85% 68%)", flexShrink: 0 }} />
            <span>
              <strong>Dica para iPhone:</strong> Para receber notificações push com tela bloqueada, adicione à <strong>Tela de Início</strong> pelo Safari.
            </span>
          </div>
          <button
            onClick={() => setShowIosPushModal(true)}
            style={{
              padding: "4px 12px",
              borderRadius: 8,
              background: "hsl(265 85% 62%)",
              border: "none",
              color: "#fff",
              fontSize: 11,
              fontWeight: 600,
              cursor: "pointer",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            Instalar no iPhone
          </button>
        </div>
      )}

      {/* ─── Main Two/Three-Column Layout ─── */}
      <div style={{ display: "flex", flex: 1, minHeight: 0, overflow: "hidden", position: "relative" }}>
        {/* ─── Left Pane: Conversations List ─── */}
        <div
          style={{
            width: isMobile ? "100%" : 380,
            minWidth: isMobile ? "100%" : 320,
            maxWidth: isMobile ? "100%" : 420,
            borderRight: isMobile ? "none" : "1px solid #27272e",
            background: "#151518",
            display: isMobile && selectedTarget ? "none" : "flex",
            flexDirection: "column",
            height: "100%",
            flexShrink: 0,
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

            {/* Filter pills with dynamic counts & scrollable without truncation */}
            <div
              style={{
                display: "flex",
                gap: 6,
                overflowX: "auto",
                paddingBottom: 2,
                scrollbarWidth: "none",
              }}
            >
              {[
                { id: "all", label: `Todos (${filterCounts.all})` },
                { id: "partners", label: `👤 Sócios (${filterCounts.partners})` },
                { id: "clients", label: `👥 Clientes (${filterCounts.clients})` },
                { id: "replied", label: `💬 Respostas (${filterCounts.replied})` },
                { id: "waiting", label: `⏳ Aguardando (${filterCounts.waiting})` },
                { id: "overdue", label: `⚠️ Em Atraso (${filterCounts.overdue})` },
              ].map((tab) => {
                const active = filter === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setFilter(tab.id as any)}
                    style={{
                      padding: "5px 11px",
                      borderRadius: 16,
                      fontSize: 11,
                      fontWeight: active ? 700 : 500,
                      background: active ? "hsl(265 85% 62% / 0.25)" : "#202028",
                      color: active ? "#c4a3ff" : "#888",
                      border: active ? "1px solid hsl(265 85% 62% / 0.5)" : "1px solid #2c2c36",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
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
            ) : filteredConversations.length === 0 ? (
              <div style={{ padding: 40, textAlign: "center", color: "#777" }}>
                <MessageSquare size={36} style={{ margin: "0 auto 12px", opacity: 0.3 }} />
                <p style={{ fontSize: 14, fontWeight: 600, color: "#aaa", margin: "0 0 4px" }}>
                  {filter === "partners"
                    ? "Nenhum sócio encontrado"
                    : filter === "clients"
                    ? "Nenhum cliente encontrado"
                    : "Nenhuma conversa encontrada"}
                </p>
                <p style={{ fontSize: 12, margin: 0, color: "#666" }}>
                  {search ? "Tente outro termo de busca." : "Nenhuma conversa disponível nesta categoria."}
                </p>
              </div>
            ) : (
              filteredConversations.map((item) => {
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
                      <ContactAvatar
                        name={item.clientName}
                        photoUrl={item.photoUrl}
                        isPartner={item.isPartner}
                        isSelected={isSelected}
                        size={40}
                        hasReplied={item.hasReplied}
                      />

                      {/* Info */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 3 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0, flex: 1, marginRight: 6 }}>
                            <span
                              style={{
                                fontSize: 13,
                                fontWeight: isSelected ? 700 : 600,
                                color: isSelected ? "#fff" : "#eee",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {item.clientName}
                            </span>
                            {item.isPartner && (
                              <span
                                style={{
                                  fontSize: 9,
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  background: "hsl(265 85% 62% / 0.2)",
                                  border: "1px solid hsl(265 85% 62% / 0.4)",
                                  color: "#c4a3ff",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                  flexShrink: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <UserCheck size={9} />
                                {item.roleLabel || "Sócio"}
                              </span>
                            )}
                          </div>
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
                                item.lastMessage.senderName?.toLowerCase().includes("operador") || item.lastMessage.kind === "manual_chat" ? (
                                  <span style={{ color: "#38bdf8", flexShrink: 0 }}>📱 Você:</span>
                                ) : (
                                  <span style={{ color: "#a78bfa", flexShrink: 0 }}>🤖 Nexus:</span>
                                )
                              ) : item.isPartner ? (
                                <span style={{ color: "#c4a3ff", flexShrink: 0 }}>👤 Sócio:</span>
                              ) : (
                                <span style={{ color: "hsl(152 65% 55%)", flexShrink: 0 }}>💬 Cliente:</span>
                              )}
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{item.lastMessage.body}</span>
                            </>
                          ) : (
                            <span style={{ color: "#555", fontStyle: "italic" }}>
                              {item.isPartner ? "Canal direto com sócio" : "Nenhuma mensagem trocada ainda"}
                            </span>
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

        {/* ─── Center Pane: WhatsApp Chat Window ─── */}
        <div
          style={{
            flex: 1,
            display: isMobile && !selectedTarget ? "none" : "flex",
            flexDirection: "column",
            height: "100%",
            background: "#0d0d0f",
            minWidth: 0,
            width: isMobile ? "100%" : undefined,
          }}
        >
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
                  padding: isMobile ? "10px 14px" : "12px 20px",
                  background: "#18181c",
                  borderBottom: "1px solid #27272e",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                  flexShrink: 0,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 8 : 12, minWidth: 0 }}>
                  {isMobile && (
                    <button
                      onClick={() => setSelectedTarget(null)}
                      title="Voltar para a lista de conversas"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#c4a3ff",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        padding: "6px",
                        marginLeft: -6,
                        borderRadius: "50%",
                        flexShrink: 0,
                      }}
                    >
                      <ArrowLeft size={22} />
                    </button>
                  )}

                  <ContactAvatar
                    name={activeConversation?.clientName || "Contato"}
                    photoUrl={activeConversation?.photoUrl}
                    isPartner={activeConversation?.isPartner}
                    size={isMobile ? 38 : 42}
                  />

                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                      <span
                        style={{
                          fontSize: isMobile ? 14 : 15,
                          fontWeight: 700,
                          color: "#fff",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          maxWidth: isMobile ? 130 : 220,
                        }}
                      >
                        {activeConversation?.clientName || "Contato"}
                      </span>

                      {activeConversation?.isPartner ? (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "hsl(265 85% 62% / 0.2)",
                            border: "1px solid hsl(265 85% 62% / 0.4)",
                            color: "#c4a3ff",
                            fontWeight: 700,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          <UserCheck size={11} /> {activeConversation?.roleLabel || "Sócio da Teltech"}
                        </span>
                      ) : (
                        /* Interactive Opt-in Toggle for clients */
                        <button
                          onClick={handleToggleOptIn}
                          disabled={isTogglingOptIn}
                          title="Clique para alternar o consentimento de WhatsApp"
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: activeConversation?.optIn ? "hsl(152 65% 45% / 0.15)" : "#25252b",
                            border: activeConversation?.optIn ? "1px solid hsl(152 65% 45% / 0.4)" : "1px solid #33333d",
                            color: activeConversation?.optIn ? "hsl(152 65% 55%)" : "#888",
                            fontWeight: 600,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            cursor: "pointer",
                            transition: "all 0.15s ease",
                          }}
                        >
                          <Shield size={11} /> {activeConversation?.optIn ? "Opt-in Ativo" : "Sem Opt-in"}
                        </button>
                      )}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginTop: 2, fontSize: 11, color: "#888" }}>
                      <span>{formatPhoneDisplay(activeConversation?.phone || "")}</span>
                      {!isMobile && activeConversation?.document && <span>• CPF/CNPJ: {activeConversation.document}</span>}
                      {!isMobile && activeConversation?.isPartner && <span>• Canal Direto Teltech</span>}
                    </div>
                  </div>
                </div>

                {/* Right side header actions & Financial summary */}
                <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                  {!isMobile && openTransactions.length > 0 && (
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

                  {/* Cobrar via Nexus with Multi-Invoice Dropdown */}
                  {openTransactions.length > 0 && (
                    <div style={{ position: "relative" }}>
                      <button
                        onClick={() => setShowInvoiceSelector(!showInvoiceSelector)}
                        disabled={isTriggeringBilling}
                        title="Selecione qual fatura disparar para o cliente"
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          padding: isMobile ? "6px 10px" : "8px 12px",
                          borderRadius: 8,
                          background: "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 52%))",
                          border: "none",
                          color: "#fff",
                          fontSize: isMobile ? 11 : 12,
                          fontWeight: 600,
                          cursor: isTriggeringBilling ? "not-allowed" : "pointer",
                          boxShadow: "0 0 16px hsl(265 85% 62% / 0.35)",
                        }}
                      >
                        <Zap size={14} />
                        {isMobile
                          ? (isTriggeringBilling ? "..." : "Cobrar")
                          : (isTriggeringBilling ? "Disparando..." : `Cobrar via Nexus (${openTransactions.length})`)}
                        <ChevronDown size={13} />
                      </button>

                      {/* Dropdown to pick which invoice to charge */}
                      <AnimatePresence>
                        {showInvoiceSelector && (
                          <motion.div
                            initial={{ opacity: 0, y: 5 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 5 }}
                            style={{
                              position: "absolute",
                              right: 0,
                              top: "100%",
                              marginTop: 6,
                              width: isMobile ? 260 : 290,
                              background: "#1c1c24",
                              border: "1px solid #323242",
                              borderRadius: 10,
                              padding: 8,
                              boxShadow: "0 10px 30px rgba(0,0,0,0.6)",
                              zIndex: 50,
                            }}
                          >
                            <div style={{ fontSize: 11, fontWeight: 700, color: "#9ca3af", padding: "4px 8px 8px" }}>
                              Selecione a fatura para disparar:
                            </div>
                            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
                              {openTransactions.map((tx) => {
                                const isOverdue = new Date(tx.dueDate) < new Date();
                                return (
                                  <div
                                    key={tx.id}
                                    onClick={() => handleTriggerBilling(tx.id)}
                                    style={{
                                      padding: "8px 10px",
                                      borderRadius: 6,
                                      background: "#242430",
                                      border: "1px solid #2e2e3e",
                                      cursor: "pointer",
                                      transition: "all 0.15s ease",
                                    }}
                                    onMouseEnter={(e) => (e.currentTarget.style.borderColor = "hsl(265 85% 62% / 0.5)")}
                                    onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#2e2e3e")}
                                  >
                                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <span style={{ fontSize: 11, fontWeight: 600, color: "#fff" }}>
                                        {tx.description || "Fatura"}
                                      </span>
                                      <span style={{ fontSize: 11, fontWeight: 700, color: "#c4a3ff" }}>
                                        {formatCents(tx.amount)}
                                      </span>
                                    </div>
                                    <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10 }}>
                                      <span style={{ color: isOverdue ? "#ff7b7b" : "#888" }}>
                                        Venc: {new Date(tx.dueDate).toLocaleDateString("pt-BR")}
                                      </span>
                                      <span style={{ color: "hsl(265 85% 62%)", fontWeight: 700 }}>
                                        Disparar Pix ➔
                                      </span>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Client 360° Drawer Toggle Button */}
                  <button
                    onClick={() => setShowClientDrawer(!showClientDrawer)}
                    title="Abrir painel 360° com histórico de faturas e baixas"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 4,
                      background: showClientDrawer ? "hsl(265 85% 62% / 0.2)" : "#22222a",
                      border: showClientDrawer ? "1px solid hsl(265 85% 62% / 0.5)" : "1px solid #333342",
                      color: showClientDrawer ? "#c4a3ff" : "#ccc",
                      padding: isMobile ? "6px 10px" : "8px 12px",
                      borderRadius: 8,
                      fontSize: isMobile ? 11 : 12,
                      fontWeight: 600,
                      cursor: "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <SlidersHorizontal size={14} />
                    {isMobile ? "360°" : "Painel 360°"}
                  </button>

                  <button
                    onClick={() => fetchMessages(selectedTarget)}
                    title="Recarregar histórico de mensagens"
                    style={{
                      background: "#22222a",
                      border: "1px solid #333342",
                      color: "#aaa",
                      padding: isMobile ? 6 : 8,
                      borderRadius: 8,
                      cursor: "pointer",
                    }}
                  >
                    <RefreshCw size={14} />
                  </button>
                </div>
              </div>

              {/* Chat Messages Timeline */}
              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: isMobile ? "12px 10px" : "20px 24px",
                  display: "flex",
                  flexDirection: "column",
                  gap: isMobile ? 10 : 14,
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
                            maxWidth: isMobile ? "88%" : "75%",
                            minWidth: isMobile ? 180 : 260,
                            borderRadius: 14,
                            padding: isMobile ? "10px 12px" : "12px 16px",
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
                                msg.senderName?.toLowerCase().includes("operador") || msg.kind === "manual_chat" ? (
                                  <>
                                    <Smartphone size={14} color="#38bdf8" />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#7dd3fc" }}>
                                      {msg.senderName || "Operador (Celular)"}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <Bot size={14} color="#c4a3ff" />
                                    <span style={{ fontSize: 11, fontWeight: 700, color: "#d6beff" }}>
                                      {msg.senderName || "Nexus (Teltech)"}
                                    </span>
                                  </>
                                )
                              ) : (activeConversation?.isPartner || msg.kind === "partner_reply") ? (
                                <>
                                  <UserCheck size={14} color="#a78bfa" />
                                  <span style={{ fontSize: 11, fontWeight: 700, color: "#c4a3ff" }}>
                                    {msg.senderName || activeConversation?.clientName || "Sócio"}
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

                          {/* Message Body, Media Player (Audio, Video, Photo, PDF, Document) or WhatsApp Markup */}
                          {(() => {
                            const isAudio = msg.mediaType === "audio" || msg.body?.includes("[Mensagem de Áudio]") || msg.body?.includes("[Áudio]");
                            const isVideo = msg.mediaType === "video" || msg.body?.includes("[Vídeo]");
                            const isImage = msg.mediaType === "image" || msg.body?.includes("[Foto]") || msg.body?.includes("[Imagem");
                            const isDoc = msg.mediaType === "document" || msg.body?.includes("[Documento") || msg.body?.includes("[PDF");

                            if (isAudio) {
                              return (
                                <WhatsAppAudioPlayer
                                  src={msg.mediaUrl}
                                  durationSec={msg.mediaDuration}
                                  isOutbound={isOutbound}
                                />
                              );
                            }

                            if (isVideo) {
                              const caption = msg.body && !msg.body.startsWith("[Vídeo]") ? msg.body : undefined;
                              return (
                                <WhatsAppVideoPlayer
                                  src={msg.mediaUrl}
                                  caption={caption}
                                  isOutbound={isOutbound}
                                />
                              );
                            }

                            if (isImage) {
                              const caption = msg.body && !msg.body.startsWith("[Foto]") && !msg.body.startsWith("[Imagem") ? msg.body : undefined;
                              return (
                                <WhatsAppImageViewer
                                  src={msg.mediaUrl}
                                  caption={caption}
                                  isOutbound={isOutbound}
                                  onOpenLightbox={(src, cap) => setLightboxImage({ src, caption: cap })}
                                />
                              );
                            }

                            if (isDoc) {
                              const caption = msg.body && !msg.body.startsWith("[Documento") && !msg.body.startsWith("[PDF") ? msg.body : undefined;
                              return (
                                <WhatsAppDocumentCard
                                  src={msg.mediaUrl}
                                  filename={msg.mediaFilename}
                                  size={msg.mediaSize}
                                  caption={caption}
                                  isOutbound={isOutbound}
                                />
                              );
                            }

                            return <FormattedWhatsAppBody text={msg.body} amount={msg.transaction?.amount} />;
                          })()}

                          {/* Embedded Linked Transaction Card with Quick Mark-Paid Button */}
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
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
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

                                {msg.transaction.status !== "paid" && (
                                  <button
                                    onClick={() => handleMarkPaid(msg.transaction!.id)}
                                    disabled={Boolean(isMarkingPaid)}
                                    title="Marcar como recebido e enviar recibo de quitação"
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      background: "hsl(152 65% 45% / 0.2)",
                                      border: "1px solid hsl(152 65% 45% / 0.5)",
                                      color: "hsl(152 65% 60%)",
                                      fontSize: 10,
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    {isMarkingPaid === msg.transaction.id ? "Baixando..." : "Dar Baixa"}
                                  </button>
                                )}
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

              {/* Chat Input Bar & Dynamic Quick Replies */}
              <div
                style={{
                  padding: isMobile ? "8px 10px max(10px, env(safe-area-inset-bottom))" : "12px 20px 16px",
                  background: "#16161a",
                  borderTop: "1px solid #27272e",
                  display: "flex",
                  flexDirection: "column",
                  gap: 10,
                }}
              >
                {/* Quick Reply Pills */}
                <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 2, scrollbarWidth: "none" }}>
                  {[
                    "👋 Olá! Segue o lembrete da sua fatura.",
                    "🔑 Segue a nossa chave Pix para pagamento:",
                    "📄 Pode nos enviar o comprovante por aqui?",
                    "🤝 Conseguimos negociar um novo prazo caso precise.",
                    "✅ Pagamento confirmado com sucesso! Muito obrigado.",
                  ].map((phrase, i) => (
                    <button
                      key={i}
                      onClick={() => handleSendMessage(phrase)}
                      disabled={isSending}
                      style={{
                        padding: "5px 12px",
                        borderRadius: 14,
                        background: "#22222a",
                        border: "1px solid #2f2f3c",
                        color: "#aaa",
                        fontSize: 11,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
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

                {/* Selected Attachment Preview Card */}
                {selectedAttachment && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "8px 12px",
                      borderRadius: 10,
                      background: "rgba(255,255,255,0.05)",
                      border: "1px solid hsl(265 85% 62% / 0.4)",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
                      {selectedAttachment.type === "image" ? (
                        <img
                          src={selectedAttachment.previewUrl}
                          alt="Preview"
                          style={{ width: 36, height: 36, borderRadius: 6, objectFit: "cover" }}
                        />
                      ) : selectedAttachment.type === "video" ? (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(168, 85, 247, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#c4a3ff" }}>
                          <Film size={18} />
                        </div>
                      ) : selectedAttachment.type === "audio" ? (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(16, 185, 129, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#34d399" }}>
                          <Mic size={18} />
                        </div>
                      ) : (
                        <div style={{ width: 36, height: 36, borderRadius: 6, background: "rgba(59, 130, 246, 0.2)", display: "flex", alignItems: "center", justifyContent: "center", color: "#60a5fa" }}>
                          <FileText size={18} />
                        </div>
                      )}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 12, fontWeight: 600, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {selectedAttachment.file.name}
                        </div>
                        <div style={{ fontSize: 10, color: "#888" }}>
                          {formatFileSize(selectedAttachment.file.size)} • Pronto para enviar
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={handleClearAttachment}
                      title="Remover anexo"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#aaa",
                        cursor: "pointer",
                        padding: 4,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.color = "#f87171")}
                      onMouseLeave={(e) => (e.currentTarget.style.color = "#aaa")}
                    >
                      <X size={16} />
                    </button>
                  </div>
                )}

                {/* Main Input Textarea & Send button */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-end",
                    gap: isMobile ? 6 : 10,
                    background: "#1d1d24",
                    border: "1px solid #31313e",
                    borderRadius: 12,
                    padding: "8px 12px",
                  }}
                >
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleSelectAttachment}
                    accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.zip"
                    style={{ display: "none" }}
                  />

                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isSending}
                    title="Anexar foto, vídeo, áudio, PDF ou documento"
                    style={{
                      width: 38,
                      height: 38,
                      borderRadius: 8,
                      background: selectedAttachment ? "hsl(265 85% 62% / 0.25)" : "transparent",
                      border: selectedAttachment ? "1px solid hsl(265 85% 62% / 0.5)" : "none",
                      color: selectedAttachment ? "#c4a3ff" : "#888",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                    onMouseEnter={(e) => {
                      if (!selectedAttachment) e.currentTarget.style.color = "#c4a3ff";
                    }}
                    onMouseLeave={(e) => {
                      if (!selectedAttachment) e.currentTarget.style.color = "#888";
                    }}
                  >
                    <Paperclip size={18} />
                  </button>

                  <textarea
                    rows={2}
                    placeholder={selectedAttachment ? "Adicione uma legenda..." : "Digite uma mensagem (Nexus enviará via WhatsApp)..."}
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
                      fontSize: isMobile ? 16 : 13,
                      resize: "none",
                      lineHeight: 1.4,
                    }}
                  />

                  <button
                    onClick={() => handleSendMessage()}
                    disabled={(!messageInput.trim() && !selectedAttachment) || isSending}
                    style={{
                      width: 40,
                      height: 40,
                      borderRadius: 10,
                      background: (messageInput.trim() || selectedAttachment)
                        ? "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 50%))"
                        : "#282832",
                      border: "none",
                      color: (messageInput.trim() || selectedAttachment) ? "#fff" : "#666",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      cursor: (messageInput.trim() || selectedAttachment) && !isSending ? "pointer" : "not-allowed",
                      boxShadow: (messageInput.trim() || selectedAttachment) ? "0 0 16px hsl(265 85% 62% / 0.4)" : "none",
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

        {/* ─── Right Drawer: Painel 360° do Cliente ─── */}
        <AnimatePresence>
          {showClientDrawer && selectedTarget && (
            <motion.div
              initial={isMobile ? { x: "100%", opacity: 0 } : { width: 0, opacity: 0 }}
              animate={isMobile ? { x: 0, opacity: 1 } : { width: 340, opacity: 1 }}
              exit={isMobile ? { x: "100%", opacity: 0 } : { width: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              style={
                isMobile
                  ? {
                      position: "fixed",
                      inset: 0,
                      zIndex: 9999,
                      background: "#16161b",
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      width: "100%",
                      overflow: "hidden",
                    }
                  : {
                      width: 340,
                      borderLeft: "1px solid #27272e",
                      background: "#16161b",
                      display: "flex",
                      flexDirection: "column",
                      height: "100%",
                      overflow: "hidden",
                    }
              }
            >
              {/* Drawer Header */}
              <div
                style={{
                  padding: "16px 20px",
                  borderBottom: "1px solid #252530",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {activeConversation?.isPartner ? (
                    <>
                      <UserCheck size={16} color="#c4a3ff" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Raio-X do Sócio</span>
                    </>
                  ) : (
                    <>
                      <SlidersHorizontal size={16} color="#c4a3ff" />
                      <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>Raio-X do Cliente</span>
                    </>
                  )}
                </div>
                <button
                  onClick={() => setShowClientDrawer(false)}
                  style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Drawer Content */}
              <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 16 }}>
                {activeConversation?.isPartner ? (
                  <>
                    {/* Partner Profile Card */}
                    <div
                      style={{
                        padding: 14,
                        background: "#1c1c24",
                        borderRadius: 10,
                        border: "1px solid #2b2b38",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ContactAvatar
                          name={activeConversation.clientName}
                          photoUrl={activeConversation.photoUrl}
                          isPartner={true}
                          size={46}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                            <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {activeConversation.clientName}
                            </div>
                            <span
                              style={{
                                fontSize: 9,
                                padding: "2px 7px",
                                borderRadius: 10,
                                background: "hsl(265 85% 62% / 0.2)",
                                color: "#c4a3ff",
                                fontWeight: 700,
                                border: "1px solid hsl(265 85% 62% / 0.4)",
                                flexShrink: 0,
                              }}
                            >
                              {activeConversation.roleLabel || "Sócio"}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                            {formatPhoneDisplay(activeConversation.phone || "")}
                          </div>
                          {activeConversation.nickname && (
                            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                              Apelido: {activeConversation.nickname}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #272734", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#888" }}>Status no Grupo</span>
                        <span style={{ fontSize: 11, fontWeight: 600, color: "hsl(152 65% 55%)" }}>
                          ✓ Ativo no Teltech Group
                        </span>
                      </div>
                    </div>

                    {/* Partner Financial Summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ padding: 10, background: "#1c1c24", borderRadius: 8, border: "1px solid #2b2b38" }}>
                        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Retiradas / Saídas</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0 70% 65%)", marginTop: 2 }}>
                          {formatCents(allTransactions.filter((t) => t.type === "outflow").reduce((a, b) => a + b.amount, 0))}
                        </div>
                      </div>
                      <div style={{ padding: 10, background: "#1c1c24", borderRadius: 8, border: "1px solid #2b2b38" }}>
                        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Movimentações</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#c4a3ff", marginTop: 2 }}>
                          {allTransactions.length} registro(s)
                        </div>
                      </div>
                    </div>

                    {/* Partner Transactions List */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#ddd", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                        <span>Lançamentos Vinculados ({allTransactions.length})</span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {allTransactions.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#777", textAlign: "center", padding: 16 }}>
                            Nenhum lançamento financeiro vinculado a este sócio ainda.
                          </div>
                        ) : (
                          allTransactions.map((tx) => {
                            const isOutflow = tx.type === "outflow";
                            return (
                              <div
                                key={tx.id}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: 8,
                                  background: "#1c1c24",
                                  border: "1px solid #2b2b38",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "#eee" }}>
                                      {tx.description || "Movimentação"}
                                    </div>
                                    <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>
                                      {new Date(tx.dueDate || (tx as any).createdAt).toLocaleDateString("pt-BR")}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isOutflow ? "hsl(0 70% 65%)" : "hsl(152 65% 55%)" }}>
                                      {isOutflow ? "- " : "+ "}{formatCents(tx.amount)}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 9,
                                        padding: "1px 5px",
                                        borderRadius: 4,
                                        background: tx.status === "paid" ? "hsl(152 65% 45% / 0.2)" : "#282835",
                                        color: tx.status === "paid" ? "hsl(152 65% 60%)" : "#aaa",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {tx.status === "paid" ? "Liquidado" : tx.status}
                                    </span>
                                  </div>
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    {/* Client Profile Card */}
                    <div
                      style={{
                        padding: 14,
                        background: "#1c1c24",
                        borderRadius: 10,
                        border: "1px solid #2b2b38",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                        <ContactAvatar
                          name={activeConversation?.clientName || "Cliente"}
                          photoUrl={activeConversation?.photoUrl}
                          isPartner={false}
                          size={46}
                        />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {activeConversation?.clientName}
                          </div>
                          <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                            {formatPhoneDisplay(activeConversation?.phone || "")}
                          </div>
                          {activeConversation?.document && (
                            <div style={{ fontSize: 11, color: "#aaa", marginTop: 2 }}>
                              Doc: {activeConversation.document}
                            </div>
                          )}
                        </div>
                      </div>

                      <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #272734", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 11, color: "#888" }}>WhatsApp Opt-in</span>
                        <button
                          onClick={handleToggleOptIn}
                          style={{
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: activeConversation?.optIn ? "hsl(152 65% 45% / 0.2)" : "#2a2a36",
                            border: "none",
                            color: activeConversation?.optIn ? "hsl(152 65% 55%)" : "#888",
                            fontSize: 10,
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {activeConversation?.optIn ? "Ativo" : "Inativo"}
                        </button>
                      </div>
                    </div>

                    {/* Financial Summary */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div style={{ padding: 10, background: "#1c1c24", borderRadius: 8, border: "1px solid #2b2b38" }}>
                        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Total Aberto</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "#c4a3ff", marginTop: 2 }}>
                          {formatCents(allTransactions.filter((t) => t.status === "pending").reduce((a, b) => a + b.amount, 0))}
                        </div>
                      </div>
                      <div style={{ padding: 10, background: "#1c1c24", borderRadius: 8, border: "1px solid #2b2b38" }}>
                        <div style={{ fontSize: 10, color: "#888", textTransform: "uppercase", fontWeight: 700 }}>Em Atraso</div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "hsl(0 70% 65%)", marginTop: 2 }}>
                          {formatCents(allTransactions.filter((t) => t.status === "pending" && new Date(t.dueDate) < new Date()).reduce((a, b) => a + b.amount, 0))}
                        </div>
                      </div>
                    </div>

                    {/* Invoices List */}
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: "#ddd", marginBottom: 8, display: "flex", justifyContent: "space-between" }}>
                        <span>Faturas ({allTransactions.length})</span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                        {allTransactions.length === 0 ? (
                          <div style={{ fontSize: 12, color: "#777", textAlign: "center", padding: 16 }}>
                            Nenhuma fatura registrada para este cliente.
                          </div>
                        ) : (
                          allTransactions.map((tx) => {
                            const isOverdue = tx.status === "pending" && new Date(tx.dueDate) < new Date();
                            const isPaid = tx.status === "paid";

                            return (
                              <div
                                key={tx.id}
                                style={{
                                  padding: "10px 12px",
                                  borderRadius: 8,
                                  background: isPaid ? "#171f1a" : "#1c1c24",
                                  border: isPaid
                                    ? "1px solid hsl(152 65% 45% / 0.3)"
                                    : isOverdue
                                    ? "1px solid hsl(0 70% 58% / 0.35)"
                                    : "1px solid #2b2b38",
                                }}
                              >
                                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                                  <div>
                                    <div style={{ fontSize: 12, fontWeight: 600, color: "#eee" }}>
                                      {tx.description || "Fatura"}
                                    </div>
                                    <div style={{ fontSize: 10, color: isOverdue ? "#ff7b7b" : "#888", marginTop: 2 }}>
                                      Vencimento: {new Date(tx.dueDate).toLocaleDateString("pt-BR")}
                                    </div>
                                  </div>
                                  <div style={{ textAlign: "right" }}>
                                    <div style={{ fontSize: 12, fontWeight: 700, color: isPaid ? "hsl(152 65% 55%)" : "#c4a3ff" }}>
                                      {formatCents(tx.amount)}
                                    </div>
                                    <span
                                      style={{
                                        fontSize: 9,
                                        padding: "1px 5px",
                                        borderRadius: 4,
                                        background: isPaid ? "hsl(152 65% 45% / 0.2)" : isOverdue ? "hsl(0 70% 58% / 0.2)" : "#282835",
                                        color: isPaid ? "hsl(152 65% 60%)" : isOverdue ? "hsl(0 70% 65%)" : "#aaa",
                                        fontWeight: 700,
                                        textTransform: "uppercase",
                                      }}
                                    >
                                      {isPaid ? "Pago" : isOverdue ? "Atrasado" : "Pendente"}
                                    </span>
                                  </div>
                                </div>

                                {/* Actions for Pending Invoices */}
                                {!isPaid && (
                                  <div style={{ display: "flex", gap: 6, marginTop: 10, paddingTop: 8, borderTop: "1px solid #282836" }}>
                                    <button
                                      onClick={() => handleTriggerBilling(tx.id)}
                                      disabled={isTriggeringBilling}
                                      title="Dispara cobrança com código Pix no WhatsApp"
                                      style={{
                                        flex: 1,
                                        padding: "5px 8px",
                                        borderRadius: 6,
                                        background: "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 52%))",
                                        border: "none",
                                        color: "#fff",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      ⚡ Cobrar Pix
                                    </button>
                                    <button
                                      onClick={() => handleMarkPaid(tx.id)}
                                      disabled={Boolean(isMarkingPaid)}
                                      title="Registra quitação e envia recibo automático"
                                      style={{
                                        flex: 1,
                                        padding: "5px 8px",
                                        borderRadius: 6,
                                        background: "hsl(152 65% 45% / 0.2)",
                                        border: "1px solid hsl(152 65% 45% / 0.4)",
                                        color: "hsl(152 65% 60%)",
                                        fontSize: 10,
                                        fontWeight: 700,
                                        cursor: "pointer",
                                      }}
                                    >
                                      {isMarkingPaid === tx.id ? "Baixando..." : "✅ Dar Baixa"}
                                    </button>
                                  </div>
                                )}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ─── WhatsApp Reconnection Modal ─── */}
      <AnimatePresence>
        {showReconnectModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 100,
              padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              style={{
                background: "#18181e",
                border: "1px solid #333342",
                borderRadius: 16,
                padding: 24,
                width: 380,
                maxWidth: "100%",
                boxShadow: "0 20px 50px rgba(0,0,0,0.8)",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                textAlign: "center",
              }}
            >
              <div style={{ width: "100%", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
                <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>Conexão WhatsApp Nexus</span>
                <button
                  onClick={() => setShowReconnectModal(false)}
                  style={{ background: "transparent", border: "none", color: "#888", cursor: "pointer" }}
                >
                  <X size={18} />
                </button>
              </div>

              {stats?.status.connected ? (
                <div style={{ padding: "20px 0" }}>
                  <CheckCircle2 size={48} color="hsl(152 65% 55%)" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>WhatsApp Conectado!</div>
                  <div style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    Número pareado: {formatPhoneDisplay(stats.status.phone || "")}
                  </div>
                </div>
              ) : stats?.status.qr ? (
                <div style={{ padding: "10px 0" }}>
                  <div style={{ padding: 12, background: "#fff", borderRadius: 12, display: "inline-block", boxShadow: "0 4px 20px rgba(0,0,0,0.5)" }}>
                    <img src={stats.status.qr} alt="QR Code WhatsApp" style={{ width: 220, height: 220, display: "block" }} />
                  </div>
                  <p style={{ fontSize: 12, color: "#aaa", marginTop: 12 }}>
                    Abra o WhatsApp no celular ➔ Aparelhos Conectados ➔ Conectar Aparelho e aponte para o código.
                  </p>
                </div>
              ) : (
                <div style={{ padding: "20px 0" }}>
                  <Bot size={44} color="#c4a3ff" style={{ margin: "0 auto 12px" }} />
                  <div style={{ fontSize: 14, fontWeight: 600, color: "#eee" }}>WhatsApp está desconectado</div>
                  <p style={{ fontSize: 12, color: "#888", marginTop: 4 }}>
                    Clique no botão abaixo para gerar um novo QR Code de conexão.
                  </p>
                  <button
                    onClick={handleReconnectWhatsApp}
                    disabled={isReconnecting}
                    style={{
                      marginTop: 14,
                      padding: "9px 18px",
                      borderRadius: 8,
                      background: "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 52%))",
                      border: "none",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    <RefreshCw size={14} className={isReconnecting ? "animate-spin" : ""} />
                    {isReconnecting ? "Solicitando..." : "Gerar QR Code Agora"}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Lightbox Modal para Visualização de Imagens ─── */}
      <AnimatePresence>
        {lightboxImage && (
          <div
            onClick={() => setLightboxImage(null)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.88)",
              backdropFilter: "blur(8px)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              zIndex: 200,
              padding: 24,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                maxWidth: "90vw",
                maxHeight: "85vh",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                position: "relative",
              }}
            >
              <div style={{ alignSelf: "flex-end", display: "flex", gap: 10, marginBottom: 10 }}>
                <a
                  href={lightboxImage.src}
                  download="imagem-whatsapp.jpg"
                  style={{
                    padding: "8px 14px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.15)",
                    color: "#fff",
                    textDecoration: "none",
                    fontSize: 12,
                    fontWeight: 600,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  <Download size={15} /> Baixar
                </a>
                <button
                  onClick={() => setLightboxImage(null)}
                  style={{
                    padding: "8px 12px",
                    borderRadius: 8,
                    background: "rgba(255,255,255,0.15)",
                    border: "none",
                    color: "#fff",
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <img
                src={lightboxImage.src}
                alt="Visualização"
                style={{
                  maxWidth: "100%",
                  maxHeight: "75vh",
                  borderRadius: 12,
                  boxShadow: "0 25px 60px rgba(0,0,0,0.9)",
                  objectFit: "contain",
                }}
              />

              {lightboxImage.caption && (
                <div
                  style={{
                    marginTop: 12,
                    padding: "8px 16px",
                    borderRadius: 8,
                    background: "rgba(0,0,0,0.6)",
                    color: "#eee",
                    fontSize: 13,
                    maxWidth: "80%",
                    textAlign: "center",
                  }}
                >
                  {lightboxImage.caption}
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ─── Modal Guia iPhone Web Push ─── */}
      <AnimatePresence>
        {showIosPushModal && (
          <div
            style={{
              position: "fixed",
              inset: 0,
              zIndex: 10000,
              background: "rgba(0, 0, 0, 0.75)",
              backdropFilter: "blur(6px)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: 20,
            }}
            onClick={() => setShowIosPushModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              onClick={(e) => e.stopPropagation()}
              style={{
                width: "100%",
                maxWidth: 480,
                background: "#16161b",
                border: "1px solid #2e2e38",
                borderRadius: 16,
                padding: 24,
                boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 36,
                      height: 36,
                      borderRadius: 10,
                      background: "hsl(265 85% 62% / 0.2)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "hsl(265 85% 65%)",
                    }}
                  >
                    <BellRing size={20} />
                  </div>
                  <div>
                    <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                      Notificações no iPhone
                    </h3>
                    <p style={{ margin: 0, fontSize: 12, color: "#888" }}>
                      Requisito da Apple para Web Push nativo no iOS 16.4+
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setShowIosPushModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#888",
                    cursor: "pointer",
                    padding: 4,
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div style={{ fontSize: 13, color: "#ccc", lineHeight: 1.6 }}>
                A Apple só permite que aplicativos web enviem notificações push reais (que tocam e vibram com tela bloqueada) quando adicionados à Tela de Início.
              </div>

              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  gap: 12,
                  background: "#101014",
                  border: "1px solid #22222a",
                  borderRadius: 12,
                  padding: 16,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: "hsl(265 85% 62%)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    1
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>Abra no Safari</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      Certifique-se de estar acessando pelo navegador <strong>Safari</strong> do iPhone.
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: "hsl(265 85% 62%)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    2
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>Toque em Compartilhar</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      Na barra inferior do Safari, toque no ícone de <strong>Compartilhar</strong> (quadrado com seta para cima).
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: "hsl(265 85% 62%)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    3
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>Adicionar à Tela de Início</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      Role a lista e toque em <strong>"Adicionar à Tela de Início"</strong>.
                    </div>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <span
                    style={{
                      width: 22,
                      height: 22,
                      borderRadius: 11,
                      background: "hsl(152 65% 45%)",
                      color: "#fff",
                      fontSize: 12,
                      fontWeight: 700,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    4
                  </span>
                  <div>
                    <div style={{ fontWeight: 600, color: "#fff", fontSize: 13 }}>Abra o App e Ative</div>
                    <div style={{ fontSize: 12, color: "#999" }}>
                      Abra o Teltech pelo ícone criado na tela inicial e toque em <strong>"Ativar Push Celular"</strong>.
                    </div>
                  </div>
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button
                  onClick={() => setShowIosPushModal(false)}
                  style={{
                    padding: "8px 18px",
                    borderRadius: 10,
                    background: "hsl(265 85% 62%)",
                    border: "none",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Entendi
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default MonitoramentoPage;
