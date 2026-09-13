import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "../lib/auth-context";
import { Loader } from "../components/Loader";
import { X, KeyRound, Check, Camera, Pencil, Trash2 } from "lucide-react";

const API = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ""
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? "http://localhost:5000" : "");

interface Member {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  phone?: string | null;
  mustChangePassword: boolean;
  role: string;
  createdAt: string;
}

type ModalMode = "create" | "edit" | "password" | "avatar" | "delete" | null;

const ROLE_LABELS: Record<string, { label: string; color: string; bg: string }> = {
  ceo: { label: "CEO", color: "#F59E0B", bg: "rgba(245,158,11,0.12)" },
  cto: { label: "CTO", color: "#3B82F6", bg: "rgba(59,130,246,0.12)" },
  cmo: { label: "CMO", color: "#EC4899", bg: "rgba(236,72,153,0.12)" },
};

const GRADIENT_COLORS = [
  "linear-gradient(135deg, #7C5AC2, #9B6DE3)",
  "linear-gradient(135deg, #3B82F6, #60A5FA)",
  "linear-gradient(135deg, #10B981, #34D399)",
  "linear-gradient(135deg, #F59E0B, #FBBF24)",
  "linear-gradient(135deg, #EF4444, #F87171)",
  "linear-gradient(135deg, #EC4899, #F472B6)",
];

function getInitials(name: string) {
  return name.split(" ").map(w => w[0]).join("").slice(0, 2).toUpperCase();
}

function Avatar({ member, size = 44 }: { member: Member; size?: number }) {
  const idx = member.name.charCodeAt(0) % GRADIENT_COLORS.length;
  if (member.avatarUrl) {
    return <img src={member.avatarUrl} alt={member.name} style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", border: "2px solid rgba(255,255,255,0.08)" }} />;
  }
  return (
    <div style={{ width: size, height: size, borderRadius: "50%", background: GRADIENT_COLORS[idx], display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.36, fontWeight: 700, color: "#fff", flexShrink: 0, border: "2px solid rgba(255,255,255,0.08)" }}>
      {getInitials(member.name)}
    </div>
  );
}

// ─── Modal Wrapper ────────────────────────────────────────────────────────────

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.6)", zIndex: 10000, display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(4px)", animation: "fadeIn 0.15s ease" }}>
      <div style={{ width: 460, background: "#1a1a1f", borderRadius: 16, border: "1px solid rgba(255,255,255,0.08)", boxShadow: "0 32px 80px rgba(0,0,0,0.8)", overflow: "hidden", animation: "slideUp 0.2s cubic-bezier(0.34,1.2,0.64,1)" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "16px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#f0f0f0" }}>{title}</h2>
          <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 7, background: "transparent", border: "1px solid rgba(255,255,255,0.08)", color: "#888", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
            onMouseEnter={e => { e.currentTarget.style.color = "#fff"; e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            onMouseLeave={e => { e.currentTarget.style.color = "#888"; e.currentTarget.style.background = "transparent"; }}>
            <X size={15} />
          </button>
        </div>
        <div style={{ padding: "20px" }}>{children}</div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.09)", borderRadius: 9, padding: "10px 14px", fontSize: 14, color: "#e0e0e0", outline: "none", fontFamily: "inherit",
};
const labelStyle: React.CSSProperties = { fontSize: 12, color: "#888", fontWeight: 500, display: "block", marginBottom: 6 };
const btnPrimary: React.CSSProperties = { padding: "10px 20px", borderRadius: 9, background: "linear-gradient(135deg,#5b3ea6,#7C5AC2)", border: "none", color: "#fff", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" };
const btnDanger: React.CSSProperties = { ...btnPrimary, background: "linear-gradient(135deg,#dc2626,#ef4444)" };
const btnSecondary: React.CSSProperties = { padding: "10px 20px", borderRadius: 9, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", color: "#aaa", fontSize: 13, fontWeight: 500, cursor: "pointer", fontFamily: "inherit" };

// ─── Main Component ───────────────────────────────────────────────────────────

export function MembersPage() {
  const { token } = useAuth();
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [showLoader, setShowLoader] = useState(true);
  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<Member | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formRole, setFormRole] = useState("ceo");
  const [formMustChange, setFormMustChange] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const headers = useCallback(() => ({ "Content-Type": "application/json", Authorization: `Bearer ${token}` }), [token]);

  const fetchMembers = useCallback(async () => {
    try {
      const res = await fetch(`${API}/api/members`, { headers: headers() });
      if (res.ok) {
        const data = await res.json();
        setMembers(data.members);
      }
    } finally { setLoading(false); }
  }, [headers]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);

  const filtered = members.filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase())
  );

  const openCreate = () => {
    setFormName(""); setFormEmail(""); setFormPhone(""); setFormPassword(""); setFormRole("ceo"); setFormMustChange(false); setError(null);
    setModal("create");
  };

  const openEdit = (m: Member) => {
    setSelected(m); setFormName(m.name); setFormEmail(m.email); setFormPhone(m.phone ?? ""); setFormRole(m.role); setFormMustChange(m.mustChangePassword); setError(null);
    setModal("edit");
  };

  const openPassword = (m: Member) => { setSelected(m); setFormPassword(""); setError(null); setModal("password"); };
  const openAvatar = (m: Member) => { setSelected(m); setError(null); setModal("avatar"); };
  const openDelete = (m: Member) => { setSelected(m); setError(null); setModal("delete"); };
  const closeModal = () => { setModal(null); setSelected(null); setError(null); };

  const handleCreate = async () => {
    setFormLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/members`, {
        method: "POST", headers: headers(),
        body: JSON.stringify({ name: formName, email: formEmail, password: formPassword, phone: formPhone || undefined, role: formRole, mustChangePassword: formMustChange }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? "Erro ao criar"); }
      await fetchMembers(); closeModal();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); } finally { setFormLoading(false); }
  };

  const handleUpdate = async () => {
    if (!selected) return;
    setFormLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/members/${selected.id}`, {
        method: "PUT", headers: headers(),
        body: JSON.stringify({ name: formName, email: formEmail, phone: formPhone || undefined, role: formRole, mustChangePassword: formMustChange }),
      });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? "Erro ao atualizar"); }
      await fetchMembers(); closeModal();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); } finally { setFormLoading(false); }
  };

  const handleChangePassword = async () => {
    if (!selected) return;
    setFormLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/members/${selected.id}/password`, {
        method: "PUT", headers: headers(),
        body: JSON.stringify({ password: formPassword }),
      });
      if (!res.ok) throw new Error("Erro ao alterar senha");
      await fetchMembers(); closeModal();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); } finally { setFormLoading(false); }
  };

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!selected || !e.target.files?.[0]) return;
    setFormLoading(true); setError(null);
    try {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        const dataUrl = reader.result as string;
        const res = await fetch(`${API}/api/members/${selected.id}/avatar`, {
          method: "PUT", headers: headers(),
          body: JSON.stringify({ avatarUrl: dataUrl }),
        });
        if (!res.ok) throw new Error("Erro ao atualizar foto");
        await fetchMembers(); closeModal();
        setFormLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (e2) { setError(e2 instanceof Error ? e2.message : "Erro"); setFormLoading(false); }
  };

  const handleDelete = async () => {
    if (!selected) return;
    setFormLoading(true); setError(null);
    try {
      const res = await fetch(`${API}/api/members/${selected.id}`, { method: "DELETE", headers: headers() });
      if (!res.ok) { const d = await res.json(); throw new Error(d.message ?? d.error ?? "Erro ao excluir"); }
      await fetchMembers(); closeModal();
    } catch (e) { setError(e instanceof Error ? e.message : "Erro"); } finally { setFormLoading(false); }
  };

  const ErrorBox = () => error ? <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 8, padding: "10px 14px", marginBottom: 14, fontSize: 13, color: "#f87171" }}>{error}</div> : null;

  return (
    <div style={{ flex: 1, overflow: "auto", padding: "28px 32px" }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: "#f0f0f0" }}>Membros</h1>
          <p style={{ margin: "4px 0 0", fontSize: 13, color: "#666" }}>{members.length} membro{members.length !== 1 ? "s" : ""} no workspace</p>
        </div>
        <button onClick={openCreate} style={btnPrimary}>
          <span style={{ marginRight: 6 }}>+</span>Novo Membro
        </button>
      </div>

      {/* Search */}
      <div style={{ marginBottom: 20 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar por nome ou email..." style={{ ...inputStyle, maxWidth: 360 }} />
      </div>

      {/* Table */}
      {showLoader ? (
        <div style={{ padding: 40, display: "flex", minHeight: 300 }}>
          <Loader isReady={!loading} onFinish={() => setShowLoader(false)} />
        </div>
      ) : (
        <div style={{ background: "#161618", border: "1px solid rgba(255,255,255,0.06)", borderRadius: 14, overflow: "hidden" }}>
          {/* Table header */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 200px 140px 120px 160px", padding: "12px 20px", borderBottom: "1px solid rgba(255,255,255,0.06)", fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            <span>Membro</span><span>Email</span><span>Cargo</span><span>Status</span><span style={{ textAlign: "right" }}>Ações</span>
          </div>

          {filtered.length === 0 ? (
            <div style={{ padding: 40, textAlign: "center", color: "#555" }}>Nenhum membro encontrado</div>
          ) : filtered.map(m => {
            const r = ROLE_LABELS[m.role] ?? { label: m.role || "Membro", color: "#888", bg: "rgba(255,255,255,0.06)" };
            return (
              <div key={m.id} style={{ display: "grid", gridTemplateColumns: "1fr 200px 140px 120px 160px", padding: "14px 20px", borderBottom: "1px solid rgba(255,255,255,0.04)", alignItems: "center", transition: "background 0.15s" }}
                onMouseEnter={e => e.currentTarget.style.background = "rgba(255,255,255,0.02)"}
                onMouseLeave={e => e.currentTarget.style.background = "transparent"}>
                {/* Name + avatar */}
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <Avatar member={m} size={38} />
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "#e0e0e0" }}>{m.name}</div>
                    {m.phone && <div style={{ fontSize: 11, color: "#555" }}>{m.phone}</div>}
                  </div>
                </div>
                {/* Email */}
                <span style={{ fontSize: 13, color: "#888" }}>{m.email}</span>
                {/* Role */}
                <span style={{ display: "inline-flex", alignItems: "center", gap: 5, background: r.bg, color: r.color, fontSize: 11, fontWeight: 600, padding: "4px 10px", borderRadius: 20, width: "fit-content" }}>
                  <span style={{ width: 6, height: 6, borderRadius: "50%", background: r.color }} />{r.label}
                </span>
                {/* Status */}
                <div>
                  {m.mustChangePassword ? (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 11, color: "#f59e0b", background: "rgba(245,158,11,0.1)", padding: "3px 8px", borderRadius: 6 }}>
                      <KeyRound size={11} /> Trocar senha
                    </span>
                  ) : (
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, color: "#10B981" }}>
                      <Check size={12} /> Ativo
                    </span>
                  )}
                </div>
                {/* Actions */}
                <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                  {[
                    { icon: <Camera size={13} />, title: "Foto", onClick: () => openAvatar(m) },
                    { icon: <Pencil size={13} />, title: "Editar", onClick: () => openEdit(m) },
                    { icon: <KeyRound size={13} />, title: "Senha", onClick: () => openPassword(m) },
                    { icon: <Trash2 size={13} />, title: "Excluir", onClick: () => openDelete(m), danger: true },
                  ].map((a, i) => (
                    <button key={i} onClick={a.onClick} title={a.title} style={{ width: 30, height: 30, borderRadius: 7, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: a.danger ? "#f87171" : "#aaa", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.15s" }}
                      onMouseEnter={e => { e.currentTarget.style.background = a.danger ? "rgba(239,68,68,0.15)" : "rgba(255,255,255,0.1)"; e.currentTarget.style.color = a.danger ? "#ef4444" : "#fff"; }}
                      onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.04)"; e.currentTarget.style.color = a.danger ? "#f87171" : "#aaa"; }}>{a.icon}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Create Modal ── */}
      {modal === "create" && (
        <Modal title="Novo Membro" onClose={closeModal}>
          <ErrorBox />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={labelStyle}>Nome</label><input value={formName} onChange={e => setFormName(e.target.value)} style={inputStyle} placeholder="Nome completo" /></div>
            <div><label style={labelStyle}>Email</label><input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} style={inputStyle} placeholder="email@teltech.com.br" /></div>
            <div style={{ display: "flex", gap: 12 }}>
              <div style={{ flex: 1 }}><label style={labelStyle}>Senha</label><input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} style={inputStyle} placeholder="Senha inicial" /></div>
              <div style={{ flex: 1 }}><label style={labelStyle}>Telefone</label><input value={formPhone} onChange={e => setFormPhone(e.target.value)} style={inputStyle} placeholder="Opcional" /></div>
            </div>
            <div>
              <label style={labelStyle}>Cargo</label>
              <div style={{ display: "flex", gap: 10 }}>
                {Object.entries(ROLE_LABELS).map(([key, r]) => {
                  const isSelected = formRole === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setFormRole(key)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 10,
                        background: isSelected ? r.bg : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isSelected ? r.color : "rgba(255,255,255,0.06)"}`,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: isSelected ? r.color : "#555" }} />
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? r.color : "#aaa" }}>
                        {r.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={formMustChange} onChange={e => setFormMustChange(e.target.checked)} style={{ accentColor: "#7C5AC2" }} />
              <span style={{ fontSize: 13, color: "#888" }}>Exigir troca de senha no primeiro login</span>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button onClick={handleCreate} disabled={formLoading} style={btnPrimary}>{formLoading ? "Criando..." : "Criar Membro"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Edit Modal ── */}
      {modal === "edit" && selected && (
        <Modal title={`Editar ${selected.name}`} onClose={closeModal}>
          <ErrorBox />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={labelStyle}>Nome</label><input value={formName} onChange={e => setFormName(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Email</label><input type="email" value={formEmail} onChange={e => setFormEmail(e.target.value)} style={inputStyle} /></div>
            <div><label style={labelStyle}>Telefone</label><input value={formPhone} onChange={e => setFormPhone(e.target.value)} style={inputStyle} placeholder="Opcional" /></div>
            <div>
              <label style={labelStyle}>Cargo</label>
              <div style={{ display: "flex", gap: 10 }}>
                {Object.entries(ROLE_LABELS).map(([key, r]) => {
                  const isSelected = formRole === key;
                  return (
                    <div
                      key={key}
                      onClick={() => setFormRole(key)}
                      style={{
                        flex: 1,
                        padding: "10px",
                        borderRadius: 10,
                        background: isSelected ? r.bg : "rgba(255,255,255,0.02)",
                        border: `1px solid ${isSelected ? r.color : "rgba(255,255,255,0.06)"}`,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 6,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <span style={{ width: 8, height: 8, borderRadius: "50%", background: isSelected ? r.color : "#555" }} />
                      <span style={{ fontSize: 13, fontWeight: isSelected ? 600 : 500, color: isSelected ? r.color : "#aaa" }}>
                        {r.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer" }}>
              <input type="checkbox" checked={formMustChange} onChange={e => setFormMustChange(e.target.checked)} style={{ accentColor: "#7C5AC2" }} />
              <span style={{ fontSize: 13, color: "#888" }}>Exigir troca de senha no próximo login</span>
            </label>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button onClick={handleUpdate} disabled={formLoading} style={btnPrimary}>{formLoading ? "Salvando..." : "Salvar"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Password Modal ── */}
      {modal === "password" && selected && (
        <Modal title={`Alterar Senha — ${selected.name}`} onClose={closeModal}>
          <ErrorBox />
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div><label style={labelStyle}>Nova Senha</label><input type="password" value={formPassword} onChange={e => setFormPassword(e.target.value)} style={inputStyle} placeholder="Digite a nova senha" autoFocus /></div>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, marginTop: 6 }}>
              <button onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button onClick={handleChangePassword} disabled={formLoading || !formPassword} style={btnPrimary}>{formLoading ? "Alterando..." : "Alterar Senha"}</button>
            </div>
          </div>
        </Modal>
      )}

      {/* ── Avatar Modal ── */}
      {modal === "avatar" && selected && (
        <Modal title={`Foto de Perfil — ${selected.name}`} onClose={closeModal}>
          <ErrorBox />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
            <Avatar member={selected} size={100} />
            <input ref={fileRef} type="file" accept="image/*" onChange={handleAvatarUpload} style={{ display: "none" }} />
            <button onClick={() => fileRef.current?.click()} disabled={formLoading} style={btnPrimary}>{formLoading ? "Enviando..." : "Escolher nova foto"}</button>
            <button onClick={closeModal} style={btnSecondary}>Cancelar</button>
          </div>
        </Modal>
      )}

      {/* ── Delete Modal ── */}
      {modal === "delete" && selected && (
        <Modal title="Confirmar Exclusão" onClose={closeModal}>
          <ErrorBox />
          <div style={{ textAlign: "center", padding: "8px 0" }}>
            <Avatar member={selected} size={64} />
            <p style={{ fontSize: 15, color: "#e0e0e0", margin: "16px 0 6px", fontWeight: 600 }}>{selected.name}</p>
            <p style={{ fontSize: 13, color: "#888", margin: "0 0 20px" }}>{selected.email}</p>
            <p style={{ fontSize: 13, color: "#f87171", background: "rgba(239,68,68,0.08)", padding: "10px 16px", borderRadius: 8, border: "1px solid rgba(239,68,68,0.2)" }}>
              Esta ação é irreversível. Todas as tarefas atribuídas a este membro serão desvinculadas.
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: 10, marginTop: 20 }}>
              <button onClick={closeModal} style={btnSecondary}>Cancelar</button>
              <button onClick={handleDelete} disabled={formLoading} style={btnDanger}>{formLoading ? "Excluindo..." : "Excluir Membro"}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}
