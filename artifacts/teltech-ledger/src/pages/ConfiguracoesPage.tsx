import React, { useState, useEffect } from "react";
import { Settings, Users, Video, Plus, Calendar, Clock, Link as LinkIcon, Trash } from "lucide-react";
import { API } from "../lib/api";

export function ConfiguracoesPage({ workspace }: { workspace?: any }) {
  const [activeTab, setActiveTab] = useState<"geral" | "reunioes">("geral");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  // Form states
  const [isCreating, setIsCreating] = useState(false);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [duration, setDuration] = useState("60");
  const [location, setLocation] = useState("");

  useEffect(() => {
    if (activeTab === "reunioes") {
      fetchMeetings();
    }
  }, [activeTab]);

  const fetchMeetings = async () => {
    setLoading(true);
    try {
      const res = await API.get("/meetings");
      if (res.data?.meetings) setMeetings(res.data.meetings);
    } catch (e) {
      console.error("Failed to load meetings", e);
    }
    setLoading(false);
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!workspace) return;
    
    try {
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start.getTime() + parseInt(duration) * 60000);
      
      const res = await API.post("/meetings", {
        workspaceId: workspace.id,
        title,
        description,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location
      });
      
      if (res.data?.meeting) {
        setMeetings(prev => [...prev, res.data.meeting].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
        setIsCreating(false);
        setTitle("");
        setDescription("");
        setDate("");
        setTime("");
        setLocation("");
      }
    } catch (e) {
      console.error("Failed to create meeting", e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta reunião?")) return;
    try {
      await API.delete(`/meetings/${id}`);
      setMeetings(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.error("Failed to delete meeting", e);
    }
  };

  const upcomingMeetings = meetings.filter(m => new Date(m.endTime) >= new Date());
  const pastMeetings = meetings.filter(m => new Date(m.endTime) < new Date());

  return (
    <div style={{ display: "flex", height: "100%", background: "#111111", color: "#fafafa" }}>
      {/* Sidebar de Configurações */}
      <div style={{ 
        width: 250, borderRight: "1px solid #242424", padding: "24px 16px",
        display: "flex", flexDirection: "column", gap: 8
      }}>
        <h2 style={{ fontSize: 18, fontWeight: 600, paddingLeft: 12, marginBottom: 16 }}>Configurações</h2>
        
        <button
          onClick={() => setActiveTab("geral")}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            background: activeTab === "geral" ? "#7C5AC222" : "transparent",
            color: activeTab === "geral" ? "#7C5AC2" : "#a1a1aa",
            border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
            fontWeight: activeTab === "geral" ? 500 : 400
          }}
        >
          <Settings size={18} />
          Geral
        </button>
        
        <button
          onClick={() => setActiveTab("reunioes")}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            background: activeTab === "reunioes" ? "#7C5AC222" : "transparent",
            color: activeTab === "reunioes" ? "#7C5AC2" : "#a1a1aa",
            border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
            fontWeight: activeTab === "reunioes" ? 500 : 400
          }}
        >
          <Video size={18} />
          Reuniões
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div style={{ flex: 1, padding: 32, overflowY: "auto" }}>
        {activeTab === "geral" && (
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 24 }}>Geral</h1>
            
            <div style={{ background: "#1a1a1a", border: "1px solid #242424", borderRadius: 12, padding: 24 }}>
              <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Espaço de Trabalho Atual</h3>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, color: "#a1a1aa" }}>Nome do Workspace</label>
                <input 
                  type="text" 
                  value={workspace?.name || "Carregando..."} 
                  disabled
                  style={{
                    background: "#232326", border: "1px solid #313136", borderRadius: 8,
                    padding: "10px 12px", color: "#a1a1aa", fontSize: 14, outline: "none"
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === "reunioes" && (
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 24 }}>
              <h1 style={{ fontSize: 24, fontWeight: 600 }}>Reuniões</h1>
              <button 
                onClick={() => setIsCreating(!isCreating)}
                style={{
                  display: "flex", alignItems: "center", gap: 8, background: "#7C5AC2", 
                  color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px",
                  fontWeight: 500, cursor: "pointer"
                }}
              >
                <Plus size={18} />
                Nova Reunião
              </button>
            </div>

            {isCreating && (
              <form onSubmit={handleCreateMeeting} style={{ background: "#1a1a1a", border: "1px solid #242424", borderRadius: 12, padding: 24, marginBottom: 24 }}>
                <h3 style={{ fontSize: 16, fontWeight: 500, marginBottom: 16 }}>Agendar Nova Reunião</h3>
                
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  <div>
                    <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6 }}>Título</label>
                    <input 
                      required type="text" value={title} onChange={e => setTitle(e.target.value)}
                      style={{ width: "100%", background: "#232326", border: "1px solid #313136", borderRadius: 8, padding: "10px 12px", color: "#fff" }}
                    />
                  </div>
                  
                  <div style={{ display: "flex", gap: 16 }}>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6 }}>Data</label>
                      <input 
                        required type="date" value={date} onChange={e => setDate(e.target.value)}
                        style={{ width: "100%", background: "#232326", border: "1px solid #313136", borderRadius: 8, padding: "10px 12px", color: "#fff", colorScheme: "dark" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6 }}>Hora de Início</label>
                      <input 
                        required type="time" value={time} onChange={e => setTime(e.target.value)}
                        style={{ width: "100%", background: "#232326", border: "1px solid #313136", borderRadius: 8, padding: "10px 12px", color: "#fff", colorScheme: "dark" }}
                      />
                    </div>
                    <div style={{ flex: 1 }}>
                      <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6 }}>Duração (minutos)</label>
                      <select 
                        value={duration} onChange={e => setDuration(e.target.value)}
                        style={{ width: "100%", background: "#232326", border: "1px solid #313136", borderRadius: 8, padding: "10px 12px", color: "#fff" }}
                      >
                        <option value="15">15 min</option>
                        <option value="30">30 min</option>
                        <option value="45">45 min</option>
                        <option value="60">1 hora</option>
                        <option value="90">1.5 horas</option>
                        <option value="120">2 horas</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6 }}>Link / Local</label>
                    <input 
                      type="text" placeholder="https://meet.google.com/..." value={location} onChange={e => setLocation(e.target.value)}
                      style={{ width: "100%", background: "#232326", border: "1px solid #313136", borderRadius: 8, padding: "10px 12px", color: "#fff" }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: 13, color: "#a1a1aa", marginBottom: 6 }}>Descrição (Opcional)</label>
                    <textarea 
                      value={description} onChange={e => setDescription(e.target.value)} rows={3}
                      style={{ width: "100%", background: "#232326", border: "1px solid #313136", borderRadius: 8, padding: "10px 12px", color: "#fff", resize: "vertical" }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 8 }}>
                    <button type="button" onClick={() => setIsCreating(false)} style={{ background: "transparent", border: "1px solid #313136", color: "#fafafa", padding: "8px 16px", borderRadius: 8, cursor: "pointer" }}>
                      Cancelar
                    </button>
                    <button type="submit" style={{ background: "#10B981", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                      Agendar
                    </button>
                  </div>
                </div>
              </form>
            )}

            {loading ? (
              <div style={{ color: "#a1a1aa" }}>Carregando reuniões...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {upcomingMeetings.length === 0 && !isCreating && (
                  <div style={{ textAlign: "center", padding: 40, background: "#1a1a1a", borderRadius: 12, border: "1px solid #242424", color: "#a1a1aa" }}>
                    Nenhuma reunião agendada.
                  </div>
                )}
                
                {upcomingMeetings.map(m => (
                  <div key={m.id} style={{ background: "#1a1a1a", border: "1px solid #242424", borderRadius: 12, padding: 20, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
                      <div style={{ width: 48, height: 48, borderRadius: 12, background: "#7C5AC222", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", color: "#7C5AC2" }}>
                        <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" }}>{new Date(m.startTime).toLocaleDateString("pt-BR", { month: "short" })}</span>
                        <span style={{ fontSize: 18, fontWeight: 700, lineHeight: 1 }}>{new Date(m.startTime).getDate()}</span>
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 500, color: "#fafafa" }}>{m.title}</h3>
                        <div style={{ display: "flex", gap: 16, marginTop: 6, color: "#a1a1aa", fontSize: 13 }}>
                          <span style={{ display: "flex", alignItems: "center", gap: 4 }}><Clock size={14} /> {new Date(m.startTime).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                          {m.location && (
                            <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
                              <LinkIcon size={14} /> 
                              {m.location.startsWith("http") ? <a href={m.location} target="_blank" rel="noreferrer" style={{ color: "#7C5AC2", textDecoration: "none" }}>Link da chamada</a> : m.location}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
                      <div style={{ display: "flex", marginRight: 8 }}>
                        {m.participants?.map((p: any, i: number) => (
                          <img key={p.id} src={p.avatarUrl || `https://ui-avatars.com/api/?name=${p.name}&background=random`} alt={p.name} title={p.name} style={{ width: 32, height: 32, borderRadius: "50%", border: "2px solid #1a1a1a", marginLeft: i > 0 ? -8 : 0 }} />
                        ))}
                      </div>
                      <button onClick={() => handleDelete(m.id)} style={{ background: "transparent", border: "none", color: "#ef4444", cursor: "pointer", opacity: 0.7 }}>
                        <Trash size={18} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
