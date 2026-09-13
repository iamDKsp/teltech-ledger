import { Construction } from "lucide-react";

export function ComingSoon({ module }: { module: string }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", padding: 40 }}>
      <div style={{ textAlign: "center", animation: "fadeIn 0.3s ease" }}>
        <div style={{
          width: 72, height: 72, borderRadius: 20, background: "rgba(124,90,194,0.1)",
          border: "1px solid rgba(124,90,194,0.15)", display: "flex", alignItems: "center",
          justifyContent: "center", margin: "0 auto 20px", color: "hsl(265 85% 62%)",
        }}>
          <Construction size={34} />
        </div>
        <h2 style={{ margin: "0 0 8px", fontSize: 20, fontWeight: 700, color: "#f0f0f0" }}>{module}</h2>
        <p style={{ margin: 0, fontSize: 14, color: "#666", maxWidth: 300 }}>
          Este módulo está sendo desenvolvido e estará disponível em breve.
        </p>
        <div style={{
          marginTop: 24, display: "inline-flex", alignItems: "center", gap: 8,
          background: "rgba(124,90,194,0.08)", border: "1px solid rgba(124,90,194,0.15)",
          borderRadius: 10, padding: "10px 20px", fontSize: 13, color: "#9B6DE3",
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
            <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
          Em desenvolvimento
        </div>
      </div>
    </div>
  );
}
