import { useState, useEffect, useRef } from "react";
import { useAuth } from "../lib/auth-context";
import { Loader } from "../components/Loader";
import { CRMBackground } from "../components/CRMBackground";
import { ParticlesBackground } from "../components/ParticlesBackground";
import { ShieldCheck, Sparkles, Eye, EyeOff } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL !== undefined && import.meta.env.VITE_API_URL !== ""
  ? import.meta.env.VITE_API_URL
  : (import.meta.env.DEV ? "http://localhost:5000" : "");
const REMEMBER_KEY = "teltech_remember";

// ─── Team Profiles ─────────────────────────────────────────────────────────────

type Profile = {
  name: string;
  email: string;
  role: string;
  tagline: string;
  initials: string;
  color: string;
  avatarUrl: string | null;
};

const BASE_PROFILES: Profile[] = [
  { name: "Tarcísio", email: "tarcisio@teltech.com.br", role: "Sócio Co-Founder", tagline: "Estratégia, Finanças & Inteligência Técnica", initials: "TS", color: "hsl(265 85% 62%)", avatarUrl: null },
  { name: "Lucas",    email: "lucas@teltech.com.br",    role: "Sócio Co-Founder", tagline: "Arquitetura Arcana, Engenharia & Inovação",    initials: "LM", color: "hsl(152 65% 45%)", avatarUrl: null },
];

// ─── Login Page ───────────────────────────────────────────────────────────────

export function LoginPage() {
  const { login } = useAuth();

  const [profiles, setProfiles] = useState<Profile[]>(BASE_PROFILES);
  const [selected, setSelected] = useState<Profile>(BASE_PROFILES[0]);
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [autoLogging, setAutoLogging] = useState(() => !!localStorage.getItem(REMEMBER_KEY));
  const [autoReady, setAutoReady] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);


  // Fetch real avatars from API
  useEffect(() => {
    fetch(`${API_BASE}/api/auth/public/users`)
      .then(r => r.json())
      .then(data => {
        if (data.users) {
          setProfiles(prev =>
            prev.map(p => {
              const dbUser = data.users.find((u: any) => u.email === p.email);
              return { ...p, avatarUrl: dbUser?.avatarUrl || null };
            })
          );
        }
      })
      .catch(() => {});
  }, []);

  // Auto-login from "remember me"
  useEffect(() => {
    const saved = localStorage.getItem(REMEMBER_KEY);
    if (saved) {
      try {
        const { email, password: savedPass } = JSON.parse(saved);
        login(email, savedPass).catch(() => {
          localStorage.removeItem(REMEMBER_KEY);
          setAutoReady(true);
        });
        return;
      } catch {
        localStorage.removeItem(REMEMBER_KEY);
      }
    }
    setAutoReady(true);
  }, [login]);

  // Focus input when profile changes
  useEffect(() => {
    setError(null);
    setTimeout(() => inputRef.current?.focus(), 80);
  }, [selected]);

  if (autoLogging) {
    return (
      <div style={{ width: "100vw", height: "100vh", background: "#0d0d0d" }}>
        <Loader isReady={autoReady} onFinish={() => setAutoLogging(false)} />
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || !password) return;
    setError(null);
    setLoading(true);
    try {
      await login(selected.email, password);
      if (remember) {
        localStorage.setItem(REMEMBER_KEY, JSON.stringify({ email: selected.email, password }));
      } else {
        localStorage.removeItem(REMEMBER_KEY);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : "Credenciais inválidas";
      const translations: Record<string, string> = {
        "Invalid credentials": "Credenciais inválidas",
        "Login failed": "Falha no login",
        "Unauthorized": "Não autorizado",
        "User not found": "Usuário não encontrado",
      };
      setError(translations[raw] ?? raw);
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setLoading(false);
    }
  };

  // ─── CSS-in-JS vars ──────────────────────────────────────────────────────────

  const BG = "#11111a";
  const CARD_BG = "rgba(22,22,30,0.82)";
  const PRIMARY = "hsl(265 85% 62%)";
  const PRIMARY_GLOW = "hsl(270 90% 72%)";
  const BORDER = "rgba(255,255,255,0.08)";

  return (
    <div
      style={{
        position: "relative",
        minHeight: "100vh",
        overflow: "hidden",
        background: BG,
        color: "#f0f0f8",
        fontFamily: "Inter, 'SF Pro Display', -apple-system, sans-serif",
        WebkitFontSmoothing: "antialiased",
      }}
    >
      {/* ── Layer 1: Partículas hero (fundo) ── */}
      <ParticlesBackground />

      {/* ── Layer 2: Animação CRM (janelas Mac) ── */}
      <CRMBackground />

      {/* ── Grid texture ── */}
      <div style={{
        pointerEvents: "none", position: "absolute", inset: 0, opacity: 0.04,
        backgroundImage: "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
        backgroundSize: "44px 44px",
        maskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
        WebkitMaskImage: "radial-gradient(ellipse at center, black 40%, transparent 75%)",
      }} />

      {/* ── Content ── */}
      <div style={{ position: "relative", zIndex: 10, display: "flex", minHeight: "100vh", alignItems: "center", justifyContent: "center", padding: "40px 16px" }}>
        <section
          style={{
            width: "100%", maxWidth: 440,
            background: CARD_BG,
            backdropFilter: "blur(24px) saturate(160%)",
            WebkitBackdropFilter: "blur(24px) saturate(160%)",
            border: `1px solid ${BORDER}`,
            borderRadius: 24,
            padding: "36px 36px 30px",
            boxShadow: "0 10px 40px -10px rgba(0,0,0,0.55), 0 20px 60px -20px hsl(265 85% 62% / 0.45)",
            animation: shake ? "tg-shake 0.45s ease" : "tg-fade-up 0.6s ease both",
          }}
        >
          {/* ── Brand ── */}
          <header style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 30 }}>
            <div style={{ lineHeight: 1.25 }}>
              <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: "#f0f0f8", letterSpacing: "-0.5px" }}>Teltech Leadger</h1>
              <p style={{ margin: "3px 0 0", fontSize: 13, color: "rgba(255,255,255,0.45)" }}>Workspace inteligente</p>
            </div>
            <span style={{
              marginLeft: "auto", display: "inline-flex", alignItems: "center", gap: 5,
              borderRadius: 20, border: `1px solid ${BORDER}`,
              background: "rgba(255,255,255,0.04)",
              padding: "4px 10px", fontSize: 10, fontWeight: 500, color: "rgba(255,255,255,0.6)",
            }}>
              <ShieldCheck size={12} style={{ color: "hsl(152 65% 45%)" }} /> Seguro
            </span>
          </header>

          {/* ── Greeting ── */}
          <div key={selected.email} style={{ marginBottom: 24, animation: "tg-fade-up 0.5s ease both" }}>
            <h2 style={{ margin: 0, fontSize: 26, fontWeight: 700, letterSpacing: "-0.5px", color: "#f0f0f8" }}>
              E aí!?{" "}
              <span style={{
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_GLOW})`,
                WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                backgroundClip: "text",
              }}>
                {selected.name}
              </span>
              {" "}<span style={{ display: "inline-block", animation: "tg-wave 1.6s ease-in-out", transformOrigin: "70% 70%" }}>
                <Sparkles size={22} style={{ color: "hsl(265 85% 62%)", verticalAlign: "middle" }} />
              </span>
            </h2>
            <p style={{ margin: "8px 0 0", fontSize: 13, fontStyle: "italic", color: "rgba(255,255,255,0.38)", letterSpacing: "0.01em" }}>
              {selected.tagline}
            </p>
          </div>

          {/* ── Profile selector ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 10, marginBottom: 24 }}>
            {profiles.map(p => {
              const active = p.email === selected.email;
              return (
                <button
                  key={p.email}
                  type="button"
                  onClick={() => setSelected(p)}
                  style={{
                    position: "relative",
                    display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                    padding: "12px 8px 10px",
                    border: active ? "1.5px solid hsl(265 85% 62% / 0.6)" : `1px solid ${BORDER}`,
                    borderRadius: 16,
                    background: active ? "hsl(265 85% 62% / 0.1)" : "rgba(255,255,255,0.03)",
                    cursor: "pointer", fontFamily: "inherit",
                    transition: "all 0.25s ease",
                    transform: active ? "scale(1.03)" : "scale(1)",
                    boxShadow: active ? "0 0 50px hsl(265 85% 62% / 0.35)" : "none",
                  }}
                  onMouseEnter={e => { if (!active) { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.borderColor = "rgba(255,255,255,0.18)"; e.currentTarget.style.background = "rgba(255,255,255,0.06)"; }}}
                  onMouseLeave={e => { if (!active) { e.currentTarget.style.transform = ""; e.currentTarget.style.borderColor = BORDER; e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}}
                >
                  {/* Avatar */}
                  <div style={{
                    position: "relative", width: 48, height: 48, borderRadius: "50%",
                    background: `linear-gradient(135deg, ${p.color}, hsl(270 90% 72%))`,
                    display: "flex", alignItems: "center", justifyContent: "center",
                    fontSize: 14, fontWeight: 700, color: "#fff",
                    transition: "transform 0.3s",
                    transform: active ? "scale(1.1)" : "scale(1)",
                    overflow: "hidden",
                  }}>
                    {p.avatarUrl
                      ? <img src={p.avatarUrl} alt={p.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      : p.initials
                    }
                    {active && (
                      <span style={{
                        position: "absolute", inset: 0, borderRadius: "50%",
                        animation: "tg-pulse-ring 1.8s ease-out infinite",
                      }} />
                    )}
                  </div>

                  <div style={{ textAlign: "center", lineHeight: 1.3 }}>
                    <div style={{ fontSize: 12, fontWeight: active ? 700 : 500, color: active ? "#f0f0f8" : "rgba(255,255,255,0.7)" }}>
                      {p.name}
                    </div>
                    <div style={{ fontSize: 10, color: "rgba(255,255,255,0.35)" }}>{p.role}</div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* ── Form ── */}
          <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }} noValidate>
            {/* Password */}
            <div>
              <label htmlFor="gateway-password" style={{ display: "flex", alignItems: "center", marginBottom: 6, fontSize: 11, fontWeight: 500, color: "rgba(255,255,255,0.45)" }}>
                <span>Senha</span>
              </label>
              <div style={{
                position: "relative", display: "flex", alignItems: "center",
                border: error ? "1px solid hsl(0 70% 58% / 0.6)" : "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12,
                background: "rgba(255,255,255,0.04)",
                transition: "all 0.3s",
              }}
                onFocusCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = "hsl(265 85% 62% / 0.6)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "0 0 50px hsl(265 85% 62% / 0.35)"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.06)"; }}
                onBlurCapture={e => { (e.currentTarget as HTMLDivElement).style.borderColor = error ? "hsl(0 70% 58% / 0.6)" : "rgba(255,255,255,0.1)"; (e.currentTarget as HTMLDivElement).style.boxShadow = "none"; (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)"; }}
              >
                <input
                  ref={inputRef}
                  id="gateway-password"
                  type={showPwd ? "text" : "password"}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••••"
                  autoComplete="current-password"
                  style={{
                    flex: 1, background: "transparent", border: "none", outline: "none",
                    padding: "13px 16px", fontSize: 14, color: "#f0f0f8",
                    letterSpacing: "0.1em", fontFamily: "inherit",
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(s => !s)}
                  aria-label={showPwd ? "Ocultar senha" : "Mostrar senha"}
                  style={{
                    background: "transparent", border: "none", color: "rgba(255,255,255,0.4)",
                    cursor: "pointer", padding: "0 12px",
                    display: "flex", alignItems: "center", transition: "color 0.15s",
                  }}
                  onMouseEnter={e => e.currentTarget.style.color = "rgba(255,255,255,0.8)"}
                  onMouseLeave={e => e.currentTarget.style.color = "rgba(255,255,255,0.4)"}
                >
                  {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Error */}
              <div style={{
                overflow: "hidden", transition: "all 0.3s",
                maxHeight: error ? 40 : 0, opacity: error ? 1 : 0,
                marginTop: error ? 8 : 0,
              }}>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 500, color: "hsl(0 70% 58%)" }}>{error}</p>
              </div>
            </div>

            {/* Remember me */}
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <span style={{
                position: "relative", display: "inline-flex", width: 16, height: 16,
                alignItems: "center", justifyContent: "center", borderRadius: 5,
                border: remember ? `1.5px solid ${PRIMARY}` : "1.5px solid rgba(255,255,255,0.2)",
                background: remember ? PRIMARY : "rgba(255,255,255,0.04)",
                transition: "all 0.2s", flexShrink: 0,
              }}>
                {remember && (
                  <svg viewBox="0 0 12 12" style={{ width: 10, height: 10, color: "#fff" }}>
                    <path d="M2.5 6.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={e => setRemember(e.target.checked)}
                  style={{ position: "absolute", inset: 0, opacity: 0, cursor: "pointer" }}
                />
              </span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.45)" }}>Lembrar-me neste dispositivo</span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !password}
              style={{
                position: "relative",
                display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
                height: 48, width: "100%", borderRadius: 13, border: "none",
                background: `linear-gradient(135deg, ${PRIMARY}, ${PRIMARY_GLOW})`,
                color: "#fff", fontSize: 14, fontWeight: 700,
                cursor: loading || !password ? "not-allowed" : "pointer",
                opacity: loading || !password ? 0.6 : 1,
                boxShadow: "0 20px 60px -20px hsl(265 85% 62% / 0.45)",
                transition: "all 0.3s", fontFamily: "inherit",
                overflow: "hidden",
              }}
              onMouseEnter={e => { if (!loading && password) e.currentTarget.style.transform = "translateY(-2px)"; }}
              onMouseLeave={e => { e.currentTarget.style.transform = ""; }}
            >
              {/* Shimmer */}
              <span style={{
                position: "absolute", inset: 0,
                background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent)",
                animation: loading ? "none" : "tg-shimmer 2.5s ease-in-out infinite",
              }} />
              {loading ? (
                <>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: 16 }}>⟳</span>
                  Autenticando...
                </>
              ) : (
                <>
                  Entrar
                  <span style={{ fontSize: 15, transition: "transform 0.3s" }}>→</span>
                </>
              )}
            </button>
          </form>

          <p style={{ marginTop: 24, textAlign: "center", fontSize: 10, color: "rgba(255,255,255,0.25)" }}>
            Protegido com criptografia de ponta a ponta · Teltech © {new Date().getFullYear()}
          </p>
        </section>
      </div>

      {/* ── Keyframes ── */}
      <style>{`
        @keyframes tg-float-orb {
          0%, 100% { transform: translate(0, 0) scale(1); }
          33% { transform: translate(40px, -30px) scale(1.05); }
          66% { transform: translate(-30px, 20px) scale(0.97); }
        }
        @keyframes tg-shake {
          0%, 100% { transform: translateX(0); }
          20%, 60% { transform: translateX(-7px); }
          40%, 80% { transform: translateX(7px); }
        }
        @keyframes tg-wave {
          0%, 60%, 100% { transform: rotate(0deg); }
          10% { transform: rotate(14deg); }
          20% { transform: rotate(-8deg); }
          30% { transform: rotate(14deg); }
          40% { transform: rotate(-4deg); }
          50% { transform: rotate(10deg); }
        }
        @keyframes tg-fade-up {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes tg-pulse-ring {
          0%   { box-shadow: 0 0 0 0 hsl(265 85% 62% / 0.6); }
          100% { box-shadow: 0 0 0 14px hsl(265 85% 62% / 0); }
        }
        @keyframes tg-shimmer {
          0%   { transform: translateX(-200%); }
          60%, 100% { transform: translateX(200%); }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
