import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth-context";
import { 
  AppContext, 
  API, 
  Task, 
  Column, 
  AvatarCluster, 
  TagBadge, 
  TimerButton, 
  ProgressBar, 
  RenameColumnModal
} from "../TeltechLedger";
import { Loader } from "./Loader";
import { TaskModal } from "./TaskModal";

// ─── Stage Dropdown Component ──────────────────────────────────────────────────

interface StageDropdownProps {
  currentColumnId: string;
  columns: Column[];
  onMove: (colId: string) => void;
}

function StageDropdown({ currentColumnId, columns, onMove }: { currentColumnId: string; columns: Column[]; onMove: (colId: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = columns.find(c => c.id === currentColumnId);
  const ref = useRef<HTMLDivElement>(null);
  
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Determine stage colors
  let dotColor = "#888";
  if (currentColumnId === "done") dotColor = "#3B82F6";
  else if (currentColumnId === "doing") dotColor = "#7C5AC2";
  else if (currentColumnId === "todo") dotColor = "#EAB308";
  else if (currentColumnId === "review") dotColor = "#EC4899";

  return (
    <div ref={ref} style={{ position: "relative", flexShrink: 0 }}>
      <div 
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        style={{ 
          display: "inline-flex", 
          alignItems: "center", 
          gap: 6, 
          padding: "4px 8px", 
          background: "rgba(255,255,255,0.03)", 
          border: "1px solid rgba(255,255,255,0.06)", 
          borderRadius: 6, 
          cursor: "pointer", 
          transition: "all 0.15s", 
          userSelect: "none" 
        }}
        onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.06)"}
        onMouseLeave={e => { if(!open) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
      >
        <span style={{ width: 6, height: 6, borderRadius: "50%", background: dotColor }} />
        <span style={{ fontSize: 11, color: "#aaa", fontWeight: 500 }}>{current?.title || "Mover"}</span>
        <svg width="8" height="8" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2.5" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "" }}>
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>
      {open && (
        <div style={{ 
          position: "absolute", 
          top: "calc(100% + 4px)", 
          left: 0, 
          background: "#1e1e22", 
          border: "1px solid rgba(255,255,255,0.08)", 
          borderRadius: 8, 
          boxShadow: "0 12px 36px rgba(0,0,0,0.65)", 
          zIndex: 99, 
          overflow: "hidden", 
          minWidth: 140,
          animation: "fadeIn 0.12s ease"
        }}>
          {columns.map(opt => (
            <div
              key={opt.id}
              onClick={(e) => { e.stopPropagation(); onMove(opt.id); setOpen(false); }}
              style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: 8, 
                padding: "8px 12px", 
                cursor: "pointer", 
                background: opt.id === currentColumnId ? "rgba(124,90,194,0.12)" : "transparent", 
                transition: "background 0.12s" 
              }}
              onMouseEnter={e => { if (opt.id !== currentColumnId) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
              onMouseLeave={e => { if (opt.id !== currentColumnId) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ fontSize: 12, color: opt.id === currentColumnId ? "#a78bfa" : "#ccc", fontWeight: opt.id === currentColumnId ? 600 : 400 }}>{opt.title}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Task Row Component ────────────────────────────────────────────────────────

interface TaskRowProps {
  task: Task;
  colId: string;
  columns: Column[];
  onTaskClick: (task: Task) => void;
  onDeleteClick: (task: Task) => void;
  onMoveTask: (taskId: string, targetColId: string) => void;
}

function TaskRow({ task, colId, columns, onTaskClick, onDeleteClick, onMoveTask }: TaskRowProps) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        display: "grid",
        gridTemplateColumns: "2.8fr 1.1fr 1fr 1.2fr 0.7fr 0.4fr",
        gap: 12,
        padding: "12px 10px",
        borderBottom: "1px solid rgba(255,255,255,0.02)",
        alignItems: "center",
        background: hovered ? "rgba(255,255,255,0.015)" : "transparent",
        transition: "background 0.15s ease",
      }}
    >
      {/* Title, Stage Selector & Tags */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <StageDropdown currentColumnId={colId} columns={columns} onMove={(targetId) => onMoveTask(task.id, targetId)} />
        
        <span 
          onClick={() => onTaskClick(task)}
          style={{
            fontSize: 13,
            fontWeight: 500,
            color: "#dfdfdf",
            cursor: "pointer",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            transition: "color 0.15s"
          }}
          onMouseEnter={e => e.currentTarget.style.color = "#7C5AC2"}
          onMouseLeave={e => e.currentTarget.style.color = "#dfdfdf"}
        >
          {task.title || <span style={{ color: "#444", fontStyle: "italic" }}>(Sem Título)</span>}
        </span>
        
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap", flexShrink: 0 }}>
          {task.tags.map(t => <TagBadge key={t.label} tag={t} />)}
        </div>
      </div>

      {/* Responsáveis */}
      <div style={{ minWidth: 0 }}>
        {Array.isArray(task.assignees) ? (
          <AvatarCluster assignees={task.assignees} size={18}/>
        ) : task.assignees > 0 ? (
          <AvatarCluster count={task.assignees} size={18}/>
        ) : (
          <span style={{ color: "#444", fontSize: 11 }}>Sem responsável</span>
        )}
      </div>

      {/* Prazo */}
      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#666", fontSize: 11 }}>
        {task.date ? (
          <>
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.6 }}>
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
            <span style={{ color: "#aaa" }}>{task.date}</span>
          </>
        ) : (
          <span style={{ color: "#444" }}>—</span>
        )}
      </div>

      {/* Estimativa & Timer */}
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        {task.estTime ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "#555" }}>
              <span>{task.estTime}</span>
              <span>{task.progress}%</span>
            </div>
            <ProgressBar progress={task.progress} state={task.timerState} />
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <TimerButton taskId={task.id} state={task.timerState} value={task.timerValue} timerSeconds={task.timerSeconds} />
      </div>

      {/* Comentários / Anexos */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
        {task.attachments != null && task.attachments > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#666" }} title="Anexos">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M13 7L8 12C6.5 13.5 4.5 13.5 3 12C1.5 10.5 1.5 8.5 3 7L8 2C9 1 10.5 1 11.5 2C12.5 3 12.5 4.5 11.5 5.5L7 10C6.5 10.5 5.5 10.5 5 10C4.5 9.5 4.5 8.5 5 8L9 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span>{task.attachments}</span>
          </div>
        ) : null}
        {task.comments != null && task.comments > 0 ? (
          <div style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 11, color: "#666" }} title="Comentários">
            <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
              <path d="M14 9.5C14 10.33 13.33 11 12.5 11H5L2 14V3.5C2 2.67 2.67 2 3.5 2H12.5C13.33 2 14 2.67 14 3.5V9.5Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
            </svg>
            <span>{task.comments}</span>
          </div>
        ) : null}
      </div>

      {/* Excluir */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => onDeleteClick(task)}
          style={{ 
            background: "transparent", 
            border: "none", 
            cursor: "pointer", 
            padding: 4, 
            display: "flex", 
            alignItems: "center", 
            justifyContent: "center", 
            opacity: hovered ? 0.7 : 0, 
            transition: "opacity 0.15s" 
          }}
          title="Excluir Tarefa"
        >
          <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4M6 7v5M10 7v5M3 4l.9 9a1.5 1.5 0 001.5 1.35h5.2A1.5 1.5 0 0012.1 13L13 4" stroke="#ef4444" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>
    </div>
  );
}

// ─── Main Project List Component ───────────────────────────────────────────────

export function ProjectList() {
  const { activeProject } = useContext(AppContext);
  const { token } = useAuth();
  
  const [columns, setColumns] = useState<Column[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [collapsedColumns, setCollapsedColumns] = useState<Record<string, boolean>>({});
  
  const [selectedTask, setSelectedTask] = useState<{ task: Task; colId: string } | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const [showRename, setShowRename] = useState<Column | null>(null);
  
  const [quickAddColumnId, setQuickAddColumnId] = useState<string | null>(null);
  const [quickTitle, setQuickTitle] = useState("");
  
  const quickInputRef = useRef<HTMLInputElement>(null);

  const loadBoard = useCallback(() => {
    if (!activeProject) return;
    setLoadingBoard(true);
    setShowLoader(true);
    fetch(`${API}/api/projects/${activeProject.id}/board`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.columns) {
          const mappedColumns = data.columns.map((c: any) => ({
            id: c.id,
            title: c.title,
            tasks: c.tasks.map((t: any) => ({
              id: t.id,
              title: t.title,
              tags: t.tags.map((tag: any) => ({ label: tag.label, color: tag.color })),
              date: t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : undefined,
              assignees: t.assignees,
              timerState: "idle",
              timerValue: "00:00",
              progress: 0,
              estTime: t.estimatedHours ? `${t.estimatedHours}h` : "",
              coverImage: t.coverImageUrl
            }))
          }));
          setColumns(mappedColumns);
        }
      })
      .catch(err => console.error("Error loading board:", err))
      .finally(() => {
        setLoadingBoard(false);
        setTimeout(() => setShowLoader(false), 300);
      });
  }, [activeProject, token]);

  useEffect(() => {
    loadBoard();
  }, [loadBoard]);

  useEffect(() => {
    if (quickAddColumnId) {
      setTimeout(() => quickInputRef.current?.focus(), 30);
    }
  }, [quickAddColumnId]);

  const toggleCollapse = (colId: string) => {
    setCollapsedColumns(prev => ({
      ...prev,
      [colId]: !prev[colId]
    }));
  };

  const onTaskClick = (task: Task) => {
    const colId = columns.find(c => c.tasks.some(t => t.id === task.id))?.id ?? "untitled";
    setSelectedTask({ task, colId });
  };

  const onDeleteClick = (task: Task) => {
    setTaskToDelete(task);
  };

  const handleTaskCreated = useCallback((task: Task, colId: string) => {
    setColumns(prev => prev.map(col =>
      col.id === colId
        ? { ...col, tasks: [...col.tasks, task] }
        : col
    ));
    
    // Silent background reload to sync with server ids and comments/attachments
    if (activeProject) {
      fetch(`${API}/api/projects/${activeProject.id}/board`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.columns) {
            setColumns(data.columns.map((c: any) => ({
              id: c.id,
              title: c.title,
              tasks: c.tasks.map((t: any) => ({
                id: t.id,
                title: t.title,
                tags: t.tags.map((tag: any) => ({ label: tag.label, color: tag.color })),
                date: t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : undefined,
                assignees: t.assignees,
                timerState: "idle",
                timerValue: "00:00",
                progress: 0,
                estTime: t.estimatedHours ? `${t.estimatedHours}h` : "",
                coverImage: t.coverImageUrl
              }))
            })));
          }
        })
        .catch(() => {});
    }
  }, [activeProject, token]);

  const handleQuickSave = async (colId: string) => {
    const title = quickTitle.trim();
    setQuickAddColumnId(null);
    setQuickTitle("");
    if (!title || !activeProject) return;
    
    try {
      const res = await fetch(`${API}/api/projects/${activeProject.id}/tasks`, {
        method: "POST", 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ columnId: colId, title, priority: "normal" })
      });
      const data = await res.json();
      if (data.task) {
        handleTaskCreated({
          id: data.task.id,
          title,
          tags: [],
          assignees: 0,
          timerState: "idle",
          timerValue: "00:00",
          progress: 0,
          estTime: ""
        }, colId);
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleRenameConfirm = async (newTitle: string) => {
    if (!showRename || !activeProject) return;
    const colId = showRename.id;
    setShowRename(null);
    
    try {
      await fetch(`${API}/api/projects/${activeProject.id}/columns/${colId}`, {
        method: "PUT", 
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle })
      });
      loadBoard();
    } catch (err) {
      console.error(err);
    }
  };

  const handleMoveTask = async (taskId: string, targetColId: string) => {
    // Find the source column
    const sourceCol = columns.find(c => c.tasks.some(t => t.id === taskId));
    if (!sourceCol || sourceCol.id === targetColId) return;

    const task = sourceCol.tasks.find(t => t.id === taskId);
    if (!task) return;

    // Optimistic state update
    setColumns(prev => prev.map(col => {
      if (col.id === sourceCol.id) {
        return { ...col, tasks: col.tasks.filter(t => t.id !== taskId) };
      }
      if (col.id === targetColId) {
        return { ...col, tasks: [...col.tasks, task] };
      }
      return col;
    }));

    if (activeProject) {
      try {
        await fetch(`${API}/api/projects/${activeProject.id}/tasks/${taskId}/move`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ targetColumnId: targetColId, targetIndex: 0 })
        });
      } catch (e) {
        console.error("Error moving task:", e);
        loadBoard(); // Rollback on error
      }
    }
  };

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "18px 20px", background: "#111111", display: "flex", flexDirection: "column", gap: 14 }}>
      {showLoader ? (
        <div style={{ flex: 1, display: "flex", minHeight: 300 }}>
          <Loader isReady={!loadingBoard} onFinish={() => setShowLoader(false)} />
        </div>
      ) : columns.length === 0 ? (
        <div style={{ color: "#888", fontSize: 14, margin: "auto" }}>Nenhuma etapa neste projeto.</div>
      ) : (
        columns.map(col => {
          const isCollapsed = collapsedColumns[col.id];
          return (
            <div 
              key={col.id} 
              style={{ 
                background: "#1A1A1E", 
                border: "1px solid rgba(255,255,255,0.03)", 
                borderRadius: 12, 
                overflow: "hidden",
                boxShadow: "0 4px 18px rgba(0,0,0,0.2)"
              }}
            >
              {/* Collapsible Stage Header */}
              <div 
                onClick={() => toggleCollapse(col.id)}
                style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  padding: "14px 20px", 
                  cursor: "pointer", 
                  background: "rgba(255,255,255,0.01)", 
                  userSelect: "none" 
                }}
              >
                <div style={{ 
                  width: 22, 
                  height: 22, 
                  display: "flex", 
                  alignItems: "center", 
                  justifyContent: "center", 
                  color: "#555", 
                  marginRight: 10, 
                  transform: isCollapsed ? "rotate(-90deg)" : "rotate(0deg)", 
                  transition: "transform 0.2s" 
                }}>
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="6 9 12 15 18 9"/>
                  </svg>
                </div>
                
                <span style={{ fontSize: 13, fontWeight: 600, color: "#d0d0d4" }}>{col.title}</span>
                
                <span style={{ 
                  marginLeft: 10, 
                  fontSize: 10, 
                  fontWeight: 600, 
                  color: "#7C5AC2", 
                  background: "rgba(124,90,194,0.08)", 
                  border: "1px solid rgba(124,90,194,0.15)", 
                  borderRadius: 10, 
                  padding: "2px 8px" 
                }}>
                  {col.tasks.length} {col.tasks.length === 1 ? "Tarefa" : "Tarefas"}
                </span>
                
                <div style={{ flex: 1 }} />
                
                <div style={{ display: "flex", gap: 8 }} onClick={e => e.stopPropagation()}>
                  <button 
                    onClick={() => {
                      if (isCollapsed) toggleCollapse(col.id);
                      setQuickAddColumnId(col.id);
                    }} 
                    style={{ background: "transparent", border: "none", color: "#505058", cursor: "pointer", fontSize: 16, padding: "2px 4px", transition: "color 0.15s" }} 
                    onMouseEnter={e => e.currentTarget.style.color = "#888"} 
                    onMouseLeave={e => e.currentTarget.style.color = "#505058"} 
                    title="Criar Nova Tarefa"
                  >+</button>
                  <button 
                    onClick={() => setShowRename(col)} 
                    style={{ background: "transparent", border: "none", color: "#505058", cursor: "pointer", letterSpacing: 1, fontSize: 13, padding: "2px 4px", transition: "color 0.15s" }} 
                    onMouseEnter={e => e.currentTarget.style.color = "#888"} 
                    onMouseLeave={e => e.currentTarget.style.color = "#505058"} 
                    title="Renomear Etapa"
                  >···</button>
                </div>
              </div>

              {/* Stage Task Table */}
              {!isCollapsed && (
                <div style={{ padding: "0 20px 16px" }}>
                  {col.tasks.length === 0 && quickAddColumnId !== col.id ? (
                    <div style={{ padding: "16px 0", color: "#555", fontSize: 12, textAlign: "center" }}>
                      Nenhuma tarefa nesta etapa. Clique em "+" para criar.
                    </div>
                  ) : (
                    <div style={{ display: "flex", flexDirection: "column" }}>
                      {col.tasks.length > 0 && (
                        <div style={{ 
                          display: "grid", 
                          gridTemplateColumns: "2.8fr 1.1fr 1fr 1.2fr 0.7fr 0.4fr", 
                          gap: 12, 
                          padding: "10px 10px 8px", 
                          borderBottom: "1px solid rgba(255,255,255,0.03)", 
                          fontSize: 10, 
                          fontWeight: 600, 
                          color: "#444", 
                          textTransform: "uppercase", 
                          letterSpacing: "0.05em" 
                        }}>
                          <div>Tarefa</div>
                          <div>Responsáveis</div>
                          <div>Prazo</div>
                          <div>Estimativa & Timer</div>
                          <div>Mídias</div>
                          <div style={{ textAlign: "right" }}>Ações</div>
                        </div>
                      )}

                      {col.tasks.map(task => (
                        <TaskRow 
                          key={task.id} 
                          task={task} 
                          colId={col.id} 
                          columns={columns} 
                          onTaskClick={onTaskClick} 
                          onDeleteClick={onDeleteClick}
                          onMoveTask={handleMoveTask}
                        />
                      ))}

                      {/* Quick Add Input Row */}
                      {quickAddColumnId === col.id && (
                        <div style={{ 
                          display: "flex", 
                          gap: 12, 
                          alignItems: "center", 
                          padding: "10px 12px", 
                          background: "#2C2C2E", 
                          border: "1.5px solid rgba(124,90,194,0.4)", 
                          borderRadius: 8, 
                          marginTop: 8,
                          boxShadow: "0 0 0 3px rgba(124,90,194,0.08)"
                        }}>
                          <input
                            ref={quickInputRef}
                            value={quickTitle}
                            onChange={e => setQuickTitle(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleQuickSave(col.id);
                              if (e.key === "Escape") { setQuickAddColumnId(null); setQuickTitle(""); }
                            }}
                            onBlur={() => {
                              if (!quickTitle.trim()) { setQuickAddColumnId(null); setQuickTitle(""); }
                              else handleQuickSave(col.id);
                            }}
                            placeholder="Nome da tarefa..."
                            style={{ 
                              flex: 1, 
                              background: "transparent", 
                              border: "none", 
                              outline: "none", 
                              color: "#dfdfdf", 
                              fontSize: 13, 
                              fontWeight: 500, 
                              fontFamily: "inherit" 
                            }}
                          />
                          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <button
                              onMouseDown={e => { e.preventDefault(); handleQuickSave(col.id); }}
                              style={{ padding: "4px 12px", borderRadius: 6, background: "linear-gradient(135deg,#7C5AC2,#6044a8)", border: "none", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                            >Criar</button>
                            <button
                              onMouseDown={e => { e.preventDefault(); setQuickAddColumnId(null); setQuickTitle(""); }}
                              style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#777", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                            >Esc</button>
                            <span style={{ fontSize: 10, color: "#444", marginLeft: 6 }}>Enter para salvar</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Task Edit Modal */}
      {selectedTask && (
        <TaskModal
          task={selectedTask.task}
          colId={selectedTask.colId}
          onClose={() => setSelectedTask(null)}
          onSave={loadBoard}
        />
      )}

      {/* Stage Rename Modal */}
      {showRename && (
        <RenameColumnModal
          colTitle={showRename.title}
          onConfirm={handleRenameConfirm}
          onClose={() => setShowRename(null)}
        />
      )}

      {/* Task Delete Confirmation Modal */}
      {taskToDelete && (
        <div style={{ 
          position: "fixed", 
          inset: 0, 
          background: "rgba(0,0,0,0.8)", 
          backdropFilter: "blur(5px)", 
          zIndex: 100000, 
          display: "flex", 
          alignItems: "center", 
          justifyContent: "center", 
          animation: "fadeIn 0.15s ease" 
        }}>
          <div style={{ 
            width: 380, 
            background: "#1e1e22", 
            borderRadius: 12, 
            border: "1px solid rgba(255,255,255,0.1)", 
            padding: "24px", 
            boxShadow: "0 20px 60px rgba(0,0,0,0.8)", 
            animation: "slideUp 0.2s ease" 
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ 
                width: 40, 
                height: 40, 
                borderRadius: "50%", 
                background: "rgba(239,68,68,0.1)", 
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center", 
                color: "#ef4444" 
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                </svg>
              </div>
              <div>
                <h3 style={{ margin: 0, fontSize: 16, color: "#f0f0f0", fontWeight: 600 }}>Excluir Tarefa</h3>
              </div>
            </div>
            <p style={{ margin: "0 0 24px 0", fontSize: 13, color: "#aaa", lineHeight: 1.5 }}>
              Tem certeza que deseja excluir permanentemente esta tarefa? Essa ação não pode ser desfeita e todos os dados serão perdidos.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
              <button 
                onClick={() => setTaskToDelete(null)} 
                style={{ padding: "8px 16px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#ccc", fontSize: 13, cursor: "pointer", fontWeight: 500 }}
              >
                Cancelar
              </button>
              <button 
                onClick={async () => {
                  if (!activeProject) return;
                  try {
                    await fetch(`${API}/api/projects/${activeProject.id}/tasks/${taskToDelete.id}`, { 
                      method: "DELETE", 
                      headers: { Authorization: `Bearer ${token}` } 
                    });
                    setTaskToDelete(null);
                    loadBoard();
                  } catch (e) { 
                    console.error(e); 
                  }
                }} 
                style={{ padding: "8px 16px", borderRadius: 6, background: "#ef4444", border: "none", color: "#fff", fontSize: 13, cursor: "pointer", fontWeight: 600 }}
              >
                Sim, Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
