import { useState, useRef, useEffect, useCallback, createContext, useContext } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TagColor = "purple" | "yellow" | "gray" | "blue" | "pink" | "red";
interface Tag { label: string; color: TagColor; }
type TimerState = "idle" | "running" | "overtime";

interface Task {
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
  progress: number;
  estTime: string;
  showStatusBadge?: boolean;
}
interface Column { id: string; title: string; tasks: Task[]; }

// ─── Initial Data ─────────────────────────────────────────────────────────────

const INITIAL_COLUMNS: Column[] = [
  {
    id: "untitled", title: "Untitled",
    tasks: [
      { id:"u1", tags:[{label:"QA",color:"blue"}], title:"Testing (Platform Pages)", assignees:2, timerState:"idle", timerValue:"00:00", progress:0, estTime:"" },
      { id:"u2", tags:[{label:"UX/UI",color:"purple"},{label:"No billing",color:"gray"}], title:"StrataScratch - Dribbble Presentation (Shot #4)", assignees:3, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Est: 8:00 h" },
      { id:"u3", tags:[], title:"Get customer feedback for Clutch", assignees:1, timerState:"idle", timerValue:"00:00", progress:0, estTime:"", showStatusBadge:true },
      { id:"u4", tags:[{label:"Management",color:"pink"}], title:"Project retrospective", assignees:0, addAssignee:true, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Est: 2:00 h" },
    ],
  },
  {
    id: "todo", title: "To Do",
    tasks: [
      { id:"t1", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"},{label:"No billing",color:"gray"}], date:"3 Jun", title:"StrataScratch - Instagram Post", assignees:3, comments:3, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Est: 0:30 h" },
      { id:"t2", tags:[{label:"UX/UI",color:"purple"}], date:"3 Jun", title:"StrataScratch - New Pricing Page", assignees:1, attachments:3, comments:1, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Est: 3:00 h" },
      { id:"t3", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"11 Jun", title:"StrataScratch - Display Ads (#3)", assignees:3, comments:3, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Est: 8:00 h" },
      { id:"t4", coverImage:"photo", tags:[], title:"", assignees:0, timerState:"idle", timerValue:"00:00", progress:0, estTime:"Est: 2:00 h" },
    ],
  },
  {
    id: "doing", title: "Doing",
    tasks: [
      { id:"d1", coverImage:"dashboard", tags:[{label:"UX/UI",color:"purple"},{label:"No billing",color:"gray"}], date:"2 Jun", title:"StrataScratch - Behance Presentation", assignees:3, attachments:2, comments:17, timerState:"running", timerValue:"16:32 h", progress:55, estTime:"Est: 30:00 h" },
      { id:"d2", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"4 Jun", title:"StrataScratch - Display Ads (#2)", assignees:3, comments:3, timerState:"running", timerValue:"0:57 h", progress:25, estTime:"Est: 4:00 h" },
      { id:"d3", tags:[{label:"UX/UI",color:"purple"}], date:"14 Jun", title:"Strata Scratch - Animation for loader/splash screen", assignees:1, attachments:1, comments:1, timerState:"running", timerValue:"0:46 h", progress:46, estTime:"Est: 1:00 h" },
    ],
  },
  {
    id: "review", title: "Review",
    tasks: [
      { id:"r1", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"28 May", title:"StrataScratch - Display Ads", assignees:3, comments:3, timerState:"overtime", timerValue:"9:43", progress:100, estTime:"Est: 8:00 h" },
      { id:"r2", coverImage:"figma", tags:[{label:"UX/UI",color:"purple"},{label:"No billing",color:"gray"}], date:"24 Jun", title:"StrataScratch - Dribbble Presentation (Shot #3)", assignees:2, comments:5, timerState:"overtime", timerValue:"2:54 h", progress:100, estTime:"Est: 3:00 h" },
    ],
  },
  {
    id: "done", title: "Done",
    tasks: [
      { id:"dn1", tags:[{label:"UX/UI",color:"purple"}], title:"New website homepage", assignees:2, timerState:"idle", timerValue:"8:00 h", progress:100, estTime:"Est: 8:00 h" },
      { id:"dn2", tags:[{label:"QA",color:"blue"}], title:"Fix and test in Zeplin", assignees:1, timerState:"idle", timerValue:"3:00 h", progress:100, estTime:"Est: 3:00 h" },
      { id:"dn3", tags:[{label:"QA",color:"blue"}], title:"Fix the bug on mobile", assignees:1, timerState:"idle", timerValue:"1:30 h", progress:100, estTime:"Est: 2:00 h" },
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
}

const DragContext = createContext<DragCtx>({
  drag: null,
  startDrag: () => {},
  colRefs: { current: new Map() },
  cardRefs: { current: new Map() },
  justDropped: null,
});

// ─── Colors ───────────────────────────────────────────────────────────────────

const TAG_STYLES: Record<TagColor, { bg: string; dot: string; text: string }> = {
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

function FaceAvatar({ index, size=22 }: { index:number; size?:number }) {
  const s = FACE_SPECS[index % FACE_SPECS.length];
  const r = size/2;
  const hairPaths: Record<string, JSX.Element> = {
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

function AvatarCluster({ count, size=22 }: { count:number; size?:number }) {
  const shown = Math.min(count, 4);
  return (
    <div style={{ display:"flex", alignItems:"center" }}>
      {Array.from({length:shown}).map((_,i) => (
        <div key={i} style={{ marginLeft: i===0 ? 0 : -(size*0.3), zIndex: shown-i }}>
          <FaceAvatar index={i} size={size}/>
        </div>
      ))}
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

function CoverImage({ type }: { type: string }) {
  if (type==="dashboard") return <DashboardCover/>;
  if (type==="figma") return <FigmaCover/>;
  if (type==="photo") return <PhotoCover/>;
  return null;
}

// ─── Tag Badge ────────────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: Tag }) {
  const s = TAG_STYLES[tag.color];
  return (
    <span style={{ background:s.bg, color:s.text, fontSize:10, fontWeight:500, padding:"2px 6px 2px 5px", borderRadius:4, whiteSpace:"nowrap", display:"inline-flex", alignItems:"center", gap:4 }}>
      <span style={{ width:5, height:5, borderRadius:1.5, background:s.dot, flexShrink:0, display:"inline-block" }}/>
      {tag.label}
    </span>
  );
}

function AddStatusBadge() {
  return (
    <span style={{ fontSize:10, color:"#555", padding:"2px 7px", border:"1px dashed #3a3a3a", borderRadius:4, display:"inline-flex", alignItems:"center", gap:3, whiteSpace:"nowrap" }}>
      <span style={{ fontSize:11, lineHeight:1 }}>+</span>Add Status
    </span>
  );
}

// ─── Timer ────────────────────────────────────────────────────────────────────

function TimerButton({ state, value }: { state:TimerState; value:string }) {
  if (state==="running") return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
      <button style={{ width:20, height:20, borderRadius:"50%", background:"#7C5AC2", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, padding:0 }}>
        <div style={{ display:"flex", gap:2 }}><div style={{ width:2, height:7, background:"#fff", borderRadius:1 }}/><div style={{ width:2, height:7, background:"#fff", borderRadius:1 }}/></div>
      </button>
      <span style={{ fontSize:11, color:"#7C5AC2", fontWeight:600, whiteSpace:"nowrap" }}>{value}</span>
    </div>
  );
  if (state==="overtime") return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
      <button style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"1.5px solid #ef4444", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
        <div style={{ width:0, height:0, borderTop:"3.5px solid transparent", borderBottom:"3.5px solid transparent", borderLeft:"5.5px solid #ef4444", marginLeft:1 }}/>
      </button>
      <span style={{ fontSize:11, color:"#ef4444", fontWeight:600, whiteSpace:"nowrap" }}>{value}</span>
    </div>
  );
  return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
      <button style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"1.5px solid #3a3a3a", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
        <div style={{ width:0, height:0, borderTop:"3.5px solid transparent", borderBottom:"3.5px solid transparent", borderLeft:"5px solid #4a4a4a", marginLeft:1 }}/>
      </button>
      <span style={{ fontSize:11, color:"#4a4a4a" }}>{value}</span>
    </div>
  );
}

function ProgressBar({ progress, state }: { progress:number; state:TimerState }) {
  const fill = state==="running" ? "#7C5AC2" : state==="overtime" ? "#ef4444" : "#3a3a3a";
  return (
    <div style={{ height:3, background:"#2a2a2a", borderRadius:2, overflow:"hidden", flex:1 }}>
      <div style={{ width:`${Math.min(progress,100)}%`, height:"100%", background:fill, borderRadius:2 }}/>
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task, ghost=false }: { task:Task; ghost?:boolean }) {
  const { drag, startDrag, cardRefs, justDropped } = useContext(DragContext);
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
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none" style={{ opacity: hovered ? 0.7 : 0.2, transition:"opacity 0.15s" }}>
                  <path d="M2 4h12M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4M6 7v5M10 7v5M3 4l.9 9a1.5 1.5 0 001.5 1.35h5.2A1.5 1.5 0 0012.1 13L13 4" stroke="#888" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
            </div>
            {task.title && <div style={{ fontSize:13, fontWeight:500, color:"#dfdfdf", lineHeight:1.45 }}>{task.title}</div>}
            <div style={{ display:"flex", alignItems:"center", gap:6 }}>
              <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
                {task.assignees>0 && <AvatarCluster count={task.assignees} size={20}/>}
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
              <TimerButton state={task.timerState} value={task.timerValue}/>
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
            {task.assignees>0 && <AvatarCluster count={task.assignees} size={20}/>}
          </div>
          <TimerButton state={task.timerState} value={task.timerValue}/>
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

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({ col }: { col: Column }) {
  const { drag, colRefs } = useContext(DragContext);
  const colRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (colRef.current) colRefs.current.set(col.id, colRef.current);
    return () => { colRefs.current.delete(col.id); };
  }, [col.id, colRefs]);

  const isTarget = drag?.active && drag.targetColId === col.id;
  const dragTask = drag ? findTask(drag.taskId) : null;

  // Build card list with ghost + drop zone inserted
  const renderedTasks = col.tasks;
  const items: JSX.Element[] = [];

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
    <div
      ref={colRef}
      data-colid={col.id}
      style={{ minWidth:220, width:220, display:"flex", flexDirection:"column", gap:10, flexShrink:0, transition:"background 0.2s", borderRadius:10, padding:isTarget ? "6px" : "0", background: isTarget ? "rgba(124,90,194,0.04)" : "transparent" }}
    >
      <div style={{ display:"flex", alignItems:"center", gap:6, padding: isTarget ? "0 2px 6px" : "0 2px 6px", paddingTop: isTarget ? 2 : 0 }}>
        <span style={{ fontSize:13, fontWeight:600, color:"#d0d0d4" }}>{col.title}</span>
        <span style={{ fontSize:11, color:"#505058" }}>{col.tasks.length} Tasks</span>
        <div style={{ flex:1 }}/>
        <button style={{ background:"transparent", border:"none", color:"#505058", cursor:"pointer", fontSize:16, lineHeight:1 }}>+</button>
        <button style={{ background:"transparent", border:"none", color:"#505058", cursor:"pointer", letterSpacing:1, fontSize:13 }}>···</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {items}
      </div>
    </div>
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
  const [columns, setColumns] = useState<Column[]>(INITIAL_COLUMNS);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [justDropped, setJustDropped] = useState<string | null>(null);
  const colRefs = useRef<Map<string, HTMLElement>>(new Map());
  const cardRefs = useRef<Map<string, HTMLElement>>(new Map());
  const dragRef = useRef<DragState | null>(null);
  const columnsRef = useRef(columns);
  columnsRef.current = columns;

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

    const handleUp = () => {
      const d = dragRef.current;
      if (!d) return;
      if (d.active) {
        const newCols = moveTask(columnsRef.current, d.taskId, d.sourceColId, d.targetColId, d.targetIndex);
        setColumns(newCols);
        setJustDropped(d.taskId);
        setTimeout(()=>setJustDropped(null), 500);
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
    <DragContext.Provider value={{ drag, startDrag, colRefs, cardRefs, justDropped }}>
      <div
        style={{ flex:1, overflowX:"auto", overflowY:"auto", padding:"18px 20px", display:"flex", gap:16, alignItems:"flex-start", background:"#111111", position:"relative" }}
        onMouseLeave={()=>{}}
      >
        {columns.map(col=><BoardColumn key={col.id} col={col}/>)}
        {drag?.active && dragTask && <FloatingCard drag={drag} task={dragTask}/>}
      </div>
    </DragContext.Provider>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon:"home", label:"Home" }, { icon:"dashboard", label:"Dashboard" },
  { icon:"projects", label:"Projects" }, { icon:"tasks", label:"My Tasks" },
  { icon:"members", label:"Members" }, { icon:"goals", label:"Goals" }, { icon:"settings", label:"Settings" },
];
const PROJECT_ITEMS = [
  { name:"Apvision", color:"#6366F1" }, { name:"AlertSec", color:"#3B82F6" },
  { name:"Bomani Cold Buzz", color:"#F59E0B" }, { name:"Danyon", color:"#EC4899" },
  { name:"JB Consulting", color:"#10B981" }, { name:"My Choice Software", color:"#8B5CF6" },
  { name:"StrataScratch", color:"#14B8A6" }, { name:"Wake Up Coffee", color:"#F97316" },
];

function NavIcon({ icon }: { icon:string }) {
  const d: Record<string,JSX.Element> = {
    home:<path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    dashboard:<><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    projects:<path d="M4 6h16M4 10h12M4 14h8M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>,
    tasks:<><path d="M9 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    members:<><circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 8a3 3 0 010 6M21 20c0-2.5-1.8-4.6-4-5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    goals:<><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    settings:<><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  };
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>{d[icon]}</svg>;
}

function Sidebar() {
  const [favOpen, setFavOpen] = useState(true);
  const [projOpen, setProjOpen] = useState(true);
  const [hovNav, setHovNav] = useState<string|null>(null);
  const [hovFav, setHovFav] = useState<string|null>(null);
  return (
    <div style={{ width:200, minWidth:200, height:"100%", background:"#1A1A1A", borderRight:"1px solid #252525", display:"flex", flexDirection:"column", overflowY:"auto", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 14px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, background:"linear-gradient(135deg,#4f2d8a,#7C5AC2)", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff" }}>▲</div>
          <span style={{ fontSize:14, fontWeight:700, color:"#f0f0f0", letterSpacing:"-0.3px" }}>brandux</span>
        </div>
        <button style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", padding:2 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>
      <nav style={{ padding:"4px 6px" }}>
        {NAV_ITEMS.map(item=>(
          <div key={item.label} onMouseEnter={()=>setHovNav(item.label)} onMouseLeave={()=>setHovNav(null)}
            style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 8px", color: hovNav===item.label?"#c4c4c8":"#666", cursor:"pointer", fontSize:13, borderRadius:6, background: hovNav===item.label?"#242424":"transparent", transition:"all 0.12s" }}>
            <NavIcon icon={item.icon}/><span>{item.label}</span>
          </div>
        ))}
      </nav>
      <div style={{ height:8 }}/>
      <div style={{ padding:"0 6px" }}>
        <button onClick={()=>setFavOpen(!favOpen)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"5px 8px", background:"transparent", border:"none", color:"#555", cursor:"pointer", fontSize:11, fontWeight:600, letterSpacing:"0.04em" }}>
          <span>Favorite</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: favOpen?"rotate(0)":"rotate(-90deg)", transition:"0.2s" }}><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        {favOpen && [
          { name:"StrataScratch", color:"#10B981", shape:"circle", active:true },
          { name:"AlertSec", color:"#3B82F6", shape:"square", active:false },
        ].map(fav=>(
          <div key={fav.name} onMouseEnter={()=>setHovFav(fav.name)} onMouseLeave={()=>setHovFav(null)}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background: fav.active?"#242424": hovFav===fav.name?"#1e1e1e":"transparent", borderRadius:6, cursor:"pointer", fontSize:13, color: fav.active?"#e0e0e0":"#888", position:"relative" }}>
            <div style={{ width:18, height:18, borderRadius: fav.shape==="circle"?"50%":5, background:fav.color, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:800, color:"#fff" }}>{fav.name[0]}</div>
            <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fav.name}</span>
            {hovFav===fav.name && <span style={{ color:"#555", fontSize:13, letterSpacing:1 }}>···</span>}
          </div>
        ))}
      </div>
      <div style={{ height:6 }}/>
      <div style={{ padding:"0 6px", flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px" }}>
          <span style={{ fontSize:11, fontWeight:600, color:"#555", letterSpacing:"0.04em" }}>Projects</span>
          <div style={{ display:"flex", gap:4 }}>
            <button style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", fontSize:15, lineHeight:1 }}>+</button>
            <button onClick={()=>setProjOpen(!projOpen)} style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: projOpen?"rotate(0)":"rotate(-90deg)", transition:"0.2s" }}><path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
        </div>
        {projOpen && PROJECT_ITEMS.map(proj=>(
          <div key={proj.name}
            style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:6, cursor:"pointer", fontSize:12, color:"#777" }}
            onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#242424"; (e.currentTarget as HTMLElement).style.color="#bbb"; }}
            onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color="#777"; }}>
            <div style={{ width:18, height:18, borderRadius:5, background:proj.color, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.9)" }}>{proj.name[0]}</div>
            <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{proj.name}</span>
          </div>
        ))}
        <div style={{ padding:"6px 8px" }}><span style={{ fontSize:11, color:"#3a3a3a", cursor:"pointer" }}>Show All Projects ∨</span></div>
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

const TABS = ["Overview","List","Boards","Chronology","Calendar","Members","Channels","Files"];

function Header() {
  const [activeTab, setActiveTab] = useState("Boards");
  return (
    <div style={{ background:"#1A1A1A", borderBottom:"1px solid #242424", flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"11px 20px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:36, height:36, borderRadius:"50%", background:"linear-gradient(135deg,#14B8A6,#0891b2)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:15, fontWeight:700, color:"#fff", flexShrink:0 }}>S</div>
          <div style={{ display:"flex", alignItems:"center", gap:5 }}>
            <span style={{ fontSize:16, fontWeight:700, color:"#f0f0f0" }}>StrataScratch</span>
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M3 5l3.5 3.5L10 5" stroke="#777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
          <div style={{ display:"flex", gap:7, marginLeft:2 }}>
            <button style={{ background:"transparent", border:"none", color:"#4a4a4a", cursor:"pointer", padding:2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/><path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>
            </button>
            <button style={{ background:"transparent", border:"none", color:"#4a4a4a", cursor:"pointer", padding:2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"><polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></svg>
            </button>
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.25)", borderRadius:20, padding:"4px 10px", marginLeft:4 }}>
            <div style={{ width:15, height:15, borderRadius:"50%", background:"#10B981", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontSize:12, color:"#10B981", fontWeight:500 }}>According to plan</span>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 3.5l2.5 2.5 2.5-2.5" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <AvatarCluster count={5} size={28}/>
          <button style={{ width:30, height:30, borderRadius:"50%", background:"#242424", border:"1px solid #2e2e2e", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#666" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M21 21l-3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>
      <div style={{ display:"flex", alignItems:"center", padding:"0 20px", overflowX:"auto" }}>
        {TABS.map(tab=>(
          <button key={tab} onClick={()=>setActiveTab(tab)} style={{ padding:"8px 14px", background:"transparent", border:"none", borderBottom:`2.5px solid ${activeTab===tab?"#7C5AC2":"transparent"}`, color: activeTab===tab?"#f0f0f0":"#505060", fontWeight: activeTab===tab?600:400, fontSize:13, cursor:"pointer", whiteSpace:"nowrap", transition:"all 0.12s" }}>
            {tab}
          </button>
        ))}
      </div>
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
  * { box-sizing: border-box; }
  ::-webkit-scrollbar { width: 4px; height: 4px; }
  ::-webkit-scrollbar-track { background: #111; }
  ::-webkit-scrollbar-thumb { background: #333; border-radius: 2px; }
`;

// ─── Root ─────────────────────────────────────────────────────────────────────

export function TeltechLedger() {
  return (
    <>
      <style>{STYLES}</style>
      <div style={{ width:"100vw", height:"100vh", display:"flex", background:"#111111", fontFamily:"'Inter','SF Pro Display',-apple-system,'Segoe UI',sans-serif", overflow:"hidden", color:"#e0e0e0", fontSize:13 }}>
        <Sidebar/>
        <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
          <Header/>
          <Board/>
        </div>
      </div>
    </>
  );
}
