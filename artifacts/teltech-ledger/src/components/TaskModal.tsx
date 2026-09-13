import { useState, useEffect, useContext, useRef, useCallback } from "react";
import { AppContext, FaceAvatar, TAG_STYLES, Task, TagColor } from "../TeltechLedger";
import { useAuth } from "../lib/auth-context";
import { Loader } from "./Loader";
import { ArrowDown, Flag, ArrowUp, AlertTriangle, X, Paperclip, Check } from "lucide-react";

const API = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ""
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? "http://localhost:5000" : "");

const PRIORITY_MAP: Record<string, { idx: number; label: string; color: string; icon: React.ComponentType<{ size?: number; className?: string }> }> = {
  low: { idx: 0, label: "Baixa", color: "#22c55e", icon: ArrowDown },
  normal: { idx: 1, label: "Normal", color: "#3B82F6", icon: Flag },
  high: { idx: 2, label: "Alta", color: "#f59e0b", icon: ArrowUp },
  urgent: { idx: 3, label: "Urgente", color: "#ef4444", icon: AlertTriangle }
};
const PRIORITY_ORDER = ["low", "normal", "high", "urgent"];

function ModalAvatar({ index, size=24, url }: { index?:number; size?:number; url?:string|null }) {
  if (url) {
    return <img src={url} style={{ width:size, height:size, borderRadius:"50%", objectFit:"cover", border:"2px solid #1e1e22" }} />;
  }
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", flexShrink:0, overflow:"hidden", border:"2px solid #1e1e22" }}>
      <FaceAvatar index={index || 0} size={size}/>
    </div>
  );
}

// ─── Custom Date Picker ───────────────────────────────────────────────────────
function CustomDatePicker({ value, onChange }: { value: string, onChange: (v: string)=>void }) {
  const [open, setOpen] = useState(false);
  const d = value ? new Date(value + "T00:00:00") : new Date();
  const [month, setMonth] = useState(new Date(d.getFullYear(), d.getMonth(), 1));

  const daysInMonth = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const firstDay = month.getDay();
  const days: (number | null)[] = (Array.from({ length: firstDay }, () => null) as (number | null)[]).concat(Array.from({ length: daysInMonth }, (_, i) => i + 1));
  const monthNames = ["Janeiro","Fevereiro","Março","Abril","Maio","Junho","Julho","Agosto","Setembro","Outubro","Novembro","Dezembro"];

  const handleDayClick = (day: number) => {
    const newVal = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    onChange(newVal);
    setOpen(false);
  };

  return (
    <div style={{ position: "relative" }}>
      <div 
        onClick={() => setOpen(!open)}
        style={{ width:"100%", padding:"10px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color: value ? "#ccc" : "#666", fontSize:13, cursor:"pointer", boxSizing:"border-box", display:"flex", justifyContent:"space-between", alignItems:"center" }}
      >
        {value ? `${value.split('-')[2]}/${value.split('-')[1]}/${value.split('-')[0]}` : "dd/mm/aaaa"}
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
      </div>
      
      {open && (
        <div style={{ position:"absolute", top:"100%", left:0, marginTop:8, zIndex:20, background:"#25252b", border:"1px solid rgba(255,255,255,0.1)", borderRadius:12, padding:16, width: 240, boxShadow:"0 12px 40px rgba(0,0,0,0.6)" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12 }}>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))} style={{ background:"transparent", border:"none", color:"#ccc", cursor:"pointer", padding:4 }}>&lt;</button>
            <span style={{ fontSize:13, fontWeight:600, color:"#eee" }}>{monthNames[month.getMonth()]} {month.getFullYear()}</span>
            <button onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))} style={{ background:"transparent", border:"none", color:"#ccc", cursor:"pointer", padding:4 }}>&gt;</button>
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4, textAlign:"center", marginBottom:8 }}>
            {["D","S","T","Q","Q","S","S"].map((d,i) => <div key={i} style={{ fontSize:10, color:"#666", fontWeight:600 }}>{d}</div>)}
          </div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(7, 1fr)", gap:4, textAlign:"center" }}>
            {days.map((day, i) => {
              if (!day) return <div key={i} />;
              const isSelected = value === `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              return (
                <div 
                  key={i} onClick={() => handleDayClick(day)}
                  style={{ fontSize:12, padding:"6px 0", cursor:"pointer", borderRadius:6, background: isSelected ? "#7C5AC2" : "transparent", color: isSelected ? "#fff" : "#ccc", fontWeight: isSelected ? 600 : 400 }}
                  onMouseEnter={e => { if(!isSelected) e.currentTarget.style.background="rgba(255,255,255,0.1)" }}
                  onMouseLeave={e => { if(!isSelected) e.currentTarget.style.background="transparent" }}
                >
                  {day}
                </div>
              );
            })}
          </div>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:12, paddingTop:12, borderTop:"1px solid rgba(255,255,255,0.05)" }}>
            <button onClick={() => { onChange(""); setOpen(false); }} style={{ fontSize:11, color:"#666", background:"transparent", border:"none", cursor:"pointer" }}>Limpar</button>
            <button onClick={() => { const today = new Date(); onChange(`${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`); setOpen(false); }} style={{ fontSize:11, color:"#7C5AC2", background:"transparent", border:"none", cursor:"pointer", fontWeight:600 }}>Hoje</button>
          </div>
        </div>
      )}
    </div>
  );
}

export interface TaskModalProps { task: Task; colId: string; onClose: () => void; onSave: () => void; }

export function TaskModal({ task: initialTask, colId: initialColId, onClose, onSave }: TaskModalProps) {
  const { activeProject } = useContext(AppContext);
  const { token, user } = useAuth();
  
  // State UI
  const [activeTab, setActiveTab] = useState<"descricao"|"comentarios"|"atividades">("descricao");
  const [hoverClose, setHoverClose] = useState(false);
  const [showAssigneesDrop, setShowAssigneesDrop] = useState(false);
  const [showTagsDrop, setShowTagsDrop] = useState(false);
  const [showColDrop, setShowColDrop] = useState(false);
  const [creatingTag, setCreatingTag] = useState(false);
  const [newTagLabel, setNewTagLabel] = useState("");
  const [newTagColor, setNewTagColor] = useState<TagColor>("gray");
  
  // Data State
  const [loading, setLoading] = useState(true);
  const [fullTask, setFullTask] = useState<any>(null);
  const [columns, setColumns] = useState<any[]>([]);
  const [workspaceMembers, setWorkspaceMembers] = useState<any[]>([]);
  const [projectTags, setProjectTags] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [activities, setActivities] = useState<any[]>([]);
  
  // Editable Fields
  const [title, setTitle] = useState(initialTask.title);
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<string>("normal");
  const [colId, setColId] = useState(initialColId);
  const [dueDate, setDueDate] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("");
  const [newSubtask, setNewSubtask] = useState("");
  const [newComment, setNewComment] = useState("");
  const [newCommentMedia, setNewCommentMedia] = useState("");
  const [showMediaInput, setShowMediaInput] = useState(false);
  const [attachments, setAttachments] = useState<any[]>([]);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);
  const [uploadingCover, setUploadingCover] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const ACTION_MAP: Record<string, string> = {
    "added_comment": "adicionou um comentário",
    "moveu esta tarefa para": "moveu esta tarefa para",
    "alterou o título": "alterou o título",
    "atualizou a descrição": "atualizou a descrição",
    "alterou a prioridade": "alterou a prioridade",
    "atualizou a estimativa de horas": "atualizou a estimativa de horas"
  };

  const initialLoadDone = useRef(false);

  const loadData = async () => {
    if (!activeProject || !initialTask.id) return;
    try {
      const [taskRes, membersRes, tagsRes, commentsRes, actsRes] = await Promise.all([
        fetch(`${API}/api/projects/${activeProject.id}/tasks/${initialTask.id}`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/projects/${activeProject.id}/members`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/projects/${activeProject.id}/tags`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/tasks/${initialTask.id}/comments`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/tasks/${initialTask.id}/activities`, { headers: { Authorization: `Bearer ${token}` } }),
        fetch(`${API}/api/tasks/${initialTask.id}/attachments`, { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      const taskData = await taskRes.json();
      const membersData = await membersRes.json();
      const tagsData = await tagsRes.json();
      const commentsData = await commentsRes.json();
      const actsData = await actsRes.json();
      const attData = await (arguments[5] || arguments[0] /* workaround */, fetch(`${API}/api/tasks/${initialTask.id}/attachments`, { headers: { Authorization: `Bearer ${token}` } })).then(r=>r.json());


      setFullTask(taskData);
      setColumns(taskData.columns || []);
      setWorkspaceMembers(membersData.members || []);
      setProjectTags(tagsData.tags || []);
      setComments(commentsData.comments || []);
      setActivities(actsData.activities || []);
      setAttachments(attData?.attachments || []);
      
      setTitle(taskData.task.title);
      setDescription(taskData.task.description || "");
      setPriority(taskData.task.priority || "normal");
      setColId(taskData.task.columnId);
      setDueDate(taskData.task.dueDate ? new Date(taskData.task.dueDate).toISOString().split('T')[0] : "");
      setEstimatedHours(taskData.task.estimatedHours?.toString() || "");

    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
      setTimeout(() => initialLoadDone.current = true, 500); // allow states to settle
    }
  };

  useEffect(() => { loadData(); }, [activeProject, initialTask.id]);

  // Patch Task Function
  const patchTask = async (updates: any) => {
    if (!activeProject || !initialLoadDone.current) return;
    try {
      await fetch(`${API}/api/projects/${activeProject.id}/tasks/${initialTask.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(updates)
      });
      onSave(); // notify board
      // Refetch activities to show new logs
      const actsRes = await fetch(`${API}/api/tasks/${initialTask.id}/activities`, { headers: { Authorization: `Bearer ${token}` } });
      const actsData = await actsRes.json();
      setActivities(actsData.activities || []);
    } catch (err) {
      console.error("Error patching task", err);
    }
  };

  // Debounced Save for text inputs
  useEffect(() => {
    if (!initialLoadDone.current) return;
    const timer = setTimeout(() => {
      patchTask({
        title, 
        description,
        estimatedHours: estimatedHours ? parseInt(estimatedHours, 10) : null
      });
    }, 1000);
    return () => clearTimeout(timer);
  }, [title, description, estimatedHours]);

  // Immediate Save for exact changes
  const handleImmediateChange = (key: string, val: any) => {
    if (key === "colId") setColId(val);
    if (key === "priority") setPriority(val);
    if (key === "dueDate") setDueDate(val);
    
    if (!initialLoadDone.current) return;
    patchTask({
      [key === "colId" ? "columnId" : key]: val && key === "dueDate" ? new Date(val).toISOString() : val
    });
  };

  const handleToggleAssignee = async (userId: string) => {
    if (!activeProject || !fullTask) return;
    const isAssigned = fullTask.assignees.some((a:any) => a.id === userId);
    try {
      if (isAssigned) {
        await fetch(`${API}/api/projects/${activeProject.id}/tasks/${initialTask.id}/assignees/${userId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        setFullTask({ ...fullTask, assignees: fullTask.assignees.filter((a:any)=>a.id !== userId) });
      } else {
        await fetch(`${API}/api/projects/${activeProject.id}/tasks/${initialTask.id}/assignees`, { 
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ userId })
        });
        const member = workspaceMembers.find(m => m.id === userId);
        if (member) setFullTask({ ...fullTask, assignees: [...fullTask.assignees, member] });
      }
    } catch (e) { console.error(e); }
  };

  const handleAddSubtask = async () => {
    if (!newSubtask.trim()) return;
    try {
      const res = await fetch(`${API}/api/tasks/${initialTask.id}/subtasks`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newSubtask.trim() })
      });
      const data = await res.json();
      if (data.subtask) {
        setFullTask((prev: any) => prev ? { ...prev, subtasks: [...(prev?.subtasks || []), data.subtask] } : prev);
        setNewSubtask("");
      }
    } catch (e) { console.error(e); }
  };

  const handleToggleSubtask = async (stId: string, completed: boolean) => {
    try {
      await fetch(`${API}/api/tasks/${initialTask.id}/subtasks/${stId}`, {
        method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ completed })
      });
      setFullTask((prev: any) => prev ? {
        ...prev,
        subtasks: prev?.subtasks?.map((st:any) => st.id === stId ? { ...st, completed } : st)
      } : prev);
    } catch (e) { console.error(e); }
  };

  const handleFormat = (type: string) => {
    const textarea = document.getElementById("task-description") as HTMLTextAreaElement;
    if (!textarea) return;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const selectedText = description.substring(start, end);
    let formatted = "";
    if (type === "B") formatted = `**${selectedText}**`;
    if (type === "I") formatted = `*${selectedText}*`;
    if (type === "U") formatted = `__${selectedText}__`;
    if (type === "S") formatted = `~~${selectedText}~~`;

    const newDesc = description.substring(0, start) + formatted + description.substring(end);
    setDescription(newDesc);
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + formatted.length, start + formatted.length);
    }, 0);
  };

  const handleUploadAttachment = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAttachment(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch(`${API}/api/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData
      });
      const upData = await upRes.json();
      if (upData.url) {
        const attRes = await fetch(`${API}/api/tasks/${initialTask.id}/attachments`, {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ fileName: upData.originalName, fileUrl: upData.url, fileType: upData.mimetype })
        });
        const attData = await attRes.json();
        if (attData.attachment) {
          setAttachments([...attachments, attData.attachment]);
        }
      }
    } catch (err) { console.error(err); } finally { setUploadingAttachment(false); }
  };

  const handleUploadCover = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingCover(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const upRes = await fetch(`${API}/api/upload`, {
        method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData
      });
      const upData = await upRes.json();
      if (upData.url) {
        const coverUrl = `${API}${upData.url}`;
        handleImmediateChange("coverImageUrl", coverUrl);
        setFullTask((prev: any) => prev ? { ...prev, coverImageUrl: coverUrl } : prev);
      }
    } catch (err) { console.error(err); } finally { setUploadingCover(false); }
  };

  const handleToggleTag = async (tagId: string) => {
    if (!activeProject || !fullTask) return;
    const hasTag = fullTask.tags.some((t:any) => t.id === tagId);
    try {
      if (hasTag) {
        await fetch(`${API}/api/projects/${activeProject.id}/tasks/${initialTask.id}/tags/${tagId}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
        setFullTask({ ...fullTask, tags: fullTask.tags.filter((t:any)=>t.id !== tagId) });
      } else {
        await fetch(`${API}/api/projects/${activeProject.id}/tasks/${initialTask.id}/tags`, { 
          method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` }, body: JSON.stringify({ tagId })
        });
        const tag = projectTags.find(t => t.id === tagId);
        if (tag) setFullTask({ ...fullTask, tags: [...fullTask.tags, tag] });
      }
    } catch (e) { console.error(e); }
  };

  const handleCreateTag = async () => {
    if (!activeProject || !newTagLabel.trim()) return;
    try {
      const res = await fetch(`${API}/api/projects/${activeProject.id}/tags`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ label: newTagLabel.trim(), color: newTagColor })
      });
      const data = await res.json();
      if (data.tag) {
        setProjectTags(prev => [...prev, data.tag]);
        await handleToggleTag(data.tag.id);
        setCreatingTag(false);
        setNewTagLabel("");
      }
    } catch (e) { console.error(e); }
  };

  const handleAddComment = async () => {
    if (!newComment.trim() || !initialTask.id) return;
    try {
      const res = await fetch(`${API}/api/tasks/${initialTask.id}/comments`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ body: newComment, attachmentUrl: newCommentMedia })
      });
      const data = await res.json();
      if (data.comment) {
        setNewComment("");
        setNewCommentMedia("");
        setShowMediaInput(false);
        // Optimistic update
        setComments([...comments, {
          ...data.comment,
          user: { id: user?.id, name: user?.name, avatarUrl: user?.avatarUrl },
          likes: 0, dislikes: 0, userVote: null
        }]);
        // Refetch activities
        const actsRes = await fetch(`${API}/api/tasks/${initialTask.id}/activities`, { headers: { Authorization: `Bearer ${token}` } });
        const actsData = await actsRes.json();
        setActivities(actsData.activities || []);
      }
    } catch (e) { console.error(e); }
  };

  const handleVoteComment = async (commentId: string, isLike: boolean) => {
    const comment = comments.find(c => c.id === commentId);
    if (!comment) return;

    let payload: boolean | null = isLike;
    if ((isLike && comment.userVote === "like") || (!isLike && comment.userVote === "dislike")) {
      payload = null; // remove vote
    }

    // Optimistic UI
    setComments(prev => prev.map(c => {
      if (c.id !== commentId) return c;
      let newLikes = c.likes;
      let newDislikes = c.dislikes;
      
      // Remove old vote
      if (c.userVote === "like") newLikes--;
      if (c.userVote === "dislike") newDislikes--;
      
      // Apply new vote
      if (payload === true) newLikes++;
      if (payload === false) newDislikes++;
      
      return { ...c, likes: newLikes, dislikes: newDislikes, userVote: payload === true ? "like" : payload === false ? "dislike" : null };
    }));

    try {
      await fetch(`${API}/api/tasks/${initialTask.id}/comments/${commentId}/like`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ isLike: payload })
      });
    } catch (e) { console.error(e); }
  };

  const currentColumn = columns.find(c => c.id === colId);

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.65)", zIndex:10000, display:"flex", alignItems:"center", justifyContent:"center", backdropFilter:"blur(3px)", animation:"fadeIn 0.18s ease" }}
    >
      <div style={{ width: 900, maxHeight:"88vh", background:"#1a1a1f", borderRadius:16, border:"1px solid rgba(255,255,255,0.07)", boxShadow:"0 32px 80px rgba(0,0,0,0.8)", display:"flex", flexDirection:"column", overflow:"hidden", animation:"slideUp 0.22s cubic-bezier(0.34,1.2,0.64,1)" }}>

        {/* ── Top bar ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 18px 12px", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <span style={{ fontSize:11, color:"#555", fontWeight:500 }}>{activeProject?.name}</span>
            <span style={{ color:"#333", fontSize:12 }}>›</span>
            <span style={{ fontSize:11, color:"#555" }}>{currentColumn?.title || "Sem Título"}</span>
          </div>
          <div style={{ display:"flex", gap:6 }}>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              style={{ width:28, height:28, borderRadius:7, background:"transparent", border:"1px solid rgba(255,255,255,0.06)", color:"#888", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}
              title="Excluir Tarefa"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            </button>
            <button
              onMouseEnter={()=>setHoverClose(true)} onMouseLeave={()=>setHoverClose(false)}
              onClick={onClose}
              style={{ width:28, height:28, borderRadius:7, background: hoverClose?"rgba(239,68,68,0.15)":"transparent", border:"1px solid rgba(255,255,255,0.06)", color: hoverClose?"#ef4444":"#888", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", transition:"all 0.15s" }}>
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Body (Two Panels) ── */}
        {loading ? (
          <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", color:"#888", fontSize:13 }}>
            Carregando...
          </div>
        ) : (
          <div style={{ flex:1, display:"flex", overflow:"hidden" }}>
            
            {/* Left Panel (Content) */}
            <div style={{ flex:6, padding:"24px 28px", overflowY:"auto", borderRight:"1px solid rgba(255,255,255,0.05)" }}>
              {/* Title Input */}
              <input 
                value={title} onChange={e=>setTitle(e.target.value)}
                placeholder="Título da tarefa..."
                style={{ width:"100%", background:"transparent", border:"none", outline:"none", fontSize:24, fontWeight:700, color:"#f0f0f0", marginBottom:12, fontFamily:"inherit" }}
              />

              {/* Priority */}
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:24 }}>
                {PRIORITY_ORDER.map(p => {
                  const info = PRIORITY_MAP[p];
                  const Icon = info.icon;
                  const active = priority === p;
                  return (
                    <button key={p} onClick={()=>handleImmediateChange("priority", p)} style={{ display:"flex", alignItems:"center", gap:6, padding:"4px 10px", borderRadius:20, background: active ? `${info.color}22` : "transparent", border:`1px solid ${active ? info.color : "rgba(255,255,255,0.08)"}`, color: active ? info.color : "#666", fontSize:12, cursor:"pointer", fontWeight: active ? 600 : 400, transition:"all 0.15s" }}>
                      <Icon size={12} /> {info.label}
                    </button>
                  );
                })}
              </div>

              {/* Tabs */}
              <div style={{ display:"flex", gap:0, borderBottom:"1px solid rgba(255,255,255,0.05)", marginBottom:20 }}>
                {(["descricao","comentarios","atividades"] as const).map(tab=>{
                  const labels = { descricao:"Descrição", comentarios:`Comentários (${comments.length})`, atividades:"Atividades" };
                  return (
                    <button key={tab} onClick={()=>setActiveTab(tab)} style={{ padding:"10px 18px", background:"transparent", border:"none", borderBottom:`2px solid ${activeTab===tab?"#7C5AC2":"transparent"}`, color: activeTab===tab?"#e0e0e0":"#555", fontWeight: activeTab===tab?600:400, fontSize:13, cursor:"pointer", transition:"all 0.12s", outline:"none" }}>
                      {labels[tab]}
                    </button>
                  );
                })}
              </div>

              {activeTab === "descricao" && (
                <div>
                  {/* Rich text area with formatting toolbar */}
                  <div style={{ marginBottom:24 }}>
                    <div style={{ display:"flex", gap:4, marginBottom:8 }}>
                      {["B","I","U","S"].map((f,i)=>(
                        <button key={i} onClick={() => handleFormat(f)} style={{ width:26, height:26, borderRadius:6, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", color:"#aaa", fontSize:12, fontWeight: f==="B"?700:400, fontStyle: f==="I"?"italic":"normal", cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center" }}>{f}</button>
                      ))}
                    </div>
                    <textarea
                      id="task-description"
                      value={description} onChange={e=>setDescription(e.target.value)} placeholder="Adicionar descrição detalhada..."
                      style={{ width:"100%", minHeight:120, background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"14px", fontSize:13, color:"#ccc", lineHeight:1.6, resize:"vertical", outline:"none", fontFamily:"inherit", boxSizing:"border-box" }}
                    />
                  </div>

                  {/* Subtasks */}
                  <div style={{ marginBottom:20 }}>
                    <div style={{ fontSize:11, fontWeight:700, color:"#555", letterSpacing:"0.05em", marginBottom:12 }}>SUBTAREFAS ({fullTask?.subtasks?.length || 0})</div>
                    {fullTask?.subtasks?.map((st:any, i:number)=>(
                      <div key={st.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                        <button onClick={() => handleToggleSubtask(st.id, !st.completed)} style={{ width:14, height:14, borderRadius:3, background: st.completed ? "rgba(124,90,194,0.8)" : "rgba(255,255,255,0.1)", border:"none", cursor:"pointer", flexShrink:0, marginTop:1, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          {st.completed && <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>}
                        </button>
                        <span style={{ fontSize:13, color:"#ccc", textDecoration: st.completed ? "line-through" : "none", opacity: st.completed ? 0.5 : 1 }}>{st.title}</span>
                      </div>
                    ))}
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginTop:10 }}>
                      <div style={{ width:14, height:14, borderRadius:3, border:"1.5px solid #444", flexShrink:0 }}/>
                      <input
                        value={newSubtask} onChange={e=>setNewSubtask(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') handleAddSubtask(); }}
                        placeholder="Adicionar subtarefa... (Pressione Enter)"
                        style={{ flex:1, background:"transparent", border:"none", outline:"none", fontSize:13, color:"#888", fontFamily:"inherit" }}
                      />
                    </div>
                  </div>

                  <div style={{ height:1, background:"rgba(255,255,255,0.05)", marginBottom:16 }}/>

                  {/* Anexos */}
                  <div style={{ marginBottom:20 }}>
                    <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"#444", letterSpacing:"0.1em" }}>ANEXOS ({attachments.length})</span>
                      <label style={{ fontSize:11, color:"#7C5AC2", fontWeight:500, cursor:"pointer", padding:0 }}>
                        {uploadingAttachment ? "Enviando..." : "Enviar"}
                        <input type="file" style={{ display:"none" }} onChange={handleUploadAttachment} />
                      </label>
                    </div>
                    <div style={{ display:"flex", flexWrap:"wrap", gap:8 }}>
                      {attachments.map(att => (
                        <div key={att.id} style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:8, padding:"8px 12px", minWidth:200 }}>
                          <div style={{ width:28, height:32, background: att.fileType?.includes("pdf") ? "#ef4444" : "#3b82f6", borderRadius:4, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                            <span style={{ fontSize:8, fontWeight:800, color:"#fff" }}>{att.fileType?.includes("pdf") ? "PDF" : "IMG"}</span>
                          </div>
                          <div>
                            <div style={{ fontSize:11, color:"#ccc", fontWeight:500, maxWidth:150, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{att.fileName}</div>
                            <div style={{ fontSize:10, color:"#555" }}><a href={`${API}${att.fileUrl}`} target="_blank" rel="noreferrer" style={{ color:"inherit", textDecoration:"none" }}>Baixar</a></div>
                          </div>
                        </div>
                      ))}
                      <label style={{ width:50, height:50, background:"rgba(255,255,255,0.03)", border:"1.5px dashed rgba(255,255,255,0.1)", borderRadius:8, display:"flex", alignItems:"center", justifyContent:"center", color:"#444", fontSize:18, cursor:"pointer", transition:"all 0.15s", flexShrink:0 }}>
                        +
                        <input type="file" style={{ display:"none" }} onChange={handleUploadAttachment} />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === "comentarios" && (
                <div style={{ paddingBottom:16 }}>
                  <div style={{ display:"flex", gap:10, marginBottom:20, alignItems:"flex-start" }}>
                    <ModalAvatar url={user?.avatarUrl} size={28}/>
                    <div style={{ flex:1, display:"flex", flexDirection:"column", gap:8 }}>
                      <div style={{ display:"flex", gap:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, padding:"2px", paddingRight:8 }}>
                        <input 
                          value={newComment} onChange={e=>setNewComment(e.target.value)}
                          onKeyDown={e=>{ if(e.key==="Enter") handleAddComment(); }}
                          placeholder="Adicionar comentário..."
                          style={{ flex:1, background:"transparent", border:"none", padding:"8px 10px", fontSize:13, color:"#ccc", outline:"none", fontFamily:"inherit" }}
                        />
                        <label style={{ background:"transparent", border:"none", color:"#888", cursor:"pointer", padding:"8px 6px", display:"flex", alignItems:"center", transition:"color 0.15s" }} title="Anexar Arquivo Local"
                          onMouseEnter={e => e.currentTarget.style.color = "#ccc"}
                          onMouseLeave={e => e.currentTarget.style.color = "#888"}>
                          <Paperclip size={14} />
                          <input type="file" style={{ display:"none" }} onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if(!file) return;
                            const formData = new FormData();
                            formData.append("file", file);
                            const upRes = await fetch(`${API}/api/upload`, { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: formData });
                            const upData = await upRes.json();
                            if(upData.url) setNewCommentMedia(`${API}${upData.url}`);
                          }} />
                        </label>
                      </div>
                      {newCommentMedia && (
                        <div style={{ fontSize:11, color:"#7C5AC2" }}>Anexo pronto para envio.</div>
                      )}
                    </div>
                  </div>
                  {comments.length === 0 && <div style={{ color:"#666", fontSize:12, textAlign:"center", padding:20 }}>Nenhum comentário ainda.</div>}
                  {comments.map((c)=>(
                    <div key={c.id} style={{ display:"flex", gap:10, marginBottom:16 }}>
                      <ModalAvatar url={c.user?.avatarUrl} size={28}/>
                      <div style={{ flex:1 }}>
                        <div style={{ display:"flex", gap:8, alignItems:"baseline", marginBottom:4 }}>
                          <span style={{ fontSize:13, color:"#ccc", fontWeight:600 }}>{c.user?.name}</span>
                          <span style={{ fontSize:11, color:"#555" }}>{new Date(c.createdAt).toLocaleDateString('pt-BR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</span>
                        </div>
                        <div style={{ fontSize:13, color:"#999", lineHeight:1.6 }}>{c.body}</div>
                        {c.attachmentUrl && (
                          <div style={{ marginTop:8, maxWidth:240, borderRadius:8, overflow:"hidden", border:"1px solid rgba(255,255,255,0.05)" }}>
                            <img src={c.attachmentUrl} alt="Anexo" style={{ width:"100%", display:"block" }} />
                          </div>
                        )}
                        {/* Likes */}
                        <div style={{ display:"flex", gap:10, marginTop:6 }}>
                          <button onClick={()=>handleVoteComment(c.id, true)} style={{ background:"transparent", border:"none", display:"flex", alignItems:"center", gap:4, fontSize:11, color: c.userVote === "like" ? "#7C5AC2" : "#666", cursor:"pointer", padding:0, fontWeight: c.userVote === "like" ? 600 : 400 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                            {c.likes > 0 && c.likes}
                          </button>
                          <button onClick={()=>handleVoteComment(c.id, false)} style={{ background:"transparent", border:"none", display:"flex", alignItems:"center", gap:4, fontSize:11, color: c.userVote === "dislike" ? "#ef4444" : "#666", cursor:"pointer", padding:0, fontWeight: c.userVote === "dislike" ? 600 : 400 }}>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ transform:"scaleY(-1)" }}><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"></path></svg>
                            {c.dislikes > 0 && c.dislikes}
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === "atividades" && (
                <div style={{ paddingBottom:16 }}>
                  {activities.length === 0 && <div style={{ color:"#666", fontSize:12, textAlign:"center", padding:20 }}>Nenhuma atividade registrada.</div>}
                  {activities.map((act)=>(
                    <div key={act.id} style={{ display:"flex", alignItems:"flex-start", gap:10, marginBottom:12, paddingBottom:12, borderBottom:"1px solid rgba(255,255,255,0.04)" }}>
                      <ModalAvatar url={act.user?.avatarUrl} size={24}/>
                      <div style={{ flex:1 }}>
                        <span style={{ fontSize:13, color:"#999" }}>
                          <span style={{ color:"#ccc", fontWeight:600 }}>{act.user?.name || "Sistema"}</span> {ACTION_MAP[act.action] || act.action} 
                          {act.metadata && JSON.parse(act.metadata)?.target && <span style={{ color:"#7C5AC2" }}> {JSON.parse(act.metadata).target}</span>}
                          {act.metadata && JSON.parse(act.metadata)?.new !== undefined && <span style={{ color:"#7C5AC2" }}> para {JSON.parse(act.metadata).new}</span>}
                        </span>
                        <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{new Date(act.createdAt).toLocaleDateString('pt-BR', {day:'numeric', month:'short', hour:'2-digit', minute:'2-digit'})}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Right Panel (Metadata) */}
            <div style={{ flex:4, padding:"24px", background:"rgba(0,0,0,0.15)", overflowY:"auto" }}>
              
              {/* Funil / Column Custom Dropdown */}
              <div style={{ marginBottom:24, position:"relative" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600 }}>ETAPA</div>
                <div 
                  onClick={()=>setShowColDrop(!showColDrop)}
                  style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"10px 12px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, color:"#e0e0e0", fontSize:13, cursor:"pointer", boxSizing:"border-box" }}
                >
                  {currentColumn?.title || "Selecionar Funil"}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>
                </div>
                {showColDrop && (
                  <div style={{ position:"absolute", top:"100%", left:0, marginTop:6, background:"rgba(18,18,22,0.97)", backdropFilter:"blur(14px)", border:"1px solid rgba(124,90,194,0.2)", borderRadius:10, width:"100%", zIndex:20, boxShadow:"0 16px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)", overflow:"hidden", animation:"dropdownFadeIn 0.18s cubic-bezier(0.34,1.4,0.64,1)" }}>
                    {columns.map(c => (
                      <div key={c.id} onClick={()=>{ handleImmediateChange("colId", c.id); setShowColDrop(false); }}
                        style={{ padding:"10px 14px", display:"flex", alignItems:"center", justifyContent:"space-between", cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.04)", background: c.id === colId ? "rgba(124,90,194,0.12)" : "transparent", transition:"background 0.12s" }}
                        onMouseEnter={e=>{ if(c.id!==colId) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                        onMouseLeave={e=>{ if(c.id!==colId) e.currentTarget.style.background="transparent"; }}
                      >
                        <span style={{ fontSize:13, color: c.id === colId ? "#a78bfa" : "#ccc", fontWeight: c.id === colId ? 600 : 400 }}>{c.title}</span>
                        {c.id === colId && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Prazo */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600 }}>PRAZO DE ENTREGA</div>
                <CustomDatePicker value={dueDate} onChange={val => handleImmediateChange("dueDate", val)} />
              </div>

              {/* Estimativa */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600 }}>ESTIMATIVA (HORAS)</div>
                <div style={{ display:"flex", alignItems:"center", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:8, overflow:"hidden" }}>
                  <button 
                    onClick={() => { const v = Math.max(0, Number(estimatedHours) - 1); setEstimatedHours(String(v)); handleImmediateChange("estimatedHours", v); }} 
                    style={{ width:36, height:38, background:"rgba(0,0,0,0.15)", border:"none", borderRight:"1px solid rgba(255,255,255,0.05)", color:"#888", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.3)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.15)"}
                  >−</button>
                  <input 
                    type="number" min="0" value={estimatedHours} onChange={e=>setEstimatedHours(e.target.value)} placeholder="0"
                    style={{ flex:1, width:"100%", padding:"10px 0", background:"transparent", border:"none", color:"#ccc", fontSize:13, outline:"none", fontFamily:"inherit", textAlign:"center", boxSizing:"border-box" }}
                  />
                  <button 
                    onClick={() => { const v = Number(estimatedHours) + 1; setEstimatedHours(String(v)); handleImmediateChange("estimatedHours", v); }} 
                    style={{ width:36, height:38, background:"rgba(0,0,0,0.15)", border:"none", borderLeft:"1px solid rgba(255,255,255,0.05)", color:"#888", cursor:"pointer", fontSize:16, display:"flex", alignItems:"center", justifyContent:"center", transition:"background 0.15s" }}
                    onMouseEnter={e=>e.currentTarget.style.background="rgba(0,0,0,0.3)"} onMouseLeave={e=>e.currentTarget.style.background="rgba(0,0,0,0.15)"}
                  >+</button>
                </div>
              </div>

              {/* Assignees */}
              <div style={{ marginBottom:24, position:"relative" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600 }}>RESPONSÁVEIS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:8, alignItems:"center" }}>
                  {fullTask?.assignees?.map((a:any) => (
                    <div key={a.id} style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(255,255,255,0.06)", padding:"4px 10px 4px 4px", borderRadius:20, border:"1px solid rgba(255,255,255,0.05)" }}>
                      <ModalAvatar url={a.avatarUrl} size={20} />
                      <span style={{ fontSize:12, color:"#ccc" }}>{a.name.split(" ")[0]}</span>
                      <button onClick={()=>handleToggleAssignee(a.id)} style={{ background:"transparent", border:"none", color:"#666", cursor:"pointer", padding:0, display:"flex", alignItems:"center", marginLeft:4 }}
                        onMouseEnter={e => e.currentTarget.style.color = "#ef4444"}
                        onMouseLeave={e => e.currentTarget.style.color = "#666"}>
                        <X size={11} />
                      </button>
                    </div>
                  ))}
                  <button onClick={()=>setShowAssigneesDrop(!showAssigneesDrop)} style={{ width:28, height:28, borderRadius:"50%", border:"1px dashed rgba(255,255,255,0.2)", background:"transparent", color:"#888", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", fontSize:16 }}>+</button>
                </div>
                {/* Assignees Dropdown */}
                {showAssigneesDrop && (
                  <div style={{ position:"absolute", top:"100%", left:0, marginTop:6, background:"rgba(18,18,22,0.97)", backdropFilter:"blur(14px)", border:"1px solid rgba(124,90,194,0.2)", borderRadius:10, width:240, zIndex:20, boxShadow:"0 16px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)", maxHeight:220, overflowY:"auto", animation:"dropdownFadeIn 0.18s cubic-bezier(0.34,1.4,0.64,1)" }}>
                    <div style={{ padding:"8px 12px 6px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                      <span style={{ fontSize:10, fontWeight:700, color:"#555", letterSpacing:"0.08em" }}>RESPONSÁVEIS</span>
                    </div>
                    {workspaceMembers.map(m => {
                      const isAssigned = fullTask?.assignees?.some((a:any)=>a.id===m.id);
                      return (
                        <div key={m.id} onClick={()=>{ handleToggleAssignee(m.id); setShowAssigneesDrop(false); }}
                          style={{ padding:"9px 12px", display:"flex", alignItems:"center", gap:9, cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.03)", background: isAssigned ? "rgba(124,90,194,0.08)" : "transparent", transition:"background 0.12s" }}
                          onMouseEnter={e=>{ if(!isAssigned) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                          onMouseLeave={e=>{ if(!isAssigned) e.currentTarget.style.background="transparent"; }}
                        >
                          <ModalAvatar url={m.avatarUrl} size={24}/>
                          <span style={{ fontSize:13, color: isAssigned ? "#e0e0e0" : "#aaa", flex:1, fontWeight: isAssigned ? 500 : 400 }}>{m.name}</span>
                          {isAssigned && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Imagem de Capa */}
              <div style={{ marginBottom:24 }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600 }}>CAPA DA TAREFA</div>
                {fullTask?.coverImageUrl && (
                  <div style={{ width:"100%", height:120, borderRadius:8, overflow:"hidden", marginBottom:10, border:"1px solid rgba(255,255,255,0.08)" }}>
                    <img src={fullTask.coverImageUrl} alt="Capa" style={{ width:"100%", height:"100%", objectFit:"cover" }} />
                  </div>
                )}
                <label style={{ display:"block", width:"100%", padding:"10px 0", background:"rgba(255,255,255,0.04)", border:"1px dashed rgba(255,255,255,0.15)", borderRadius:8, color:"#ccc", fontSize:12, textAlign:"center", cursor:"pointer", transition:"background 0.15s" }}>
                  {uploadingCover ? "Enviando..." : (fullTask?.coverImageUrl ? "Alterar Capa" : "Adicionar Capa")}
                  <input type="file" style={{ display:"none" }} onChange={handleUploadCover} accept="image/*" />
                </label>
              </div>

              {/* Tags */}
              <div style={{ marginBottom:24, position:"relative" }}>
                <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600 }}>TAGS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:6, alignItems:"center" }}>
                  {fullTask?.tags?.map((t:any) => {
                    const s = TAG_STYLES[t.color as TagColor] || TAG_STYLES.gray;
                    return (
                      <span key={t.id} style={{ background:s.bg, color:s.text, fontSize:11, padding:"3px 10px", borderRadius:20, display:"inline-flex", alignItems:"center", gap:6, border:`1px solid ${s.dot}44` }}>
                        <span style={{ width:6, height:6, borderRadius:"50%", background:s.dot }}/>
                        {t.label}
                        <button onClick={()=>handleToggleTag(t.id)} style={{ background:"transparent", border:"none", color:s.text, cursor:"pointer", padding:0, display:"inline-flex", alignItems:"center", opacity:0.7 }}
                          onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                          onMouseLeave={e => e.currentTarget.style.opacity = "0.7"}>
                          <X size={10} />
                        </button>
                      </span>
                    )
                  })}
                  <button onClick={()=>setShowTagsDrop(!showTagsDrop)} style={{ fontSize:12, color:"#a78bfa", background:"transparent", border:"none", cursor:"pointer", fontWeight:500, display:"flex", alignItems:"center", gap:4 }}>+ Tag</button>
                </div>
                {showTagsDrop && (
                  <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:0, background:"rgba(18,18,22,0.97)", backdropFilter:"blur(14px)", border:"1px solid rgba(124,90,194,0.2)", borderRadius:10, width:260, zIndex:20, boxShadow:"0 -16px 48px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,255,255,0.04)", overflow:"hidden", animation:"dropdownFadeUp 0.18s cubic-bezier(0.34,1.4,0.64,1)" }}>
                    {!creatingTag ? (
                      <>
                        <div style={{ padding:"8px 12px 6px", borderBottom:"1px solid rgba(255,255,255,0.06)" }}>
                          <span style={{ fontSize:10, fontWeight:700, color:"#555", letterSpacing:"0.08em" }}>TAGS DO PROJETO</span>
                        </div>
                        <div style={{ maxHeight:180, overflowY:"auto" }}>
                          {projectTags.length === 0 && (
                            <div style={{ padding:"14px 12px", fontSize:12, color:"#555", textAlign:"center" }}>Nenhuma tag criada</div>
                          )}
                          {projectTags.map(t => {
                            const hasTag = fullTask?.tags?.some((ft:any)=>ft.id===t.id);
                            const s = TAG_STYLES[t.color as TagColor] || TAG_STYLES.gray;
                            return (
                              <div key={t.id} onClick={()=>handleToggleTag(t.id)}
                                style={{ padding:"9px 12px", display:"flex", alignItems:"center", gap:9, cursor:"pointer", borderBottom:"1px solid rgba(255,255,255,0.03)", background: hasTag ? "rgba(124,90,194,0.08)" : "transparent", transition:"background 0.12s" }}
                                onMouseEnter={e=>{ if(!hasTag) e.currentTarget.style.background="rgba(255,255,255,0.05)"; }}
                                onMouseLeave={e=>{ if(!hasTag) e.currentTarget.style.background="transparent"; }}
                              >
                                <span style={{ width:10, height:10, borderRadius:"50%", background:s.dot, flexShrink:0 }}/>
                                <span style={{ fontSize:13, color: hasTag ? s.text : "#ccc", flex:1, fontWeight: hasTag ? 500 : 400 }}>{t.label}</span>
                                {hasTag && <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12"/></svg>}
                              </div>
                            );
                          })}
                        </div>
                        <div onClick={()=>setCreatingTag(true)}
                          style={{ padding:"10px 14px", borderTop:"1px solid rgba(124,90,194,0.15)", display:"flex", alignItems:"center", gap:8, color:"#a78bfa", fontSize:12, cursor:"pointer", fontWeight:600, transition:"background 0.12s" }}
                          onMouseEnter={e=>e.currentTarget.style.background="rgba(124,90,194,0.1)"}
                          onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                          Criar Nova Tag
                        </div>
                      </>
                    ) : (
                      <div style={{ padding:16 }}>
                        <div style={{ fontSize:11, fontWeight:700, color:"#555", letterSpacing:"0.08em", marginBottom:10 }}>NOVA TAG</div>
                        <input value={newTagLabel} onChange={e=>setNewTagLabel(e.target.value)} placeholder="Nome da tag..." style={{ width:"100%", padding:"9px 12px", marginBottom:12, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(124,90,194,0.3)", borderRadius:7, color:"#f0f0f0", fontSize:13, boxSizing:"border-box", outline:"none", fontFamily:"inherit" }}
                          onFocus={e=>{e.currentTarget.style.borderColor="rgba(124,90,194,0.6)"; e.currentTarget.style.boxShadow="0 0 0 2px rgba(124,90,194,0.1)";}} onBlur={e=>{e.currentTarget.style.borderColor="rgba(124,90,194,0.3)"; e.currentTarget.style.boxShadow="none";}}
                        />
                        <div style={{ display:"flex", gap:8, marginBottom:14, alignItems:"center" }}>
                          <span style={{ fontSize:11, color:"#555" }}>Cor:</span>
                          {(Object.keys(TAG_STYLES) as TagColor[]).map(c=>(
                            <div key={c} onClick={()=>setNewTagColor(c)} style={{ width:22, height:22, borderRadius:"50%", background:TAG_STYLES[c].dot, cursor:"pointer", border: newTagColor===c ? "2.5px solid #fff" : "2.5px solid transparent", boxShadow: newTagColor===c ? `0 0 0 2px ${TAG_STYLES[c].dot}66` : "none", transition:"all 0.15s" }}/>
                          ))}
                        </div>
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={()=>setCreatingTag(false)} style={{ flex:1, padding:"8px", fontSize:12, borderRadius:7, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#888", cursor:"pointer", fontFamily:"inherit", transition:"all 0.12s" }}
                            onMouseEnter={e=>e.currentTarget.style.background="rgba(255,255,255,0.05)"} onMouseLeave={e=>e.currentTarget.style.background="transparent"}
                          >Cancelar</button>
                          <button onClick={handleCreateTag} disabled={!newTagLabel.trim()} style={{ flex:1, padding:"8px", fontSize:12, borderRadius:7, background:"linear-gradient(135deg,#7C5AC2,#6044a8)", border:"none", color:"#fff", cursor:"pointer", fontFamily:"inherit", fontWeight:600, boxShadow:"0 4px 12px rgba(124,90,194,0.3)", opacity: newTagLabel.trim() ? 1 : 0.5, transition:"all 0.12s" }}
                            onMouseEnter={e=>{ if(newTagLabel.trim()) e.currentTarget.style.transform="translateY(-1px)"; }} onMouseLeave={e=>e.currentTarget.style.transform=""}
                          >Criar Tag</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Criador */}
              {fullTask?.creator && (
                <div>
                  <div style={{ fontSize:11, color:"#666", marginBottom:8, fontWeight:600 }}>CRIADO POR</div>
                  <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                    <ModalAvatar url={fullTask.creator.avatarUrl} size={24} />
                    <span style={{ fontSize:13, color:"#888" }}>{fullTask.creator.name}</span>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"16px 24px", borderTop:"1px solid rgba(255,255,255,0.05)", background:"#161619" }}>
          <span style={{ fontSize:11, color:"#888", fontStyle:"italic", display:"inline-flex", alignItems:"center", gap:4 }}>
            Salvo automaticamente <Check size={12} style={{ color:"#10B981" }} />
          </span>
          <button onClick={onClose} style={{ padding:"10px 20px", borderRadius:8, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#999", fontSize:13, cursor:"pointer", fontFamily:"inherit" }}>Fechar Janela</button>
        </div>

        {/* Delete Confirm Modal */}
        {showDeleteConfirm && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(5px)", zIndex:100000, display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.15s ease" }}>
            <div style={{ width:380, background:"#1e1e22", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", padding:"24px", boxShadow:"0 20px 60px rgba(0,0,0,0.8)", animation:"slideUp 0.2s ease" }}>
              <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
                <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(239,68,68,0.1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#ef4444" }}>
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                </div>
                <div>
                  <h3 style={{ margin:0, fontSize:16, color:"#f0f0f0", fontWeight:600 }}>Excluir Tarefa</h3>
                </div>
              </div>
              <p style={{ margin:"0 0 24px 0", fontSize:13, color:"#aaa", lineHeight:1.5 }}>
                Tem certeza que deseja excluir permanentemente esta tarefa? Essa ação não pode ser desfeita e todos os dados serão perdidos.
              </p>
              <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
                <button onClick={() => setShowDeleteConfirm(false)} style={{ padding:"8px 16px", borderRadius:6, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#ccc", fontSize:13, cursor:"pointer", fontWeight:500 }}>Cancelar</button>
                <button onClick={async () => {
                    try {
                      await fetch(`${API}/api/projects/${activeProject?.id}/tasks/${initialTask.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
                      onSave();
                      onClose();
                    } catch (e) { console.error(e); }
                }} style={{ padding:"8px 16px", borderRadius:6, background:"#ef4444", border:"none", color:"#fff", fontSize:13, cursor:"pointer", fontWeight:600 }}>Sim, Excluir</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
