import React, { useEffect, useState, useContext } from "react";
import { useLocation } from "wouter";
import { API } from "../lib/api";
import { useAuth } from "../lib/auth-context";
import { 
  CalendarCheck, 
  AlertTriangle, 
  CheckCircle2, 
  FolderKanban,
  Plus,
  Folder,
  CheckSquare,
  Clock,
  DollarSign,
  ChevronRight,
  ArrowUpRight
} from "lucide-react";
import { AppContext } from "../TeltechLedger";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface IncomingInstallment {
  id: string;
  description: string;
  amount: number;
  dueDate: string;
  status: string;
  installmentNumber?: number;
  installmentsTotal?: number;
  revenueType?: string;
  paymentMethod?: string;
  clientName?: string;
  projectName?: string;
  projectColor?: string;
  urgencyGroup: "overdue" | "today" | "upcoming_month" | "future_later";
}

interface DashboardData {
  welcomeData: {
    name: string;
    date: string;
  };
  todaysTasks: any[];
  allPendingTasks?: any[];
  todaysStrictCount?: number;
  showingFallbackTasks?: boolean;
  overdueTasksCount: number;
  completedTodayCount: number;
  totalActiveProjectsCount: number;
  recentActivity: any[];
  incomingInstallments?: IncomingInstallment[];
  incomingInstallmentsSummary?: {
    overdueCount: number;
    todayCount: number;
    monthUpcomingCount: number;
    futureLaterCount: number;
    totalCount: number;
    totalAmountCents: number;
  };
}

export function InicioPage() {
  const { user } = useAuth();
  const [, navigate] = useLocation();
  const { setSidebarModule, projects } = useContext(AppContext);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [vencimentoFilter, setVencimentoFilter] = useState<"todos" | "overdue" | "today" | "upcoming">("todos");
  const [showAllTasks, setShowAllTasks] = useState(false);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await API.get("/dashboard");
        setData(response);
      } catch (error) {
        console.error("Failed to load dashboard data", error);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, []);

  if (loading || !data) {
    return (
      <div style={{ flex: 1, display: "flex", justifyContent: "center", alignItems: "center", color: "#888" }}>
        Carregando...
      </div>
    );
  }

  const hour = new Date().getHours();
  let greeting = "Bom dia";
  if (hour >= 12 && hour < 18) greeting = "Boa tarde";
  else if (hour >= 18) greeting = "Boa noite";

  const formattedDate = format(new Date(), "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
  // Capitalize first letter of day
  const displayDate = formattedDate.charAt(0).toUpperCase() + formattedDate.slice(1);

  const formatBRL = (cents: number) => {
    return new Intl.NumberFormat("pt-BR", {
      style: "currency",
      currency: "BRL",
    }).format((cents || 0) / 100);
  };

  const allInstallments = data.incomingInstallments || [];
  const overdueCount = data.incomingInstallmentsSummary?.overdueCount ?? allInstallments.filter(i => i.urgencyGroup === "overdue").length;
  const todayCount = data.incomingInstallmentsSummary?.todayCount ?? allInstallments.filter(i => i.urgencyGroup === "today").length;
  const monthUpcomingCount = data.incomingInstallmentsSummary?.monthUpcomingCount ?? allInstallments.filter(i => i.urgencyGroup === "upcoming_month").length;

  const filteredInstallments = allInstallments.filter(item => {
    if (vencimentoFilter === "overdue") return item.urgencyGroup === "overdue";
    if (vencimentoFilter === "today") return item.urgencyGroup === "today";
    if (vencimentoFilter === "upcoming") return item.urgencyGroup === "upcoming_month" || item.urgencyGroup === "future_later";
    return true;
  });

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "urgent": return "#ef4444";
      case "high": return "#f59e0b";
      case "normal": return "#3b82f6";
      case "low": return "#888";
      default: return "#888";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "urgent": return "Urgente";
      case "high": return "Alta";
      case "normal": return "Normal";
      case "low": return "Baixa";
      default: return "Normal";
    }
  };

  const todayDateKey = format(new Date(), "yyyy-MM-dd");
  const formatTaskDueInfo = (task: any) => {
    if (!task.dueDate) {
      return { label: "Sem prazo", color: "#71717a" };
    }
    const dateKey = new Date(task.dueDate).toISOString().slice(0, 10);
    const parsedDate = new Date(dateKey + "T12:00:00");
    const shortDate = format(parsedDate, "dd 'de' MMM", { locale: ptBR });

    if (dateKey === todayDateKey) {
      return { label: "Hoje", color: "#f59e0b" };
    }
    if (dateKey < todayDateKey) {
      return { label: `Atrasada • ${shortDate}`, color: "#ef4444" };
    }
    return { label: shortDate, color: "#a1a1aa" };
  };

  const displayedTasks = showAllTasks && data.allPendingTasks
    ? data.allPendingTasks
    : data.todaysTasks;

  return (
    <div className="responsive-page-pad" style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#111111",
      color: "#e0e0e0",
      overflowY: "auto",
      padding: "clamp(16px, 3vw, 32px)",
      gap: "24px",
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif",
      WebkitOverflowScrolling: "touch"
    }}>
      {/* Welcome Banner */}
      <div style={{
        position: "relative",
        padding: "clamp(18px, 3vw, 32px)",
        borderRadius: "16px",
        border: "1px solid #242424",
        backgroundColor: "#1a1a1a",
        overflow: "hidden",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "16px"
      }}>
        {/* Mesh Gradient Background */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "radial-gradient(circle at 15% 50%, rgba(124, 90, 194, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.1), transparent 25%)",
          zIndex: 0
        }} />

        <div style={{
          position: "relative",
          zIndex: 1,
          display: "flex",
          alignItems: "center",
          gap: "clamp(14px, 3vw, 22px)",
          minWidth: 0
        }}>
          {/* User Profile Avatar */}
          <div style={{
            width: "clamp(64px, 9vw, 82px)",
            height: "clamp(64px, 9vw, 82px)",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #7C5AC2 0%, #4F2D8A 100%)",
            border: "3px solid rgba(124, 90, 194, 0.4)",
            boxShadow: "0 8px 24px rgba(124, 90, 194, 0.3)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0
          }}>
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.name || "Foto de perfil"}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
              />
            ) : (
              <span style={{ fontSize: "clamp(26px, 4vw, 36px)", fontWeight: 700, color: "#fff" }}>
                {(user?.name || data.welcomeData.name || "U")[0]?.toUpperCase()}
              </span>
            )}
          </div>

          <div>
            <h1 style={{ margin: "0 0 6px 0", fontSize: "clamp(22px, 3.5vw, 28px)", fontWeight: "600", color: "#fafafa", lineHeight: 1.2 }}>
              {greeting}, {user?.name?.split(" ")[0] || data.welcomeData.name?.split(" ")[0] || "Usuário"}!
            </h1>
            <p style={{ margin: 0, color: "#888", fontSize: "15px" }}>
              {displayDate}
            </p>
            <p style={{ margin: "6px 0 0 0", color: "#a1a1aa", fontSize: "14px" }}>
              Aqui está o resumo do seu dia.
            </p>
          </div>
        </div>

        {/* Quick Actions */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <button style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "#2b2b2e",
            border: "1px solid #313136",
            borderRadius: "8px",
            color: "#e0e0e0",
            cursor: "pointer",
            fontWeight: "500",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#35353a"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#2b2b2e"}
          >
            <Plus size={18} />
            <span>Nova Tarefa</span>
          </button>
          
          <button 
            onClick={() => {
              if (projects && projects.length > 0) {
                navigate(`/projetos/${projects[0].id}/quadros`);
              } else {
                navigate("/projetos");
              }
            }}
            style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "#2b2b2e",
            border: "1px solid #313136",
            borderRadius: "8px",
            color: "#e0e0e0",
            cursor: "pointer",
            fontWeight: "500",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => e.currentTarget.style.backgroundColor = "#35353a"}
          onMouseOut={(e) => e.currentTarget.style.backgroundColor = "#2b2b2e"}
          >
            <Folder size={18} />
            <span>Ver Projetos</span>
          </button>

          <button 
            onClick={() => navigate("/minhas-tarefas")}
            style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            padding: "10px 16px",
            backgroundColor: "#7C5AC2",
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
            cursor: "pointer",
            fontWeight: "500",
            transition: "all 0.2s"
          }}
          onMouseOver={(e) => {
            e.currentTarget.style.boxShadow = "0 0 20px rgba(124,90,194,0.3)";
            e.currentTarget.style.transform = "translateY(-1px)";
          }}
          onMouseOut={(e) => {
            e.currentTarget.style.boxShadow = "none";
            e.currentTarget.style.transform = "none";
          }}
          >
            <CheckSquare size={18} />
            <span>Minhas Tarefas</span>
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "14px" }}>
        {/* Card 1 */}
        <div style={{
          backgroundColor: "#161618",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          transition: "all 0.3s cursor-pointer"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = "#313136";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(124,90,194,0.05)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = "#242424";
          e.currentTarget.style.boxShadow = "none";
        }}
        >
          <div style={{ backgroundColor: "rgba(124, 90, 194, 0.1)", padding: "12px", borderRadius: "10px", color: "#7C5AC2" }}>
            <CalendarCheck size={24} />
          </div>
          <div>
            <p style={{ margin: "0 0 4px 0", color: "#888", fontSize: "14px" }}>Tarefas para Hoje</p>
            <p style={{ margin: 0, color: "#e0e0e0", fontSize: "24px", fontWeight: "600" }}>{data.todaysTasks.length}</p>
          </div>
        </div>

        {/* Card 2 */}
        <div style={{
          backgroundColor: "#161618",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          transition: "all 0.3s cursor-pointer"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = "#313136";
          e.currentTarget.style.boxShadow = data.overdueTasksCount > 0 ? "0 0 20px rgba(239, 68, 68, 0.1)" : "0 0 20px rgba(124,90,194,0.05)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = "#242424";
          e.currentTarget.style.boxShadow = "none";
        }}
        >
          <div style={{ backgroundColor: data.overdueTasksCount > 0 ? "rgba(239, 68, 68, 0.1)" : "rgba(124, 90, 194, 0.1)", padding: "12px", borderRadius: "10px", color: data.overdueTasksCount > 0 ? "#ef4444" : "#7C5AC2" }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <p style={{ margin: "0 0 4px 0", color: "#888", fontSize: "14px" }}>Atrasadas</p>
            <p style={{ margin: 0, color: data.overdueTasksCount > 0 ? "#ef4444" : "#e0e0e0", fontSize: "24px", fontWeight: "600" }}>{data.overdueTasksCount}</p>
          </div>
        </div>

        {/* Card 3 */}
        <div style={{
          backgroundColor: "#161618",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          transition: "all 0.3s cursor-pointer"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = "#313136";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(16, 185, 129, 0.05)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = "#242424";
          e.currentTarget.style.boxShadow = "none";
        }}
        >
          <div style={{ backgroundColor: "rgba(16, 185, 129, 0.1)", padding: "12px", borderRadius: "10px", color: "#10B981" }}>
            <CheckCircle2 size={24} />
          </div>
          <div>
            <p style={{ margin: "0 0 4px 0", color: "#888", fontSize: "14px" }}>Concluídas Hoje</p>
            <p style={{ margin: 0, color: "#10B981", fontSize: "24px", fontWeight: "600" }}>{data.completedTodayCount}</p>
          </div>
        </div>

        {/* Card 4 */}
        <div style={{
          backgroundColor: "#161618",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          alignItems: "center",
          gap: "16px",
          transition: "all 0.3s cursor-pointer"
        }}
        onMouseOver={(e) => {
          e.currentTarget.style.borderColor = "#313136";
          e.currentTarget.style.boxShadow = "0 0 20px rgba(124,90,194,0.05)";
        }}
        onMouseOut={(e) => {
          e.currentTarget.style.borderColor = "#242424";
          e.currentTarget.style.boxShadow = "none";
        }}
        >
          <div style={{ backgroundColor: "rgba(124, 90, 194, 0.1)", padding: "12px", borderRadius: "10px", color: "#7C5AC2" }}>
            <FolderKanban size={24} />
          </div>
          <div>
            <p style={{ margin: "0 0 4px 0", color: "#888", fontSize: "14px" }}>Projetos Ativos</p>
            <p style={{ margin: 0, color: "#e0e0e0", fontSize: "24px", fontWeight: "600" }}>{data.totalActiveProjectsCount}</p>
          </div>
        </div>
      </div>

      {/* ─── Vencimentos & Parcelas a Entrar (Fluxo de Recebimentos Prioritário) ─── */}
      <div style={{
        backgroundColor: "#161618",
        border: overdueCount > 0 ? "1px solid rgba(239, 68, 68, 0.3)" : "1px solid #242424",
        borderRadius: "14px",
        padding: "clamp(16px, 2.5vw, 22px)",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
        boxShadow: overdueCount > 0 ? "0 4px 24px rgba(239,68,68,0.08)" : "0 4px 20px rgba(0,0,0,0.3)",
        position: "relative",
        overflow: "hidden"
      }}>
        {/* Subtle glow highlight if overdue items exist */}
        {overdueCount > 0 && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            height: 3,
            background: "linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)"
          }} />
        )}

        {/* Section Header */}
        <div style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "10px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: overdueCount > 0 
                ? "linear-gradient(135deg, #ef4444 0%, #b91c1c 100%)" 
                : "linear-gradient(135deg, #10B981 0%, #059669 100%)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fff",
              boxShadow: overdueCount > 0 ? "0 4px 12px rgba(239,68,68,0.3)" : "0 4px 12px rgba(16,185,129,0.3)",
              flexShrink: 0
            }}>
              <DollarSign size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "17px", fontWeight: "700", color: "#fafafa" }}>
                  Vencimentos & Parcelas a Entrar
                </h2>
                {allInstallments.length > 0 && (
                  <span style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: 12,
                    background: overdueCount > 0 ? "rgba(239,68,68,0.18)" : "rgba(16,185,129,0.18)",
                    color: overdueCount > 0 ? "#f87171" : "#10b981",
                    border: `1px solid ${overdueCount > 0 ? "rgba(239,68,68,0.35)" : "rgba(16,185,129,0.35)"}`
                  }}>
                    {overdueCount > 0 ? `${overdueCount} atrasada(s)` : `${allInstallments.length} prevista(s)`}
                  </span>
                )}
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#888" }}>
                {overdueCount > 0 
                  ? "Atenção: cobranças vencidas aguardando liquidação prioritária"
                  : todayCount > 0 
                    ? "Parcelas com previsão de recebimento para hoje"
                    : "Previsão de receitas e parcelas do mês organizadas por vencimento"}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            {data.incomingInstallmentsSummary?.totalAmountCents !== undefined && (
              <span style={{ fontSize: 13, fontWeight: 700, color: "#10b981", background: "rgba(16,185,129,0.1)", padding: "4px 8px", borderRadius: 6, border: "1px solid rgba(16,185,129,0.2)" }}>
                {formatBRL(data.incomingInstallmentsSummary.totalAmountCents)}
              </span>
            )}
            <button
              onClick={() => navigate("/financeiro")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 12px",
                borderRadius: "8px",
                background: "rgba(255,255,255,0.06)",
                border: "1px solid rgba(255,255,255,0.12)",
                color: "#e4e4e7",
                fontSize: "12px",
                fontWeight: "600",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.12)";
                e.currentTarget.style.color = "#fff";
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.background = "rgba(255,255,255,0.06)";
                e.currentTarget.style.color = "#e4e4e7";
              }}
            >
              <span>Financeiro</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

        {/* Filter Chips (if multiple groups exist) */}
        {allInstallments.length > 1 && (overdueCount > 0 || todayCount > 0) && (
          <div style={{ display: "flex", gap: 6, overflowX: "auto", paddingBottom: 2 }}>
            <button
              onClick={() => setVencimentoFilter("todos")}
              style={{
                padding: "4px 10px",
                borderRadius: 6,
                border: vencimentoFilter === "todos" ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.08)",
                background: vencimentoFilter === "todos" ? "rgba(124,90,194,0.2)" : "rgba(255,255,255,0.04)",
                color: vencimentoFilter === "todos" ? "#fff" : "#aaa",
                fontSize: 11,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              Todas ({allInstallments.length})
            </button>
            {overdueCount > 0 && (
              <button
                onClick={() => setVencimentoFilter("overdue")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: vencimentoFilter === "overdue" ? "1px solid #ef4444" : "1px solid rgba(239,68,68,0.2)",
                  background: vencimentoFilter === "overdue" ? "rgba(239,68,68,0.25)" : "rgba(239,68,68,0.1)",
                  color: "#f87171",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Atrasadas ({overdueCount})
              </button>
            )}
            {todayCount > 0 && (
              <button
                onClick={() => setVencimentoFilter("today")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: vencimentoFilter === "today" ? "1px solid #f59e0b" : "1px solid rgba(245,158,11,0.2)",
                  background: vencimentoFilter === "today" ? "rgba(245,158,11,0.25)" : "rgba(245,158,11,0.1)",
                  color: "#fbbf24",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                Hoje ({todayCount})
              </button>
            )}
            {monthUpcomingCount > 0 && (
              <button
                onClick={() => setVencimentoFilter("upcoming")}
                style={{
                  padding: "4px 10px",
                  borderRadius: 6,
                  border: vencimentoFilter === "upcoming" ? "1px solid #3b82f6" : "1px solid rgba(59,130,246,0.2)",
                  background: vencimentoFilter === "upcoming" ? "rgba(59,130,246,0.25)" : "rgba(59,130,246,0.1)",
                  color: "#93c5fd",
                  fontSize: 11,
                  fontWeight: 600,
                  cursor: "pointer"
                }}
              >
                No Mês ({monthUpcomingCount})
              </button>
            )}
          </div>
        )}

        {/* List of Incoming Installments */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {filteredInstallments.length === 0 ? (
            <div style={{
              textAlign: "center",
              color: "#888",
              padding: "20px 16px",
              background: "rgba(255,255,255,0.02)",
              borderRadius: "10px",
              border: "1px dashed rgba(255,255,255,0.08)"
            }}>
              <CheckCircle2 size={24} style={{ color: "#10b981", margin: "0 auto 6px auto" }} />
              <p style={{ margin: 0, fontSize: "14px", color: "#ddd", fontWeight: 600 }}>
                Nenhum vencimento pendente no período
              </p>
              <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#777" }}>
                Todos os recebimentos deste mês estão devidamente liquidados.
              </p>
            </div>
          ) : (
            filteredInstallments.slice(0, 6).map(item => {
              const isOverdue = item.urgencyGroup === "overdue";
              const isToday = item.urgencyGroup === "today";
              const dateStr = item.dueDate ? format(new Date(item.dueDate), "dd/MM/yyyy") : "--";

              return (
                <div
                  key={item.id}
                  onClick={() => navigate("/financeiro")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    backgroundColor: isOverdue ? "rgba(239,68,68,0.06)" : "#202024",
                    border: `1px solid ${isOverdue ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.08)"}`,
                    borderRadius: "10px",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                    gap: "10px",
                    flexWrap: "wrap"
                  }}
                  onMouseOver={(e) => {
                    e.currentTarget.style.borderColor = isOverdue ? "rgba(239,68,68,0.5)" : "#4a4a52";
                    e.currentTarget.style.backgroundColor = isOverdue ? "rgba(239,68,68,0.1)" : "#28282d";
                  }}
                  onMouseOut={(e) => {
                    e.currentTarget.style.borderColor = isOverdue ? "rgba(239,68,68,0.25)" : "rgba(255,255,255,0.08)";
                    e.currentTarget.style.backgroundColor = isOverdue ? "rgba(239,68,68,0.06)" : "#202024";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 180, flex: 1 }}>
                    <div style={{
                      width: "4px",
                      height: "32px",
                      borderRadius: "2px",
                      backgroundColor: isOverdue ? "#ef4444" : (isToday ? "#f59e0b" : "#10b981"),
                      flexShrink: 0
                    }} />

                    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: "#fafafa" }}>
                          {item.clientName || "Cliente"}
                        </span>
                        {item.projectName && (
                          <span style={{
                            fontSize: "11px",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            background: "rgba(255,255,255,0.06)",
                            color: "#a1a1aa"
                          }}>
                            {item.projectName}
                          </span>
                        )}
                        {item.installmentNumber && item.installmentsTotal && (
                          <span style={{
                            fontSize: "10px",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            background: "rgba(124,90,194,0.18)",
                            color: "#c4b5fd",
                            fontWeight: 600
                          }}>
                            Parcela {item.installmentNumber}/{item.installmentsTotal}
                          </span>
                        )}
                      </div>
                      <span style={{ fontSize: "12px", color: "#888", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "12px", justifyContent: "flex-end", flexShrink: 0 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "15px", fontWeight: "800", color: isOverdue ? "#f87171" : "#10b981", letterSpacing: "-0.01em" }}>
                        {formatBRL(item.amount)}
                      </div>
                      <div style={{ fontSize: "11px", color: "#888" }}>
                        {dateStr}
                      </div>
                    </div>

                    <span style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      padding: "3px 8px",
                      borderRadius: "6px",
                      whiteSpace: "nowrap",
                      backgroundColor: isOverdue 
                        ? "rgba(239,68,68,0.15)" 
                        : (isToday ? "rgba(245,158,11,0.15)" : "rgba(59,130,246,0.15)"),
                      color: isOverdue 
                        ? "#ef4444" 
                        : (isToday ? "#f59e0b" : "#60a5fa"),
                      border: `1px solid ${isOverdue ? "rgba(239,68,68,0.3)" : (isToday ? "rgba(245,158,11,0.3)" : "rgba(59,130,246,0.3)")}`
                    }}>
                      {isOverdue ? "Atrasada" : (isToday ? "Vence Hoje" : "A Vencer")}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      {/* Two Column Layout */}
      <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", flex: 1, minHeight: 0 }}>
        
        {/* Left Column - Today's Tasks */}
        <div style={{
          flex: "1 1 320px",
          backgroundColor: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#fafafa" }}>Tarefas de Hoje</h2>
                {data.showingFallbackTasks && (
                  <span style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "rgba(124, 90, 194, 0.16)",
                    color: "#c4b5fd",
                    border: "1px solid rgba(124, 90, 194, 0.3)"
                  }}>
                    Próximas por vencimento
                  </span>
                )}
              </div>
              {data.showingFallbackTasks && (
                <p style={{ margin: "4px 0 0 0", fontSize: "12px", color: "#888" }}>
                  Nenhuma tarefa agendada para hoje — exibindo pendentes da mais próxima de vencer até a mais distante.
                </p>
              )}
            </div>

            {(data.todaysStrictCount || 0) > 0 && (data.allPendingTasks?.length || 0) > (data.todaysStrictCount || 0) && (
              <div style={{ display: "flex", gap: "6px" }}>
                <button
                  onClick={() => setShowAllTasks(false)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: !showAllTasks ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.08)",
                    background: !showAllTasks ? "rgba(124,90,194,0.2)" : "rgba(255,255,255,0.04)",
                    color: !showAllTasks ? "#fff" : "#aaa",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Hoje ({data.todaysStrictCount})
                </button>
                <button
                  onClick={() => setShowAllTasks(true)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: showAllTasks ? "1px solid #7C5AC2" : "1px solid rgba(255,255,255,0.08)",
                    background: showAllTasks ? "rgba(124,90,194,0.2)" : "rgba(255,255,255,0.04)",
                    color: showAllTasks ? "#fff" : "#aaa",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer"
                  }}
                >
                  Todas ({data.allPendingTasks?.length})
                </button>
              </div>
            )}
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
            {displayedTasks.length === 0 ? (
              <div style={{ textAlign: "center", color: "#888", padding: "32px" }}>
                <p>Nenhuma tarefa pendente para hoje. Bom trabalho!</p>
              </div>
            ) : (
              displayedTasks.map(task => {
                const dueInfo = formatTaskDueInfo(task);
                return (
                  <div
                    key={task.id}
                    onClick={() => {
                      if (task.projectId) {
                        navigate(`/projetos/${task.projectId}/quadros`);
                      } else {
                        navigate("/minhas-tarefas");
                      }
                    }}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "16px",
                      backgroundColor: "#232326",
                      border: "1px solid #313136",
                      borderRadius: "8px",
                      cursor: "pointer",
                      transition: "all 0.2s",
                      gap: "12px",
                      flexWrap: "wrap"
                    }}
                    onMouseOver={(e) => e.currentTarget.style.borderColor = "#4a4a52"}
                    onMouseOut={(e) => e.currentTarget.style.borderColor = "#313136"}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "12px", minWidth: 0, flex: 1 }}>
                      <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: task.projectColor || "#7C5AC2", flexShrink: 0 }} />
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                        <span style={{ fontSize: "15px", fontWeight: "500", color: "#e0e0e0" }}>{task.title}</span>
                        <span style={{ fontSize: "13px", color: "#888" }}>
                          {task.projectName}{task.columnTitle ? ` • ${task.columnTitle}` : ""}
                        </span>
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: "16px", flexShrink: 0 }}>
                      <span style={{
                        fontSize: "12px",
                        padding: "4px 8px",
                        borderRadius: "12px",
                        backgroundColor: `${getPriorityColor(task.priority)}22`,
                        color: getPriorityColor(task.priority),
                        fontWeight: "500"
                      }}>
                        {getPriorityLabel(task.priority)}
                      </span>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", color: dueInfo.color, fontSize: "13px", fontWeight: task.urgencyGroup === "today" || task.urgencyGroup === "overdue" ? 600 : 400 }}>
                        <Clock size={14} />
                        <span>{dueInfo.label}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div style={{
          flex: "1 1 280px",
          backgroundColor: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#fafafa" }}>Atividade Recente</h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", overflowY: "auto", paddingRight: "8px" }}>
            {data.recentActivity.length === 0 ? (
              <div style={{ textAlign: "center", color: "#888", padding: "32px" }}>
                <p>Nenhuma atividade recente.</p>
              </div>
            ) : (
              data.recentActivity.map(activity => {
                const isSystem = !activity.user;
                return (
                  <div key={activity.id} style={{ display: "flex", gap: "12px" }}>
                    <div style={{
                      width: "32px",
                      height: "32px",
                      borderRadius: "50%",
                      backgroundColor: isSystem ? "#2b2b2e" : "#7C5AC2",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                      overflow: "hidden"
                    }}>
                      {isSystem ? (
                        <span style={{ fontSize: "12px", color: "#888" }}>Sist.</span>
                      ) : activity.user.avatarUrl ? (
                        <img src={activity.user.avatarUrl} alt={activity.user.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      ) : (
                        <span style={{ fontSize: "12px", color: "#fff", fontWeight: "600" }}>
                          {activity.user.name.substring(0, 2).toUpperCase()}
                        </span>
                      )}
                    </div>
                    
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <div style={{ fontSize: "14px", color: "#e0e0e0" }}>
                        <span style={{ fontWeight: "600" }}>{isSystem ? "Sistema" : activity.user.name}</span>{" "}
                        {activity.action === "created" && "criou a tarefa"}
                        {activity.action === "moved_to" && "moveu a tarefa"}
                        {activity.action === "added_comment" && "comentou na tarefa"}
                        {activity.action === "changed_priority" && "alterou a prioridade da tarefa"}
                        {!["created", "moved_to", "added_comment", "changed_priority"].includes(activity.action) && activity.action}{" "}
                        <span style={{ fontWeight: "500", color: "#a1a1aa" }}>{activity.task?.title}</span>
                      </div>
                      <div style={{ fontSize: "12px", color: "#888" }}>
                        {format(new Date(activity.createdAt), "dd/MM/yyyy 'às' HH:mm")}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>
    </div>
  );
}
