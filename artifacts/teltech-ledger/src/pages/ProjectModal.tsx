import { useState, useEffect } from "react";
import { useAuth } from "../lib/auth-context";
import { X, Trash2 } from "lucide-react";
import { API } from "../lib/api";
import { getProjectChanges } from "../lib/project-changes";

interface ProjectColumn { id: string; title: string; position: number; }
interface Project { id: string; workspaceId: string; name: string; color: string; icon?: string | null; }

const COLORS = ["#7C5AC2","#3B82F6","#14B8A6","#10B981","#F59E0B","#EF4444","#EC4899","#6366F1","#F97316","#8B5CF6"];

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "10px 14px",
  fontSize: 14, color: "#e0e0e0", outline: "none", fontFamily: "inherit",
};

export function ProjectModal({ project, onClose, onSaved }: {
  project: Project | null; // null = create mode
  onClose: () => void;
  onSaved: (savedProject?: Project) => void | Promise<void>;
}) {
  const { user } = useAuth();
  const isEdit = !!project;

  const [name, setName] = useState(project?.name ?? "");
  const [color, setColor] = useState(project?.color ?? "#7C5AC2");
  const [icon, setIcon] = useState<string | null>(project?.icon ?? null);
  const [columns, setColumns] = useState<ProjectColumn[]>([]);
  const [savedColumns, setSavedColumns] = useState<ProjectColumn[]>([]);
  const [savedProject, setSavedProject] = useState(project);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [draggedIdx, setDraggedIdx] = useState<number | null>(null);

  const handleDragStart = (idx: number) => {
    setDraggedIdx(idx);
  };

  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (draggedIdx === null || draggedIdx === idx) return;
    const newColumns = [...columns];
    const draggedCol = newColumns[draggedIdx];
    newColumns.splice(draggedIdx, 1);
    newColumns.splice(idx, 0, draggedCol);
    setColumns(newColumns);
    setDraggedIdx(idx);
  };

  const handleDragEnd = () => {
    setDraggedIdx(null);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setError('Por favor, selecione uma imagem válida.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setError('A imagem deve ter no máximo 2MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      setIcon(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  // Load columns for existing project
  useEffect(() => {
    if (!project) return;
    let active = true;
    API.get<{ columns: ProjectColumn[] }>(`/projects/${project.id}/board`)
      .then(data => {
        if (!active) return;
        if (!Array.isArray(data.columns)) throw new Error("Não foi possível carregar as etapas do projeto.");
        const loaded = data.columns.map(c => ({ id: c.id, title: c.title, position: c.position }));
        setColumns(loaded);
        setSavedColumns(loaded);
      })
      .catch(e => { if (active) setError(e instanceof Error ? e.message : "Erro ao carregar etapas"); });
    return () => { active = false; };
  }, [project?.id]);

  const handleSave = async () => {
    if (!name.trim()) { setError("Nome é obrigatório"); return; }
    setLoading(true); setError(null);
    let projectWasSaved = false;
    let confirmedProject: Project | undefined;
    try {
      if (project && savedProject) {
        // Renaming should not also rewrite unchanged color, icon or columns.
        const changes = getProjectChanges(savedProject, { name, color, icon });
        if (Object.keys(changes).length > 0) {
          const result = await API.put<{ project: Project }>(`/projects/${project.id}`, changes);
          if (!result.project) throw new Error("O servidor não confirmou a atualização do projeto.");
          setSavedProject(result.project);
          confirmedProject = result.project;
          projectWasSaved = true;
        }
        const columnsChanged = columns.length !== savedColumns.length || columns.some((column, index) =>
          column.id !== savedColumns[index]?.id || column.title !== savedColumns[index]?.title
        );
        if (columnsChanged) {
          const ordered = columns.map((column, position) => ({ ...column, position }));
          await API.put(`/projects/${project.id}/columns-order`, { columns: ordered });
          setSavedColumns(ordered);
        }
      } else {
        // The login response omits workspaceId; /auth/me includes it.
        let workspaceId = user?.workspaceId;
        if (!workspaceId) {
          const session = await API.get<{ user: { workspaceId?: string | null } }>("/auth/me");
          workspaceId = session.user.workspaceId;
        }
        if (!workspaceId) throw new Error("Não foi possível determinar o workspace. Recarregue a página.");
        const result = await API.post<{ project: Project }>("/projects", { workspaceId, name: name.trim(), color, icon });
        if (!result.project) throw new Error("O servidor não confirmou a criação do projeto.");
        confirmedProject = result.project;
        projectWasSaved = true;
      }
      await onSaved(confirmedProject);
      onClose();
    } catch (e) {
      const message = e instanceof Error ? e.message : "Erro ao salvar projeto";
      setError(projectWasSaved ? `Projeto salvo, mas a atualização das etapas ou da lista falhou: ${message}` : message);
      if (projectWasSaved) {
        try { await onSaved(confirmedProject); } catch { /* Keep the original error visible. */ }
      }
    }
    finally { setLoading(false); }
  };

  const handleDelete = async () => {
    if (!project) return;
    setLoading(true); setError(null);
    try {
      const result = await API.delete<{ success: boolean }>(`/projects/${project.id}`);
      if (!result.success) throw new Error("O servidor não confirmou a exclusão do projeto.");
      await onSaved();
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao excluir"); }
    finally { setLoading(false); }
  };

  const addColumn = async () => {
    if (!project) return;
    setLoading(true);
    setError(null);
    try {
      const data = await API.post<{ column: ProjectColumn }>(`/projects/${project.id}/columns`, { title: "Nova Etapa" });
      if (data.column) {
        const added = { id: data.column.id, title: data.column.title, position: data.column.position };
        setColumns(prev => [...prev, added]);
        setSavedColumns(prev => [...prev, added]);
      } else {
        throw new Error("Formato de resposta inesperado do servidor.");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setLoading(false);
    }
  };

  const deleteColumn = async (colId: string) => {
    if (!project) return;
    setLoading(true); setError(null);
    try {
      await API.delete(`/projects/${project.id}/columns/${colId}`);
      setColumns(prev => prev.filter(c => c.id !== colId));
      setSavedColumns(prev => prev.filter(c => c.id !== colId));
    } catch (e) { setError(e instanceof Error ? e.message : "Erro ao excluir etapa"); }
    finally { setLoading(false); }
  };

  const updateColTitle = (colId: string, title: string) => {
    setColumns(prev => prev.map(c => c.id === colId ? { ...c, title } : c));
  };

  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease" }}>
      <div style={{ width: 480, maxHeight: "85vh", background: "#1a1a1f", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)", display: "flex", flexDirection: "column", overflow: "hidden", animation: "slideUp 0.2s cubic-bezier(0.34,1.2,0.64,1)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f0f0f0" }}>
            {isEdit ? "Editar Projeto" : "Novo Projeto"}
          </h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#888", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.background = "transparent"; }}>
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
          {error && <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#f87171" }}>{error}</div>}

          {/* Name */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 500, display: "block", marginBottom: 6 }}>Nome do Projeto</label>
            <input value={name} onChange={e => setName(e.target.value)} style={inputStyle} placeholder="Ex: Marketing 2025" autoFocus />
          </div>

          {/* Ícone */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 500, display: "block", marginBottom: 6 }}>Ícone do Projeto (Opcional)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{
                width: 42, height: 42, borderRadius: 10, background: icon ? `url(${icon}) center/cover` : "rgba(255,255,255,0.04)",
                border: "1px dashed rgba(255,255,255,0.2)", display: "flex", alignItems: "center", justifyContent: "center",
                flexShrink: 0, overflow: "hidden"
              }}>
                {!icon && <span style={{ color: "#888", fontSize: 20 }}>+</span>}
              </div>
              <label style={{ cursor: "pointer", fontSize: 13, color: "#aaa", padding: "6px 12px", background: "rgba(255,255,255,0.06)", borderRadius: 6, border: "1px solid rgba(255,255,255,0.1)", transition: "all 0.2s" }} onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.08)"} onMouseLeave={e => e.currentTarget.style.background="rgba(255,255,255,0.06)"}>
                Selecionar Foto
                <input type="file" accept="image/*" onChange={handleImageUpload} style={{ display: "none" }} />
              </label>
              {icon && (
                <button onClick={() => setIcon(null)} style={{ background: "transparent", border: "none", color: "#f87171", cursor: "pointer", fontSize: 13 }} onMouseEnter={e => e.currentTarget.style.opacity="0.8"} onMouseLeave={e => e.currentTarget.style.opacity="1"}>Remover</button>
              )}
            </div>
          </div>

          {/* Color */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ fontSize: 12, color: "#888", fontWeight: 500, display: "block", marginBottom: 8 }}>Cor</label>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {COLORS.map(c => (
                <button key={c} onClick={() => setColor(c)} style={{
                  width: 28, height: 28, borderRadius: 8, background: c, border: color === c ? "2px solid #fff" : "2px solid transparent",
                  cursor: "pointer", transition: "all 0.15s", transform: color === c ? "scale(1.15)" : "scale(1)",
                  boxShadow: color === c ? `0 0 0 3px ${c}44` : "none",
                }} />
              ))}
            </div>
          </div>

          {/* Columns / Stages — only for edit mode */}
          {isEdit && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                <label style={{ fontSize: 12, color: "#888", fontWeight: 500 }}>Etapas do Funil</label>
                <button onClick={addColumn} style={{ fontSize: 11, color: "#7C5AC2", background: "transparent", border: "none", cursor: "pointer", fontWeight: 600 }}>+ Adicionar</button>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {columns.map((col, idx) => (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragOver={(e) => handleDragOver(e, idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      opacity: draggedIdx === idx ? 0.4 : 1,
                      cursor: "grab",
                      background: "transparent",
                      transition: "opacity 0.2s"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", color: "#444", width: 14 }}>
                      <svg width="10" height="14" viewBox="0 0 10 14" fill="currentColor">
                        <circle cx="3" cy="3" r="1.5"/><circle cx="3" cy="7" r="1.5"/><circle cx="3" cy="11" r="1.5"/>
                        <circle cx="7" cy="3" r="1.5"/><circle cx="7" cy="7" r="1.5"/><circle cx="7" cy="11" r="1.5"/>
                      </svg>
                    </div>
                    <span style={{ fontSize: 11, color: "#555", width: 14, textAlign: "center", flexShrink: 0 }}>{idx + 1}</span>
                    <input value={col.title} onChange={e => updateColTitle(col.id, e.target.value)}
                      style={{ ...inputStyle, padding: "8px 12px", fontSize: 13, cursor: "text" }} />
                    <button onClick={() => deleteColumn(col.id)}
                      title="Excluir etapa"
                      style={{ width: 28, height: 28, borderRadius: 6, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.15)", color: "#f87171", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = "rgba(239,68,68,0.2)"; e.currentTarget.style.color = "#ef4444"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(239,68,68,0.08)"; e.currentTarget.style.color = "#f87171"; }}>
                      <Trash2 size={13} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: isEdit ? "space-between" : "flex-end", padding: "14px 20px", borderTop: "1px solid rgba(255,255,255,0.06)", gap: 10 }}>
          {isEdit && !confirmDelete && (
            <button onClick={() => setConfirmDelete(true)}
              style={{ padding: "8px 14px", borderRadius: 8, background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", color: "#f87171", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Excluir</button>
          )}
          {isEdit && confirmDelete && (
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <span style={{ fontSize: 12, color: "#f87171" }}>Confirmar?</span>
              <button onClick={handleDelete} disabled={loading}
                style={{ padding: "6px 12px", borderRadius: 6, background: "#ef4444", border: "none", color: "#fff", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Sim</button>
              <button onClick={() => setConfirmDelete(false)}
                style={{ padding: "6px 12px", borderRadius: 6, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#aaa", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>Não</button>
            </div>
          )}
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={onClose} style={{ padding: "9px 18px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#aaa", fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>Cancelar</button>
            <button onClick={handleSave} disabled={loading}
              style={{ padding: "9px 18px", borderRadius: 9, background: "linear-gradient(135deg,#5b3ea6,#7C5AC2)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>
              {loading ? "Salvando..." : isEdit ? "Salvar" : "Criar Projeto"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
