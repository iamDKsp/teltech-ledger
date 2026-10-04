import React, { useState, useRef } from "react";
import { useAuth } from "../lib/auth-context";
import { useIsMobile } from "../hooks/use-mobile";
import { API_BASE } from "../lib/api";
import { Camera, X, Loader2, Check, AlertCircle } from "lucide-react";
import { motion } from "framer-motion";
import { backdropVariants, modalVariants, bottomSheetVariants } from "../lib/motion";

export function ProfileModal({ onClose }: { onClose: () => void }) {
  const { user, token, updateUser, refreshUser } = useAuth();
  const isMobile = useIsMobile();
  const [name, setName] = useState(user?.name || "");
  const [email, setEmail] = useState(user?.email || "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [password, setPassword] = useState("");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl || "");
  const [loading, setLoading] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!user) return null;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input value so user can re-pick same file if desired
    e.target.value = "";
    
    setUploadingImage(true);
    setError("");
    setSuccess("");
    
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
      
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.message || "Erro ao fazer upload da imagem");
      }
      
      const data = await res.json();
      setAvatarUrl(data.url);
      setSuccess("Foto carregada com sucesso! Clique em Salvar para confirmar.");
    } catch (err: any) {
      setError(err.message || "Falha no upload da foto");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      // Validate password change
      if (password) {
        if (!currentPassword) {
          throw new Error("Informe a senha atual para alterar sua senha");
        }
        if (password.length < 6) {
          throw new Error("A nova senha deve ter no mínimo 6 caracteres");
        }
      }

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
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.message || "Erro ao atualizar dados do perfil");
        }
      }

      // Update Password if provided
      if (password) {
        const resPw = await fetch(`${API_BASE}/api/members/${user.id}/password`, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
          },
          body: JSON.stringify({ currentPassword, newPassword: password }),
        });
        if (!resPw.ok) {
          const errData = await resPw.json().catch(() => ({}));
          throw new Error(errData.message || "Erro ao atualizar a senha");
        }
      }

      // Update local state without hard refresh
      if (updateUser) {
        updateUser({ name, email, avatarUrl });
      }
      if (refreshUser) {
        await refreshUser();
      }

      setSuccess("Perfil atualizado com sucesso!");
      setTimeout(() => {
        onClose();
      }, 700);
    } catch (err: any) {
      setError(err.message || "Erro ao salvar perfil");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      variants={backdropVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      style={{ 
        position: "fixed", 
        inset: 0, 
        background: "rgba(0,0,0,0.72)", 
        display: "flex", 
        alignItems: isMobile ? "flex-end" : "center", 
        justifyContent: "center", 
        zIndex: 100050 
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <motion.div 
        variants={isMobile ? bottomSheetVariants : modalVariants}
        style={{ 
          width: isMobile ? "100%" : 420, 
          maxWidth: "100vw", 
          maxHeight: isMobile ? "92dvh" : "88vh", 
          display: "flex",
          flexDirection: "column",
          background: "linear-gradient(180deg, #1c1c21 0%, #141417 100%)", 
          border: "1px solid rgba(255,255,255,0.12)", 
          borderRadius: isMobile ? "20px 20px 0 0" : 16, 
          boxShadow: "0 20px 60px rgba(0,0,0,0.85)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header with Title and Close Button */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: isMobile ? "16px 18px 12px 18px" : "18px 22px 14px 22px",
          borderBottom: "1px solid rgba(255,255,255,0.08)"
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#fff", letterSpacing: "-0.01em" }}>
              Editar Perfil
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: 12, color: "#a1a1aa" }}>
              Personalize sua foto e credenciais de acesso
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{
              background: "rgba(255,255,255,0.06)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: "50%",
              width: 32,
              height: 32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#a1a1aa",
              cursor: "pointer",
              transition: "all 0.15s ease",
              flexShrink: 0
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.color = "#fff";
              e.currentTarget.style.background = "rgba(255,255,255,0.12)";
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.color = "#a1a1aa";
              e.currentTarget.style.background = "rgba(255,255,255,0.06)";
            }}
            title="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <div style={{
          flex: 1,
          overflowY: "auto",
          padding: isMobile ? "18px 16px calc(env(safe-area-inset-bottom, 0px) + 20px) 16px" : "20px 22px 24px 22px",
          WebkitOverflowScrolling: "touch"
        }}>
          {/* Avatar Upload Section */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginBottom: 20 }}>
            <div 
              style={{ 
                width: 88, 
                height: 88, 
                borderRadius: "50%", 
                background: "linear-gradient(135deg, #7C5AC2 0%, #4F2D8A 100%)", 
                position: "relative", 
                cursor: "pointer", 
                boxShadow: "0 6px 20px rgba(124,90,194,0.35)",
                border: "2px solid rgba(255,255,255,0.15)",
                display: "flex", 
                alignItems: "center", 
                justifyContent: "center" 
              }}
              onClick={() => fileInputRef.current?.click()}
              title="Clique para trocar a foto"
            >
              {avatarUrl ? (
                <img 
                  src={avatarUrl} 
                  alt="Avatar" 
                  style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} 
                />
              ) : (
                <span style={{ fontSize: 34, fontWeight: 700, color: "#fff" }}>
                  {name[0]?.toUpperCase() || "U"}
                </span>
              )}

              {/* Floating Camera Badge */}
              <div 
                style={{
                  position: "absolute",
                  bottom: -2,
                  right: -2,
                  width: 30,
                  height: 30,
                  borderRadius: "50%",
                  background: "#7C5AC2",
                  border: "2px solid #1c1c21",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.5)"
                }}
              >
                {uploadingImage ? (
                  <Loader2 size={15} className="animate-spin" />
                ) : (
                  <Camera size={15} />
                )}
              </div>
            </div>

            <input 
              type="file" 
              ref={fileInputRef} 
              hidden 
              accept="image/png,image/jpeg,image/webp,image/jpg" 
              onChange={handleFileChange} 
            />

            {/* Explicit Change Photo Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadingImage}
              style={{
                marginTop: 10,
                background: "transparent",
                border: "none",
                color: "#9F7AEA",
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                padding: "4px 8px",
                borderRadius: 6,
              }}
            >
              {uploadingImage ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Enviando foto...</span>
                </>
              ) : (
                <>
                  <Camera size={14} />
                  <span>{avatarUrl ? "Trocar foto de perfil" : "Adicionar foto de perfil"}</span>
                </>
              )}
            </button>
            <span style={{ fontSize: 11, color: "#71717a", marginTop: 2 }}>
              JPG, PNG ou WebP (máx. 5MB)
            </span>
          </div>

          {error && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8, 
              background: "rgba(239, 68, 68, 0.12)", 
              color: "#f87171", 
              border: "1px solid rgba(239, 68, 68, 0.25)",
              padding: "10px 12px", 
              borderRadius: 8, 
              marginBottom: 16, 
              fontSize: 13 
            }}>
              <AlertCircle size={16} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          {success && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: 8, 
              background: "rgba(34, 197, 94, 0.12)", 
              color: "#4ade80", 
              border: "1px solid rgba(34, 197, 94, 0.25)",
              padding: "10px 12px", 
              borderRadius: 8, 
              marginBottom: 16, 
              fontSize: 13 
            }}>
              <Check size={16} style={{ flexShrink: 0 }} />
              <span>{success}</span>
            </div>
          )}

          <form onSubmit={handleSave} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#ccc" }}>
                Nome
              </label>
              <input 
                value={name} 
                onChange={e => setName(e.target.value)} 
                required
                style={{ 
                  width: "100%", 
                  background: "rgba(0,0,0,0.35)", 
                  border: "1px solid rgba(255,255,255,0.12)", 
                  color: "#fff", 
                  padding: "10px 12px", 
                  borderRadius: 8, 
                  outline: "none", 
                  boxSizing: "border-box", 
                  fontSize: 16 
                }} 
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#ccc" }}>
                E-mail
              </label>
              <input 
                type="email" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required
                style={{ 
                  width: "100%", 
                  background: "rgba(0,0,0,0.35)", 
                  border: "1px solid rgba(255,255,255,0.12)", 
                  color: "#fff", 
                  padding: "10px 12px", 
                  borderRadius: 8, 
                  outline: "none", 
                  boxSizing: "border-box", 
                  fontSize: 16 
                }} 
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#ccc" }}>
                Senha Atual (necessária para alterar a senha)
              </label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={e => setCurrentPassword(e.target.value)} 
                placeholder="Digite sua senha atual"
                style={{ 
                  width: "100%", 
                  background: "rgba(0,0,0,0.35)", 
                  border: "1px solid rgba(255,255,255,0.12)", 
                  color: "#fff", 
                  padding: "10px 12px", 
                  borderRadius: 8, 
                  outline: "none", 
                  boxSizing: "border-box", 
                  fontSize: 16 
                }} 
              />
            </div>

            <div>
              <label style={{ display: "block", marginBottom: 5, fontSize: 12, fontWeight: 600, color: "#ccc" }}>
                Nova Senha
              </label>
              <input 
                type="password" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                placeholder="Deixe em branco para não alterar"
                style={{ 
                  width: "100%", 
                  background: "rgba(0,0,0,0.35)", 
                  border: "1px solid rgba(255,255,255,0.12)", 
                  color: "#fff", 
                  padding: "10px 12px", 
                  borderRadius: 8, 
                  outline: "none", 
                  boxSizing: "border-box", 
                  fontSize: 16 
                }} 
              />
            </div>

            {/* Bottom Actions - Highly accessible touch targets */}
            <div style={{ 
              display: "flex", 
              gap: 10, 
              justifyContent: "flex-end", 
              marginTop: 12,
              paddingTop: 8
            }}>
              <button 
                type="button" 
                onClick={onClose} 
                style={{ 
                  flex: isMobile ? 1 : "initial",
                  padding: "11px 18px", 
                  background: "rgba(255,255,255,0.06)", 
                  border: "1px solid rgba(255,255,255,0.14)", 
                  color: "#e4e4e7", 
                  borderRadius: 8, 
                  cursor: "pointer",
                  fontSize: 14,
                  fontWeight: 600,
                  minHeight: 44,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                Cancelar
              </button>

              <button 
                type="submit" 
                disabled={loading || uploadingImage} 
                style={{ 
                  flex: isMobile ? 1.5 : "initial",
                  padding: "11px 20px", 
                  background: "linear-gradient(135deg, #8B5CF6 0%, #6D28D9 100%)", 
                  border: "none", 
                  color: "#fff", 
                  borderRadius: 8, 
                  cursor: "pointer", 
                  fontWeight: 600,
                  fontSize: 14,
                  minHeight: 44,
                  boxShadow: "0 4px 14px rgba(139,92,246,0.35)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 8,
                  opacity: (loading || uploadingImage) ? 0.7 : 1
                }}
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Salvando...</span>
                  </>
                ) : (
                  <span>Salvar Alterações</span>
                )}
              </button>
            </div>
          </form>
        </div>
      </motion.div>
    </motion.div>
  );
}
