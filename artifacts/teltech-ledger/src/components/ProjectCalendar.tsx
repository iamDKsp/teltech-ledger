import React, { useState, useContext, useEffect, useCallback } from "react";
import { AppContext } from "../TeltechLedger";
import { API } from "../lib/api";
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, List, Clock } from "lucide-react";
import { useIsMobile } from "../hooks/use-mobile";
import { TaskModal } from "./TaskModal";

export function ProjectCalendar() {
  const { activeProject } = useContext(AppContext);
  const isMobile = useIsMobile();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [selectedColId, setSelectedColId] = useState<string>("todo");
  const [mobileMode, setMobileMode] = useState<"calendar" | "agenda">("calendar");

  const loadTasks = useCallback(() => {
    if (!activeProject?.id) return;
    setLoading(true);
    API.get(`/api/projects/${activeProject.id}/board`)
      .then((res: any) => {
        const allTasks: any[] = [];
        res.columns?.forEach((col: any) => {
          col.tasks?.forEach((task: any) => {
            if (task.dueDate) {
              allTasks.push({ ...task, colId: col.id, columnName: col.title });
            }
          });
        });
        setTasks(allTasks);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [activeProject?.id]);

  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

  const handleOpenTask = (task: any) => {
    setSelectedTask(task);
    setSelectedColId(task.colId || task.columnId || "todo");
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
  const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0);

  const startDayOfWeek = startOfMonth.getDay() === 0 ? 6 : startOfMonth.getDay() - 1; // 0 = Monday
  const daysInMonth = endOfMonth.getDate();

  const monthNames = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "low": return "#4a4a4a";
      case "normal": return "#3b82f6";
      case "high": return "#f59e0b";
      case "urgent": return "#ef4444";
      default: return "#4a4a4a";
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

  const getTasksForDate = (date: Date) => {
    return tasks.filter(t => {
      const taskDate = new Date(t.dueDate);
      return taskDate.getFullYear() === date.getFullYear() &&
             taskDate.getMonth() === date.getMonth() &&
             taskDate.getDate() === date.getDate();
    });
  };

  const isSameDay = (d1: Date, d2: Date) => {
    return d1.getFullYear() === d2.getFullYear() &&
           d1.getMonth() === d2.getMonth() &&
           d1.getDate() === d2.getDate();
  };

  const isToday = (date: Date) => {
    return isSameDay(date, new Date());
  };

  const monthTasks = tasks
    .filter(t => {
      const taskDate = new Date(t.dueDate);
      return taskDate.getFullYear() === currentDate.getFullYear() &&
             taskDate.getMonth() === currentDate.getMonth();
    })
    .sort((a, b) => new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime());

  const selectedDayTasks = getTasksForDate(selectedDate);

  const renderDesktopCells = () => {
    const cells = [];
    
    // Empty cells before start of month
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} style={{ padding: "8px", minHeight: "120px", borderRight: "1px solid #242424", borderBottom: "1px solid #242424" }} />);
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const dayTasks = getTasksForDate(date);
      const today = isToday(date);

      cells.push(
        <div key={d} style={{
          padding: "8px",
          minHeight: "120px",
          borderRight: "1px solid #242424",
          borderBottom: "1px solid #242424",
          backgroundColor: "#161618",
          border: today ? "2px solid #7C5AC2" : undefined,
          display: "flex",
          flexDirection: "column",
          gap: "4px"
        }}>
          <div style={{
            color: today ? "#7C5AC2" : "#fafafa",
            fontWeight: today ? "bold" : "normal",
            marginBottom: "4px",
            fontSize: "14px"
          }}>
            {d}
          </div>
          
          {dayTasks.slice(0, 3).map(task => (
            <div
              key={task.id}
              onClick={() => handleOpenTask(task)}
              style={{
                backgroundColor: getPriorityColor(task.priority),
                color: "#fff",
                padding: "2px 6px",
                borderRadius: "4px",
                fontSize: "12px",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                cursor: "pointer"
              }}
              title={task.title}
            >
              {task.title}
            </div>
          ))}

          {dayTasks.length > 3 && (
            <div style={{ fontSize: "11px", color: "#a1a1aa", marginTop: "2px" }}>
              +{dayTasks.length - 3} mais
            </div>
          )}
        </div>
      );
    }

    // Fill remaining cells for grid
    const totalCells = cells.length;
    const remainingCells = (7 - (totalCells % 7)) % 7;
    for (let i = 0; i < remainingCells; i++) {
      cells.push(<div key={`empty-end-${i}`} style={{ padding: "8px", minHeight: "120px", borderRight: "1px solid #242424", borderBottom: "1px solid #242424" }} />);
    }

    return cells;
  };

  const renderMobileCalendarCells = () => {
    const cells = [];
    
    // Empty cells before start of month
    for (let i = 0; i < startDayOfWeek; i++) {
      cells.push(<div key={`m-empty-${i}`} style={{ aspectRatio: "1 / 1" }} />);
    }

    // Days of month
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), d);
      const dayTasks = getTasksForDate(date);
      const today = isToday(date);
      const isSelected = isSameDay(date, selectedDate);

      cells.push(
        <button
          key={`m-day-${d}`}
          onClick={() => setSelectedDate(date)}
          style={{
            aspectRatio: "1 / 1",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: 8,
            border: isSelected
              ? "1.5px solid #7C5AC2"
              : today
              ? "1px solid rgba(124, 90, 194, 0.4)"
              : "1px solid transparent",
            backgroundColor: isSelected
              ? "rgba(124, 90, 194, 0.2)"
              : today
              ? "rgba(124, 90, 194, 0.08)"
              : "transparent",
            cursor: "pointer",
            padding: 2,
            gap: 2,
          }}
        >
          <span style={{
            fontSize: 13,
            fontWeight: isSelected || today ? 700 : 500,
            color: isSelected ? "#A78BFA" : today ? "#7C5AC2" : "#f4f4f5",
          }}>
            {d}
          </span>

          {/* Task indicator dots */}
          <div style={{ display: "flex", gap: 2, height: 4, alignItems: "center" }}>
            {dayTasks.slice(0, 3).map((t, idx) => (
              <span
                key={idx}
                style={{
                  width: 4,
                  height: 4,
                  borderRadius: "50%",
                  backgroundColor: getPriorityColor(t.priority),
                }}
              />
            ))}
          </div>
        </button>
      );
    }

    return cells;
  };

  if (loading) {
    return <div style={{ padding: "24px", color: "#fafafa" }}>Carregando calendário...</div>;
  }

  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      height: "100%",
      padding: isMobile ? "12px 14px" : "24px",
      color: "#fafafa",
      overflowY: "auto",
      boxSizing: "border-box",
    }}>
      {/* Header with Navigation and View Switcher */}
      <div style={{
        display: "flex",
        flexDirection: isMobile ? "column" : "row",
        justifyContent: "space-between",
        alignItems: isMobile ? "stretch" : "center",
        gap: 12,
        marginBottom: isMobile ? 16 : 24,
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h2 style={{ margin: 0, fontSize: isMobile ? 20 : 24, fontWeight: 700 }}>Calendário</h2>

          {isMobile && (
            <div style={{
              display: "inline-flex",
              backgroundColor: "#161619",
              padding: 2,
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.08)",
            }}>
              <button
                onClick={() => setMobileMode("calendar")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: mobileMode === "calendar" ? "#7C5AC2" : "transparent",
                  color: mobileMode === "calendar" ? "#fff" : "#a1a1aa",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <CalendarIcon size={14} /> Mês
              </button>
              <button
                onClick={() => setMobileMode("agenda")}
                style={{
                  padding: "5px 10px",
                  borderRadius: 6,
                  border: "none",
                  backgroundColor: mobileMode === "agenda" ? "#7C5AC2" : "transparent",
                  color: mobileMode === "agenda" ? "#fff" : "#a1a1aa",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: 4,
                }}
              >
                <List size={14} /> Agenda
              </button>
            </div>
          )}
        </div>
        
        {/* Month Stepper */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          backgroundColor: "#1a1a1a",
          padding: isMobile ? "6px 12px" : "8px 16px",
          borderRadius: 8,
          border: "1px solid #242424",
        }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}>
            <ChevronLeft size={20} />
          </button>
          
          <span style={{ fontSize: isMobile ? 14 : 16, fontWeight: 600, minWidth: isMobile ? 110 : 140, textAlign: "center" }}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          
          <button onClick={nextMonth} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center", padding: 4 }}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      {/* MOBILE VIEW */}
      {isMobile ? (
        mobileMode === "calendar" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {/* Compact Month Grid */}
            <div style={{
              backgroundColor: "#18181c",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 14,
              padding: "12px 10px",
            }}>
              {/* Day names */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "repeat(7, 1fr)",
                textAlign: "center",
                fontSize: 11,
                fontWeight: 600,
                color: "#71717a",
                marginBottom: 8,
              }}>
                {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map((d, i) => (
                  <span key={i}>{d}</span>
                ))}
              </div>

              {/* Day cells */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 4 }}>
                {renderMobileCalendarCells()}
              </div>
            </div>

            {/* Selected Day Agenda */}
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: "#fff" }}>
                  {selectedDate.toLocaleDateString("pt-BR", { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <span style={{ fontSize: 12, color: "#a1a1aa" }}>
                  {selectedDayTasks.length} {selectedDayTasks.length === 1 ? "tarefa" : "tarefas"}
                </span>
              </div>

              {selectedDayTasks.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {selectedDayTasks.map(task => (
                    <div
                      key={task.id}
                      onClick={() => handleOpenTask(task)}
                      style={{
                        backgroundColor: "#18181c",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 10,
                        padding: "12px 14px",
                        display: "flex",
                        flexDirection: "column",
                        gap: 6,
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: 14, fontWeight: 600, color: "#fafafa" }}>
                          {task.title}
                        </span>
                        <span style={{
                          fontSize: 10,
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: 6,
                          backgroundColor: `${getPriorityColor(task.priority)}25`,
                          color: getPriorityColor(task.priority),
                          border: `1px solid ${getPriorityColor(task.priority)}40`,
                        }}>
                          {getPriorityLabel(task.priority)}
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, color: "#a1a1aa" }}>
                        <span>Coluna: <strong style={{ color: "#d4d4d8" }}>{task.columnName}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div style={{
                  padding: "24px 16px",
                  textAlign: "center",
                  backgroundColor: "rgba(255,255,255,0.02)",
                  borderRadius: 10,
                  border: "1px dashed rgba(255,255,255,0.08)",
                  color: "#71717a",
                  fontSize: 13,
                }}>
                  Nenhuma tarefa com vencimento nesta data
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Mobile Agenda Full List */
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {monthTasks.length > 0 ? (
              monthTasks.map(task => {
                const taskDate = new Date(task.dueDate);
                return (
                  <div
                    key={task.id}
                    onClick={() => handleOpenTask(task)}
                    style={{
                      backgroundColor: "#18181c",
                      border: "1px solid rgba(255,255,255,0.08)",
                      borderRadius: 10,
                      padding: "12px 14px",
                      display: "flex",
                      flexDirection: "column",
                      gap: 6,
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: 14, fontWeight: 600, color: "#fafafa" }}>
                        {task.title}
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: 6,
                        backgroundColor: `${getPriorityColor(task.priority)}25`,
                        color: getPriorityColor(task.priority),
                        border: `1px solid ${getPriorityColor(task.priority)}40`,
                      }}>
                        {getPriorityLabel(task.priority)}
                      </span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11, color: "#a1a1aa" }}>
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <Clock size={12} />
                        {taskDate.toLocaleDateString("pt-BR", { day: "numeric", month: "short" })}
                      </span>
                      <span>{task.columnName}</span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div style={{
                padding: "36px 16px",
                textAlign: "center",
                backgroundColor: "rgba(255,255,255,0.02)",
                borderRadius: 10,
                border: "1px dashed rgba(255,255,255,0.08)",
                color: "#71717a",
                fontSize: 13,
              }}>
                Nenhuma tarefa agendada para {monthNames[currentDate.getMonth()]}.
              </div>
            )}
          </div>
        )
      ) : (
        /* DESKTOP VIEW (100% Original High-Fidelity 7-Column Grid) */
        <div style={{ 
          backgroundColor: "#1a1a1a", 
          border: "1px solid #242424", 
          borderRadius: "8px", 
          overflow: "hidden" 
        }}>
          {/* Days of week header */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid #242424", backgroundColor: "#2b2b2e" }}>
            {["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"].map(day => (
              <div key={day} style={{ padding: "12px 8px", textAlign: "center", fontWeight: "500", color: "#a1a1aa", fontSize: "14px", borderRight: "1px solid #242424" }}>
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
            {renderDesktopCells()}
          </div>
        </div>
      )}

      {/* Task Modal on Click */}
      {selectedTask && (
        <TaskModal
          task={selectedTask}
          colId={selectedColId}
          onClose={() => setSelectedTask(null)}
          onSave={() => {
            setSelectedTask(null);
            loadTasks();
          }}
        />
      )}
    </div>
  );
}
