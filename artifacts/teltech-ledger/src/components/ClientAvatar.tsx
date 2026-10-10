import { useState } from "react";
import { API_BASE } from "../lib/api";

export function ClientAvatar({ name, photoUrl, size = 40 }: { name: string; photoUrl?: string | null; size?: number }) {
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const local = photoUrl?.startsWith("/uploads/client-photos/") ? `${API_BASE.replace(/\/$/, "")}${photoUrl}` : null;
  const initials = name.trim().split(/\s+/).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  return <span className="inline-flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-primary/20 bg-primary/10 font-semibold text-primary"
    style={{ width: size, height: size, fontSize: Math.max(10, Math.round(size * 0.32)) }}>
    {local && failedUrl !== local ? <img src={local} alt={`Foto de ${name}`} width={size} height={size} loading="lazy"
      className="h-full w-full object-cover" onError={() => setFailedUrl(local)} /> : <span aria-label={name}>{initials || "?"}</span>}
  </span>;
}
