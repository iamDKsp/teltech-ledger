import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ScanFace, ShieldCheck, Lock, LogOut, RefreshCw, AlertCircle } from "lucide-react";
import { authenticateWithBiometrics } from "../lib/biometrics";

interface BiometricLockScreenProps {
  userName?: string | null;
  userEmail?: string | null;
  avatarUrl?: string | null;
  onUnlock: () => void;
  onFallbackPassword: () => void;
}

export function BiometricLockScreen({
  userName,
  userEmail,
  avatarUrl,
  onUnlock,
  onFallbackPassword,
}: BiometricLockScreenProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleUnlock = useCallback(async () => {
    if (isVerifying) return;
    setIsVerifying(true);
    setErrorMessage(null);
    try {
      await authenticateWithBiometrics();
      onUnlock();
    } catch (err: any) {
      console.warn("Face ID failed or canceled", err);
      if (err.name === "NotAllowedError" || err.message?.includes("cancel")) {
        setErrorMessage("Verificação cancelada. Toque abaixo para tentar com Face ID.");
      } else {
        setErrorMessage(err.message || "Não foi possível verificar sua biometria.");
      }
    } finally {
      setIsVerifying(false);
    }
  }, [isVerifying, onUnlock]);

  // Auto-trigger Face ID on mount
  useEffect(() => {
    const timer = setTimeout(() => {
      handleUnlock();
    }, 450);
    return () => clearTimeout(timer);
  }, []);

  const displayName = userName || (userEmail ? userEmail.split("@")[0] : "Sócio Teltech");

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 999999,
        background: "radial-gradient(circle at 50% 20%, #1e1533 0%, #0d0d0f 70%)",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "max(24px, env(safe-area-inset-top)) 24px max(24px, env(safe-area-inset-bottom))",
        color: "#fff",
        userSelect: "none",
      }}
    >
      {/* Top Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 8, opacity: 0.85, paddingTop: 12 }}>
        <ShieldCheck size={18} color="hsl(265 85% 68%)" />
        <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "#c4a3ff" }}>
          Teltech Seguro • Face ID
        </span>
      </div>

      {/* Center Biometrics Card */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          textAlign: "center",
          maxWidth: 360,
          width: "100%",
        }}
      >
        {/* Animated Face ID Scanner Icon */}
        <motion.div
          animate={isVerifying ? { scale: [1, 1.08, 1], rotate: [0, 2, -2, 0] } : {}}
          transition={{ repeat: Infinity, duration: 1.8, ease: "easeInOut" }}
          onClick={handleUnlock}
          style={{
            position: "relative",
            width: 104,
            height: 104,
            borderRadius: "50%",
            background: "linear-gradient(135deg, hsl(265 85% 62% / 0.25), hsl(265 85% 42% / 0.1))",
            border: "2px solid hsl(265 85% 62% / 0.6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#c4a3ff",
            boxShadow: "0 0 35px hsl(265 85% 62% / 0.35)",
            cursor: "pointer",
            marginBottom: 24,
          }}
        >
          {isVerifying ? (
            <ScanFace size={52} className="animate-pulse" style={{ color: "#d8b4fe" }} />
          ) : (
            <ScanFace size={52} />
          )}

          {/* Glowing pulse ring */}
          <motion.div
            animate={{ scale: [1, 1.25, 1], opacity: [0.4, 0, 0.4] }}
            transition={{ repeat: Infinity, duration: 2.2, ease: "easeOut" }}
            style={{
              position: "absolute",
              inset: -8,
              borderRadius: "50%",
              border: "1px solid hsl(265 85% 62% / 0.5)",
              pointerEvents: "none",
            }}
          />
        </motion.div>

        {/* User identification */}
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={displayName}
              style={{ width: 28, height: 28, borderRadius: "50%", objectFit: "cover", border: "1px solid hsl(265 85% 62% / 0.5)" }}
            />
          ) : (
            <div
              style={{
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "hsl(265 85% 62% / 0.3)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 11,
                fontWeight: 700,
                color: "#c4a3ff",
              }}
            >
              {displayName.slice(0, 2).toUpperCase()}
            </div>
          )}
          <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>
            {displayName}
          </span>
        </div>

        <p style={{ fontSize: 13, color: "#9ca3af", margin: "0 0 20px 0", lineHeight: 1.5 }}>
          {isVerifying
            ? "Olhe para a tela para autenticar com Face ID..."
            : "Aplicativo bloqueado para sua privacidade. Autentique-se para continuar."}
        </p>

        {/* Error message if any */}
        <AnimatePresence>
          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 8,
                padding: "8px 14px",
                background: "hsl(0 70% 58% / 0.15)",
                border: "1px solid hsl(0 70% 58% / 0.4)",
                borderRadius: 10,
                color: "hsl(0 70% 70%)",
                fontSize: 12,
                marginBottom: 20,
              }}
            >
              <AlertCircle size={15} style={{ flexShrink: 0 }} />
              <span>{errorMessage}</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main Unlock Button */}
        <button
          onClick={handleUnlock}
          disabled={isVerifying}
          style={{
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: 10,
            padding: "14px 20px",
            borderRadius: 14,
            background: "linear-gradient(135deg, hsl(265 85% 62%), hsl(265 85% 48%))",
            border: "none",
            color: "#fff",
            fontSize: 15,
            fontWeight: 700,
            cursor: isVerifying ? "not-allowed" : "pointer",
            boxShadow: "0 8px 24px -4px hsl(265 85% 62% / 0.5)",
            transition: "all 0.2s ease",
          }}
        >
          {isVerifying ? (
            <>
              <RefreshCw size={18} className="animate-spin" />
              Lendo Face ID...
            </>
          ) : (
            <>
              <ScanFace size={20} />
              Desbloquear com Face ID
            </>
          )}
        </button>
      </div>

      {/* Bottom Fallback options */}
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 12, width: "100%", maxWidth: 360 }}>
        <button
          onClick={onFallbackPassword}
          style={{
            background: "transparent",
            border: "none",
            color: "#aaa",
            fontSize: 13,
            cursor: "pointer",
            padding: "8px 16px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            transition: "color 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.color = "#fff")}
          onMouseLeave={(e) => (e.currentTarget.style.color = "#aaa")}
        >
          <Lock size={14} /> Entrar com Senha / Outra Conta
        </button>
      </div>
    </div>
  );
}
