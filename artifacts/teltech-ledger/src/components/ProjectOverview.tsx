import React, { useState, useContext, useEffect } from "react";
import { AppContext } from "../TeltechLedger";
import { API } from "../lib/api";
import { CheckCircle, Clock, AlertTriangle, ListTodo } from "lucide-react";

export function ProjectOverview() {
  const { activeProject } = useContext(AppContext);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject?.id) return;

    setLoading(true);
    API.get(`/api/projects/${activeProject.id}/stats`)
      .then((res: any) => {
        setStats(res);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [activeProject?.id]);

  if (loading) {
    return <div style={{ padding: "24px", color: "#fafafa" }}>Carregando visão geral...</div>;
  }

  if (!stats) return null;

  const radius = 60;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (stats.completionPercentage / 100) * circumference;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px", color: "#fafafa", overflowY: "auto", gap: "24px" }}>
      <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>Visão Geral</h2>

      {/* Top Stats Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
        
        {/* Total Tasks */}
        <div style={{ backgroundColor: "#1a1a1a", border: "1px solid #242424", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", backgroundColor: "#2b2b2e", borderRadius: "8px", color: "#a1a1aa" }}>
            <ListTodo size={24} />
          </div>
          <div>
            <div style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "4px" }}>Total Tarefas</div>
            <div style={{ fontSize: "24px", fontWeight: "bold" }}>{stats.totalTasks}</div>
          </div>
        </div>

        {/* Completed Tasks */}
        <div style={{ backgroundColor: "#1a1a1a", border: "1px solid #242424", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", backgroundColor: "rgba(16, 185, 129, 0.1)", borderRadius: "8px", color: "#10B981" }}>
            <CheckCircle size={24} />
          </div>
          <div>
            <div style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "4px" }}>Concluídas</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#10B981" }}>{stats.completedTasks}</div>
          </div>
        </div>

        {/* In Progress Tasks */}
        <div style={{ backgroundColor: "#1a1a1a", border: "1px solid #242424", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", backgroundColor: "rgba(59, 130, 246, 0.1)", borderRadius: "8px", color: "#3b82f6" }}>
            <Clock size={24} />
          </div>
          <div>
            <div style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "4px" }}>Em Progresso</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: "#3b82f6" }}>{stats.totalTasks - stats.completedTasks}</div>
          </div>
        </div>

        {/* Overdue Tasks */}
        <div style={{ backgroundColor: "#1a1a1a", border: stats.overdueTasks > 0 ? "1px solid rgba(239, 68, 68, 0.5)" : "1px solid #242424", borderRadius: "8px", padding: "16px", display: "flex", alignItems: "center", gap: "16px" }}>
          <div style={{ padding: "12px", backgroundColor: stats.overdueTasks > 0 ? "rgba(239, 68, 68, 0.1)" : "#2b2b2e", borderRadius: "8px", color: stats.overdueTasks > 0 ? "#ef4444" : "#a1a1aa" }}>
            <AlertTriangle size={24} />
          </div>
          <div>
            <div style={{ color: "#a1a1aa", fontSize: "14px", marginBottom: "4px" }}>Atrasadas</div>
            <div style={{ fontSize: "24px", fontWeight: "bold", color: stats.overdueTasks > 0 ? "#ef4444" : "#fafafa" }}>{stats.overdueTasks}</div>
          </div>
        </div>

      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", marginTop: "8px" }}>
        
        {/* Progress Ring */}
        <div style={{ backgroundColor: "#1a1a1a", border: "1px solid #242424", borderRadius: "8px", padding: "24px", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
          <h3 style={{ margin: "0 0 24px 0", fontSize: "16px", fontWeight: "500", alignSelf: "flex-start" }}>Progresso Geral</h3>
          
          <div style={{ position: "relative", width: radius * 2, height: radius * 2, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg height={radius * 2} width={radius * 2} style={{ position: "absolute", transform: "rotate(-90deg)" }}>
              <circle
                stroke="#2b2b2e"
                fill="transparent"
                strokeWidth={stroke}
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
              <circle
                stroke="#7C5AC2"
                fill="transparent"
                strokeWidth={stroke}
                strokeDasharray={circumference + " " + circumference}
                style={{ strokeDashoffset, transition: "stroke-dashoffset 0.5s ease-in-out" }}
                strokeLinecap="round"
                r={normalizedRadius}
                cx={radius}
                cy={radius}
              />
            </svg>
            <div style={{ position: "absolute", fontSize: "28px", fontWeight: "bold", color: "#fafafa" }}>
              {stats.completionPercentage}%
            </div>
          </div>
          <div style={{ marginTop: "24px", color: "#a1a1aa", fontSize: "14px" }}>
            {stats.completedTasks} de {stats.totalTasks} tarefas concluídas
          </div>
        </div>

        {/* Tasks by Column & Priority */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div style={{ backgroundColor: "#1a1a1a", border: "1px solid #242424", borderRadius: "8px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "500" }}>Tarefas por Coluna</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {stats.tasksByColumn.map((col: any) => {
                const maxCount = Math.max(...stats.tasksByColumn.map((c: any) => c.count), 1);
                const widthPercent = (col.count / maxCount) * 100;
                
                return (
                  <div key={col.id}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px", fontSize: "13px" }}>
                      <span style={{ color: "#a1a1aa" }}>{col.title}</span>
                      <span style={{ fontWeight: "500" }}>{col.count}</span>
                    </div>
                    <div style={{ width: "100%", height: "8px", backgroundColor: "#2b2b2e", borderRadius: "4px", overflow: "hidden" }}>
                      <div style={{ 
                        height: "100%", 
                        width: `${widthPercent}%`, 
                        backgroundColor: activeProject?.color || "#7C5AC2",
                        borderRadius: "4px",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div style={{ backgroundColor: "#1a1a1a", border: "1px solid #242424", borderRadius: "8px", padding: "24px" }}>
            <h3 style={{ margin: "0 0 16px 0", fontSize: "16px", fontWeight: "500" }}>Tarefas por Prioridade</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#ef4444" }} />
                <span style={{ fontSize: "13px", color: "#a1a1aa", flex: 1 }}>Urgente</span>
                <span style={{ fontWeight: "500" }}>{stats.tasksByPriority?.urgent || 0}</span>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#f59e0b" }} />
                <span style={{ fontSize: "13px", color: "#a1a1aa", flex: 1 }}>Alta</span>
                <span style={{ fontWeight: "500" }}>{stats.tasksByPriority?.high || 0}</span>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#3b82f6" }} />
                <span style={{ fontSize: "13px", color: "#a1a1aa", flex: 1 }}>Normal</span>
                <span style={{ fontWeight: "500" }}>{stats.tasksByPriority?.normal || 0}</span>
              </div>
              
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: "#4a4a4a" }} />
                <span style={{ fontSize: "13px", color: "#a1a1aa", flex: 1 }}>Baixa</span>
                <span style={{ fontWeight: "500" }}>{stats.tasksByPriority?.low || 0}</span>
              </div>

            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
