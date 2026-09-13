import React, { useState, useEffect } from "react";
import { API } from "../lib/api";
import { CheckCircle2, Clock, Calendar, AlertCircle } from "lucide-react";
import { format, isToday, isThisWeek, isBefore, startOfDay, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Task {
  id: string;
  title: string;
  priority: "low" | "normal" | "high" | "urgent";
  dueDate: string | null;
  columnTitle: string;
  projectName: string;
  projectColor: string;
  projectId: string;
  subtasksTotal: number;
  subtasksCompleted: number;
}

type FilterType = "todas" | "hoje" | "semana" | "atrasadas" | "concluidas";

export default function MinhasTarefasPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterType>("todas");
  const [hoveredTaskId, setHoveredTaskId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await API.get("/api/tasks/my-tasks");
      if (res.tasks) {
        setTasks(res.tasks);
      }
    } catch (error) {
      console.error("Error fetching my tasks:", error);
    } finally {
      setLoading(false);
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "#4a4a4a";
      case "normal": return "#3b82f6";
      case "high": return "#f59e0b";
      case "urgent": return "#ef4444";
      default: return "#3b82f6";
    }
  };

  const getPriorityLabel = (priority: string) => {
    switch (priority) {
      case "low": return "Baixa";
      case "normal": return "Normal";
      case "high": return "Alta";
      case "urgent": return "Urgente";
      default: return priority;
    }
  };

  const filteredTasks = tasks.filter((task) => {
    const isCompleted = task.columnTitle.toLowerCase() === "concluído";
    const dueDate = task.dueDate ? parseISO(task.dueDate) : null;
    const now = startOfDay(new Date());

    if (filter === "concluidas") return isCompleted;
    if (isCompleted) return false; // Hide completed tasks from other filters

    if (filter === "todas") return true;
    
    if (!dueDate) return false; // The time-based filters need a due date

    if (filter === "hoje") return isToday(dueDate);
    if (filter === "semana") return isThisWeek(dueDate, { locale: ptBR });
    if (filter === "atrasadas") return isBefore(dueDate, now);

    return true;
  });

  const getEmptyStateMessage = () => {
    switch (filter) {
      case "hoje": return "Nenhuma tarefa para hoje. Aproveite o dia!";
      case "semana": return "Nenhuma tarefa para esta semana.";
      case "atrasadas": return "Ótimo trabalho! Nenhuma tarefa atrasada.";
      case "concluidas": return "Você ainda não concluiu nenhuma tarefa.";
      default: return "Você não tem nenhuma tarefa atribuída.";
    }
  };

  return (
    <div style={{ padding: "2rem", height: "100%", display: "flex", flexDirection: "column", boxSizing: "border-box", overflowY: "auto", fontFamily: "'Inter', 'SF Pro Display', -apple-system, sans-serif" }}>
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "2rem", fontWeight: 600, color: "#fafafa", margin: "0 0 1.5rem 0" }}>
          Minhas Tarefas
        </h1>
        
        <div style={{ display: "flex", gap: "1rem", overflowX: "auto", paddingBottom: "0.5rem" }}>
          {[
            { id: "todas", label: "Todas" },
            { id: "hoje", label: "Para Hoje" },
            { id: "semana", label: "Esta Semana" },
            { id: "atrasadas", label: "Atrasadas" },
            { id: "concluidas", label: "Concluídas" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setFilter(tab.id as FilterType)}
              style={{
                background: filter === tab.id ? "#2b2b2e" : "transparent",
                color: filter === tab.id ? "#fafafa" : "#a1a1aa",
                border: `1px solid ${filter === tab.id ? "#313136" : "transparent"}`,
                padding: "0.5rem 1rem",
                borderRadius: "6px",
                cursor: "pointer",
                fontWeight: 500,
                fontSize: "0.9rem",
                transition: "all 0.2s ease"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ color: "#a1a1aa", textAlign: "center", marginTop: "3rem" }}>Carregando tarefas...</div>
      ) : filteredTasks.length === 0 ? (
        <div style={{ 
          display: "flex", 
          flexDirection: "column", 
          alignItems: "center", 
          justifyContent: "center",
          marginTop: "4rem",
          color: "#a1a1aa"
        }}>
          {filter === 'concluidas' ? (
            <CheckCircle2 size={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
          ) : filter === 'atrasadas' ? (
            <AlertCircle size={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
          ) : filter === 'hoje' ? (
            <Clock size={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
          ) : (
            <Calendar size={48} style={{ marginBottom: "1rem", opacity: 0.5 }} />
          )}
          <p style={{ fontSize: "1.1rem" }}>{getEmptyStateMessage()}</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {filteredTasks.map((task) => (
            <div
              key={task.id}
              onMouseEnter={() => setHoveredTaskId(task.id)}
              onMouseLeave={() => setHoveredTaskId(null)}
              style={{
                background: "#1a1a1a",
                border: `1px solid ${hoveredTaskId === task.id ? "#7C5AC2" : "#242424"}`,
                borderRadius: "8px",
                padding: "1.25rem",
                transition: "border-color 0.3s ease",
                display: "flex",
                flexDirection: "column",
                gap: "0.75rem",
                cursor: "pointer"
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                    <div style={{ width: 8, height: 8, borderRadius: "50%", background: task.projectColor || "#7C5AC2" }} />
                    <span style={{ color: "#888", fontSize: "0.85rem", fontWeight: 500 }}>{task.projectName}</span>
                  </div>
                  <h3 style={{ color: "#e0e0e0", margin: 0, fontSize: "1.1rem", fontWeight: 500 }}>{task.title}</h3>
                </div>
                
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  <span style={{
                    background: "#2b2b2e",
                    color: "#e0e0e0",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "4px",
                    fontSize: "0.8rem",
                    border: "1px solid #313136"
                  }}>
                    {task.columnTitle}
                  </span>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "1rem", marginTop: "0.5rem" }}>
                <span style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  fontSize: "0.8rem",
                  color: getPriorityColor(task.priority),
                  background: `${getPriorityColor(task.priority)}15`,
                  padding: "0.25rem 0.5rem",
                  borderRadius: "4px",
                  fontWeight: 500
                }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: getPriorityColor(task.priority) }} />
                  {getPriorityLabel(task.priority)}
                </span>

                {task.dueDate && (
                  <span style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                    fontSize: "0.85rem",
                    color: isBefore(parseISO(task.dueDate), startOfDay(new Date())) && task.columnTitle.toLowerCase() !== "concluído" ? "#ef4444" : "#888"
                  }}>
                    <Calendar size={14} />
                    {format(parseISO(task.dueDate), "dd MMM", { locale: ptBR })}
                  </span>
                )}

                {task.subtasksTotal > 0 && (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginLeft: "auto" }}>
                    <span style={{ fontSize: "0.8rem", color: "#888" }}>
                      {task.subtasksCompleted}/{task.subtasksTotal}
                    </span>
                    <div style={{ width: "60px", height: "4px", background: "#242424", borderRadius: "2px", overflow: "hidden" }}>
                      <div style={{
                        width: `${(task.subtasksCompleted / task.subtasksTotal) * 100}%`,
                        height: "100%",
                        background: task.subtasksCompleted === task.subtasksTotal ? "#10B981" : "#7C5AC2",
                        transition: "width 0.3s ease"
                      }} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
