import React, { useEffect, useState } from "react";
import { FileText, Image as ImageIcon, Film, File, Upload, Download, Search, LayoutGrid, List } from "lucide-react";
import { API } from "../lib/api";

export function ProjectFiles({ projectId }: { projectId: string }) {
  const [files, setFiles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    fetchFiles();
  }, [projectId]);

  const fetchFiles = async () => {
    setLoading(true);
    try {
      const res = await API.get(`/projects/${projectId}/files`);
      if (res.data?.files) setFiles(res.data.files);
    } catch (e) {
      console.error("Failed to load files", e);
    }
    setLoading(false);
  };

  const filteredFiles = files.filter(f => 
    f.fileName.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const formatSize = (bytes: number) => {
    if (!bytes) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const getIcon = (type: string) => {
    if (type.startsWith("image/")) return <ImageIcon size={24} color="#7C5AC2" />;
    if (type.startsWith("video/")) return <Film size={24} color="#7C5AC2" />;
    if (type.includes("pdf") || type.includes("text")) return <FileText size={24} color="#7C5AC2" />;
    return <File size={24} color="#7C5AC2" />;
  };

  if (loading) return <div style={{ color: "#a1a1aa", padding: 20 }}>Carregando arquivos...</div>;

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 24, height: "100%", overflowY: "auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <h2 style={{ fontSize: 24, fontWeight: 600, color: "#fafafa", margin: 0 }}>Arquivos</h2>
        
        <div style={{ display: "flex", gap: 12 }}>
          <div style={{ 
            display: "flex", alignItems: "center", background: "#232326", 
            padding: "8px 12px", borderRadius: 8, border: "1px solid #313136"
          }}>
            <Search size={16} color="#a1a1aa" style={{ marginRight: 8 }} />
            <input 
              type="text" 
              placeholder="Buscar arquivo..." 
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              style={{ background: "transparent", border: "none", color: "#fafafa", outline: "none", width: 200 }}
            />
          </div>
          
          <div style={{ display: "flex", background: "#232326", borderRadius: 8, padding: 4, border: "1px solid #313136" }}>
            <button 
              onClick={() => setViewMode("grid")}
              style={{ 
                background: viewMode === "grid" ? "#313136" : "transparent",
                border: "none", borderRadius: 4, padding: "6px 8px", cursor: "pointer", color: "#fafafa" 
              }}
            >
              <LayoutGrid size={18} />
            </button>
            <button 
              onClick={() => setViewMode("list")}
              style={{ 
                background: viewMode === "list" ? "#313136" : "transparent",
                border: "none", borderRadius: 4, padding: "6px 8px", cursor: "pointer", color: "#fafafa" 
              }}
            >
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {files.length === 0 ? (
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", flex: 1, color: "#a1a1aa" }}>
          <Upload size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
          <p style={{ fontSize: 16 }}>Nenhum arquivo no projeto</p>
          <p style={{ fontSize: 14, opacity: 0.7 }}>Arquivos anexados às tarefas aparecerão aqui.</p>
        </div>
      ) : (
        <div style={viewMode === "grid" ? { 
          display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 16 
        } : {
          display: "flex", flexDirection: "column", gap: 12
        }}>
          {filteredFiles.map(file => (
            <div key={file.id} style={{ 
              background: "#1a1a1a", border: "1px solid #242424", borderRadius: 12, padding: 16,
              display: viewMode === "grid" ? "flex" : "grid",
              gridTemplateColumns: viewMode === "grid" ? undefined : "auto 1fr auto auto",
              flexDirection: viewMode === "grid" ? "column" : "row",
              alignItems: viewMode === "grid" ? "flex-start" : "center",
              gap: 16
            }}>
              <div style={{ 
                width: 48, height: 48, borderRadius: 8, background: "#7C5AC222", 
                display: "flex", alignItems: "center", justifyContent: "center" 
              }}>
                {getIcon(file.fileType)}
              </div>
              
              <div style={{ flex: 1, overflow: "hidden" }}>
                <div style={{ color: "#fafafa", fontWeight: 500, fontSize: 14, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {file.fileName}
                </div>
                <div style={{ color: "#a1a1aa", fontSize: 12, marginTop: 4 }}>
                  De: {file.taskTitle}
                </div>
                {viewMode === "grid" && (
                  <div style={{ color: "#888", fontSize: 11, marginTop: 8 }}>
                    {formatSize(file.fileSize)} • {new Date(file.createdAt).toLocaleDateString("pt-BR")}
                  </div>
                )}
              </div>
              
              {viewMode === "list" && (
                <div style={{ color: "#888", fontSize: 12, textAlign: "right" }}>
                  <div>{formatSize(file.fileSize)}</div>
                  <div>{new Date(file.createdAt).toLocaleDateString("pt-BR")}</div>
                </div>
              )}

              <a 
                href={file.fileUrl} 
                target="_blank" 
                rel="noreferrer"
                style={{ 
                  background: "#2b2b2e", border: "none", borderRadius: 8, padding: 8, 
                  cursor: "pointer", color: "#fafafa", display: "flex", alignItems: "center", justifyContent: "center",
                  textDecoration: "none"
                }}
              >
                <Download size={18} />
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
