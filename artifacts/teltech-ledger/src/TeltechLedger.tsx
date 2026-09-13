import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";
import { useLocation } from "wouter";
import { useAuth } from "./lib/auth-context";
import { FinanceiroPage } from "./pages/FinanceiroPage";
import { MembersPage } from "./pages/MembersPage";
import { ComingSoon } from "./pages/ComingSoon";
import { InicioPage } from "./pages/InicioPage";
import MinhasTarefasPage from "./pages/MinhasTarefasPage";
import { MetasPage } from "./pages/MetasPage";
import { PainelPage } from "./pages/PainelPage";
import { ProjectModal } from "./pages/ProjectModal";
import { ProfileModal } from "./pages/ProfileModal";
import { Loader } from "./components/Loader";
import { TaskModal } from "./components/TaskModal";
import { ProjectList } from "./components/ProjectList";
import { ProjectCalendar } from "./components/ProjectCalendar";
import { ProjectOverview } from "./components/ProjectOverview";
import { ProjectFiles } from "./components/ProjectFiles";
import { ProjectChannels } from "./components/ProjectChannels";
import { ConfiguracoesPage } from "./pages/ConfiguracoesPage";
import { Settings, Check, Zap } from "lucide-react";
// ─── App Context ──────────────────────────────────────────────────────────────

import { API } from "./lib/api";
export { API };


export interface AppProject { id: string; name: string; color: string; workspaceId: string; icon?: string; isFavorite?: boolean; status?: string; }

export interface AppCtx {
  activeTab: string; setActiveTab: (t: string) => void;
  sidebarOpen: boolean; setSidebarOpen: (v: boolean) => void;
  sidebarModule: string; setSidebarModule: (m: string) => void;
  activeProject: AppProject | null; setActiveProject: (p: AppProject) => void;
  projects: AppProject[]; refreshProjects: () => void;
  loadBoard?: () => void;
}
export const AppContext = createContext<AppCtx>({} as AppCtx);


// ─── Types ────────────────────────────────────────────────────────────────────

export type TagColor = "purple" | "yellow" | "gray" | "blue" | "pink" | "red";
export interface Tag { label: string; color: TagColor; }
export type TimerState = "idle" | "running" | "overtime";

export interface Task {
  id: string;
  coverImage?: string;
  tags: Tag[];
  date?: string;
  title: string;
  assignees: number;
  addAssignee?: boolean;
  attachments?: number;
  comments?: number;
  timerState: TimerState;
  timerValue: string;
  timerSeconds?: number;
  progress: number;
  estTime: string;
  showStatusBadge?: boolean;
}
export interface Column { id: string; title: string; tasks: Task[]; }

// ─── Initial Data ─────────────────────────────────────────────────────────────

const INITIAL_COLUMNS: Column[] = [
  {
    id: "untitled", title: "Sem Título",
    tasks: [
      { id:"u1", tags:[{label:"QA",color:"blue"}], title:"Testes (Páginas da Plataforma)", assignees:2, timerState:"idle", timerValue:"00:00", progress:0, estTime:"" },
      { id:"u2", tags:[{label:"UX/UI",color:"purple"},{label:"Sem cobrança",color:"gray"}], title:"StrataScratch - Apresentação Dribbble (Versão #4)", assignees:3, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Prev: 8:00 h" },
      { id:"u3", tags:[], title:"Coletar feedback de clientes do Clutch", assignees:1, timerState:"idle", timerValue:"00:00", progress:0, estTime:"", showStatusBadge:true },
      { id:"u4", tags:[{label:"Gestão",color:"pink"}], title:"Retrospectiva do projeto", assignees:0, addAssignee:true, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Prev: 2:00 h" },
    ],
  },
  {
    id: "todo", title: "A Fazer",
    tasks: [
      { id:"t1", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"},{label:"Sem cobrança",color:"gray"}], date:"3 Jun", title:"StrataScratch - Post para Instagram", assignees:3, comments:3, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Prev: 0:30 h" },
      { id:"t2", tags:[{label:"UX/UI",color:"purple"}], date:"3 Jun", title:"StrataScratch - Nova Página de Preços", assignees:1, attachments:3, comments:1, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Prev: 3:00 h" },
      { id:"t3", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"11 Jun", title:"StrataScratch - Anúncios Display (#3)", assignees:3, comments:3, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Prev: 8:00 h" },
      { id:"t4", coverImage:"photo", tags:[], title:"", assignees:0, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Prev: 2:00 h" },
    ],
  },
  {
    id: "doing", title: "Em Andamento",
    tasks: [
      { id:"d1", coverImage:"dashboard", tags:[{label:"UX/UI",color:"purple"},{label:"Sem cobrança",color:"gray"}], date:"2 Jun", title:"StrataScratch - Apresentação Behance", assignees:3, attachments:2, comments:17, timerState:"running", timerValue:"16:32 h", progress:55, estTime:"Prev: 30:00 h" },
      { id:"d2", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"4 Jun", title:"StrataScratch - Anúncios Display (#2)", assignees:3, comments:3, timerState:"running", timerValue:"0:57 h", progress:25, estTime:"Prev: 4:00 h" },
      { id:"d3", tags:[{label:"UX/UI",color:"purple"}], date:"14 Jun", title:"Strata Scratch - Animação para tela de carregamento", assignees:1, attachments:1, comments:1, timerState:"running", timerValue:"0:46 h", progress:46, estTime:"Prev: 1:00 h" },
    ],
  },
  {
    id: "review", title: "Revisão",
    tasks: [
      { id:"r1", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"28 Mai", title:"StrataScratch - Anúncios Display", assignees:3, comments:3, timerState:"overtime", timerValue:"9:43", progress:100, estTime:"Prev: 8:00 h" },
      { id:"r2", coverImage:"figma", tags:[{label:"UX/UI",color:"purple"},{label:"Sem cobrança",color:"gray"}], date:"24 Jun", title:"StrataScratch - Apresentação Dribbble (Versão #3)", assignees:2, comments:5, timerState:"overtime", timerValue:"2:54 h", progress:100, estTime:"Prev: 3:00 h" },
    ],
  },
  {
    id: "done", title: "Concluído",
    tasks: [
      { id:"dn1", tags:[{label:"UX/UI",color:"purple"}], title:"Nova página inicial do site", assignees:2, timerState:"idle", timerValue:"8:00 h", progress:100, estTime:"Prev: 8:00 h" },
      { id:"dn2", tags:[{label:"QA",color:"blue"}], title:"Corrigir e testar no Zeplin", assignees:1, timerState:"idle", timerValue:"3:00 h", progress:100, estTime:"Prev: 3:00 h" },
      { id:"dn3", tags:[{label:"QA",color:"blue"}], title:"Corrigir bug no mobile", assignees:1, timerState:"idle", timerValue:"1:30 h", progress:100, estTime:"Prev: 2:00 h" },
    ],
  },
];

// ─── Drag State & Context ─────────────────────────────────────────────────────

interface DragState {
  taskId: string;
  sourceColId: string;
  targetColId: string;
  targetIndex: number;
  mouseX: number;
  mouseY: number;
  startMouseX: number;
  startMouseY: number;
  offsetX: number;
  offsetY: number;
  cardW: number;
  cardH: number;
  active: boolean;
}

interface DragCtx {
  drag: DragState | null;
  startDrag: (taskId: string, sourceColId: string, e: React.MouseEvent, cardEl: HTMLElement) => void;
  colRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  cardRefs: React.MutableRefObject<Map<string, HTMLElement>>;
  justDropped: string | null;
  onCardClick: (task: Task) => void;
  onDeleteClick: (task: Task) => void;
  loadBoard: () => void;
}

const DragContext = createContext<DragCtx>({
  drag: null,
  startDrag: () => {},
  colRefs: { current: new Map() },
  cardRefs: { current: new Map() },
  justDropped: null,
  onCardClick: () => {},
  onDeleteClick: () => {},
  loadBoard: () => {},
});

// ─── Colors ───────────────────────────────────────────────────────────────────

export const TAG_STYLES: Record<TagColor, { bg: string; dot: string; text: string }> = {
  purple: { bg: "rgba(124,90,194,0.22)", dot: "#7C5AC2", text: "#b39deb" },
  yellow: { bg: "rgba(234,179,8,0.2)",   dot: "#EAB308", text: "#fcd34d" },
  gray:   { bg: "rgba(113,113,122,0.22)",dot: "#71717a", text: "#a1a1aa" },
  blue:   { bg: "rgba(59,130,246,0.2)",  dot: "#3B82F6", text: "#93c5fd" },
  pink:   { bg: "rgba(236,72,153,0.2)",  dot: "#EC4899", text: "#f9a8d4" },
  red:    { bg: "rgba(239,68,68,0.2)",   dot: "#ef4444", text: "#fca5a5" },
};

// ─── Face Avatars ─────────────────────────────────────────────────────────────

type FaceSpec = { bg: string; skin: string; hair: string; hairStyle: "curly"|"straight"|"afro"|"short"|"bun" };
const FACE_SPECS: FaceSpec[] = [
  { bg:"#3d2b6b", skin:"#c68642", hair:"#1a0900", hairStyle:"curly" },
  { bg:"#1e4d8c", skin:"#8d5524", hair:"#2c1810", hairStyle:"afro" },
  { bg:"#5b2d8e", skin:"#e8b89a", hair:"#8B4513", hairStyle:"straight" },
  { bg:"#7c1d1d", skin:"#d4956a", hair:"#3b1f0a", hairStyle:"bun" },
  { bg:"#1a5c3a", skin:"#f0c8a0", hair:"#4a2000", hairStyle:"short" },
];

export function FaceAvatar({ index, size=22 }: { index:number; size?:number }) {
  const s = FACE_SPECS[index % FACE_SPECS.length];
  const r = size/2;
  const hairPaths: Record<string, React.ReactNode> = {
    curly: <><ellipse cx={r} cy={r*0.38} rx={r*0.54} ry={r*0.36} fill={s.hair}/><ellipse cx={r*0.35} cy={r*0.52} rx={r*0.22} ry={r*0.28} fill={s.hair}/><ellipse cx={r*1.65} cy={r*0.52} rx={r*0.22} ry={r*0.28} fill={s.hair}/></>,
    afro:  <ellipse cx={r} cy={r*0.35} rx={r*0.68} ry={r*0.48} fill={s.hair}/>,
    straight: <><ellipse cx={r} cy={r*0.36} rx={r*0.52} ry={r*0.3} fill={s.hair}/><rect x={r*0.42} y={r*0.55} width={r*0.14} height={r*0.55} rx={r*0.07} fill={s.hair}/><rect x={r*1.44} y={r*0.55} width={r*0.14} height={r*0.55} rx={r*0.07} fill={s.hair}/></>,
    bun: <><ellipse cx={r} cy={r*0.38} rx={r*0.5} ry={r*0.3} fill={s.hair}/><circle cx={r} cy={r*0.18} r={r*0.22} fill={s.hair}/></>,
    short: <ellipse cx={r} cy={r*0.38} rx={r*0.5} ry={r*0.3} fill={s.hair}/>,
  };
  return (
    <div style={{ width:size, height:size, borderRadius:"50%", background:s.bg, border:"2px solid #252525", flexShrink:0, overflow:"hidden", position:"relative" }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} style={{position:"absolute",top:0,left:0}}>
        <ellipse cx={r} cy={size*0.88} rx={r*0.38} ry={r*0.35} fill={s.skin}/>
        <rect x={r*0.62} y={size*0.72} width={r*0.76} height={size*0.3} rx={r*0.12} fill={s.bg} opacity={0.6}/>
        <ellipse cx={r} cy={r*0.78} rx={r*0.44} ry={r*0.48} fill={s.skin}/>
        {hairPaths[s.hairStyle]}
        <ellipse cx={r*0.72} cy={r*0.72} rx={r*0.07} ry={r*0.085} fill="#1a0a00"/>
        <ellipse cx={r*1.28} cy={r*0.72} rx={r*0.07} ry={r*0.085} fill="#1a0a00"/>
        <path d={`M ${r*0.8} ${r*0.96} Q ${r} ${r*1.08} ${r*1.2} ${r*0.96}`} stroke="#a0604a" strokeWidth={size*0.02} fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

// Member profile data map (matching login.tsx)
export const MEMBER_PROFILES: Record<string, { role: string; tagline: string; color: string }> = {
  "Tarcísio": { role: "Sócio Co-Founder", tagline: "Estratégia, Finanças & Inteligência Técnica", color: "hsl(265 85% 62%)" },
  "Lucas":    { role: "Sócio Co-Founder", tagline: "Arquitetura Arcana, Engenharia & Inovação",    color: "hsl(152 65% 45%)" },
};
export function getMemberProfile(name: string) {
  const key = Object.keys(MEMBER_PROFILES).find(k => name?.startsWith(k)) ?? name;
  return MEMBER_PROFILES[key] ?? { role: "", tagline: "", color: "#7C5AC2" };
}

export function AvatarCluster({ assignees, count, size=22 }: { assignees?: any[]; count?:number; size?:number }) {
  const [tooltip, setTooltip] = useState<number | null>(null);
  const total = assignees ? assignees.length : count || 0;
  if (total === 0) return null;
  const shown = Math.min(total, 4);
  const items = assignees ? assignees.slice(0, shown) : Array.from({length:shown});
  return (
    <div style={{ display:"flex", alignItems:"center", position:"relative" }}>
      {items.map((item, i) => {
        const prof = assignees && item.name ? getMemberProfile(item.name) : null;
        return (
          <div key={i} style={{ position:"relative", marginLeft: i===0 ? 0 : -(size*0.3), zIndex: tooltip===i ? 999 : shown-i }}
            onMouseEnter={() => { if (assignees && item) setTooltip(i); }}
            onMouseLeave={() => setTooltip(null)}>
            <div style={{ width:size, height:size, borderRadius:"50%", border:"2px solid #252525", overflow:"hidden", background:"#1e1e22", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:size*0.4, fontWeight:600, cursor: assignees ? "pointer" : "default" }}>
              {assignees && item.avatarUrl ? (
                <img src={item.avatarUrl} style={{ width:"100%", height:"100%", objectFit:"cover" }} />
              ) : assignees && item.name ? (
                item.name[0].toUpperCase()
              ) : (
                <FaceAvatar index={i} size={size}/>
              )}
            </div>
            {tooltip === i && prof && assignees && item && (
              <div style={{
                position: "absolute", bottom: "calc(100% + 10px)", left: "50%", transform: "translateX(-50%)",
                background: "rgba(20,20,24,0.97)", backdropFilter: "blur(12px)",
                border: `1px solid ${prof.color}44`,
                borderRadius: 12, padding: "12px", minWidth: 200, maxWidth: 240,
                boxShadow: `0 12px 40px rgba(0,0,0,0.7), 0 0 0 1px ${prof.color}22`,
                animation: "fadeIn 0.15s ease",
                pointerEvents: "none",
              }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:8 }}>
                  <div style={{ width:44, height:44, borderRadius:"50%", border:`2px solid ${prof.color}`, overflow:"hidden", flexShrink:0, background:"#1e1e22", display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:700, color:"#fff" }}>
                    {item.avatarUrl ? <img src={item.avatarUrl} style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : item.name[0]?.toUpperCase()}
                  </div>
                  <div>
                    <div style={{ fontSize:13, fontWeight:700, color:"#f0f0f8" }}>{item.name}</div>
                    <div style={{ fontSize:11, fontWeight:600, color: prof.color, marginTop:2 }}>{prof.role}</div>
                  </div>
                </div>
                <div style={{ fontSize:11, fontStyle:"italic", color:"rgba(255,255,255,0.45)", lineHeight:1.5 }}>{prof.tagline}</div>
                {/* Seta */}
                <div style={{ position:"absolute", bottom:-6, left:"50%", transform:"translateX(-50%) rotate(45deg)", width:10, height:10, background:"rgba(20,20,24,0.97)", border:`1px solid ${prof.color}44`, borderTop:"none", borderLeft:"none" }}/>
              </div>
            )}
          </div>
        );
      })}
      {total > 4 && (
        <div style={{ marginLeft: -(size*0.3), zIndex: 0, width:size, height:size, borderRadius:"50%", border:"2px solid #252525", background:"#333", display:"flex", alignItems:"center", justifyContent:"center", color:"#fff", fontSize:size*0.4, fontWeight:600 }}>
          +{total - 4}
        </div>
      )}
    </div>
  );
}

// ─── Cover Images ─────────────────────────────────────────────────────────────

function DashboardCover() {
  return (
    <div style={{ width:"100%", height:126, borderRadius:"8px 8px 0 0", background:"#0b0b18", overflow:"hidden", position:"relative" }}>
      <div style={{ height:16, background:"#13132a", display:"flex", alignItems:"center", gap:3, padding:"0 6px" }}>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"#ef4444" }}/>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"#f59e0b" }}/>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"#22c55e" }}/>
        <div style={{ flex:1, height:5, borderRadius:2, background:"#1e1e3f", marginLeft:6 }}/>
      </div>
      <div style={{ display:"flex", height:"calc(100% - 16px)" }}>
        <div style={{ width:22, background:"#0e0e22", display:"flex", flexDirection:"column", alignItems:"center", gap:5, paddingTop:6 }}>
          <div style={{ width:14, height:14, borderRadius:4, background:"linear-gradient(135deg,#7C5AC2,#a78bfa)" }}/>
          {[1,2,3,4].map(i=><div key={i} style={{ width:10, height:10, borderRadius:2, background: i===2?"#7C5AC2":"#1a1a38" }}/>)}
        </div>
        <div style={{ flex:1, padding:"6px 8px", display:"flex", flexDirection:"column", gap:5 }}>
          <div style={{ display:"flex", gap:4 }}>
            {["linear-gradient(135deg,#4f2d8a,#7C5AC2)","linear-gradient(135deg,#c45c0e,#f97316)","linear-gradient(135deg,#0e7490,#06b6d4)"].map((bg,i)=>(
              <div key={i} style={{ flex:1, height:30, borderRadius:4, background:bg, padding:"4px 5px" }}>
                <div style={{ width:"60%", height:4, borderRadius:2, background:"rgba(255,255,255,0.4)", marginBottom:3 }}/>
                <div style={{ width:"40%", height:6, borderRadius:2, background:"rgba(255,255,255,0.7)" }}/>
              </div>
            ))}
          </div>
          <div style={{ flex:1, background:"#0d0d20", borderRadius:4, padding:"4px 5px", display:"flex", gap:3, alignItems:"flex-end" }}>
            {[55,80,45,70,35,60,75,50,65,40].map((h,i)=>(
              <div key={i} style={{ flex:1, height:`${h}%`, borderRadius:"2px 2px 0 0", background: i%3===0?"#7C5AC2": i%3===1?"#0ea5e9":"#1e1e38" }}/>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FigmaCover() {
  return (
    <div style={{ width:"100%", height:110, borderRadius:"8px 8px 0 0", background:"#f8f8f8", overflow:"hidden", display:"flex" }}>
      <div style={{ width:30, background:"#1e1e1e", padding:"6px 4px", display:"flex", flexDirection:"column", gap:4 }}>
        <div style={{ width:22, height:22, borderRadius:4, background:"#10B981", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:10, height:10, borderRadius:1, background:"rgba(255,255,255,0.9)" }}/>
        </div>
        {["#2a2a2a","#2a2a2a","#3a3a3a","#2a2a2a"].map((c,i)=>(
          <div key={i} style={{ height:6, borderRadius:2, background:c }}/>
        ))}
      </div>
      <div style={{ width:55, background:"#252525", padding:"5px 4px", display:"flex", flexDirection:"column", gap:3 }}>
        <div style={{ height:5, borderRadius:2, background:"#3a3a3a", width:"80%" }}/>
        {[{c:"#10B981",w:"90%"},{c:"#3a3a3a",w:"70%"},{c:"#3a3a3a",w:"85%"},{c:"#10B981",w:"60%"},{c:"#3a3a3a",w:"75%"}].map((r,i)=>(
          <div key={i} style={{ height:4, borderRadius:2, background:r.c, width:r.w, marginLeft:4 }}/>
        ))}
      </div>
      <div style={{ flex:1, background:"#e8e8e8", padding:6, display:"flex", flexDirection:"column", gap:3 }}>
        <div style={{ display:"flex", gap:3 }}>
          {["#c5e8d5","#c5e8d5","#d5d5d5","#d5d5d5"].map((c,i)=>(
            <div key={i} style={{ flex:1, height:6, borderRadius:1, background:c }}/>
          ))}
        </div>
        {[1,2,3,4,5].map(i=>(
          <div key={i} style={{ display:"flex", gap:3, alignItems:"center" }}>
            {[i%2===0?"#b8d4c5":"#d0d0d0","#d0d0d0","#d0d0d0","#d0d0d0"].map((c,j)=>(
              <div key={j} style={{ flex:1, height:5, borderRadius:1, background:c }}/>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoCover() {
  return (
    <div style={{ width:"100%", height:120, borderRadius:"8px 8px 0 0", overflow:"hidden", position:"relative" }}>
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg, #edd5b0 0%, #c9a878 60%, #b8965e 100%)" }}/>
      <svg viewBox="0 0 200 140" width="100%" height="100%" style={{ position:"absolute", bottom:0, left:0 }}>
        <ellipse cx="90" cy="145" rx="45" ry="30" fill="#2d2d2d"/>
        <rect x="55" y="90" width="70" height="60" rx="8" fill="#1a1a1a"/>
        <rect x="82" y="78" width="16" height="18" rx="4" fill="#b07840"/>
        <ellipse cx="90" cy="68" rx="26" ry="30" fill="#b07840"/>
        <ellipse cx="64" cy="68" rx="5" ry="7" fill="#a06e38"/>
        <ellipse cx="116" cy="68" rx="5" ry="7" fill="#a06e38"/>
        <ellipse cx="90" cy="44" rx="34" ry="28" fill="#150a00"/>
        <ellipse cx="60" cy="52" rx="14" ry="18" fill="#150a00"/>
        <ellipse cx="120" cy="52" rx="14" ry="18" fill="#150a00"/>
        <ellipse cx="90" cy="30" rx="22" ry="14" fill="#1c0f00"/>
        <ellipse cx="80" cy="64" rx="4.5" ry="4" fill="#fff"/>
        <ellipse cx="80" cy="64" rx="3" ry="3" fill="#2d1800"/>
        <ellipse cx="100" cy="64" rx="4.5" ry="4" fill="#fff"/>
        <ellipse cx="100" cy="64" rx="3" ry="3" fill="#2d1800"/>
        <path d="M 73 57 Q 80 54 87 57" stroke="#1a0a00" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M 93 57 Q 100 54 107 57" stroke="#1a0a00" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M 87 70 Q 90 76 93 70" stroke="#8a5820" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        <path d="M 82 78 Q 90 84 98 78" stroke="#7a3820" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <ellipse cx="130" cy="85" rx="10" ry="25" fill="#b07840" transform="rotate(-25,130,85)"/>
        <ellipse cx="148" cy="68" rx="8" ry="7" fill="#b07840"/>
        <circle cx="158" cy="62" r="9" fill="#f0c060"/>
        <circle cx="158" cy="62" r="7" fill="#e8b848"/>
        {[152,157,163,155,161].map((x,i)=>(
          <circle key={i} cx={x} cy={[60,56,61,64,57][i]} r="1.5" fill="#7a4a10"/>
        ))}
      </svg>
    </div>
  );
}

export function CoverImage({ type }: { type: string }) {
  if (type==="dashboard") return <DashboardCover/>;
  if (type==="figma") return <FigmaCover/>;
  if (type==="photo") return <PhotoCover/>;
  if (type.startsWith("http") || type.startsWith("/")) {
    return (
      <div style={{ width:"100%", height:160, overflow:"hidden", borderBottom:"1px solid rgba(255,255,255,0.05)" }}>
        <img src={type} alt="Capa da Tarefa" style={{ width:"100%", height:"100%", objectFit:"cover", display:"block" }} />
      </div>
    );
  }
  return null;
}

// ─── Tag Badge ────────────────────────────────────────────────────────────────

export function TagBadge({ tag }: { tag: Tag }) {
  const s = TAG_STYLES[tag.color];
  return (
    <span style={{ background:s.bg, color:s.text, fontSize:10, fontWeight:500, padding:"2px 6px 2px 5px", borderRadius:4, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:4 }}>
      <span style={{ width:5, height:5, borderRadius:1.5, background:s.dot, flexShrink:0, display:"inline-block" }}/>
      {tag.label}
    </span>
  );
}

export function AddStatusBadge() {
  return (
    <span style={{ fontSize:10, color:"#555", padding:"2px 7px", border:"1px dashed #3a3a3a", borderRadius:4, display:"inline-flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }}>
      <span style={{ fontSize:11, lineHeight:1 }}>+</span>Adicionar Status
    </span>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────

export function TimerButton({ taskId, state: initialState, value: initialValue, timerSeconds: initialTimerSeconds = 0, onTimerChange }: { taskId: string, state:TimerState; value:string, timerSeconds?: number, onTimerChange?: (state: TimerState, value: string) => void }) {
  const [state, setState] = useState(initialState);
  const [seconds, setSeconds] = useState(initialTimerSeconds);

  useEffect(() => {
    setState(initialState);
    setSeconds(initialTimerSeconds);
  }, [initialState, initialTimerSeconds]);

  useEffect(() => {
    if (state === "running") {
      const interval = setInterval(() => {
        setSeconds(s => s + 1);
      }, 1000);
      return () => clearInterval(interval);
    }
    return undefined;
  }, [state]);

  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const displayValue = seconds > 0 
    ? (h > 0 ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
    : initialValue;

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (state === "running") {
      setState("idle");
      onTimerChange?.("idle", displayValue);
      try {
        const res = await API.post(`/api/tasks/${taskId}/timer/stop`, {});
        if (res.totalSeconds !== undefined) {
          setSeconds(res.totalSeconds);
        }
      } catch (err) {
        console.error("Failed to stop timer:", err);
      }
    } else {
      setState("running");
      onTimerChange?.("running", displayValue);
      try {
        await API.post(`/api/tasks/${taskId}/timer/start`, {});
      } catch (err) {
        console.error("Failed to start timer:", err);
      }
    }
  };

  if (state==="running") return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
      <button onClick={handleToggle} style={{ width:20, height:20, borderRadius:"50%", background:"#7C5AC2", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, padding:0 }}>
        <div style={{ display:"flex", gap:2 }}><div style={{ width:2, height:7, background:"#fff", borderRadius:1 }}/><div style={{ width:2, height:7, background:"#fff", borderRadius:1 }}/></div>
      </button>
      <span style={{ fontSize:11, color:"#7C5AC2", fontWeight:600, whiteSpace:"nowrap" }}>{displayValue}</span>
    </div>
  );
  if (state==="overtime") return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
      <button onClick={handleToggle} style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"1.5px solid #ef4444", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
        <div style={{ width:0, height:0, borderTop:"3.5px solid transparent", borderBottom:"3.5px solid transparent", borderLeft:"5.5px solid #ef4444", marginLeft:1 }}/>
      </button>
      <span style={{ fontSize:11, color:"#ef4444", fontWeight:600, whiteSpace:"nowrap" }}>{displayValue}</span>
    </div>
  );
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
      <button onClick={handleToggle} style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"1.5px solid #3a3a3a", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
        <div style={{ width:0, height:0, borderTop:"3.5px solid transparent", borderBottom:"3.5px solid transparent", borderLeft:"5px solid #4a4a4a", marginLeft:1 }}/>
      </button>
      <span style={{ fontSize:11, color:"#4a4a4a" }}>{displayValue}</span>
    </div>
  );
}

export function ProgressBar({ progress, state }: { progress:number; state:TimerState }) {
  const fill = state==="running" ? "#7C5AC2" : state==="overtime" ? "#ef4444" : "#3a3a3a";
  return (
    <div style={{ height:3, background:"#2a2a2a", borderRadius:2, overflow:"hidden", flex:1 }}>
      <div style={{ width:`${Math.min(progress,100)}%`, height:"100%", background:fill, borderRadius:2 }}/>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, ghost=false }: { task:Task; ghost?:boolean }) {
  const { drag, startDrag, cardRefs, justDropped, onCardClick, onDeleteClick } = useContext(DragContext);
  const [hovered, setHovered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const isDragging = drag?.taskId === task.id && drag.active;
  const isJustDropped = justDropped === task.id;

  // Register card ref for position detection
  useEffect(() => {
    if (cardRef.current) cardRefs.current.set(task.id, cardRef.current);
    return () => { cardRefs.current.delete(task.id); };
  }, [task.id, cardRefs]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    e.preventDefault();
    // Find which column this card belongs to
    const colEl = cardRef.current.closest("[data-colid]") as HTMLElement;
    const colId = colEl?.dataset.colid ?? "";
    startDrag(task.id, colId, e, cardRef.current);
  }, [task.id, startDrag]);

  if (isDragging && !ghost) return null; // floating card renders it instead

  const dropped = isJustDropped;

  return (
    <div
      ref={cardRef}
      onMouseDown={!ghost ? handleMouseDown : undefined}
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{
        background: ghost ? "rgba(124,90,194,0.06)" : "#2C2C2E",
        borderRadius:8,
        overflow: ghost ? "visible" : "hidden",
        boxShadow: ghost ? "none" : hovered ? "0 6px 20px rgba(0,0,0,0.45)" : "0 1px 3px rgba(0,0,0,0.3)",
        border: ghost ? "1.5px dashed rgba(124,90,194,0.5)" : "none",
        opacity: ghost ? 1 : 1,
        cursor: ghost ? "default" : "grab",
        userSelect: "none",
        transform: dropped ? "scale(1)" : undefined,
        animation: dropped ? "cardDrop 0.35s cubic-bezier(0.34,1.56,0.64,1)" : undefined,
        transition: ghost ? "none" : "box-shadow 0.15s, transform 0.15s",
        flexShrink: 0,
      }}
    >
      {ghost ? (
        <div style={{ height: task.coverImage==="dashboard" ? 186 : task.coverImage==="figma" ? 160 : task.coverImage==="photo" ? 170 : task.tags.length===0&&!task.title ? 120 : task.coverImage ? 160 : 80 }}/>
      ) : (
        <>
          {task.coverImage && <CoverImage type={task.coverImage}/>}
          <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
            <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:4 }}>
              <div style={{ display:"flex", flexWrap:"wrap", gap:4, flex:1, minWidth:0 }}>
                {task.showStatusBadge && <AddStatusBadge/>}
                {task.tags.map(tag=><TagBadge key={tag.label} tag={tag}/>)}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, marginTop:1 }}>
                {task.date && <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap" }}>{task.date}</span>}
                <div style={{ display:"flex", gap:2 }}>
                  <button
                    onMouseDown={e=>e.stopPropagation()}
                    onClick={e=>{ e.stopPropagation(); onCardClick(task); }}
                    style={{ background:"transparent", border:"none", cursor:"pointer", padding:2 }}
                    title="Abrir Tarefa"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: hovered ? 0.7 : 0.2, transition:"opacity 0.15s", color:"#888" }}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                  </button>
                  <button
                    onMouseDown={e=>e.stopPropagation()}
                    onClick={e=>{ e.stopPropagation(); onDeleteClick(task); }}
                    style={{ background:"transparent", border:"none", cursor:"pointer", padding:2 }}
                    title="Excluir Tarefa"
                  >
                    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: hovered ? 0.7 : 0.2, transition:"opacity 0.15s" }}>
                      <path d="M2 4h12M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4M6 7v5M10 7v5M3 4l.9 9a1.5 1.5 0 001.5 1.35h5.2A1.5 1.5 0 0012.1 13L13 4" stroke="#ef4444" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            </div>
            {task.title && <div style={{ fontSize:13, fontWeight:500, color:"#dfdfdf", lineHeight:1.45 }}>{task.title}</div>}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
                {Array.isArray(task.assignees) ? (
                  <AvatarCluster assignees={task.assignees} size={20}/>
                ) : task.assignees > 0 ? (
                  <AvatarCluster count={task.assignees} size={20}/>
                ) : null}
                {task.addAssignee && <button style={{ width:20, height:20, borderRadius:"50%", border:"1.5px dashed #3a3a3a", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#555", fontSize:13 }}>+</button>}
                {task.attachments!=null && (
                  <div style={{ display:"flex", alignItems:"center", gap:2, fontSize:11 }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M13 7L8 12C6.5 13.5 4.5 13.5 3 12C1.5 10.5 1.5 8.5 3 7L8 2C9 1 10.5 1 11.5 2C12.5 3 12.5 4.5 11.5 5.5L7 10C6.5 10.5 5.5 10.5 5 10C4.5 9.5 4.5 8.5 5 8L9 4" stroke="#666" strokeWidth="1.3" strokeLinecap="round"/></svg>
                    <span style={{ color:"#666" }}>{task.attachments}</span>
                  </div>
                )}
                {task.comments!=null && (
                  <div style={{ display:"flex", alignItems:"center", gap:2, fontSize:11 }}>
                    <svg width="10" height="10" viewBox="0 0 16 16" fill="none"><path d="M14 9.5C14 10.33 13.33 11 12.5 11H5L2 14V3.5C2 2.67 2.67 2 3.5 2H12.5C13.33 2 14 2.67 14 3.5V9.5Z" stroke="#666" strokeWidth="1.3" strokeLinejoin="round"/></svg>
                    <span style={{ color:"#666" }}>{task.comments}</span>
                  </div>
                )}
              </div>
              <TimerButton taskId={task.id} state={task.timerState} value={task.timerValue} timerSeconds={task.timerSeconds} />
            </div>
            {task.estTime && (
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <ProgressBar progress={task.progress} state={task.timerState}/>
                <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap", flexShrink:0 }}>{task.estTime}</span>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Floating Dragged Card ────────────────────────────────────────────────────

function FloatingCard({ drag, task }: { drag: DragState; task: Task }) {
  const x = drag.mouseX - drag.offsetX;
  const y = drag.mouseY - drag.offsetY;
  return (
    <div style={{
      position:"fixed", left:x, top:y, width:drag.cardW, zIndex:9999,
      pointerEvents:"none",
      transform:"rotate(-2.5deg) scale(1.03)",
      boxShadow:"0 28px 64px rgba(0,0,0,0.75), 0 8px 20px rgba(124,90,194,0.2)",
      borderRadius:8, overflow:"hidden", background:"#2C2C2E",
      filter:"brightness(1.06)",
      transition:"box-shadow 0.1s",
    }}>
      {task.coverImage && <CoverImage type={task.coverImage}/>}
      <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:4 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, flex:1, minWidth:0 }}>
            {task.showStatusBadge && <AddStatusBadge/>}
            {task.tags.map(tag=><TagBadge key={tag.label} tag={tag}/>)}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, marginTop:1 }}>
            {task.date && <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap" }}>{task.date}</span>}
          </div>
        </div>
        {task.title && <div style={{ fontSize:13, fontWeight:500, color:"#dfdfdf", lineHeight:1.45 }}>{task.title}</div>}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, flex:1 }}>
            {Array.isArray(task.assignees) ? (
              <AvatarCluster assignees={task.assignees} size={20}/>
            ) : task.assignees > 0 ? (
              <AvatarCluster count={task.assignees} size={20}/>
            ) : null}
          </div>
          <TimerButton taskId={task.id} state={task.timerState} value={task.timerValue} timerSeconds={task.timerSeconds} />
        </div>
        {task.estTime && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <ProgressBar progress={task.progress} state={task.timerState}/>
            <span style={{ fontSize:10, color:"#555", whiteSpace:"nowrap", flexShrink:0 }}>{task.estTime}</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Drop Zone Placeholder ────────────────────────────────────────────────────

function DropZone({ height }: { height: number }) {
  return (
    <div style={{
      height: Math.max(height, 60),
      borderRadius:8,
      border:"2px solid rgba(124,90,194,0.6)",
      background:"rgba(124,90,194,0.07)",
      boxShadow:"0 0 0 4px rgba(124,90,194,0.07), inset 0 0 12px rgba(124,90,194,0.04)",
      animation:"dropZonePulse 1.5s ease-in-out infinite",
      flexShrink:0,
      transition:"height 0.15s ease",
    }}/>
  );
}

// ─── Rename Column Modal ──────────────────────────────────────────────────────

export function RenameColumnModal({ colTitle, onConfirm, onClose }: { colTitle: string; onConfirm: (name: string) => void; onClose: () => void }) {
  const [value, setValue] = useState(colTitle);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setTimeout(() => inputRef.current?.select(), 50);
  }, []);

  const handleConfirm = () => {
    const trimmed = value.trim();
    if (trimmed && trimmed !== colTitle) onConfirm(trimmed);
    else onClose();
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleConfirm();
    if (e.key === "Escape") onClose();
  };

  return (
    <div
      style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", backdropFilter:"blur(6px)", zIndex:200000, display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.15s ease" }}
      onClick={e => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ width:360, background:"linear-gradient(145deg,#1e1e28,#17171f)", borderRadius:14, border:"1px solid rgba(124,90,194,0.25)", padding:"28px 28px 22px", boxShadow:"0 32px 80px rgba(0,0,0,0.85), 0 0 0 1px rgba(255,255,255,0.04)", animation:"slideUp 0.2s cubic-bezier(0.34,1.4,0.64,1)" }}>
        {/* Header */}
        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:20 }}>
          <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,rgba(124,90,194,0.25),rgba(124,90,194,0.08))", border:"1px solid rgba(124,90,194,0.3)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
          </div>
          <div>
            <h3 style={{ margin:0, fontSize:15, fontWeight:700, color:"#f0f0f4", letterSpacing:"-0.2px" }}>Renomear etapa</h3>
            <p style={{ margin:"2px 0 0", fontSize:12, color:"#666" }}>Insira o novo nome para esta coluna</p>
          </div>
        </div>

        {/* Input */}
        <div style={{ position:"relative", marginBottom:20 }}>
          <input
            ref={inputRef}
            value={value}
            onChange={e => setValue(e.target.value)}
            onKeyDown={handleKey}
            maxLength={60}
            style={{
              width:"100%", boxSizing:"border-box",
              padding:"11px 14px",
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(124,90,194,0.35)",
              borderRadius:9,
              color:"#f0f0f4",
              fontSize:14,
              fontWeight:500,
              outline:"none",
              transition:"border-color 0.2s, box-shadow 0.2s",
              fontFamily:"inherit",
            }}
            onFocus={e => { e.currentTarget.style.borderColor = "rgba(124,90,194,0.7)"; e.currentTarget.style.boxShadow = "0 0 0 3px rgba(124,90,194,0.12)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "rgba(124,90,194,0.35)"; e.currentTarget.style.boxShadow = "none"; }}
          />
          <span style={{ position:"absolute", right:12, bottom:12, fontSize:11, color:"#3a3a4a" }}>{value.length}/60</span>
        </div>

        {/* Actions */}
        <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
          <button
            onClick={onClose}
            style={{ padding:"9px 18px", borderRadius:8, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#888", fontSize:13, cursor:"pointer", fontWeight:500, transition:"all 0.15s", fontFamily:"inherit" }}
            onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.05)"; e.currentTarget.style.color = "#bbb"; }}
            onMouseLeave={e => { e.currentTarget.style.background = "transparent"; e.currentTarget.style.color = "#888"; }}
          >
            Cancelar
          </button>
          <button
            onClick={handleConfirm}
            disabled={!value.trim()}
            style={{ padding:"9px 20px", borderRadius:8, background:"linear-gradient(135deg,#7C5AC2,#6044a8)", border:"none", color:"#fff", fontSize:13, cursor:"pointer", fontWeight:600, transition:"all 0.15s", fontFamily:"inherit", boxShadow:"0 4px 14px rgba(124,90,194,0.35)", opacity: value.trim() ? 1 : 0.5 }}
            onMouseEnter={e => { if (value.trim()) { e.currentTarget.style.background = "linear-gradient(135deg,#8b6bd4,#7C5AC2)"; e.currentTarget.style.transform = "translateY(-1px)"; }}}
            onMouseLeave={e => { e.currentTarget.style.background = "linear-gradient(135deg,#7C5AC2,#6044a8)"; e.currentTarget.style.transform = ""; }}
          >
            Salvar nome
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({ col, onTaskCreated }: { col: Column; onTaskCreated?: (task: Task, colId: string) => void }) {
  const { drag, colRefs, loadBoard } = useContext(DragContext);
  const { activeProject } = useContext(AppContext);
  const { token } = useAuth();
  const colRef = useRef<HTMLDivElement>(null);
  const [showRename, setShowRename] = useState(false);
  const [quickAdd, setQuickAdd] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const quickInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (quickAdd) setTimeout(() => quickInputRef.current?.focus(), 30);
  }, [quickAdd]);

  useEffect(() => {
    if (colRef.current) colRefs.current.set(col.id, colRef.current);
    return () => { colRefs.current.delete(col.id); };
  }, [col.id, colRefs]);

  const handleAddCard = () => {
    setQuickTitle("");
    setQuickAdd(true);
  };

  const handleQuickSave = async () => {
    const title = quickTitle.trim();
    setQuickAdd(false);
    setQuickTitle("");
    if (!title || !activeProject) return;
    try {
      const res = await fetch(`${API}/api/projects/${activeProject.id}/tasks`, {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ columnId: col.id, title, priority: "normal" })
      });
      const data = await res.json();
      if (data.task && onTaskCreated) {
        onTaskCreated({
          id: data.task.id,
          title,
          tags: [],
          assignees: 0,
          timerState: "idle",
          timerValue: "00:00",
          progress: 0,
          estTime: ""
        }, col.id);
      }
    } catch (err) { console.error(err); }
  };

  const handleQuickKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleQuickSave(); }
    if (e.key === "Escape") { setQuickAdd(false); setQuickTitle(""); }
  };

  const handleRenameConfirm = async (newTitle: string) => {
    setShowRename(false);
    if (!activeProject) return;
    try {
      await fetch(`${API}/api/projects/${activeProject.id}/columns/${col.id}`, {
        method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: newTitle })
      });
      loadBoard();
    } catch (err) { console.error(err); }
  };

  const isTarget = drag?.active && drag.targetColId === col.id;

  // Build card list with ghost + drop zone inserted
  const renderedTasks = col.tasks;
  const items: React.ReactNode[] = [];

  renderedTasks.forEach((task, idx) => {
    const isGhost = drag?.active && drag.taskId === task.id && drag.sourceColId === col.id;

    // Insert drop zone BEFORE this card if it's the target index in target col
    if (isTarget && drag!.targetIndex === idx) {
      items.push(<DropZone key="dropzone" height={drag!.cardH}/>);
    }

    if (isGhost) {
      items.push(<TaskCard key={task.id} task={task} ghost={true}/>);
    } else {
      items.push(<TaskCard key={task.id} task={task}/>);
    }
  });

  // Drop zone at end
  if (isTarget && drag!.targetIndex >= renderedTasks.length) {
    items.push(<DropZone key="dropzone-end" height={drag!.cardH}/>);
  }

  // Empty column drop zone
  if (isTarget && renderedTasks.length === 0) {
    items.push(<DropZone key="dropzone-empty" height={80}/>);
  }

  return (
    <>
      <div
        ref={colRef}
        data-colid={col.id}
        style={{ minWidth:220, width:220, display:"flex", flexDirection:"column", gap:10, flexShrink:0, transition:"background 0.2s", borderRadius:10, padding:isTarget ? "6px" : "0", background: isTarget ? "rgba(124,90,194,0.04)" : "transparent" }}
      >
        <div style={{ display:"flex", alignItems:"center", gap:6, padding: isTarget ? "0 2px 6px" : "0 2px 6px", paddingTop: isTarget ? 2 : 0 }}>
          <span style={{ fontSize:13, fontWeight:600, color:"#d0d0d4" }}>{col.title}</span>
          <span style={{ fontSize:11, color:"#505058" }}>{col.tasks.length} Tarefas</span>
          <div style={{ flex:1 }}/>
          <button onClick={handleAddCard} style={{ background:"transparent", border:"none", color:"#505058", cursor:"pointer", fontSize:16, lineHeight:1, transition:"color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#888"} onMouseLeave={e=>e.currentTarget.style.color="#505058"} title="Criar Nova Tarefa">+</button>
          <button onClick={() => setShowRename(true)} style={{ background:"transparent", border:"none", color:"#505058", cursor:"pointer", letterSpacing:1, fontSize:13, transition:"color 0.15s" }} onMouseEnter={e=>e.currentTarget.style.color="#888"} onMouseLeave={e=>e.currentTarget.style.color="#505058"} title="Editar Etapa">···</button>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
          {items}
          {quickAdd && (
            <div style={{
              background: "#2C2C2E", borderRadius: 8, padding: "10px 12px",
              border: "1.5px solid rgba(124,90,194,0.5)",
              boxShadow: "0 0 0 3px rgba(124,90,194,0.1)",
              display: "flex", flexDirection: "column", gap: 8,
            }}>
              <input
                ref={quickInputRef}
                value={quickTitle}
                onChange={e => setQuickTitle(e.target.value)}
                onKeyDown={handleQuickKeyDown}
                onBlur={() => { if (!quickTitle.trim()) { setQuickAdd(false); setQuickTitle(""); } else handleQuickSave(); }}
                placeholder="Nome da tarefa..."
                style={{
                  background: "transparent", border: "none", outline: "none",
                  color: "#dfdfdf", fontSize: 13, fontWeight: 500,
                  fontFamily: "inherit", width: "100%", lineHeight: 1.4,
                }}
              />
              <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <button
                  onMouseDown={e => { e.preventDefault(); handleQuickSave(); }}
                  style={{ padding: "4px 12px", borderRadius: 6, background: "linear-gradient(135deg,#7C5AC2,#6044a8)", border: "none", color: "#fff", fontSize: 11, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
                >Criar</button>
                <button
                  onMouseDown={e => { e.preventDefault(); setQuickAdd(false); setQuickTitle(""); }}
                  style={{ padding: "4px 10px", borderRadius: 6, background: "transparent", border: "1px solid rgba(255,255,255,0.1)", color: "#777", fontSize: 11, cursor: "pointer", fontFamily: "inherit" }}
                >Esc</button>
                <span style={{ fontSize: 10, color: "#444", marginLeft: "auto" }}>Enter para salvar</span>
              </div>
            </div>
          )}
        </div>
      </div>
      {showRename && (
        <RenameColumnModal
          colTitle={col.title}
          onConfirm={handleRenameConfirm}
          onClose={() => setShowRename(false)}
        />
      )}
    </>
  );
}

// ─── Drag Engine ──────────────────────────────────────────────────────────────

function findTask(taskId: string): Task | null {
  for (const col of INITIAL_COLUMNS) {
    const t = col.tasks.find(t=>t.id===taskId);
    if (t) return t;
  }
  return null;
}

function moveTask(columns: Column[], taskId: string, srcColId: string, tgtColId: string, tgtIdx: number): Column[] {
  const task = columns.flatMap(c=>c.tasks).find(t=>t.id===taskId);
  if (!task) return columns;
  return columns.map(col => {
    if (col.id===srcColId && col.id===tgtColId) {
      const tasks = col.tasks.filter(t=>t.id!==taskId);
      const adjIdx = Math.min(Math.max(tgtIdx, 0), tasks.length);
      tasks.splice(adjIdx, 0, task);
      return { ...col, tasks };
    }
    if (col.id===srcColId) return { ...col, tasks: col.tasks.filter(t=>t.id!==taskId) };
    if (col.id===tgtColId) {
      const tasks = [...col.tasks];
      const adjIdx = Math.min(Math.max(tgtIdx, 0), tasks.length);
      tasks.splice(adjIdx, 0, task);
      return { ...col, tasks };
    }
    return col;
  });
}



// ─── Board ────────────────────────────────────────────────────────────────────

function Board() {
  const { activeProject } = useContext(AppContext);
  const { token } = useAuth();
  const [columns, setColumns] = useState<Column[]>([]);
  const [loadingBoard, setLoadingBoard] = useState(false);
  const [showLoader, setShowLoader] = useState(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null);
  const [selectedTask, setSelectedTask] = useState<{ task: Task; colId: string } | null>(null);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const colRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

  const loadBoard = async () => {
    if (!activeProject) return;
    setLoadingBoard(true);
    setShowLoader(true);
    try {
      const res = await fetch(`${API}/api/projects/${activeProject.id}/board`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.columns) {
        const allTasks = data.columns.flatMap((c: any) => c.tasks);
        const timerResponses = await Promise.all(allTasks.map((t: any) => 
          fetch(`${API}/api/tasks/${t.id}/timer`, {
            headers: { Authorization: `Bearer ${token}` }
          }).then(r => r.json().catch(() => ({}))).catch(() => ({}))
        ));
        
        const timerDataMap = new Map(allTasks.map((t: any, i: number) => [t.id, timerResponses[i]]));

        const mappedColumns = data.columns.map((c: any) => ({
          id: c.id,
          title: c.title,
          tasks: c.tasks.map((t: any) => {
            const progress = t.subtaskCount > 0 ? Math.round((t.subtaskCompletedCount / t.subtaskCount) * 100) : 0;
            const timerInfo: any = timerDataMap.get(t.id);
            const totalSeconds = timerInfo?.totalSeconds || 0;
            const h = Math.floor(totalSeconds / 3600);
            const m = Math.floor((totalSeconds % 3600) / 60);
            const s = totalSeconds % 60;
            const timerValue = totalSeconds > 0 
              ? (h > 0 ? `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}` : `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`)
              : "00:00";
            
            return {
              id: t.id,
              title: t.title,
              tags: t.tags.map((tag: any) => ({ label: tag.label, color: tag.color })),
              date: t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : undefined,
              assignees: t.assignees,
              timerState: timerInfo?.running ? "running" : "idle",
              timerValue,
              progress,
              estTime: t.estimatedHours ? `${t.estimatedHours}h` : "",
              coverImage: t.coverImageUrl,
              timerSeconds: totalSeconds,
            };
          })
        }));
        setColumns(mappedColumns);
      }
    } catch (err) {
      console.error("Error loading board:", err);
    } finally {
      setLoadingBoard(false);
      setTimeout(() => setShowLoader(false), 500);
    }
  };

  useEffect(() => {
    loadBoard();
  }, [activeProject, token]);

  const onCardClick = useCallback((task: Task) => {
    const colId = columnsRef.current.find(c=>c.tasks.some(t=>t.id===task.id))?.id ?? "untitled";
    setSelectedTask({ task, colId });
  }, []);

  const handleTaskCreated = useCallback((task: Task, colId: string) => {
    // Optimistic update: insert card directly into local state — NO modal, NO reload
    setColumns(prev => prev.map(col =>
      col.id === colId
        ? { ...col, tasks: [...col.tasks, task] }
        : col
    ));
    // Silent background sync (no spinner, no flash)
    if (activeProject) {
      fetch(`${API}/api/projects/${activeProject.id}/board`, {
        headers: { Authorization: `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(data => {
          if (data.columns) {
            setColumns(data.columns.map((c: any) => ({
              id: c.id, title: c.title,
              tasks: c.tasks.map((t: any) => ({
                id: t.id, title: t.title,
                tags: t.tags.map((tag: any) => ({ label: tag.label, color: tag.color })),
                date: t.dueDate ? new Date(t.dueDate).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short' }) : undefined,
                assignees: t.assignees,
                timerState: "idle", timerValue: "00:00", progress: 0,
                estTime: t.estimatedHours ? `${t.estimatedHours}h` : "",
                coverImage: t.coverImageUrl
              }))
            })));
          }
        })
        .catch(() => {}); // silently ignore
    }
  }, [activeProject, token]);

  const onDeleteClick = useCallback((task: Task) => {
    setTaskToDelete(task);
  }, []);

  const startDrag = useCallback((taskId: string, sourceColId: string, e: React.MouseEvent, cardEl: HTMLElement) => {
    e.preventDefault();
    const rect = cardEl.getBoundingClientRect();
    const state: DragState = {
      taskId, sourceColId,
      targetColId: sourceColId,
      targetIndex: 0,
      mouseX: e.clientX, mouseY: e.clientY,
      startMouseX: e.clientX, startMouseY: e.clientY,
      offsetX: e.clientX - rect.left, offsetY: e.clientY - rect.top,
      cardW: rect.width, cardH: rect.height,
      active: false,
    };
    dragRef.current = state;
    setDrag(state);
  }, []);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const d = dragRef.current;
      if (!d) return;
      const dx = e.clientX - d.startMouseX;
      const dy = e.clientY - d.startMouseY;
      const wasActive = d.active;
      const nowActive = wasActive || Math.abs(dx)>4 || Math.abs(dy)>4;

      // Detect target column
      let targetColId = d.sourceColId;
      let targetIndex = 0;

      for (const [colId, colEl] of colRefs.current) {
        const rect = colEl.getBoundingClientRect();
        if (e.clientX >= rect.left && e.clientX <= rect.right && e.clientY >= rect.top-10 && e.clientY <= rect.bottom+10) {
          targetColId = colId;
          // Find insertion index by checking card midpoints
          const col = columnsRef.current.find(c=>c.id===colId);
          if (col) {
            let idx = col.tasks.length;
            for (let i=0; i<col.tasks.length; i++) {
              const task = col.tasks[i];
              if (task.id === d.taskId) continue; // skip ghost
              const cardEl = cardRefs.current.get(task.id);
              if (cardEl) {
                const cr = cardEl.getBoundingClientRect();
                if (e.clientY < cr.top + cr.height/2) { idx = i; break; }
              }
            }
            targetIndex = idx;
          }
          break;
        }
      }

      const updated: DragState = { ...d, mouseX:e.clientX, mouseY:e.clientY, active:nowActive, targetColId, targetIndex };
      dragRef.current = updated;
      setDrag({ ...updated });
    };

    const handleUp = async () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.active) {
        const newCols = moveTask(columnsRef.current, d.taskId, d.sourceColId, d.targetColId, d.targetIndex);
        setColumns(newCols);
        setJustDropped(d.taskId);
        setTimeout(()=>setJustDropped(null), 500);

        if (activeProject) {
          try {
            await fetch(`${API}/api/projects/${activeProject.id}/tasks/${d.taskId}/move`, {
              method: "POST",
              headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
              body: JSON.stringify({ targetColumnId: d.targetColId, targetIndex: d.targetIndex })
            });
          } catch (e) {
            console.error("Erro ao mover task:", e);
          }
        }
      } else {
        // Simple click — open modal
        const task = columnsRef.current.flatMap(c=>c.tasks).find(t=>t.id===d.taskId);
        if (task) {
          const colId = columnsRef.current.find(c=>c.tasks.some(t=>t.id===task.id))?.id ?? "untitled";
          setSelectedTask({ task, colId });
        }
      }
      dragRef.current = null;
      setDrag(null);
      document.body.style.cursor = "";
    };

    document.addEventListener("mousemove", handleMove, { passive:true });
    document.addEventListener("mouseup", handleUp);
    return () => {
      document.removeEventListener("mousemove", handleMove);
      document.removeEventListener("mouseup", handleUp);
    };
  }, []);

  // Change cursor during drag
  useEffect(() => {
    if (drag?.active) document.body.style.cursor = "grabbing";
    else document.body.style.cursor = "";
  }, [drag?.active]);

  const allTasks = columns.flatMap(c=>c.tasks);
  const dragTask = drag ? allTasks.find(t=>t.id===drag.taskId) ?? findTask(drag.taskId) : null;

  return (
    <DragContext.Provider value={{ drag, startDrag, colRefs, cardRefs, justDropped, onCardClick, onDeleteClick, loadBoard }}>
      <div
        style={{ flex:1, overflowX:"auto", overflowY:"auto", padding:"18px 20px", display:"flex", gap:16, alignItems:"flex-start", background:"#111111", position:"relative" }}
        onMouseLeave={()=>{}}
      >
        {showLoader ? (
          <div style={{ flex: 1, display: "flex", minHeight: 300 }}>
            <Loader isReady={!loadingBoard} onFinish={() => setShowLoader(false)} />
          </div>
        ) : columns.length === 0 ? (
          <div style={{ color: "#888", fontSize: 14, margin: "auto" }}>Nenhuma etapa neste projeto.</div>
        ) : (
          columns.map(col=><BoardColumn key={col.id} col={col} onTaskCreated={handleTaskCreated} />)
        )}
        {drag?.active && dragTask && <FloatingCard drag={drag} task={dragTask}/>}
      </div>
      {selectedTask && (
        <TaskModal
          task={selectedTask.task}
          colId={selectedTask.colId}
          onClose={()=>setSelectedTask(null)}
          onSave={loadBoard}
        />
      )}
      {taskToDelete && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.8)", backdropFilter:"blur(5px)", zIndex:100000, display:"flex", alignItems:"center", justifyContent:"center", animation:"fadeIn 0.15s ease" }}>
          <div style={{ width:380, background:"#1e1e22", borderRadius:12, border:"1px solid rgba(255,255,255,0.1)", padding:"24px", boxShadow:"0 20px 60px rgba(0,0,0,0.8)", animation:"slideUp 0.2s ease" }}>
            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:16 }}>
              <div style={{ width:40, height:40, borderRadius:"50%", background:"rgba(239,68,68,0.1)", display:"flex", alignItems:"center", justifyContent:"center", color:"#ef4444" }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
              </div>
              <div>
                <h3 style={{ margin:0, fontSize:16, color:"#f0f0f0", fontWeight:600 }}>Excluir Tarefa</h3>
              </div>
            </div>
            <p style={{ margin:"0 0 24px 0", fontSize:13, color:"#aaa", lineHeight:1.5 }}>
              Tem certeza que deseja excluir permanentemente esta tarefa? Essa ação não pode ser desfeita e todos os dados serão perdidos.
            </p>
            <div style={{ display:"flex", justifyContent:"flex-end", gap:10 }}>
              <button onClick={() => setTaskToDelete(null)} style={{ padding:"8px 16px", borderRadius:6, background:"transparent", border:"1px solid rgba(255,255,255,0.1)", color:"#ccc", fontSize:13, cursor:"pointer", fontWeight:500 }}>Cancelar</button>
              <button onClick={async () => {
                  if (!activeProject) return;
                  try {
                    await fetch(`${API}/api/projects/${activeProject.id}/tasks/${taskToDelete.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } });
                    setTaskToDelete(null);
                    loadBoard();
                  } catch (e) { console.error(e); }
              }} style={{ padding:"8px 16px", borderRadius:6, background:"#ef4444", border:"none", color:"#fff", fontSize:13, cursor:"pointer", fontWeight:600 }}>Sim, Excluir</button>
            </div>
          </div>
        </div>
      )}
    </DragContext.Provider>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon:"home", label:"Início" }, { icon:"dashboard", label:"Painel" },
  { icon:"projects", label:"Projetos" }, { icon:"tasks", label:"Minhas Tarefas" },
  { icon:"members", label:"Membros" }, { icon:"finance", label:"Financeiro" },
  { icon:"goals", label:"Metas" }, { icon:"settings", label:"Configurações" },
];
const PROJECT_ITEMS = [
  { name:"Apvision", color:"#6366F1" }, { name:"AlertSec", color:"#3B82F6" },
  { name:"Bomani Cold Buzz", color:"#F59E0B" }, { name:"Danyon", color:"#EC4899" },
  { name:"JB Consulting", color:"#10B981" }, { name:"My Choice Software", color:"#8B5CF6" },
  { name:"StrataScratch", color:"#14B8A6" }, { name:"Wake Up Coffee", color:"#F97316" },
];

function NavIcon({ icon }: { icon:string }) {
  const d: Record<string, React.ReactNode> = {
    home:<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    dashboard:<><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    projects:<path d="M4 6h16M4 10h12M4 14h8M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
    tasks:<><path d="M9 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    members:<><circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 8a3 3 0 010 6M21 20c0-2.5-1.8-4.6-4-5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    finance:<><line x1="12" y1="1" x2="12" y2="23" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
    goals:<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    settings:<><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  };
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>{d[icon]}</svg>;
}

function Sidebar() {
  const [location, navigate] = useLocation();
  const [projOpen, setProjOpen] = useState(true);
  const [hovNav, setHovNav] = useState<string|null>(null);
  const [editProject, setEditProject] = useState<AppProject|null>(null);
  const [showNewProject, setShowNewProject] = useState(false);
  const ctx = useContext(AppContext);
  const { sidebarOpen, setSidebarOpen, sidebarModule, activeProject, setActiveProject, projects, refreshProjects, setActiveTab } = ctx;
  const w = sidebarOpen ? 200 : 52;

  const handleNavClick = (label: string) => {
    if (label === "Início") navigate("/");
    else if (label === "Painel") navigate("/painel");
    else if (label === "Minhas Tarefas") navigate("/minhas-tarefas");
    else if (label === "Membros") navigate("/membros");
    else if (label === "Financeiro") navigate("/financeiro");
    else if (label === "Metas") navigate("/metas");
    else if (label === "Configurações") navigate("/configuracoes");
    else if (label === "Projetos") navigate("/projetos");
  };

  const handleProjectClick = (p: AppProject) => {
    navigate(`/projetos/${p.id}/quadros`);
  };

  return (
    <>
    <div style={{ width:w, minWidth:w, height:"100%", background:"#1A1A1A", borderRight:"1px solid #252525", display:"flex", flexDirection:"column", overflowY:"auto", overflowX:"hidden", flexShrink:0, transition:"width 0.2s ease" }}>
      {/* Logo + toggle */}
      <div style={{ display:"flex", alignItems:"center", justifyContent: sidebarOpen ? "space-between" : "center", padding: sidebarOpen ? "14px 14px 10px" : "14px 0 10px" }}>
        {sidebarOpen && (
          <div style={{ display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:28, height:28, background:"linear-gradient(135deg,#4f2d8a,#7C5AC2)", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", color:"#fff" }}><Zap size={15} fill="currentColor" /></div>
            <span style={{ fontSize:14, fontWeight:700, color:"#f0f0f0", letterSpacing:"-0.3px" }}>Teltech</span>
          </div>
        )}
        <button onClick={() => setSidebarOpen(!sidebarOpen)} style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", padding:4, borderRadius:6, display:"flex", alignItems:"center", justifyContent:"center" }}
          onMouseEnter={e=>e.currentTarget.style.color="#bbb"} onMouseLeave={e=>e.currentTarget.style.color="#555"}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ padding: sidebarOpen ? "4px 6px" : "4px 6px" }}>
        {NAV_ITEMS.map(item => {
          const isActive = sidebarModule === item.label || (item.label === "Projetos" && sidebarModule === "project");
          return (
            <div key={item.label} onMouseEnter={()=>setHovNav(item.label)} onMouseLeave={()=>setHovNav(null)}
              onClick={() => handleNavClick(item.label)}
              title={!sidebarOpen ? item.label : undefined}
              style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 8px", color: isActive?"#e0e0e4": hovNav===item.label?"#c4c4c8":"#666", cursor:"pointer", fontSize:13, borderRadius:6, background: isActive?"#2a2a2e": hovNav===item.label?"#242424":"transparent", transition:"all 0.12s", fontWeight: isActive?600:400, justifyContent: sidebarOpen ? "flex-start" : "center" }}>
              <NavIcon icon={item.icon}/>{sidebarOpen && <span>{item.label}</span>}
            </div>
          );
        })}
      </nav>

      {/* Projects section */}
      <div style={{ height:8 }}/>
      <div style={{ padding: sidebarOpen ? "0 6px" : "0", flex:1, display:"flex", flexDirection:"column", alignItems: sidebarOpen ? "stretch" : "center", gap: 4 }}>
        {sidebarOpen ? (
          <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px" }}>
            <span style={{ fontSize:11, fontWeight:600, color:"#555", letterSpacing:"0.04em" }}>Projetos</span>
            <div style={{ display:"flex", gap:4 }}>
              <button onClick={() => setShowNewProject(true)} style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", fontSize:15, lineHeight:1 }} title="Novo Projeto">+</button>
              <button onClick={()=>setProjOpen(!projOpen)} style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer" }}>
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: projOpen?"rotate(0)":"rotate(-90deg)", transition:"0.2s" }}><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        ) : (
          <div style={{ width: "100%", height: 1, background: "#252525", margin: "8px 0" }} />
        )}

        {projOpen && (
          <>
            {/* Favoritos */}
            {sidebarOpen && projects.some((p: any) => p.isFavorite) && (
              <div style={{ fontSize:10, fontWeight:700, color:"#444", letterSpacing:"0.08em", padding:"4px 8px", marginTop:4 }}>FAVORITOS</div>
            )}
            {projects.filter((p: any) => p.isFavorite).map(proj => {
              const isActive = activeProject?.id === proj.id && sidebarModule === "project";
              return (
                <div key={proj.id} title={!sidebarOpen ? proj.name : undefined}
                  onClick={() => handleProjectClick(proj)}
                  style={{ display:"flex", alignItems:"center", justifyContent: sidebarOpen ? "flex-start" : "center", gap:8, padding: sidebarOpen ? "5px 8px" : "6px", borderRadius:6, cursor:"pointer", fontSize:12, color: isActive ? "#e0e0e0" : "#777", background: isActive ? "#242424" : "transparent", transition:"all 0.12s" }}
                  onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background="#1e1e1e"; e.currentTarget.style.color="#bbb"; }}}
                  onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#777"; }}}>
                  <div style={{ width: sidebarOpen ? 18 : 24, height: sidebarOpen ? 18 : 24, borderRadius:5, background: proj.icon ? `url(${proj.icon}) center/cover` : proj.color, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize: sidebarOpen ? 9 : 12, fontWeight:700, color:"rgba(255,255,255,0.9)" }}>{!proj.icon && proj.name[0]}</div>
                  {sidebarOpen && (
                    <>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{proj.name}</span>
                      <button onClick={e => { e.stopPropagation(); setEditProject(proj); }}
                        title="Configurações do projeto"
                        style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", padding:2, display:"flex", alignItems:"center", opacity:0.6, transition:"all 0.15s" }}
                        onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.color="#e0e0e0"; }}
                        onMouseLeave={e=>{ e.currentTarget.style.opacity="0.6"; e.currentTarget.style.color="#555"; }}>
                        <Settings size={13} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}

            {/* Outros */}
            {sidebarOpen && projects.some((p: any) => !p.isFavorite) && (
              <div style={{ fontSize:10, fontWeight:700, color:"#444", letterSpacing:"0.08em", padding:"4px 8px", marginTop:8 }}>GERAL</div>
            )}
            {projects.filter((p: any) => !p.isFavorite).map(proj => {
              const isActive = activeProject?.id === proj.id && sidebarModule === "project";
              return (
                <div key={proj.id} title={!sidebarOpen ? proj.name : undefined}
                  onClick={() => handleProjectClick(proj)}
                  style={{ display:"flex", alignItems:"center", justifyContent: sidebarOpen ? "flex-start" : "center", gap:8, padding: sidebarOpen ? "5px 8px" : "6px", borderRadius:6, cursor:"pointer", fontSize:12, color: isActive ? "#e0e0e0" : "#777", background: isActive ? "#242424" : "transparent", transition:"all 0.12s" }}
                  onMouseEnter={e=>{ if(!isActive){ e.currentTarget.style.background="#1e1e1e"; e.currentTarget.style.color="#bbb"; }}}
                  onMouseLeave={e=>{ if(!isActive){ e.currentTarget.style.background="transparent"; e.currentTarget.style.color="#777"; }}}>
                  <div style={{ width: sidebarOpen ? 18 : 24, height: sidebarOpen ? 18 : 24, borderRadius:5, background: proj.icon ? `url(${proj.icon}) center/cover` : proj.color, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize: sidebarOpen ? 9 : 12, fontWeight:700, color:"rgba(255,255,255,0.9)" }}>{!proj.icon && proj.name[0]}</div>
                  {sidebarOpen && (
                    <>
                      <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap", flex:1 }}>{proj.name}</span>
                      <button onClick={e => { e.stopPropagation(); setEditProject(proj); }}
                        title="Configurações do projeto"
                        style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", padding:2, display:"flex", alignItems:"center", opacity:0.6, transition:"all 0.15s" }}
                        onMouseEnter={e=>{ e.currentTarget.style.opacity="1"; e.currentTarget.style.color="#e0e0e0"; }}
                        onMouseLeave={e=>{ e.currentTarget.style.opacity="0.6"; e.currentTarget.style.color="#555"; }}>
                        <Settings size={13} />
                      </button>
                    </>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>

    {/* Project modals */}
    {editProject && <ProjectModal project={editProject} onClose={() => setEditProject(null)} onSaved={refreshProjects} />}
    {showNewProject && <ProjectModal project={null} onClose={() => setShowNewProject(false)} onSaved={refreshProjects} />}
    </>
  );
}

// ─── Status Dropdown ─────────────────────────────────────────────────────────

const STATUS_OPTIONS = [
  { value: "active",    label: "Ativo",     color: "#10B981", bg: "rgba(16,185,129,0.12)",  border: "rgba(16,185,129,0.28)"  },
  { value: "completed", label: "Concluído", color: "#3B82F6", bg: "rgba(59,130,246,0.12)",  border: "rgba(59,130,246,0.28)"  },
  { value: "on_hold",   label: "Pausado",   color: "#F59E0B", bg: "rgba(245,158,11,0.12)",  border: "rgba(245,158,11,0.28)"  },
];

function StatusDropdown({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [open, setOpen] = useState(false);
  const current = STATUS_OPTIONS.find(o => o.value === value) ?? STATUS_OPTIONS[0];
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative", marginLeft: 10 }}>
      <div
        onClick={() => setOpen(!open)}
        style={{ display: "flex", alignItems: "center", gap: 7, padding: "4px 10px 4px 8px", background: current.bg, border: `1px solid ${current.border}`, borderRadius: 20, cursor: "pointer", transition: "all 0.15s", userSelect: "none" }}
      >
        <span style={{ width: 7, height: 7, borderRadius: "50%", background: current.color, flexShrink: 0 }} />
        <span style={{ fontSize: 12, fontWeight: 600, color: current.color }}>{current.label}</span>
        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={current.color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ transition: "transform 0.2s", transform: open ? "rotate(180deg)" : "" }}><path d="M6 9l6 6 6-6"/></svg>
      </div>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, background: "rgba(20,20,24,0.97)", backdropFilter: "blur(12px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 10, boxShadow: "0 16px 48px rgba(0,0,0,0.7), 0 0 0 1px rgba(255,255,255,0.04)", zIndex: 9999, overflow: "hidden", minWidth: 150, animation: "statusDropIn 0.18s cubic-bezier(0.34,1.4,0.64,1)" }}>
          {STATUS_OPTIONS.map(opt => (
            <div
              key={opt.value}
              onClick={() => { onChange(opt.value); setOpen(false); }}
              style={{ display: "flex", alignItems: "center", gap: 9, padding: "10px 14px", cursor: "pointer", background: opt.value === value ? opt.bg : "transparent", transition: "background 0.12s", borderBottom: "1px solid rgba(255,255,255,0.04)" }}
              onMouseEnter={e => { if (opt.value !== value) e.currentTarget.style.background = "rgba(255,255,255,0.05)"; }}
              onMouseLeave={e => { if (opt.value !== value) e.currentTarget.style.background = "transparent"; }}
            >
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: opt.color, flexShrink: 0 }} />
              {opt.value === value && <Check size={13} style={{ marginLeft: "auto", color: opt.color }} />}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

const TABS = ["Visão Geral","Lista","Quadros","Cronologia","Calendário","Canais","Arquivos"];

function Header() {
  const { user, logout, token } = useAuth();
  const [location, navigate] = useLocation();
  const ctx = useContext(AppContext);
  const { activeTab, setActiveTab, activeProject, setActiveProject, projects, refreshProjects, sidebarModule, setSidebarModule } = ctx;
  const [showDropdown, setShowDropdown] = useState(false);
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [otherMembers, setOtherMembers] = useState<any[]>([]);
  const isProjectView = sidebarModule === "project" && activeProject;

  useEffect(() => {
    if (!token || !user) return;
    fetch(`${API}/api/members`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.json())
      .then(data => {
        if (data.members) {
          setOtherMembers(data.members.filter((m: any) => m.id !== user.id));
        }
      })
      .catch(console.error);
  }, [token, user]);

  return (
    <div style={{ background:"#1A1A1A", borderBottom:"1px solid #242424", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {isProjectView ? (
            <>
              <div style={{ width:36, height:36, borderRadius:8, background: activeProject.icon ? `url(${activeProject.icon}) center/cover` : activeProject.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, color:"#fff", flexShrink:0 }}>{!activeProject.icon && activeProject.name[0]}</div>
              <div style={{ display:"flex", alignItems:"center", gap:5, cursor:"pointer", position:"relative" }} onClick={() => setShowDropdown(!showDropdown)}>
                <span style={{ fontSize:16, fontWeight:700, color:"#f0f0f0" }}>{activeProject.name}</span>
                <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 5l3.5 3.5L10 5" stroke="#777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {showDropdown && (
                  <div style={{ position:"absolute", top:"calc(100% + 8px)", left:0, background:"#1e1e22", border:"1px solid rgba(255,255,255,0.1)", borderRadius:10, boxShadow:"0 12px 40px rgba(0,0,0,0.7)", zIndex:100, minWidth:220, padding:"6px", animation:"fadeIn 0.12s ease" }}>
                    {projects.map((p: any) => (
                      <div key={p.id} onClick={e => { e.stopPropagation(); navigate(`/projetos/${p.id}/quadros`); setShowDropdown(false); }}
                        style={{ display:"flex", alignItems:"center", gap:8, padding:"8px 10px", borderRadius:7, cursor:"pointer", fontSize:13, color: p.id===activeProject.id ? "#e0e0e0" : "#888", background: p.id===activeProject.id ? "#2a2a2e" : "transparent" }}
                        onMouseEnter={e => { if(p.id!==activeProject.id) e.currentTarget.style.background="#242424"; }}
                        onMouseLeave={e => { if(p.id!==activeProject.id) e.currentTarget.style.background="transparent"; }}>
                        <div style={{ width:20, height:20, borderRadius:5, background: p.icon ? `url(${p.icon}) center/cover` : p.color, display:"flex", alignItems:"center", justifyContent:"center", fontSize:10, fontWeight:700, color:"#fff" }}>{!p.icon && p.name[0]}</div>
                        {p.name}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <button 
                onClick={async () => {
                  try {
                    await fetch(`${API}/api/projects/${activeProject.id}`, {
                      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ isFavorite: !activeProject.isFavorite })
                    });
                    refreshProjects();
                  } catch(e) { console.error(e); }
                }}
                style={{ background:"transparent", border:"none", cursor:"pointer", padding:"2px 4px", color: activeProject.isFavorite ? "#EAB308" : "#555", transition:"color 0.2s" }}
                title={activeProject.isFavorite ? "Remover dos favoritos" : "Adicionar aos favoritos"}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill={activeProject.isFavorite ? "currentColor" : "none"} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>
              </button>

              <StatusDropdown
                value={activeProject.status || "active"}
                onChange={async (newStatus) => {
                  try {
                    await fetch(`${API}/api/projects/${activeProject.id}`, {
                      method: "PUT", headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
                      body: JSON.stringify({ status: newStatus })
                    });
                    refreshProjects();
                  } catch(err) { console.error(err); }
                }}
              />
            </>
          ) : (
            <span style={{ fontSize:16, fontWeight:700, color:"#f0f0f0" }}>{sidebarModule === "Membros" ? "Membros" : sidebarModule}</span>
          )}
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:12 }}>
          {otherMembers.length > 0 && (
            <AvatarCluster assignees={otherMembers} size={28} />
          )}
          {user && (
            <div style={{ position: "relative" }}>
              <div 
                onClick={() => setProfileMenuOpen(!profileMenuOpen)}
                style={{ display:"flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:"5px 12px 5px 6px", cursor: "pointer", transition: "all 0.15s" }}
                onMouseEnter={e=>(e.currentTarget.style.background="rgba(255,255,255,0.08)")} onMouseLeave={e=>(e.currentTarget.style.background="rgba(255,255,255,0.04)")}
              >
                <div style={{ width:26, height:26, borderRadius:"50%", background:"linear-gradient(135deg,#4f2d8a,#7C5AC2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:700, color:"#fff", overflow: "hidden" }}>
                  {user.avatarUrl ? <img src={user.avatarUrl} alt="" style={{width:'100%',height:'100%',objectFit:'cover'}} /> : user.name[0]?.toUpperCase()}
                </div>
                <span style={{ fontSize:12, color:"#bbb", fontWeight:500 }}>{user.name}</span>
              </div>
              
              {profileMenuOpen && (
                <>
                  <div style={{ position: "fixed", top:0, left:0, right:0, bottom:0, zIndex: 90 }} onClick={() => setProfileMenuOpen(false)} />
                  <div style={{ position: "absolute", top: "calc(100% + 8px)", right: 0, background: "rgba(18,18,22,0.97)", backdropFilter: "blur(16px)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 14, boxShadow: "0 16px 48px rgba(0,0,0,0.8)", zIndex: 100, minWidth: 220, overflow:"hidden", animation: "fadeIn 0.12s ease" }}>
                    {/* Profile Header */}
                    {(() => {
                      const prof = user ? getMemberProfile(user.name) : null;
                      return (
                        <div style={{ padding:"16px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", flexDirection:"column", alignItems:"center", gap:10, background:`radial-gradient(ellipse at 50% 0%, ${prof?.color ?? "#7C5AC2"}22 0%, transparent 70%)` }}>
                          <div style={{ width:60, height:60, borderRadius:"50%", border:`2px solid ${prof?.color ?? "#7C5AC2"}`, overflow:"hidden", background:"linear-gradient(135deg,#4f2d8a,#7C5AC2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:22, fontWeight:700, color:"#fff" }}>
                            {user?.avatarUrl ? <img src={user.avatarUrl} alt="" style={{ width:"100%", height:"100%", objectFit:"cover" }}/> : user?.name[0]?.toUpperCase()}
                          </div>
                          <div style={{ textAlign:"center" }}>
                            <div style={{ fontSize:14, fontWeight:700, color:"#f0f0f8" }}>{user?.name}</div>
                            <div style={{ fontSize:11, fontWeight:600, color: prof?.color ?? "#7C5AC2", marginTop:2 }}>{prof?.role}</div>
                            <div style={{ fontSize:11, fontStyle:"italic", color:"rgba(255,255,255,0.35)", marginTop:5, lineHeight:1.4 }}>{prof?.tagline}</div>
                          </div>
                        </div>
                      );
                    })()}
                    {/* Actions */}
                    <div style={{ padding:"6px" }}>
                      <div 
                        onClick={() => { setProfileMenuOpen(false); setProfileModalOpen(true); }}
                        style={{ padding: "9px 12px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#ccc", transition: "all 0.1s", display:"flex", alignItems:"center", gap:8 }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.05)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                        Editar Perfil
                      </div>
                      <div 
                        onClick={logout}
                        style={{ padding: "9px 12px", borderRadius: 7, cursor: "pointer", fontSize: 13, color: "#ef4444", transition: "all 0.1s", display:"flex", alignItems:"center", gap:8 }}
                        onMouseEnter={e => e.currentTarget.style.background="rgba(239,68,68,0.08)"} onMouseLeave={e => e.currentTarget.style.background="transparent"}
                      >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
                        Sair
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
      {profileModalOpen && <ProfileModal onClose={() => setProfileModalOpen(false)} />}
      {isProjectView && (
        <div style={{ display:"flex", alignItems:"center", padding:"0 20px", overflowX:"auto" }}>
          {TABS.map(tab=>(
            <button key={tab} onClick={()=>{
              if (activeProject) navigate(`/projetos/${activeProject.id}/${tab.toLowerCase().replace(/ /g, '-')}`);
            }} style={{ padding:"8px 14px", background:"transparent", border:"none", borderBottom:`2.5px solid ${activeTab===tab?"#7C5AC2":"transparent"}`, color: activeTab===tab?"#f0f0f0":"#505060", fontWeight: activeTab===tab?600:400, fontSize:13, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.12s" }}>
              {tab}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── CSS Keyframes (injected once) ────────────────────────────────────────────

const STYLES = `
  @keyframes dropZonePulse {
    0%, 100% { border-color: rgba(124,90,194,0.6); background: rgba(124,90,194,0.07); }
    50%       { border-color: rgba(124,90,194,0.9); background: rgba(124,90,194,0.13); }
  }
  @keyframes cardDrop {
    0%   { transform: rotate(-2.5deg) scale(1.04); }
    60%  { transform: rotate(0.3deg) scale(1.01); }
    100% { transform: rotate(0deg) scale(1); }
  }
  @keyframes fadeIn {
    from { opacity: 0; }
    to   { opacity: 1; }
  }
  @keyframes slideUp {
    from { opacity: 0; transform: translateY(24px) scale(0.97); }
    to   { opacity: 1; transform: translateY(0) scale(1); }
  }
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
  textarea:focus { border-color: rgba(124,90,194,0.5) !important; box-shadow: 0 0 0 3px rgba(124,90,194,0.1); }
  input::placeholder { color: #444; }
  input[type=number]::-webkit-inner-spin-button, 
  input[type=number]::-webkit-outer-spin-button { 
    -webkit-appearance: none; 
    margin: 0; 
  }
  input[type=number] {
    -moz-appearance: textfield;
  }
`;

// ─── Root ─────────────────────────────────────────────────────────────────────

function MainContent() {
  // ⚠️ ALL hooks must be called unconditionally at the top — Rules of Hooks
  const { sidebarModule, activeTab, activeProject, projects } = useContext(AppContext);
  const currentWorkspaceId = activeProject?.workspaceId || projects[0]?.workspaceId;

  if (sidebarModule === "Início") return <InicioPage />;
  if (sidebarModule === "Minhas Tarefas") return <MinhasTarefasPage />;
  if (sidebarModule === "Membros") return <MembersPage />;
  if (sidebarModule === "Financeiro") return <FinanceiroPage />;
  if (sidebarModule === "Metas") return <MetasPage />;
  if (sidebarModule === "Painel") return <PainelPage />;
  if (sidebarModule === "Configurações") {
    return <ConfiguracoesPage workspace={{ id: currentWorkspaceId, name: "Workspace Principal" }} />;
  }
  if (sidebarModule === "project") {
    switch (activeTab) {
      case "Quadros": return <Board />;
      case "Lista": return <ProjectList />;
      case "Calendário": return <ProjectCalendar />;
      case "Visão Geral": return <ProjectOverview />;
      case "Arquivos": return activeProject ? <ProjectFiles projectId={activeProject.id} /> : <div/>;
      case "Canais": return activeProject ? <ProjectChannels projectId={activeProject.id} /> : <div/>;
      default: return <ComingSoon module={`Projeto: ${activeTab}`} />;
    }
  }

  // Any other module -> Coming Soon
  return <ComingSoon module={sidebarModule} />;
}

export function TeltechLedger() {
  const { token } = useAuth();
  const [location, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("Quadros");
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [sidebarModule, setSidebarModule] = useState("Início");
  const [activeProject, setActiveProject] = useState<AppProject | null>(null);
  const [projects, setProjects] = useState<AppProject[]>([]);

  const fetchProjects = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(`${API}/api/projects`, { headers: { Authorization: `Bearer ${token}` } });
      const data = await res.json();
      if (data.projects) {
        setProjects(data.projects);
      }
    } catch (e) { console.error("Failed to load projects", e); }
  }, [token]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  useEffect(() => {
    const p = location.toLowerCase();
    if (p === "/" || p === "") setSidebarModule("Início");
    else if (p === "/painel") setSidebarModule("Painel");
    else if (p === "/minhas-tarefas") setSidebarModule("Minhas Tarefas");
    else if (p === "/membros") setSidebarModule("Membros");
    else if (p === "/financeiro") setSidebarModule("Financeiro");
    else if (p === "/metas") setSidebarModule("Metas");
    else if (p === "/configuracoes") setSidebarModule("Configurações");
    else if (p.startsWith("/projetos")) {
      setSidebarModule("project");
      const parts = p.split("/");
      const pid = parts[2];
      const tabSlug = parts[3];
      
      if (pid && projects.length > 0) {
        const proj = projects.find(x => x.id === pid);
        if (proj) setActiveProject(proj);
      } else if (!pid && projects.length > 0) {
        setActiveProject(projects[0]);
        navigate(`/projetos/${projects[0].id}/quadros`, { replace: true });
      }
      
      if (tabSlug) {
        const tabMap: Record<string, string> = {
          "visão-geral": "Visão Geral",
          "lista": "Lista",
          "quadros": "Quadros",
          "cronologia": "Cronologia",
          "calendário": "Calendário",
          "canais": "Canais",
          "arquivos": "Arquivos"
        };
        const decodedTab = decodeURIComponent(tabSlug);
        const matched = tabMap[decodedTab] || Object.values(tabMap).find(v => v.toLowerCase().replace(/ /g, '-') === decodedTab);
        if (matched) setActiveTab(matched);
      }
    }
  }, [location, projects, navigate]);

  return (
    <AppContext.Provider value={{
      activeTab, setActiveTab, sidebarOpen, setSidebarOpen,
      sidebarModule, setSidebarModule, activeProject, setActiveProject,
      projects, refreshProjects: fetchProjects
    }}>
      <style>{STYLES}</style>
      <div style={{ width:"100vw", height:"100vh", display:"flex", background:"#111111", fontFamily:"'Inter','SF Pro Display',-apple-system,'Segoe UI',sans-serif", overflow:"hidden", color:"#e0e0e0", fontSize:13 }}>
        <Sidebar/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
          <Header/>
          <MainContent />
        </div>
      </div>
    </AppContext.Provider>
  );
}
