import React, { useState, useRef } from "react";
import { useAuth } from "../lib/auth-context";
import { API_BASE } from "../lib/api";
import { Camera } from "lucide-react";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, token } = useAuth();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setLoading(true);
    setError("");
    
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const res = await fetch(`${API_BASE}/api/upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`
        },
        body: formData,
      });
      
      if (!res.ok) throw new Error("Erro ao fazer upload da imagem");
      
      const data = await res.json();
      setAvatarUrl(data.url);
      setSuccess("Imagem carregada! Clique em Salvar para confirmar.");
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Update Name, Email and Avatar
      if (name !== user.name || email !== user.email || avatarUrl !== user.avatarUrl) {
        const res = await fetch(`${API_BASE}/api/members/${user.id}`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ name, email, avatarUrl }),
        });
        if (!res.ok) throw new Error("Erro ao atualizar dados do perfil");
      }

      // Update Password if provided
      if (password) {
        const resPw = await fetch(`${API_BASE}/api/members/${user.id}/password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ password }),
        });
        if (!resPw.ok) throw new Error("Erro ao atualizar a senha");
      }

      setSuccess("Perfil atualizado com sucesso!");
      setTimeout(() => {
        window.location.reload(); 
      }, 1000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000 }}>
      <div style={{ width: 400, background: "rgba(25,25,28,0.95)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 12, padding: 24, boxShadow: "0 10px 40px rgba(0,0,0,0.5)" }}>
        <h2 style={{ margin: "0 0 20px 0", fontSize: 18, color: "#fff", textAlign: "center" }}>Editar Perfil</h2>
        
        {/* Avatar Upload Section */}
        <div style={{ display: "flex", justifyContent: "center", marginBottom: 24 }}>
          <div 
            style={{ width: 80, height: 80, borderRadius: "50%", background: "linear-gradient(135deg,#4f2d8a,#7C5AC2)", position: "relative", cursor: "pointer", overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center" }}
            onClick={() => fileInputRef.current?.click()}
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 32, fontWeight: 700, color: "#fff" }}>{name[0]?.toUpperCase()}</span>
            )}
            
            <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "center", justifyContent: "center", opacity: 0, transition: "opacity 0.2s", backdropFilter: "blur(2px)" }}
                 onMouseEnter={e => e.currentTarget.style.opacity = "1"}
                 onMouseLeave={e => e.currentTarget.style.opacity = "0"}>
              <Camera size={24} color="#fff" />
            </div>
            <input type="file" ref={fileInputRef} hidden accept="image/*" onChange={handleFileChange} />
          </div>
        </div>

        {error && <div style={{ background: "rgba(239, 68, 68, 0.1)", color: "#ef4444", padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{error}</div>}
        {success && <div style={{ background: "rgba(34, 197, 94, 0.1)", color: "#22c55e", padding: 10, borderRadius: 6, marginBottom: 16, fontSize: 13 }}>{success}</div>}

        <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "#aaa" }}>Nome</label>
            <input value={name} onChange={e => setName(e.target.value)} required
              style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 12px", borderRadius: 6, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "#aaa" }}>E-mail</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
              style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 12px", borderRadius: 6, outline: "none", boxSizing: "border-box" }} />
          </div>
          <div>
            <label style={{ display: "block", marginBottom: 6, fontSize: 12, color: "#aaa" }}>Nova Senha (opcional)</label>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Deixe em branco para não alterar"
              style={{ width: "100%", background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.1)", color: "#fff", padding: "8px 12px", borderRadius: 6, outline: "none", boxSizing: "border-box" }} />
          </div>

          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 10 }}>
            <button type="button" onClick={onClose} style={{ padding: "8px 16px", background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#aaa", borderRadius: 6, cursor: "pointer" }}>Cancelar</button>
            <button type="submit" disabled={loading} style={{ padding: "8px 16px", background: "#4f2d8a", border: "none", color: "#fff", borderRadius: 6, cursor: "pointer", fontWeight: 500 }}>
              {loading ? "Salvando..." : "Salvar Alterações"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
