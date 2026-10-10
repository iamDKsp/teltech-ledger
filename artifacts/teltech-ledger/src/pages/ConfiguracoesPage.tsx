import React, { useState, useEffect } from "react";
import { Settings, Video, Plus, Clock, Link as LinkIcon, Trash, MessageCircle, Webhook, ScanFace } from "lucide-react";
import { API } from "../lib/api";
import { confirmDialog } from "../components/finance-ui";
import { WhatsAppSettingsPanel } from "../components/WhatsAppSettingsPanel";
import { WebhookSettingsPanel } from "../components/WebhookSettingsPanel";
import { useAuth } from "../lib/auth-context";
import { isBiometricsEnabled, registerBiometrics, disableBiometrics } from "../lib/biometrics";
import { toast } from "sonner";

export function ConfiguracoesPage({ workspace }: { workspace?: any }) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"geral" | "reunioes" | "whatsapp" | "integracoes">("geral");
  const [meetings, setMeetings] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Biometrics Face ID state
  const [biometricsActive, setBiometricsActive] = useState(() => isBiometricsEnabled());
  const [biometricsLoading, setBiometricsLoading] = useState(false);

  const handleEnableBiometrics = async () => {
    setBiometricsLoading(true);
    try {
      const email = user?.email || "socio@teltech.com.br";
      const name = user?.name || "Sócio Teltech";
      await registerBiometrics(email, name);
      setBiometricsActive(true);
      toast.success("Face ID ativado com sucesso! Será solicitado ao abrir o app.");
    } catch (err: any) {
      console.warn("Enable biometrics error:", err);
      if (err.name === "NotAllowedError") {
        toast.error("Permissão de Face ID / Biometria cancelada.");
      } else {
        toast.error(err.message || "Erro ao configurar Face ID neste aparelho.");
      }
    } finally {
      setBiometricsLoading(false);
    }
  };

  const handleDisableBiometrics = () => {
    disableBiometrics();
    setBiometricsActive(false);
    toast.info("Face ID desativado neste aparelho.");
  };

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
    setError(null);
    try {
      const res = await API.get<{ meetings: any[] }>("/meetings");
      if (!Array.isArray(res?.meetings)) throw new Error("Resposta inválida ao carregar reuniões.");
      setMeetings(res.meetings);
    } catch (e) {
      console.error("Failed to load meetings", e);
      setError(e instanceof Error ? e.message : "Não foi possível carregar as reuniões.");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateMeeting = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;
    if (!workspace?.id) {
      setError("Não foi possível identificar o espaço de trabalho para agendar a reunião.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const start = new Date(`${date}T${time}:00`);
      const end = new Date(start.getTime() + parseInt(duration) * 60000);
      
      const res = await API.post<{ meeting: any }>("/meetings", {
        workspaceId: workspace.id,
        title,
        description,
        startTime: start.toISOString(),
        endTime: end.toISOString(),
        location
      });
      
      if (!res?.meeting?.id) throw new Error("Resposta inválida ao agendar reunião.");
      {
        setMeetings(prev => [...prev, res.meeting].sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()));
        setIsCreating(false);
        setTitle("");
        setDescription("");
        setDate("");
        setTime("");
        setLocation("");
      }
    } catch (e) {
      console.error("Failed to create meeting", e);
      setError(e instanceof Error ? e.message : "Não foi possível agendar a reunião.");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmDialog({
      title: "Excluir Reunião",
      message: "Tem certeza que deseja excluir esta reunião?",
      confirmLabel: "Excluir",
      danger: true,
    });
    if (!ok) return;
    setError(null);
    try {
      await API.delete(`/meetings/${id}`);
      setMeetings(prev => prev.filter(m => m.id !== id));
    } catch (e) {
      console.error("Failed to delete meeting", e);
      setError(e instanceof Error ? e.message : "Não foi possível excluir a reunião.");
    }
  };

  const upcomingMeetings = meetings.filter(m => new Date(m.endTime) >= new Date());
  const pastMeetings = meetings.filter(m => new Date(m.endTime) < new Date());

  return (
    <div className="flex h-full min-w-0 flex-col bg-background text-foreground md:flex-row">
      {/* Sidebar de Configurações */}
      <div className="flex shrink-0 flex-row gap-2 overflow-x-auto border-b border-border p-3 md:w-[250px] md:flex-col md:overflow-visible md:border-b-0 md:border-r md:p-4">
        <h2 className="hidden pl-3 text-lg font-semibold md:mb-4 md:block">Configurações</h2>
        
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
        <button
          onClick={() => setActiveTab("whatsapp")}
          style={{
            display: "flex", alignItems: "center", gap: 12, padding: "10px 12px",
            background: activeTab === "whatsapp" ? "hsl(265 85% 62% / 0.14)" : "transparent",
            color: activeTab === "whatsapp" ? "hsl(265 85% 62%)" : "hsl(240 5% 65%)",
            border: "none", borderRadius: 8, cursor: "pointer", textAlign: "left",
            fontWeight: activeTab === "whatsapp" ? 600 : 400,
            whiteSpace: "nowrap"
          }}
        >
          <MessageCircle size={18} />
          WhatsApp
        </button>
        <button onClick={() => setActiveTab("integracoes")}
          className={`flex items-center gap-3 whitespace-nowrap rounded-lg px-3 py-2.5 text-left transition-colors ${activeTab === "integracoes" ? "bg-primary/15 font-semibold text-primary" : "text-muted-foreground hover:bg-muted"}`}>
          <Webhook size={18} /> Integrações
        </button>
      </div>

      {/* Conteúdo Principal */}
      <div className="min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 md:p-8">
        {activeTab === "whatsapp" && <WhatsAppSettingsPanel />}
        {activeTab === "integracoes" && <WebhookSettingsPanel workspaceId={workspace?.id} />}
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

            {/* Segurança & Desbloqueio com Face ID */}
            <div style={{ background: "#1a1a1a", border: "1px solid #242424", borderRadius: 12, padding: 24, marginTop: 20 }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
                  <div
                    style={{
                      width: 44,
                      height: 44,
                      borderRadius: 12,
                      background: "hsl(265 85% 62% / 0.15)",
                      border: "1px solid hsl(265 85% 62% / 0.4)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#c4a3ff",
                      flexShrink: 0,
                    }}
                  >
                    <ScanFace size={24} />
                  </div>
                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                      <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0, color: "#fff" }}>
                        Bloqueio com Face ID / Biometria
                      </h3>
                      {biometricsActive ? (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: "hsl(152 65% 45% / 0.2)",
                            border: "1px solid hsl(152 65% 45% / 0.4)",
                            color: "hsl(152 65% 55%)",
                            fontWeight: 700,
                          }}
                        >
                          Ativo neste Aparelho
                        </span>
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            padding: "2px 8px",
                            borderRadius: 10,
                            background: "#25252b",
                            border: "1px solid #33333d",
                            color: "#888",
                            fontWeight: 600,
                          }}
                        >
                          Inativo
                        </span>
                      )}
                    </div>
                    <p style={{ fontSize: 12, color: "#a1a1aa", margin: "4px 0 0 0", maxWidth: 460, lineHeight: 1.4 }}>
                      Exige Face ID no iPhone ou biometria no celular sempre que você abrir o Teltech Ledger, garantindo que apenas você acesse as contas e clientes.
                    </p>
                  </div>
                </div>

                <div>
                  {biometricsActive ? (
                    <button
                      onClick={handleDisableBiometrics}
                      style={{
                        padding: "8px 16px",
                        borderRadius: 8,
                        background: "hsl(0 70% 58% / 0.15)",
                        border: "1px solid hsl(0 70% 58% / 0.4)",
                        color: "hsl(0 70% 68%)",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.15s ease",
                      }}
                    >
                      Desativar Face ID
                    </button>
                  ) : (
                    <button
                      onClick={handleEnableBiometrics}
                      disabled={biometricsLoading}
                      style={{
                        padding: "9px 18px",
                        borderRadius: 8,
                        background: "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 50%))",
                        border: "none",
                        color: "#fff",
                        fontSize: 13,
                        fontWeight: 600,
                        cursor: biometricsLoading ? "not-allowed" : "pointer",
                        boxShadow: "0 0 16px hsl(265 85% 62% / 0.35)",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 8,
                      }}
                    >
                      <ScanFace size={16} />
                      {biometricsLoading ? "Lendo Face ID..." : "Ativar Face ID"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === "reunioes" && (
          <div>
            {error && <div role="alert" style={{ color: "#f87171", marginBottom: 16 }}>{error}</div>}
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
                    <button type="submit" disabled={saving} style={{ background: "#10B981", border: "none", color: "#fff", padding: "8px 16px", borderRadius: 8, cursor: "pointer", fontWeight: 500 }}>
                      {saving ? "Agendando..." : "Agendar"}
                    </button>
                  </div>
                </div>
              </form>
            )}

            {loading ? (
              <div style={{ color: "#a1a1aa" }}>Carregando reuniões...</div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                {upcomingMeetings.length === 0 && !isCreating && !error && (
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
