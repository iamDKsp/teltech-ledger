import React, { useEffect, useState, useRef } from "react";
import { Send } from "lucide-react";
import { API } from "../lib/api";

export function ProjectChannels({ projectId }: { projectId: string }) {
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [body, setBody] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // We should ideally fetch current user ID to distinct their messages, but we can do a hack or use context.
  // For now we'll just check if there's any user token data or assume user info. We can't access user context directly unless we pass it.
  // We'll style based on some local assumption or just style all similarly if we can't tell.

  useEffect(() => {
    fetchMessages();
  }, [projectId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const fetchMessages = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/projects/${projectId}/messages`);
      if (res.data?.messages) setMessages(res.data.messages);
    } catch (e) {
      console.error("Failed to fetch messages", e);
    }
    setLoading(false);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSend = async () => {
    if (!body.trim()) return;
    try {
      const res = await API.post(`/projects/${projectId}/messages`, { body: body.trim() });
      if (res.data?.message) {
        setMessages(prev => [...prev, res.data.message]);
        setBody("");
      }
    } catch (e) {
      console.error("Failed to send message", e);
    }
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return "agora";
    if (diffMins < 60) return `há ${diffMins} min`;
    if (diffHours < 24) return `há ${diffHours} hora${diffHours > 1 ? "s" : ""}`;
    if (diffDays === 1) return "ontem";
    return date.toLocaleDateString("pt-BR");
  };

  if (loading) return <div style={{ color: "#a1a1aa", padding: 20 }}>Carregando canais...</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%", background: "#111111" }}>
      <div style={{ padding: "20px 24px", borderBottom: "1px solid #242424" }}>
        <h2 style={{ fontSize: 20, fontWeight: 600, color: "#fafafa", margin: 0 }}>Canal do Projeto</h2>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 16 }}>
        {messages.length === 0 ? (
          <div style={{ margin: "auto", color: "#a1a1aa", textAlign: "center" }}>
            <p>Nenhuma mensagem ainda.</p>
            <p>Comece a conversa!</p>
          </div>
        ) : (
          messages.map((msg, i) => {
            const isMe = false; // We don't have current user id here easily, assume others for now, or you could pass it. Let's just render standard left-aligned.
            
            return (
              <div key={msg.id || i} style={{ display: "flex", gap: 12, alignItems: "flex-start", maxWidth: "80%" }}>
                {msg.user?.avatarUrl ? (
                  <img src={msg.user.avatarUrl} alt={msg.user.name} style={{ width: 36, height: 36, borderRadius: "50%", objectFit: "cover" }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: "50%", background: "#7C5AC2", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 600, fontSize: 14 }}>
                    {msg.user?.name?.substring(0, 2).toUpperCase() || "??"}
                  </div>
                )}
                
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
                    <span style={{ color: "#fafafa", fontWeight: 500, fontSize: 14 }}>{msg.user?.name}</span>
                    <span style={{ color: "#a1a1aa", fontSize: 12 }}>{formatTime(msg.createdAt)}</span>
                  </div>
                  
                  <div style={{ 
                    background: "#1e1e22", 
                    padding: "10px 14px", 
                    borderRadius: "0 12px 12px 12px", 
                    color: "#e0e0e0",
                    fontSize: 14,
                    lineHeight: 1.5,
                    wordBreak: "break-word"
                  }}>
                    {msg.body}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      <div style={{ padding: 20, borderTop: "1px solid #242424", background: "#111111" }}>
        <div style={{ 
          display: "flex", alignItems: "center", background: "#232326", 
          borderRadius: 24, padding: "8px 8px 8px 16px", border: "1px solid #313136" 
        }}>
          <input 
            type="text" 
            placeholder="Escreva uma mensagem..." 
            value={body}
            onChange={e => setBody(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            style={{ 
              flex: 1, background: "transparent", border: "none", color: "#fafafa", 
              outline: "none", fontSize: 14 
            }}
          />
          <button 
            onClick={handleSend}
            disabled={!body.trim()}
            style={{ 
              background: body.trim() ? "#7C5AC2" : "#313136", 
              border: "none", borderRadius: "50%", width: 36, height: 36, 
              display: "flex", alignItems: "center", justifyContent: "center", 
              cursor: body.trim() ? "pointer" : "not-allowed",
              color: body.trim() ? "#fff" : "#a1a1aa",
              transition: "background 0.2s"
            }}
          >
            <Send size={16} style={{ marginLeft: -2 }} />
          </button>
        </div>
      </div>
    </div>
  );
}
