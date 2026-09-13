import React, { useEffect, useState, useContext } from "react";
import { API } from "../lib/api";
import { 
  CalendarCheck, 
  AlertTriangle, 
  CheckCircle2, 
  FolderKanban,
  Plus,
  Folder,
  CheckSquare,
  Clock
} from "lucide-react";
import { AppContext } from "../TeltechLedger";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface DashboardData {
  welcomeData: {
    name: string;
    date: string;
  };
  todaysTasks: any[];
  overdueTasksCount: number;
  completedTodayCount: number;
  totalActiveProjectsCount: number;
  recentActivity: any[];
}

export function InicioPage() {
  const { setSidebarModule } = useContext(AppContext);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadData() {
      try {
        const response = await API.get("/dashboard");
        setData(response.data);
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

  return (
    <div style={{
      flex: 1,
      display: "flex",
      flexDirection: "column",
      backgroundColor: "#111111",
      color: "#e0e0e0",
      overflowY: "auto",
      padding: "32px",
      gap: "32px",
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif"
    }}>
      {/* Welcome Banner */}
      <div style={{
        position: "relative",
        padding: "32px",
        borderRadius: "16px",
        border: "1px solid #242424",
        backgroundColor: "#1a1a1a",
        overflow: "hidden",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        {/* Mesh Gradient Background */}
        <div style={{
          position: "absolute",
          top: 0, left: 0, right: 0, bottom: 0,
          background: "radial-gradient(circle at 15% 50%, rgba(124, 90, 194, 0.15), transparent 25%), radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.1), transparent 25%)",
          zIndex: 0
        }} />

        <div style={{ position: "relative", zIndex: 1 }}>
          <h1 style={{ margin: "0 0 8px 0", fontSize: "28px", fontWeight: "600", color: "#fafafa" }}>
            {greeting}, {data.welcomeData.name?.split(" ")[0] || "Usuário"}!
          </h1>
          <p style={{ margin: 0, color: "#888", fontSize: "16px" }}>
            {displayDate}
          </p>
          <p style={{ margin: "16px 0 0 0", color: "#a1a1aa", fontSize: "14px" }}>
            Aqui está o resumo do seu dia.
          </p>
        </div>

        {/* Quick Actions */}
        <div style={{ position: "relative", zIndex: 1, display: "flex", gap: "12px" }}>
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
            onClick={() => setSidebarModule("Projetos")}
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
            onClick={() => setSidebarModule("Minhas Tarefas")}
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
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
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

      {/* Two Column Layout */}
      <div style={{ display: "flex", gap: "24px", flex: 1, minHeight: 0 }}>
        
        {/* Left Column - Today's Tasks */}
        <div style={{
          flex: "6",
          backgroundColor: "#1a1a1a",
          border: "1px solid #242424",
          borderRadius: "12px",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "16px"
        }}>
          <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "600", color: "#fafafa" }}>Tarefas de Hoje</h2>
          
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflowY: "auto" }}>
            {data.todaysTasks.length === 0 ? (
              <div style={{ textAlign: "center", color: "#888", padding: "32px" }}>
                <p>Nenhuma tarefa pendente para hoje. Bom trabalho!</p>
              </div>
            ) : (
              data.todaysTasks.map(task => (
                <div key={task.id} style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "16px",
                  backgroundColor: "#232326",
                  border: "1px solid #313136",
                  borderRadius: "8px",
                  cursor: "pointer",
                  transition: "all 0.2s"
                }}
                onMouseOver={(e) => e.currentTarget.style.borderColor = "#4a4a52"}
                onMouseOut={(e) => e.currentTarget.style.borderColor = "#313136"}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                    <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: task.projectColor || "#7C5AC2" }} />
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span style={{ fontSize: "15px", fontWeight: "500", color: "#e0e0e0" }}>{task.title}</span>
                      <span style={{ fontSize: "13px", color: "#888" }}>{task.projectName}</span>
                    </div>
                  </div>
                  
                  <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
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
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "#a1a1aa", fontSize: "13px" }}>
                      <Clock size={14} />
                      <span>{format(new Date(task.dueDate), "HH:mm")}</span>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Right Column - Recent Activity */}
        <div style={{
          flex: "4",
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
