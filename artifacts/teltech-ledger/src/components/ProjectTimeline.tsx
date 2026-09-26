import React, { useState, useEffect, useContext, useRef, useMemo, useCallback } from "react";
import { AppContext, Task, AvatarCluster, API } from "../TeltechLedger";
import { useAuth } from "../lib/auth-context";
import { TaskModal } from "./TaskModal";
import {
  Calendar,
  Clock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Plus,
  Search,
  Milestone,
  Target,
  Check,
  Layers,
  CalendarDays,
  ArrowRight,
  X,
  FolderKanban,
  CheckCircle,
  TrendingUp,
} from "lucide-react";

// ─── Interfaces ────────────────────────────────────────────────────────────────

interface TimelineTask {
  id: string;
  title: string;
  columnId: string;
  columnTitle: string;
  startDate: Date;
  dueDate: Date;
  priority: "low" | "normal" | "high" | "urgent";
  assignees: { id: string; name: string; avatarUrl?: string | null }[];
  tags: { id: string; label: string; color: string }[];
  subtaskCount: number;
  subtaskCompletedCount: number;
  progress: number;
  rawTask: any;
}

interface MilestoneItem {
  id: string;
  title: string;
  description: string;
  targetDate: string; // YYYY-MM-DD
  status: "no_prazo" | "em_risco" | "atrasado" | "concluido";
  taskIds: string[];
}

type ViewMode = "timeline" | "roadmap";
type ZoomLevel = "dias" | "semanas" | "meses";
type GroupBy = "column" | "assignee";

// ─── Color Helpers ─────────────────────────────────────────────────────────────

const PRIORITY_CONFIG: Record<string, { label: string; color: string }> = {
  low: { label: "Baixa", color: "#10B981" },
  normal: { label: "Normal", color: "#3B82F6" },
  high: { label: "Alta", color: "#F59E0B" },
  urgent: { label: "Urgente", color: "#EF4444" },
};

function getColumnTheme(colTitle: string) {
  const lower = colTitle.toLowerCase();
  if (lower.includes("conclu") || lower.includes("done")) {
    return {
      bg: "linear-gradient(135deg, rgba(16, 185, 129, 0.28), rgba(16, 185, 129, 0.12))",
      border: "rgba(16, 185, 129, 0.45)",
      glow: "0 0 16px rgba(16, 185, 129, 0.25)",
      text: "#10B981",
      badgeBg: "rgba(16, 185, 129, 0.15)",
    };
  }
  if (lower.includes("andamento") || lower.includes("doing") || lower.includes("progresso")) {
    return {
      bg: "linear-gradient(135deg, rgba(124, 90, 194, 0.38), rgba(124, 90, 194, 0.15))",
      border: "rgba(124, 90, 194, 0.55)",
      glow: "0 0 20px rgba(124, 90, 194, 0.35)",
      text: "#A78BFA",
      badgeBg: "rgba(124, 90, 194, 0.2)",
    };
  }
  if (lower.includes("revis") || lower.includes("review")) {
    return {
      bg: "linear-gradient(135deg, rgba(236, 72, 153, 0.3), rgba(236, 72, 153, 0.12))",
      border: "rgba(236, 72, 153, 0.45)",
      glow: "0 0 16px rgba(236, 72, 153, 0.25)",
      text: "#F472B6",
      badgeBg: "rgba(236, 72, 153, 0.15)",
    };
  }
  // To Do / Outros
  return {
    bg: "linear-gradient(135deg, rgba(59, 130, 246, 0.3), rgba(59, 130, 246, 0.12))",
    border: "rgba(59, 130, 246, 0.4)",
    glow: "0 0 16px rgba(59, 130, 246, 0.2)",
    text: "#60A5FA",
    badgeBg: "rgba(59, 130, 246, 0.15)",
  };
}

// ─── Componente Principal ──────────────────────────────────────────────────────

export function ProjectTimeline() {
  const { activeProject } = useContext(AppContext);
  const { token } = useAuth();

  // Estados principais
  const [viewMode, setViewMode] = useState<ViewMode>("timeline");
  const [zoom, setZoom] = useState<ZoomLevel>("dias");
  const [groupBy, setGroupBy] = useState<GroupBy>("column");
  const [search, setSearch] = useState("");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [selectedTask, setSelectedTask] = useState<{ task: Task; colId: string } | null>(null);

  // Estados de dados
  const [loading, setLoading] = useState(true);
  const [columnsData, setColumnsData] = useState<any[]>([]);
  const [tasks, setTasks] = useState<TimelineTask[]>([]);
  const [milestones, setMilestones] = useState<MilestoneItem[]>([]);
  const [showNewMilestoneModal, setShowNewMilestoneModal] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // Timeline Scroll & Date Range
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [referenceDate] = useState<Date>(new Date());

  // ─── Carregar Dados do Projeto ───────────────────────────────────────────────

  const loadProjectBoard = useCallback(async () => {
    if (!activeProject?.id) return;
    setLoading(true);
    try {
      const res = await API.get(`/api/projects/${activeProject.id}/board`);
      if (res.columns) {
        setColumnsData(res.columns);
        const mappedTasks: TimelineTask[] = [];

        res.columns.forEach((col: any) => {
          col.tasks?.forEach((t: any) => {
            const hasDue = !!t.dueDate;
            const due = hasDue ? new Date(t.dueDate) : new Date(Date.now() + 86400000 * 3);
            const created = t.createdAt ? new Date(t.createdAt) : new Date(Date.now() - 86400000 * 3);
            
            // Se startDate não existe, estima baseado no createdAt ou 3 dias antes do vencimento
            let start = new Date(created);
            if (start > due) {
              start = new Date(due.getTime() - 86400000 * 3);
            }
            if (due.getTime() - start.getTime() < 86400000) {
              start = new Date(due.getTime() - 86400000 * 2);
            }

            const totalSubs = t.subtaskCount || 0;
            const compSubs = t.subtaskCompletedCount || 0;
            const progress = totalSubs > 0 
              ? Math.round((compSubs / totalSubs) * 100) 
              : (col.title.toLowerCase().includes("conclu") ? 100 : (col.title.toLowerCase().includes("andamento") ? 50 : 0));

            mappedTasks.push({
              id: t.id,
              title: t.title || "Sem título",
              columnId: col.id,
              columnTitle: col.title,
              startDate: start,
              dueDate: due,
              priority: t.priority || "normal",
              assignees: t.assignees || [],
              tags: t.tags || [],
              subtaskCount: totalSubs,
              subtaskCompletedCount: compSubs,
              progress,
              rawTask: t,
            });
          });
        });

        setTasks(mappedTasks);
      }
    } catch (err) {
      console.error("Falha ao carregar timeline:", err);
    } finally {
      setLoading(false);
    }
  }, [activeProject?.id]);

  useEffect(() => {
    loadProjectBoard();
  }, [loadProjectBoard]);

  // Carregar / Inicializar Marcos Padrão
  useEffect(() => {
    if (!activeProject?.id) return;
    const storageKey = `teltech_milestones_${activeProject.id}`;
    const saved = localStorage.getItem(storageKey);
    if (saved) {
      try {
        setMilestones(JSON.parse(saved));
        return;
      } catch (e) {
        console.error("Erro ao ler marcos salvos:", e);
      }
    }

    // Marcos padrão inteligentes gerados a partir do projeto
    const defaultMilestones: MilestoneItem[] = [
      {
        id: "m1",
        title: "Sprint 1: Planejamento & Definição de Arquitetura",
        description: "Alinhamento de requisitos, arquitetura base e layout preliminar das telas.",
        targetDate: new Date(Date.now() + 86400000 * 7).toISOString().split("T")[0],
        status: "concluido",
        taskIds: [],
      },
      {
        id: "m2",
        title: "Sprint 2: Integração e Desenvolvimento de Recursos",
        description: "Construção das funcionalidades centrais, comunicação com APIs e fluxos principais.",
        targetDate: new Date(Date.now() + 86400000 * 18).toISOString().split("T")[0],
        status: "no_prazo",
        taskIds: [],
      },
      {
        id: "m3",
        title: "Release Beta: Testes de Homologação & Validação",
        description: "Refinamento de performance, validação com usuários-chave e ajustes de UX.",
        targetDate: new Date(Date.now() + 86400000 * 30).toISOString().split("T")[0],
        status: "no_prazo",
        taskIds: [],
      },
    ];
    setMilestones(defaultMilestones);
  }, [activeProject?.id]);

  // Salvar marcos sempre que mudarem
  const saveMilestones = (updated: MilestoneItem[]) => {
    setMilestones(updated);
    if (activeProject?.id) {
      localStorage.setItem(`teltech_milestones_${activeProject.id}`, JSON.stringify(updated));
    }
  };

  // ─── Configurações de Escala de Tempo (Gantt) ──────────────────────────────────

  const { daysArray, columnWidth, timelineStartDate } = useMemo(() => {
    let daysBefore = 10;
    let daysAfter = 30;
    let colWidth = 48;

    if (zoom === "dias") {
      daysBefore = 12;
      daysAfter = 36;
      colWidth = 52;
    } else if (zoom === "semanas") {
      daysBefore = 21;
      daysAfter = 70;
      colWidth = 32;
    } else if (zoom === "meses") {
      daysBefore = 45;
      daysAfter = 150;
      colWidth = 18;
    }

    const start = new Date(referenceDate);
    start.setDate(start.getDate() - daysBefore);
    start.setHours(0, 0, 0, 0);

    const end = new Date(referenceDate);
    end.setDate(end.getDate() + daysAfter);
    end.setHours(23, 59, 59, 999);

    const days: Date[] = [];
    const curr = new Date(start);
    while (curr <= end) {
      days.push(new Date(curr));
      curr.setDate(curr.getDate() + 1);
    }

    return {
      daysArray: days,
      columnWidth: colWidth,
      timelineStartDate: start,
      timelineEndDate: end,
    };
  }, [referenceDate, zoom]);

  // Centralizar na data de "Hoje"
  const scrollToToday = useCallback(() => {
    if (!timelineScrollRef.current) return;
    const today = new Date();
    const diffTime = today.getTime() - timelineStartDate.getTime();
    const diffDays = diffTime / (1000 * 3600 * 24);
    const scrollPos = diffDays * columnWidth - 250;
    timelineScrollRef.current.scrollTo({ left: Math.max(0, scrollPos), behavior: "smooth" });
  }, [timelineStartDate, columnWidth]);

  useEffect(() => {
    if (loading) return;
    const timeout = setTimeout(scrollToToday, 250);
    return () => clearTimeout(timeout);
  }, [loading, zoom, scrollToToday]);

  // Filtragem de Tarefas
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const matchSearch = !search || t.title.toLowerCase().includes(search.toLowerCase());
      const matchPriority = priorityFilter === "all" || t.priority === priorityFilter;
      return matchSearch && matchPriority;
    });
  }, [tasks, search, priorityFilter]);

  // Agrupamento de Tarefas
  const groupedTasks = useMemo(() => {
    if (groupBy === "column") {
      const groups: { id: string; title: string; theme: any; tasks: TimelineTask[] }[] = [];
      columnsData.forEach((col) => {
        const colTasks = filteredTasks.filter((t) => t.columnId === col.id);
        groups.push({
          id: col.id,
          title: col.title,
          theme: getColumnTheme(col.title),
          tasks: colTasks,
        });
      });
      return groups;
    } else {
      // Agrupar por Responsável
      const map: Record<string, { id: string; title: string; theme: any; tasks: TimelineTask[] }> = {
        unassigned: {
          id: "unassigned",
          title: "Sem Responsável",
          theme: { bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.15)", text: "#999" },
          tasks: [],
        },
      };

      filteredTasks.forEach((t) => {
        if (!t.assignees || t.assignees.length === 0) {
          map.unassigned.tasks.push(t);
        } else {
          t.assignees.forEach((a) => {
            if (!map[a.id]) {
              map[a.id] = {
                id: a.id,
                title: a.name,
                theme: { bg: "rgba(124,90,194,0.12)", border: "rgba(124,90,194,0.35)", text: "#A78BFA" },
                tasks: [],
              };
            }
            map[a.id].tasks.push(t);
          });
        }
      });

      return Object.values(map).filter((g) => g.tasks.length > 0 || g.id !== "unassigned");
    }
  }, [filteredTasks, groupBy, columnsData]);

  // Alternar Colapso de Grupo
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({ ...prev, [groupId]: !prev[groupId] }));
  };

  // Calcular posição e largura da barra na timeline
  const getTaskCoordinates = (task: TimelineTask) => {
    const startMs = task.startDate.getTime();
    const dueMs = task.dueDate.getTime();
    const timelineStartMs = timelineStartDate.getTime();

    const startDays = (startMs - timelineStartMs) / (1000 * 3600 * 24);
    const durationDays = Math.max(1, (dueMs - startMs) / (1000 * 3600 * 24));

    const left = Math.round(startDays * columnWidth);
    const width = Math.max(columnWidth * 0.9, Math.round(durationDays * columnWidth));

    return { left, width };
  };

  // Posição da linha "Hoje"
  const todayPosition = useMemo(() => {
    const today = new Date();
    const diff = (today.getTime() - timelineStartDate.getTime()) / (1000 * 3600 * 24);
    return Math.round(diff * columnWidth);
  }, [timelineStartDate, columnWidth]);

  // ─── Modal Task Trigger ───────────────────────────────────────────────────────

  const handleOpenTask = (t: TimelineTask) => {
    setSelectedTask({
      task: {
        id: t.id,
        title: t.title,
        tags: t.tags as any,
        assignees: t.assignees.length,
        timerState: "idle",
        timerValue: "00:00",
        progress: t.progress,
        estTime: "",
      },
      colId: t.columnId,
    });
  };

  // ─── Handlers de Drag & Resize Rápido ──────────────────────────────────────────

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null);
  const dragStartRef = useRef<{ startX: number; originalStartMs: number; originalDueMs: number } | null>(null);

  const handleMouseDownBar = (e: React.MouseEvent, task: TimelineTask) => {
    e.stopPropagation();
    setDraggingTaskId(task.id);
    dragStartRef.current = {
      startX: e.clientX,
      originalStartMs: task.startDate.getTime(),
      originalDueMs: task.dueDate.getTime(),
    };

    const handleMouseMove = (moveEvent: MouseEvent) => {
      if (!dragStartRef.current) return;
      const dx = moveEvent.clientX - dragStartRef.current.startX;
      const dayDelta = Math.round(dx / columnWidth);
      if (dayDelta === 0) return;

      const deltaMs = dayDelta * 86400000;
      setTasks((prev) =>
        prev.map((t) => {
          if (t.id !== task.id) return t;
          return {
            ...t,
            startDate: new Date(dragStartRef.current!.originalStartMs + deltaMs),
            dueDate: new Date(dragStartRef.current!.originalDueMs + deltaMs),
          };
        })
      );
    };

    const handleMouseUp = async (upEvent: MouseEvent) => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      setDraggingTaskId(null);

      if (!dragStartRef.current || !activeProject) return;
      const dx = upEvent.clientX - dragStartRef.current.startX;
      const dayDelta = Math.round(dx / columnWidth);
      if (dayDelta === 0) return;

      const newDue = new Date(dragStartRef.current.originalDueMs + dayDelta * 86400000);
      try {
        await fetch(`${API}/api/projects/${activeProject.id}/tasks/${task.id}`, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ dueDate: newDue.toISOString() }),
        });
      } catch (err) {
        console.error("Falha ao salvar novo prazo:", err);
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  // ─── Renderização dos Meses no Topo do Grid ───────────────────────────────────

  const monthHeaders = useMemo(() => {
    const headers: { monthName: string; count: number }[] = [];
    let currentMonth = "";
    let count = 0;

    daysArray.forEach((d) => {
      const mName = d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      const capMonth = mName.charAt(0).toUpperCase() + mName.slice(1);
      if (capMonth !== currentMonth) {
        if (currentMonth) {
          headers.push({ monthName: currentMonth, count });
        }
        currentMonth = capMonth;
        count = 1;
      } else {
        count++;
      }
    });
    if (currentMonth) {
      headers.push({ monthName: currentMonth, count });
    }
    return headers;
  }, [daysArray]);

  if (loading && tasks.length === 0) {
    return (
      <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", minHeight: 400, gap: 14 }}>
        <div
          style={{
            width: 36,
            height: 36,
            borderRadius: "50%",
            border: "3px solid rgba(124,90,194,0.18)",
            borderTopColor: "#9B6DE3",
            animation: "spin 0.8s linear infinite",
          }}
        />
        <span style={{ fontSize: 13, color: "#8E8E9A" }}>Carregando cronograma do projeto...</span>
      </div>
    );
  }

  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", height: "100%", background: "#111113", overflow: "hidden" }}>
      
      {/* ─── Top Control Header ─────────────────────────────────────────────── */}
      <div
        style={{
          padding: "14px 20px",
          background: "#161618",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 12,
          flexShrink: 0,
        }}
      >
        {/* Esquerda: Switcher de Visão (Timeline vs Roadmap) & Agrupamento */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          {/* View Mode Toggle Pill */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              background: "#202024",
              border: "1px solid rgba(255,255,255,0.08)",
              borderRadius: 8,
              padding: 3,
            }}
          >
            <button
              onClick={() => setViewMode("timeline")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 14px",
                borderRadius: 6,
                background: viewMode === "timeline" ? "linear-gradient(135deg, #7C5AC2, #6044A8)" : "transparent",
                color: viewMode === "timeline" ? "#FFFFFF" : "#888892",
                fontWeight: viewMode === "timeline" ? 600 : 400,
                fontSize: 12.5,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: viewMode === "timeline" ? "0 2px 8px rgba(124,90,194,0.4)" : "none",
              }}
            >
              <CalendarDays size={14} />
              Linha do Tempo (Gantt)
            </button>

            <button
              onClick={() => setViewMode("roadmap")}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 7,
                padding: "6px 14px",
                borderRadius: 6,
                background: viewMode === "roadmap" ? "linear-gradient(135deg, #7C5AC2, #6044A8)" : "transparent",
                color: viewMode === "roadmap" ? "#FFFFFF" : "#888892",
                fontWeight: viewMode === "roadmap" ? 600 : 400,
                fontSize: 12.5,
                border: "none",
                cursor: "pointer",
                transition: "all 0.15s ease",
                boxShadow: viewMode === "roadmap" ? "0 2px 8px rgba(124,90,194,0.4)" : "none",
              }}
            >
              <Milestone size={14} />
              Roadmap de Marcos
            </button>
          </div>

          {/* Seletor de Agrupamento (Apenas no Gantt) */}
          {viewMode === "timeline" && (
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: 8 }}>
              <span style={{ fontSize: 12, color: "#666672" }}>Agrupar:</span>
              <div
                style={{
                  display: "inline-flex",
                  background: "#1c1c20",
                  borderRadius: 6,
                  border: "1px solid rgba(255,255,255,0.06)",
                  padding: 2,
                }}
              >
                <button
                  onClick={() => setGroupBy("column")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 11.5,
                    border: "none",
                    cursor: "pointer",
                    background: groupBy === "column" ? "#2B2B32" : "transparent",
                    color: groupBy === "column" ? "#E5E5EB" : "#777782",
                    fontWeight: groupBy === "column" ? 600 : 400,
                  }}
                >
                  Por Etapa
                </button>
                <button
                  onClick={() => setGroupBy("assignee")}
                  style={{
                    padding: "4px 10px",
                    borderRadius: 4,
                    fontSize: 11.5,
                    border: "none",
                    cursor: "pointer",
                    background: groupBy === "assignee" ? "#2B2B32" : "transparent",
                    color: groupBy === "assignee" ? "#E5E5EB" : "#777782",
                    fontWeight: groupBy === "assignee" ? 600 : 400,
                  }}
                >
                  Por Membro
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Direita: Controles de Busca, Filtros, Zoom e Botão de Ação */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* Campo de Busca Rápida */}
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: "#1C1C20",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "5px 10px",
              minWidth: 160,
            }}
          >
            <Search size={13} color="#777" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar tarefa..."
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "#E0E0E6",
                fontSize: 12,
                width: 110,
              }}
            />
            {search && (
              <X size={12} color="#777" style={{ cursor: "pointer" }} onClick={() => setSearch("")} />
            )}
          </div>

          {/* Filtro por Prioridade */}
          <select
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value)}
            style={{
              background: "#1C1C20",
              border: "1px solid rgba(255,255,255,0.07)",
              borderRadius: 8,
              padding: "5px 8px",
              color: "#A1A1AA",
              fontSize: 12,
              outline: "none",
              cursor: "pointer",
            }}
          >
            <option value="all">Todas Prioridades</option>
            <option value="urgent">Urgente</option>
            <option value="high">Alta</option>
            <option value="normal">Normal</option>
            <option value="low">Baixa</option>
          </select>

          {/* Controles de Zoom (Apenas na Linha do Tempo) */}
          {viewMode === "timeline" && (
            <>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  background: "#1C1C20",
                  borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.07)",
                  padding: 2,
                }}
              >
                {(["dias", "semanas", "meses"] as ZoomLevel[]).map((z) => (
                  <button
                    key={z}
                    onClick={() => setZoom(z)}
                    style={{
                      padding: "4px 9px",
                      borderRadius: 6,
                      fontSize: 11.5,
                      border: "none",
                      cursor: "pointer",
                      background: zoom === z ? "#2B2B32" : "transparent",
                      color: zoom === z ? "#FFFFFF" : "#777782",
                      fontWeight: zoom === z ? 600 : 400,
                      textTransform: "capitalize",
                    }}
                  >
                    {z}
                  </button>
                ))}
              </div>

              {/* Botão Hoje */}
              <button
                onClick={scrollToToday}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 5,
                  padding: "5px 11px",
                  borderRadius: 8,
                  background: "rgba(124,90,194,0.12)",
                  border: "1px solid rgba(124,90,194,0.3)",
                  color: "#9B6DE3",
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                }}
                title="Rolar para o dia de hoje"
              >
                <Clock size={13} />
                Hoje
              </button>
            </>
          )}

          {/* Botão de Criação */}
          {viewMode === "roadmap" && (
            <button
              onClick={() => setShowNewMilestoneModal(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "6px 13px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #7C5AC2, #6044A8)",
                border: "none",
                color: "#FFFFFF",
                fontSize: 12.5,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(124,90,194,0.4)",
              }}
            >
              <Plus size={14} />
              Novo Marco
            </button>
          )}
        </div>
      </div>

      {/* ─── Conteúdo Principal: Alternância entre Modos ───────────────────── */}
      {viewMode === "timeline" ? (
        /* ══════════════════════════════════════════════════════════════════════
           MODO 1: LINHA DO TEMPO / GANTT INTERATIVO
        ══════════════════════════════════════════════════════════════════════ */
        <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
          
          {/* Painel Esquerdo: Lista de Tarefas / Grupos */}
          <div
            style={{
              width: 320,
              minWidth: 320,
              background: "#161618",
              borderRight: "1px solid rgba(255,255,255,0.06)",
              display: "flex",
              flexDirection: "column",
              zIndex: 10,
              boxShadow: "4px 0 20px rgba(0,0,0,0.35)",
            }}
          >
            {/* Header da Coluna de Tarefas */}
            <div
              style={{
                height: 64,
                padding: "0 16px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                borderBottom: "1px solid rgba(255,255,255,0.06)",
                background: "#18181C",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <Layers size={15} color="#A78BFA" />
                <span style={{ fontSize: 13, fontWeight: 700, color: "#EDEDF0" }}>
                  {groupBy === "column" ? "Etapas & Tarefas" : "Responsáveis"}
                </span>
              </div>
              <span style={{ fontSize: 11, color: "#666", background: "#222226", padding: "2px 7px", borderRadius: 10 }}>
                {filteredTasks.length} {filteredTasks.length === 1 ? "tarefa" : "tarefas"}
              </span>
            </div>

            {/* Lista dos Grupos & Tarefas */}
            <div style={{ flex: 1, overflowY: "auto", overflowX: "hidden" }}>
              {groupedTasks.map((group) => {
                const isCollapsed = !!collapsedGroups[group.id];
                return (
                  <div key={group.id} style={{ borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                    {/* Header do Grupo */}
                    <div
                      onClick={() => toggleGroupCollapse(group.id)}
                      style={{
                        padding: "10px 14px",
                        background: "rgba(255,255,255,0.02)",
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        cursor: "pointer",
                        borderLeft: `3px solid ${group.theme.text}`,
                        userSelect: "none",
                      }}
                    >
                      <span style={{ color: "#777", display: "flex" }}>
                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} style={{ transform: "rotate(-90deg)" }} />}
                      </span>
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: "#E0E0E6", flex: 1 }}>
                        {group.title}
                      </span>
                      <span
                        style={{
                          fontSize: 10.5,
                          padding: "1px 6px",
                          borderRadius: 8,
                          background: group.theme.badgeBg || "rgba(255,255,255,0.06)",
                          color: group.theme.text,
                          fontWeight: 600,
                        }}
                      >
                        {group.tasks.length}
                      </span>
                    </div>

                    {/* Linhas das Tarefas */}
                    {!isCollapsed &&
                      group.tasks.map((task) => (
                        <div
                          key={task.id}
                          onClick={() => handleOpenTask(task)}
                          style={{
                            height: 48,
                            padding: "0 14px 0 26px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            borderBottom: "1px solid rgba(255,255,255,0.02)",
                            cursor: "pointer",
                            transition: "background 0.12s",
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
                          onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: 8, overflow: "hidden", flex: 1, paddingRight: 8 }}>
                            <span
                              style={{
                                width: 7,
                                height: 7,
                                borderRadius: "50%",
                                background: PRIORITY_CONFIG[task.priority]?.color || "#3B82F6",
                                flexShrink: 0,
                              }}
                            />
                            <span
                              style={{
                                fontSize: 12,
                                color: "#D4D4D8",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                              title={task.title}
                            >
                              {task.title}
                            </span>
                          </div>

                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                            {task.subtaskCount > 0 && (
                              <span style={{ fontSize: 10.5, color: "#777", display: "inline-flex", alignItems: "center", gap: 3 }}>
                                <CheckCircle2 size={11} color={task.subtaskCompletedCount === task.subtaskCount ? "#10B981" : "#888"} />
                                {task.subtaskCompletedCount}/{task.subtaskCount}
                              </span>
                            )}
                            {task.assignees.length > 0 && (
                              <AvatarCluster assignees={task.assignees} size={20} />
                            )}
                          </div>
                        </div>
                      ))}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Painel Direito: Grid da Linha do Tempo e Régua */}
          <div
            ref={timelineScrollRef}
            style={{
              flex: 1,
              overflowX: "auto",
              overflowY: "auto",
              position: "relative",
              background: "#111113",
            }}
          >
            <div style={{ minWidth: daysArray.length * columnWidth, position: "relative" }}>
              
              {/* ─── Header da Régua Temporal ─────────────────────────────── */}
              <div
                style={{
                  position: "sticky",
                  top: 0,
                  zIndex: 20,
                  background: "#18181C",
                  borderBottom: "1px solid rgba(255,255,255,0.07)",
                }}
              >
                {/* Linha dos Meses */}
                <div style={{ display: "flex", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  {monthHeaders.map((m, idx) => (
                    <div
                      key={idx}
                      style={{
                        width: m.count * columnWidth,
                        padding: "6px 12px",
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#9B6DE3",
                        letterSpacing: "0.5px",
                        textTransform: "uppercase",
                        borderRight: "1px solid rgba(255,255,255,0.04)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {m.monthName}
                    </div>
                  ))}
                </div>

                {/* Linha dos Dias / Colunas */}
                <div style={{ display: "flex" }}>
                  {daysArray.map((day, i) => {
                    const isToday = day.toDateString() === new Date().toDateString();
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div
                        key={i}
                        style={{
                          width: columnWidth,
                          height: 38,
                          display: "flex",
                          flexDirection: "column",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRight: "1px solid rgba(255,255,255,0.03)",
                          background: isToday ? "rgba(124,90,194,0.12)" : isWeekend ? "rgba(0,0,0,0.2)" : "transparent",
                          position: "relative",
                        }}
                      >
                        <span
                          style={{
                            fontSize: 10,
                            color: isToday ? "#A78BFA" : "#666",
                            fontWeight: isToday ? 700 : 400,
                          }}
                        >
                          {day.toLocaleDateString("pt-BR", { weekday: "narrow" })}
                        </span>
                        <span
                          style={{
                            fontSize: 12,
                            fontWeight: isToday ? 700 : 500,
                            color: isToday ? "#FFFFFF" : isWeekend ? "#777" : "#BBB",
                          }}
                        >
                          {day.getDate()}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* ─── Marcador Luminoso de "Hoje" ────────────────────────────── */}
              <div
                style={{
                  position: "absolute",
                  left: todayPosition + columnWidth / 2,
                  top: 0,
                  bottom: 0,
                  width: 2,
                  background: "linear-gradient(to bottom, #A78BFA, #7C5AC2)",
                  boxShadow: "0 0 12px rgba(124,90,194,0.8), 0 0 24px rgba(124,90,194,0.4)",
                  zIndex: 15,
                  pointerEvents: "none",
                }}
              >
                <div
                  style={{
                    position: "sticky",
                    top: 68,
                    transform: "translateX(-50%)",
                    background: "#7C5AC2",
                    color: "#FFF",
                    padding: "2px 7px",
                    borderRadius: 4,
                    fontSize: 10,
                    fontWeight: 700,
                    boxShadow: "0 2px 8px rgba(0,0,0,0.5)",
                  }}
                >
                  Hoje
                </div>
              </div>

              {/* ─── Grid de Fundo e Linhas de Tarefas ───────────────────────── */}
              <div style={{ position: "relative" }}>
                
                {/* Linhas verticais do grid */}
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    display: "flex",
                    pointerEvents: "none",
                  }}
                >
                  {daysArray.map((day, i) => {
                    const isWeekend = day.getDay() === 0 || day.getDay() === 6;
                    return (
                      <div
                        key={i}
                        style={{
                          width: columnWidth,
                          height: "100%",
                          borderRight: "1px solid rgba(255,255,255,0.025)",
                          background: isWeekend ? "rgba(0,0,0,0.12)" : "transparent",
                        }}
                      />
                    );
                  })}
                </div>

                {/* Linhas de tarefas agrupadas */}
                {groupedTasks.map((group) => {
                  const isCollapsed = !!collapsedGroups[group.id];
                  return (
                    <div key={group.id} style={{ position: "relative" }}>
                      {/* Espaçador de Cabeçalho do Grupo */}
                      <div
                        style={{
                          height: 38,
                          background: "rgba(255,255,255,0.015)",
                          borderBottom: "1px solid rgba(255,255,255,0.03)",
                        }}
                      />

                      {/* Tarefas dentro do grupo */}
                      {!isCollapsed &&
                        group.tasks.map((task) => {
                          const { left, width } = getTaskCoordinates(task);
                          const isBeingDragged = draggingTaskId === task.id;
                          const theme = getColumnTheme(task.columnTitle);

                          return (
                            <div
                              key={task.id}
                              style={{
                                height: 48,
                                position: "relative",
                                borderBottom: "1px solid rgba(255,255,255,0.02)",
                                display: "flex",
                                alignItems: "center",
                              }}
                            >
                              {/* Barra da Tarefa (Gantt Bar) */}
                              <div
                                onMouseDown={(e) => handleMouseDownBar(e, task)}
                                onDoubleClick={() => handleOpenTask(task)}
                                style={{
                                  position: "absolute",
                                  left,
                                  width,
                                  height: 32,
                                  borderRadius: 8,
                                  background: theme.bg,
                                  border: `1px solid ${theme.border}`,
                                  boxShadow: isBeingDragged ? "0 8px 24px rgba(0,0,0,0.7)" : theme.glow,
                                  cursor: isBeingDragged ? "grabbing" : "grab",
                                  display: "flex",
                                  alignItems: "center",
                                  padding: "0 10px",
                                  gap: 8,
                                  zIndex: isBeingDragged ? 30 : 5,
                                  overflow: "hidden",
                                  userSelect: "none",
                                  transition: isBeingDragged ? "none" : "box-shadow 0.15s, transform 0.12s",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isBeingDragged) e.currentTarget.style.transform = "translateY(-1px)";
                                }}
                                onMouseLeave={(e) => {
                                  if (!isBeingDragged) e.currentTarget.style.transform = "none";
                                }}
                              >
                                {/* Progresso de Subtarefas (Preenchimento Interno) */}
                                {task.progress > 0 && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      left: 0,
                                      top: 0,
                                      bottom: 0,
                                      width: `${task.progress}%`,
                                      background: "rgba(255,255,255,0.08)",
                                      zIndex: 1,
                                      pointerEvents: "none",
                                    }}
                                  />
                                )}

                                {/* Conteúdo da Barra */}
                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: 7,
                                    zIndex: 2,
                                    width: "100%",
                                    overflow: "hidden",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: 6,
                                      height: 6,
                                      borderRadius: "50%",
                                      background: PRIORITY_CONFIG[task.priority]?.color || "#3B82F6",
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span
                                    style={{
                                      fontSize: 11.5,
                                      fontWeight: 600,
                                      color: "#FFFFFF",
                                      whiteSpace: "nowrap",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                    }}
                                  >
                                    {task.title}
                                  </span>

                                  {/* Badges de Data e Progresso */}
                                  <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                                    {task.progress > 0 && (
                                      <span style={{ fontSize: 10, fontWeight: 700, color: theme.text }}>
                                        {task.progress}%
                                      </span>
                                    )}
                                    {task.assignees.length > 0 && width > 130 && (
                                      <AvatarCluster assignees={task.assignees} size={18} />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ══════════════════════════════════════════════════════════════════════
           MODO 2: ROADMAP ESTRATÉGICO DE MARCOS (MILESTONES & SPRINTS)
        ══════════════════════════════════════════════════════════════════════ */
        <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
          
          {/* Top Metric Cards */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
              gap: 16,
              marginBottom: 32,
            }}
          >
            {/* Card 1: Total de Marcos */}
            <div
              style={{
                background: "#161618",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(124,90,194,0.12)",
                  border: "1px solid rgba(124,90,194,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#9B6DE3",
                }}
              >
                <Target size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888894" }}>Total de Marcos</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#EDEDF0" }}>
                  {milestones.length}
                </div>
              </div>
            </div>

            {/* Card 2: Concluídos */}
            <div
              style={{
                background: "#161618",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(16,185,129,0.12)",
                  border: "1px solid rgba(16,185,129,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#10B981",
                }}
              >
                <CheckCircle size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888894" }}>Marcos Concluídos</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#10B981" }}>
                  {milestones.filter((m) => m.status === "concluido").length}
                </div>
              </div>
            </div>

            {/* Card 3: No Prazo */}
            <div
              style={{
                background: "#161618",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(59,130,246,0.12)",
                  border: "1px solid rgba(59,130,246,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#3B82F6",
                }}
              >
                <TrendingUp size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888894" }}>No Prazo</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#60A5FA" }}>
                  {milestones.filter((m) => m.status === "no_prazo").length}
                </div>
              </div>
            </div>

            {/* Card 4: Tarefas Conectadas */}
            <div
              style={{
                background: "#161618",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: 12,
                padding: "16px 20px",
                display: "flex",
                alignItems: "center",
                gap: 14,
              }}
            >
              <div
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 10,
                  background: "rgba(245,158,11,0.12)",
                  border: "1px solid rgba(245,158,11,0.25)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#F59E0B",
                }}
              >
                <FolderKanban size={22} />
              </div>
              <div>
                <div style={{ fontSize: 12, color: "#888894" }}>Tarefas no Projeto</div>
                <div style={{ fontSize: 22, fontWeight: 700, color: "#EDEDF0" }}>
                  {tasks.length}
                </div>
              </div>
            </div>
          </div>

          {/* ─── Trilha do Roadmap (Spine Timeline) ────────────────────────────── */}
          <div style={{ maxWidth: 860, margin: "0 auto", position: "relative" }}>
            
            {/* Linha vertical conectora de progresso */}
            <div
              style={{
                position: "absolute",
                left: 27,
                top: 24,
                bottom: 24,
                width: 2,
                background: "linear-gradient(to bottom, #7C5AC2, rgba(124,90,194,0.2))",
                zIndex: 1,
              }}
            />

            {/* Lista dos Cards de Marcos */}
            <div style={{ display: "flex", flexDirection: "column", gap: 24, position: "relative", zIndex: 2 }}>
              {milestones.map((m, index) => {
                const isConcluido = m.status === "concluido";
                const isEmRisco = m.status === "em_risco";
                const isAtrasado = m.status === "atrasado";

                let statusBadge = { label: "No Prazo", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", color: "#10B981" };
                if (isConcluido) statusBadge = { label: "Concluído", bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", color: "#60A5FA" };
                else if (isEmRisco) statusBadge = { label: "Atenção", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)", color: "#F59E0B" };
                else if (isAtrasado) statusBadge = { label: "Atrasado", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.3)", color: "#EF4444" };

                // Progresso simulado ou baseado nas tarefas
                const progressPct = isConcluido ? 100 : Math.min(85, Math.round(((index + 1) / (milestones.length + 1)) * 100));

                return (
                  <div
                    key={m.id}
                    style={{
                      display: "flex",
                      alignItems: "flex-start",
                      gap: 20,
                    }}
                  >
                    {/* Nó Losango / Check Icon */}
                    <div
                      style={{
                        width: 56,
                        height: 56,
                        borderRadius: "50%",
                        background: "#161618",
                        border: `2px solid ${isConcluido ? "#10B981" : "#7C5AC2"}`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                        boxShadow: isConcluido ? "0 0 16px rgba(16,185,129,0.3)" : "0 0 16px rgba(124,90,194,0.35)",
                        zIndex: 3,
                      }}
                    >
                      {isConcluido ? (
                        <Check size={24} color="#10B981" strokeWidth={3} />
                      ) : (
                        <div
                          style={{
                            width: 14,
                            height: 14,
                            background: "#9B6DE3",
                            transform: "rotate(45deg)",
                            borderRadius: 2,
                          }}
                        />
                      )}
                    </div>

                    {/* Card do Marco */}
                    <div
                      style={{
                        flex: 1,
                        background: "rgba(24,24,28,0.95)",
                        backdropFilter: "blur(16px)",
                        border: "1px solid rgba(255,255,255,0.08)",
                        borderRadius: 14,
                        padding: "20px 24px",
                        boxShadow: "0 10px 30px rgba(0,0,0,0.4)",
                        transition: "border-color 0.2s, transform 0.2s",
                      }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = "rgba(124,90,194,0.4)";
                        e.currentTarget.style.transform = "translateY(-2px)";
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)";
                        e.currentTarget.style.transform = "none";
                      }}
                    >
                      {/* Topo do Card: Título, Data e Badge de Status */}
                      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                        <div>
                          <h3 style={{ margin: "0 0 6px 0", fontSize: 16, fontWeight: 700, color: "#EDEDF0" }}>
                            {m.title}
                          </h3>
                          <p style={{ margin: 0, fontSize: 13, color: "#8E8E9A", lineHeight: 1.5 }}>
                            {m.description}
                          </p>
                        </div>

                        {/* Status Badge */}
                        <div
                          style={{
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: statusBadge.bg,
                            border: `1px solid ${statusBadge.border}`,
                            color: statusBadge.color,
                            fontSize: 11.5,
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                          }}
                        >
                          {statusBadge.label}
                        </div>
                      </div>

                      {/* Barra de Progresso */}
                      <div style={{ marginTop: 20 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 6 }}>
                          <span style={{ color: "#777" }}>Progresso de Conclusão</span>
                          <span style={{ fontWeight: 600, color: isConcluido ? "#10B981" : "#9B6DE3" }}>
                            {progressPct}%
                          </span>
                        </div>
                        <div
                          style={{
                            height: 6,
                            background: "rgba(255,255,255,0.06)",
                            borderRadius: 10,
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              height: "100%",
                              width: `${progressPct}%`,
                              borderRadius: 10,
                              background: isConcluido
                                ? "linear-gradient(90deg, #10B981, #34D399)"
                                : "linear-gradient(90deg, #7C5AC2, #9B6DE3)",
                              boxShadow: isConcluido
                                ? "0 0 10px rgba(16,185,129,0.5)"
                                : "0 0 10px rgba(124,90,194,0.5)",
                              transition: "width 0.4s ease",
                            }}
                          />
                        </div>
                      </div>

                      {/* Rodapé do Card: Data Alvo e Ações Rápidas */}
                      <div
                        style={{
                          marginTop: 18,
                          paddingTop: 14,
                          borderTop: "1px solid rgba(255,255,255,0.05)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          fontSize: 12,
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 7, color: "#888894" }}>
                          <Calendar size={14} color="#7C5AC2" />
                          <span>Data Alvo:</span>
                          <span style={{ color: "#CCC", fontWeight: 500 }}>
                            {new Date(m.targetDate + "T12:00:00").toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>

                        {/* Botão de Alternar Status */}
                        <button
                          onClick={() => {
                            const newStatus = isConcluido ? "no_prazo" : "concluido";
                            const updated = milestones.map((item) =>
                              item.id === m.id ? { ...item, status: newStatus as any } : item
                            );
                            saveMilestones(updated);
                          }}
                          style={{
                            background: "transparent",
                            border: "none",
                            color: isConcluido ? "#888" : "#9B6DE3",
                            fontSize: 12,
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                          }}
                        >
                          {isConcluido ? "Reabrir Marco" : "Marcar como Concluído"}
                          <ArrowRight size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ─── Modal para Criar Novo Marco ────────────────────────────────────── */}
      {showNewMilestoneModal && (
        <CreateMilestoneModal
          onClose={() => setShowNewMilestoneModal(false)}
          onSave={(newM) => {
            saveMilestones([...milestones, newM]);
            setShowNewMilestoneModal(false);
          }}
        />
      )}

      {/* ─── Modal de Edição de Tarefas (TaskModal) ─────────────────────────── */}
      {selectedTask && (
        <TaskModal
          task={selectedTask.task}
          colId={selectedTask.colId}
          onClose={() => setSelectedTask(null)}
          onSave={loadProjectBoard}
        />
      )}
    </div>
  );
}

// ─── Modal de Criação de Marco ─────────────────────────────────────────────────

function CreateMilestoneModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (m: MilestoneItem) => void;
}) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [targetDate, setTargetDate] = useState(
    new Date(Date.now() + 86400000 * 14).toISOString().split("T")[0]
  );
  const [status, setStatus] = useState<"no_prazo" | "em_risco" | "concluido">("no_prazo");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      id: "m_" + Date.now(),
      title: title.trim(),
      description: description.trim(),
      targetDate,
      status,
      taskIds: [],
    });
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.75)",
        backdropFilter: "blur(8px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: 20,
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: 480,
          background: "#18181C",
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 16,
          boxShadow: "0 24px 60px rgba(0,0,0,0.8)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <Milestone size={18} color="#9B6DE3" />
            <span style={{ fontSize: 16, fontWeight: 700, color: "#EDEDF0" }}>
              Novo Marco do Projeto
            </span>
          </div>
          <X size={18} color="#777" style={{ cursor: "pointer" }} onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} style={{ padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8E8E9A", marginBottom: 6 }}>
              Título do Marco
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex: Release Beta v1.0 ou Lançamento de Marketing"
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#222228",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#EDEDF0",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8E8E9A", marginBottom: 6 }}>
              Descrição / Entregáveis
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Descreva as principais entregas que compõem este marco..."
              style={{
                width: "100%",
                padding: "10px 12px",
                background: "#222228",
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 8,
                color: "#EDEDF0",
                fontSize: 13,
                outline: "none",
                boxSizing: "border-box",
                resize: "vertical",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8E8E9A", marginBottom: 6 }}>
                Data Alvo
              </label>
              <input
                type="date"
                required
                value={targetDate}
                onChange={(e) => setTargetDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "#222228",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#EDEDF0",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#8E8E9A", marginBottom: 6 }}>
                Status Inicial
              </label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  background: "#222228",
                  border: "1px solid rgba(255,255,255,0.08)",
                  borderRadius: 8,
                  color: "#EDEDF0",
                  fontSize: 13,
                  outline: "none",
                  boxSizing: "border-box",
                  cursor: "pointer",
                }}
              >
                <option value="no_prazo">No Prazo</option>
                <option value="em_risco">Atenção / Em Risco</option>
                <option value="concluido">Já Concluído</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 12 }}>
            <button
              type="button"
              onClick={onClose}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                background: "transparent",
                border: "1px solid rgba(255,255,255,0.1)",
                color: "#999",
                fontSize: 13,
                cursor: "pointer",
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              style={{
                padding: "8px 18px",
                borderRadius: 8,
                background: "linear-gradient(135deg, #7C5AC2, #6044A8)",
                border: "none",
                color: "#FFFFFF",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                boxShadow: "0 2px 10px rgba(124,90,194,0.4)",
              }}
            >
              Salvar Marco
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
