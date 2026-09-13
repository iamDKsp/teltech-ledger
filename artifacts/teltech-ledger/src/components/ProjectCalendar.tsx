import React, { useState, useContext, useEffect } from "react";
import { AppContext } from "../TeltechLedger";
import { API } from "../lib/api";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProjectCalendar() {
  const { activeProject } = useContext(AppContext);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [tasks, setTasks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeProject?.id) return;

    setLoading(true);
    API.get(`/api/projects/${activeProject.id}/board`)
      .then((res: any) => {
        // Extract all tasks with due dates from the columns
        const allTasks: any[] = [];
        res.columns?.forEach((col: any) => {
          col.tasks?.forEach((task: any) => {
            if (task.dueDate) {
              allTasks.push({ ...task, columnName: col.title });
            }
          });
        });
        setTasks(allTasks);
      })
      .catch((err) => console.error(err))
      .finally(() => setLoading(false));
  }, [activeProject?.id]);

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

  const getTasksForDate = (date: Date) => {
    return tasks.filter(t => {
      const taskDate = new Date(t.dueDate);
      return taskDate.getFullYear() === date.getFullYear() &&
             taskDate.getMonth() === date.getMonth() &&
             taskDate.getDate() === date.getDate();
    });
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return date.getFullYear() === today.getFullYear() &&
           date.getMonth() === today.getMonth() &&
           date.getDate() === today.getDate();
  };

  const renderCells = () => {
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
              onClick={() => console.log(task.id)}
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

  if (loading) {
    return <div style={{ padding: "24px", color: "#fafafa" }}>Carregando calendário...</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", padding: "24px", color: "#fafafa", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
        <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "600" }}>Calendário</h2>
        
        <div style={{ display: "flex", alignItems: "center", gap: "16px", backgroundColor: "#1a1a1a", padding: "8px 16px", borderRadius: "8px", border: "1px solid #242424" }}>
          <button onClick={prevMonth} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ChevronLeft size={20} />
          </button>
          
          <span style={{ fontSize: "16px", fontWeight: "500", minWidth: "140px", textAlign: "center" }}>
            {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
          </span>
          
          <button onClick={nextMonth} style={{ background: "none", border: "none", color: "#a1a1aa", cursor: "pointer", display: "flex", alignItems: "center" }}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

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
          {renderCells()}
        </div>
      </div>
    </div>
  );
}
