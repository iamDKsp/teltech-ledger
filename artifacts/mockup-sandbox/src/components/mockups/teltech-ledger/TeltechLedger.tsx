import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TagColor = "purple" | "yellow" | "gray" | "blue" | "pink" | "red";
interface Tag { label: string; color: TagColor; }
type TimerState = "idle" | "running" | "overtime";
type CardFooterIcon = "calendar" | "timer";

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
  footerIcon: CardFooterIcon;
  progress: number;
  estTime: string;
  showStatusBadge?: boolean;
  isDragged?: boolean;
}
interface Column { id: string; title: string; count: number; tasks: Task[]; }

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COLUMNS: Column[] = [
  {
    id: "untitled", title: "Untitled", count: 4,
    tasks: [
      { id:"u1", tags:[{label:"QA",color:"blue"}], title:"Testing (Platform Pages)", assignees:2, timerState:"idle", timerValue:"00:00", footerIcon:"calendar", progress:0, estTime:"" },
      { id:"u2", tags:[{label:"UX/UI",color:"purple"},{label:"No billing",color:"gray"}], title:"StrataScratch - Dribbble Presentation (Shot #4)", assignees:3, timerState:"idle", timerValue:"00:00", footerIcon:"timer", progress:0, estTime:"Est: 8:00 h" },
      { id:"u3", tags:[], title:"Get customer feedback for Clutch", assignees:1, timerState:"idle", timerValue:"00:00", footerIcon:"calendar", progress:0, estTime:"", showStatusBadge:true },
      { id:"u4", tags:[{label:"Management",color:"pink"}], title:"Project retrospective", assignees:0, addAssignee:true, timerState:"idle", timerValue:"00:00", footerIcon:"calendar", progress:0, estTime:"Est: 2:00 h" },
    ],
  },
  {
    id: "todo", title: "To Do", count: 8,
    tasks: [
      { id:"t1", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"},{label:"No billing",color:"gray"}], date:"3 Jun", title:"StrataScratch - Instagram Post", assignees:3, comments:3, timerState:"idle", timerValue:"00:00", footerIcon:"timer", progress:0, estTime:"Est: 0:30 h" },
      { id:"t2", tags:[{label:"UX/UI",color:"purple"}], date:"3 Jun", title:"StrataScratch - New Pricing Page", assignees:1, attachments:3, comments:1, timerState:"idle", timerValue:"00:00", footerIcon:"timer", progress:0, estTime:"Est: 3:00 h", isDragged:true },
      { id:"t3", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"11 Jun", title:"StrataScratch - Display Ads (#3)", assignees:3, comments:3, timerState:"idle", timerValue:"00:00", footerIcon:"timer", progress:0, estTime:"Est: 8:00 h" },
      { id:"t4", coverImage:"photo", tags:[], title:"", assignees:0, timerState:"idle", timerValue:"00:00", footerIcon:"calendar", progress:0, estTime:"Est: 2:00 h" },
    ],
  },
  {
    id: "doing", title: "Doing", count: 14,
    tasks: [
      { id:"d1", coverImage:"dashboard", tags:[{label:"UX/UI",color:"purple"},{label:"No billing",color:"gray"}], date:"2 Jun", title:"StrataScratch - Behance Presentation", assignees:3, attachments:2, comments:17, timerState:"running", timerValue:"16:32 h", footerIcon:"timer", progress:55, estTime:"Est: 30:00 h" },
      { id:"d2", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"4 Jun", title:"StrataScratch - Display Ads (#2)", assignees:3, comments:3, timerState:"running", timerValue:"0:57 h", footerIcon:"timer", progress:25, estTime:"Est: 4:00 h" },
      { id:"d3", tags:[{label:"UX/UI",color:"purple"}], date:"14 Jun", title:"Strata Scratch - Animation for loader/splash screen", assignees:1, attachments:1, comments:1, timerState:"running", timerValue:"0:46 h", footerIcon:"timer", progress:46, estTime:"Est: 1:00 h" },
    ],
  },
  {
    id: "review", title: "Review", count: 2,
    tasks: [
      { id:"r1", tags:[{label:"UX/UI",color:"purple"},{label:"Marketing",color:"yellow"}], date:"28 May", title:"StrataScratch - Display Ads", assignees:3, comments:3, timerState:"overtime", timerValue:"9:43", footerIcon:"timer", progress:100, estTime:"Est: 8:00 h" },
      { id:"r2", coverImage:"figma", tags:[{label:"UX/UI",color:"purple"},{label:"No billing",color:"gray"}], date:"24 Jun", title:"StrataScratch - Dribbble Presentation (Shot #3)", assignees:2, comments:5, timerState:"overtime", timerValue:"2:54 h", footerIcon:"timer", progress:100, estTime:"Est: 3:00 h" },
    ],
  },
  {
    id: "done", title: "Done", count: 6,
    tasks: [
      { id:"dn1", tags:[{label:"UX/UI",color:"purple"}], title:"New website homepage", assignees:2, timerState:"idle", timerValue:"8:00 h", footerIcon:"timer", progress:100, estTime:"Est: 8:00 h" },
      { id:"dn2", tags:[{label:"QA",color:"blue"}], title:"Fix and test in Zeplin", assignees:1, timerState:"idle", timerValue:"3:00 h", footerIcon:"timer", progress:100, estTime:"Est: 3:00 h" },
      { id:"dn3", tags:[{label:"QA",color:"blue"}], title:"Fix the bug on mobile", assignees:1, timerState:"idle", timerValue:"1:30 h", footerIcon:"timer", progress:100, estTime:"Est: 2:00 h" },
    ],
  },
];

// ─── Colors ───────────────────────────────────────────────────────────────────

const TAG_STYLES: Record<TagColor, { bg: string; dot: string; text: string }> = {
  purple: { bg: "rgba(124,90,194,0.22)", dot: "#7C5AC2", text: "#b39deb" },
  yellow: { bg: "rgba(234,179,8,0.2)",   dot: "#EAB308", text: "#fcd34d" },
  gray:   { bg: "rgba(113,113,122,0.22)",dot: "#71717a", text: "#a1a1aa" },
  blue:   { bg: "rgba(59,130,246,0.2)",  dot: "#3B82F6", text: "#93c5fd" },
  pink:   { bg: "rgba(236,72,153,0.2)",  dot: "#EC4899", text: "#f9a8d4" },
  red:    { bg: "rgba(239,68,68,0.2)",   dot: "#ef4444", text: "#fca5a5" },
};

// ─── Face-style Avatars ───────────────────────────────────────────────────────

type FaceSpec = { bg: string; skin: string; hair: string; hairStyle: "curly"|"straight"|"afro"|"short"|"bun" };
const FACE_SPECS: FaceSpec[] = [
  { bg:"#3d2b6b", skin:"#c68642", hair:"#1a0900", hairStyle:"curly" },
  { bg:"#1e4d8c", skin:"#8d5524", hair:"#2c1810", hairStyle:"afro" },
  { bg:"#5b2d8e", skin:"#e8b89a", hair:"#8B4513", hairStyle:"straight" },
  { bg:"#7c1d1d", skin:"#d4956a", hair:"#3b1f0a", hairStyle:"bun" },
  { bg:"#1a5c3a", skin:"#f0c8a0", hair:"#4a2000", hairStyle:"short" },
  { bg:"#2a4a7f", skin:"#c49a6c", hair:"#1c0c00", hairStyle:"curly" },
  { bg:"#6b3d9e", skin:"#e0b080", hair:"#2d1400", hairStyle:"straight" },
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
        {/* neck + body */}
        <ellipse cx={r} cy={size*0.88} rx={r*0.38} ry={r*0.35} fill={s.skin}/>
        <rect x={r*0.62} y={size*0.72} width={r*0.76} height={size*0.3} rx={r*0.12} fill={s.bg} opacity={0.6}/>
        {/* face */}
        <ellipse cx={r} cy={r*0.78} rx={r*0.44} ry={r*0.48} fill={s.skin}/>
        {/* hair */}
        {hairPaths[s.hairStyle]}
        {/* eyes */}
        <ellipse cx={r*0.72} cy={r*0.72} rx={r*0.07} ry={r*0.085} fill="#1a0a00"/>
        <ellipse cx={r*1.28} cy={r*0.72} rx={r*0.07} ry={r*0.085} fill="#1a0a00"/>
        {/* mouth */}
        <path d={`M ${r*0.8} ${r*0.96} Q ${r} ${r*1.08} ${r*1.2} ${r*0.96}`} stroke="#a0604a" strokeWidth={size*0.02} fill="none" strokeLinecap="round"/>
      </svg>
    </div>
  );
}

function AvatarCluster({ count, size=22 }: { count:number; size?:number }) {
  const shown = Math.min(count, 4);
  const overlap = size * 0.3;
  return (
    <div style={{ display:"flex", alignItems:"center" }}>
      {Array.from({length:shown}).map((_,i) => (
        <div key={i} style={{ marginLeft: i===0 ? 0 : -overlap, zIndex: shown-i }}>
          <FaceAvatar index={i} size={size}/>
        </div>
      ))}
    </div>
  );
}

// ─── Cover Images ─────────────────────────────────────────────────────────────

function DashboardCover() {
  // Faithful dark-app screenshot: narrow sidebar, top nav, stat cards, bar chart
  return (
    <div style={{ width:"100%", height:126, borderRadius:"8px 8px 0 0", background:"#0b0b18", overflow:"hidden", position:"relative" }}>
      {/* browser chrome */}
      <div style={{ height:16, background:"#13132a", display:"flex", alignItems:"center", gap:3, padding:"0 6px" }}>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"#ef4444" }}/>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"#f59e0b" }}/>
        <div style={{ width:5, height:5, borderRadius:"50%", background:"#22c55e" }}/>
        <div style={{ flex:1, height:5, borderRadius:2, background:"#1e1e3f", marginLeft:6 }}/>
      </div>
      <div style={{ display:"flex", height:"calc(100% - 16px)" }}>
        {/* sidebar */}
        <div style={{ width:22, background:"#0e0e22", display:"flex", flexDirection:"column", alignItems:"center", gap:5, paddingTop:6 }}>
          <div style={{ width:14, height:14, borderRadius:4, background:"linear-gradient(135deg,#7C5AC2,#a78bfa)" }}/>
          {[1,2,3,4].map(i=><div key={i} style={{ width:10, height:10, borderRadius:2, background: i===2?"#7C5AC2":"#1a1a38" }}/>)}
        </div>
        {/* main content */}
        <div style={{ flex:1, padding:"6px 8px", display:"flex", flexDirection:"column", gap:5 }}>
          {/* stat cards row */}
          <div style={{ display:"flex", gap:4 }}>
            {[
              "linear-gradient(135deg,#4f2d8a,#7C5AC2)",
              "linear-gradient(135deg,#c45c0e,#f97316)",
              "linear-gradient(135deg,#0e7490,#06b6d4)",
            ].map((bg,i)=>(
              <div key={i} style={{ flex:1, height:30, borderRadius:4, background:bg, padding:"4px 5px" }}>
                <div style={{ width:"60%", height:4, borderRadius:2, background:"rgba(255,255,255,0.4)", marginBottom:3 }}/>
                <div style={{ width:"40%", height:6, borderRadius:2, background:"rgba(255,255,255,0.7)" }}/>
              </div>
            ))}
          </div>
          {/* chart area */}
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
  // Figma/design-tool style: left panel + main canvas with table rows
  return (
    <div style={{ width:"100%", height:110, borderRadius:"8px 8px 0 0", background:"#f8f8f8", overflow:"hidden", position:"relative", display:"flex" }}>
      {/* left panel dark */}
      <div style={{ width:30, background:"#1e1e1e", padding:"6px 4px", display:"flex", flexDirection:"column", gap:4 }}>
        <div style={{ width:22, height:22, borderRadius:4, background:"#10B981", display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div style={{ width:10, height:10, borderRadius:1, background:"rgba(255,255,255,0.9)" }}/>
        </div>
        {["#2a2a2a","#2a2a2a","#3a3a3a","#2a2a2a"].map((c,i)=>(
          <div key={i} style={{ height:6, borderRadius:2, background:c }}/>
        ))}
      </div>
      {/* layers panel */}
      <div style={{ width:55, background:"#252525", padding:"5px 4px", display:"flex", flexDirection:"column", gap:3 }}>
        <div style={{ height:5, borderRadius:2, background:"#3a3a3a", width:"80%" }}/>
        {[{c:"#10B981",w:"90%"},{c:"#3a3a3a",w:"70%"},{c:"#3a3a3a",w:"85%"},{c:"#10B981",w:"60%"},{c:"#3a3a3a",w:"75%"}].map((r,i)=>(
          <div key={i} style={{ height:4, borderRadius:2, background:r.c, width:r.w, marginLeft:4 }}/>
        ))}
      </div>
      {/* canvas */}
      <div style={{ flex:1, background:"#e8e8e8", padding:6, display:"flex", flexDirection:"column", gap:3 }}>
        {/* header row */}
        <div style={{ display:"flex", gap:3 }}>
          {["#c5e8d5","#c5e8d5","#d5d5d5","#d5d5d5"].map((c,i)=>(
            <div key={i} style={{ flex:1, height:6, borderRadius:1, background:c }}/>
          ))}
        </div>
        {/* rows */}
        {[1,2,3,4,5].map(i=>(
          <div key={i} style={{ display:"flex", gap:3, alignItems:"center" }}>
            <div style={{ flex:1, height:5, borderRadius:1, background: i%2===0?"#b8d4c5":"#d0d0d0" }}/>
            <div style={{ flex:1, height:5, borderRadius:1, background:"#d0d0d0" }}/>
            <div style={{ flex:1, height:5, borderRadius:1, background:"#d0d0d0" }}/>
            <div style={{ flex:1, height:5, borderRadius:1, background:"#d0d0d0" }}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhotoCover() {
  // Woman with afro natural hair, warm skin tone, holding a snack - realistic SVG
  return (
    <div style={{ width:"100%", height:120, borderRadius:"8px 8px 0 0", overflow:"hidden", position:"relative", background:"linear-gradient(180deg, #e8d5b8 0%, #d4b896 50%, #c8a880 100%)" }}>
      {/* wall/background texture */}
      <div style={{ position:"absolute", inset:0, background:"linear-gradient(160deg, #edd5b0 0%, #c9a878 60%, #b8965e 100%)" }}/>
      {/* person SVG */}
      <svg viewBox="0 0 200 140" width="100%" height="100%" style={{ position:"absolute", bottom:0, left:0 }}>
        {/* background wall patch */}
        <rect x="110" y="0" width="90" height="140" fill="#e0c89a" opacity="0.5"/>
        {/* body / clothes */}
        <ellipse cx="90" cy="145" rx="45" ry="30" fill="#2d2d2d"/>
        <rect x="55" y="90" width="70" height="60" rx="8" fill="#1a1a1a"/>
        {/* neck */}
        <rect x="82" y="78" width="16" height="18" rx="4" fill="#b07840"/>
        {/* face */}
        <ellipse cx="90" cy="68" rx="26" ry="30" fill="#b07840"/>
        {/* ear */}
        <ellipse cx="64" cy="68" rx="5" ry="7" fill="#a06e38"/>
        <ellipse cx="116" cy="68" rx="5" ry="7" fill="#a06e38"/>
        {/* natural afro hair */}
        <ellipse cx="90" cy="44" rx="34" ry="28" fill="#150a00"/>
        <ellipse cx="60" cy="52" rx="14" ry="18" fill="#150a00"/>
        <ellipse cx="120" cy="52" rx="14" ry="18" fill="#150a00"/>
        <ellipse cx="90" cy="30" rx="22" ry="14" fill="#1c0f00"/>
        {/* eyes */}
        <ellipse cx="80" cy="64" rx="4.5" ry="4" fill="#fff"/>
        <ellipse cx="80" cy="64" rx="3" ry="3" fill="#2d1800"/>
        <ellipse cx="100" cy="64" rx="4.5" ry="4" fill="#fff"/>
        <ellipse cx="100" cy="64" rx="3" ry="3" fill="#2d1800"/>
        {/* eyebrows */}
        <path d="M 73 57 Q 80 54 87 57" stroke="#1a0a00" strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M 93 57 Q 100 54 107 57" stroke="#1a0a00" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* nose */}
        <path d="M 87 70 Q 90 76 93 70" stroke="#8a5820" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
        {/* mouth / smile */}
        <path d="M 82 78 Q 90 84 98 78" stroke="#7a3820" strokeWidth="2" fill="none" strokeLinecap="round"/>
        {/* arm raised */}
        <ellipse cx="130" cy="85" rx="10" ry="25" fill="#b07840" transform="rotate(-25,130,85)"/>
        {/* hand */}
        <ellipse cx="148" cy="68" rx="8" ry="7" fill="#b07840"/>
        {/* snack/cookie in hand */}
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

// ─── Timer / Calendar ─────────────────────────────────────────────────────────

function TimerButton({ state, value }: { state:TimerState; value:string }) {
  if (state==="running") return (
    <div style={{ display:"flex", alignItems:"center", gap:5, marginLeft:"auto" }}>
      <button style={{ width:20, height:20, borderRadius:"50%", background:"#7C5AC2", border:"none", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", flexShrink:0, padding:0 }}>
        <div style={{ display:"flex", gap:2 }}>
          <div style={{ width:2, height:7, background:"#fff", borderRadius:1 }}/>
          <div style={{ width:2, height:7, background:"#fff", borderRadius:1 }}/>
        </div>
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

function CalendarBtn() {
  return (
    <div style={{ display:"flex", alignItems:"center", marginLeft:"auto" }}>
      <button style={{ width:20, height:20, borderRadius:"50%", background:"transparent", border:"1.5px solid #3a3a3a", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", padding:0 }}>
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="#4a4a4a" strokeWidth="1.5"/>
          <path d="M5 1.5v3M11 1.5v3M1.5 7h13" stroke="#4a4a4a" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress, state }: { progress:number; state:TimerState }) {
  const fill = state==="running" ? "#7C5AC2" : state==="overtime" ? "#ef4444" : "#3a3a3a";
  return (
    <div style={{ height:3, background:"#2a2a2a", borderRadius:2, overflow:"hidden", flex:1 }}>
      <div style={{ width:`${Math.min(progress,100)}%`, height:"100%", background:fill, borderRadius:2 }}/>
    </div>
  );
}

// ─── Icons ────────────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4M6 7v5M10 7v5M3 4l.9 9a1.5 1.5 0 001.5 1.35h5.2A1.5 1.5 0 0012.1 13L13 4"
        stroke="#555" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

function DotsMenu() {
  return (
    <button style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", padding:"0 2px", letterSpacing:1, fontSize:13, lineHeight:1 }}>···</button>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task:Task }) {
  const [hovered, setHovered] = useState(false);
  const isDragged = task.isDragged;

  return (
    <div
      onMouseEnter={()=>setHovered(true)}
      onMouseLeave={()=>setHovered(false)}
      style={{
        background: isDragged ? "#252528" : "#2C2C2E",
        borderRadius:8,
        overflow:"hidden",
        boxShadow: isDragged
          ? "0 16px 40px rgba(0,0,0,0.75), 0 4px 12px rgba(0,0,0,0.5)"
          : hovered
            ? "0 8px 24px rgba(0,0,0,0.5)"
            : "0 1px 3px rgba(0,0,0,0.3)",
        transform: isDragged ? "rotate(1.5deg) scale(1.02)" : hovered ? "translateY(-1px)" : "none",
        transition:"box-shadow 0.15s, transform 0.15s",
        cursor: isDragged ? "grabbing" : "pointer",
        flexShrink:0,
        border: isDragged ? "1px solid rgba(255,255,255,0.06)" : "none",
      }}
    >
      {task.coverImage && <CoverImage type={task.coverImage}/>}

      <div style={{ padding:"10px 12px", display:"flex", flexDirection:"column", gap:8 }}>
        {/* Row 1: tags + date + action icon */}
        <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", gap:4 }}>
          <div style={{ display:"flex", flexWrap:"wrap", gap:4, flex:1, minWidth:0 }}>
            {task.showStatusBadge && <AddStatusBadge/>}
            {task.tags.map(tag=><TagBadge key={tag.label} tag={tag}/>)}
            {!task.showStatusBadge && task.tags.length===0 && task.id!=="t4" && <AddStatusBadge/>}
          </div>
          <div style={{ display:"flex", alignItems:"center", gap:5, flexShrink:0, marginTop:1 }}>
            {task.date && !isDragged && (
              <span style={{ fontSize:10, color:"#666", whiteSpace:"nowrap" }}>{task.date}</span>
            )}
            {isDragged ? <DotsMenu/> : (
              <div style={{ opacity: hovered ? 1 : 0.35, transition:"opacity 0.15s" }}><TrashIcon/></div>
            )}
          </div>
        </div>

        {/* Title */}
        {task.title && (
          <div style={{ fontSize:13, fontWeight:500, color:"#dfdfdf", lineHeight:1.45 }}>{task.title}</div>
        )}

        {/* Footer row 1 */}
        <div style={{ display:"flex", alignItems:"center", gap:6 }}>
          <div style={{ display:"flex", alignItems:"center", gap:5, flex:1, minWidth:0 }}>
            {task.assignees>0 && <AvatarCluster count={task.assignees} size={20}/>}
            {task.addAssignee && (
              <button style={{ width:20, height:20, borderRadius:"50%", border:"1.5px dashed #3a3a3a", background:"transparent", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#555", fontSize:13 }}>+</button>
            )}
            {task.attachments!==undefined && (
              <div style={{ display:"flex", alignItems:"center", gap:2, fontSize:11 }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M13 7L8 12C6.5 13.5 4.5 13.5 3 12C1.5 10.5 1.5 8.5 3 7L8 2C9 1 10.5 1 11.5 2C12.5 3 12.5 4.5 11.5 5.5L7 10C6.5 10.5 5.5 10.5 5 10C4.5 9.5 4.5 8.5 5 8L9 4" stroke="#666" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span style={{ color:"#666" }}>{task.attachments}</span>
              </div>
            )}
            {task.comments!==undefined && (
              <div style={{ display:"flex", alignItems:"center", gap:2, fontSize:11 }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M14 9.5C14 10.33 13.33 11 12.5 11H5L2 14V3.5C2 2.67 2.67 2 3.5 2H12.5C13.33 2 14 2.67 14 3.5V9.5Z" stroke="#666" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                <span style={{ color:"#666" }}>{task.comments}</span>
              </div>
            )}
          </div>
          {task.footerIcon==="timer" ? <TimerButton state={task.timerState} value={task.timerValue}/> : <CalendarBtn/>}
        </div>

        {/* Footer row 2: progress */}
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

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({ col }: { col:Column }) {
  return (
    <div style={{ minWidth:220, width:220, display:"flex", flexDirection:"column", gap:10, flexShrink:0 }}>
      <div style={{ display:"flex", alignItems:"center", gap:6, padding:"0 2px 6px" }}>
        <span style={{ fontSize:13, fontWeight:600, color:"#d0d0d4" }}>{col.title}</span>
        <span style={{ fontSize:11, color:"#505058" }}>{col.count} Tasks</span>
        <div style={{ flex:1 }}/>
        <button style={{ background:"transparent", border:"none", color:"#505058", cursor:"pointer", fontSize:16, lineHeight:1 }}>+</button>
        <button style={{ background:"transparent", border:"none", color:"#505058", cursor:"pointer", letterSpacing:1, fontSize:13 }}>···</button>
      </div>
      <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
        {col.tasks.map(task=><TaskCard key={task.id} task={task}/>)}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon:"home",      label:"Home" },
  { icon:"dashboard", label:"Dashboard" },
  { icon:"projects",  label:"Projects" },
  { icon:"tasks",     label:"My Tasks" },
  { icon:"members",   label:"Members" },
  { icon:"goals",     label:"Goals" },
  { icon:"settings",  label:"Settings" },
];

const PROJECT_ITEMS = [
  { name:"Apvision",           color:"#6366F1" },
  { name:"AlertSec",           color:"#3B82F6" },
  { name:"Bomani Cold Buzz",   color:"#F59E0B" },
  { name:"Danyon",             color:"#EC4899" },
  { name:"JB Consulting",      color:"#10B981" },
  { name:"My Choice Software", color:"#8B5CF6" },
  { name:"StrataScratch",      color:"#14B8A6" },
  { name:"Wake Up Coffee",     color:"#F97316" },
];

function NavIcon({ icon }: { icon:string }) {
  const d: Record<string,JSX.Element> = {
    home:      <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    projects:  <><path d="M4 6h16M4 10h12M4 14h8M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    tasks:     <><path d="M9 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    members:   <><circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 8a3 3 0 010 6M21 20c0-2.5-1.8-4.6-4-5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    goals:     <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    settings:  <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  };
  return <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink:0 }}>{d[icon]}</svg>;
}

function Sidebar() {
  const [favOpen, setFavOpen] = useState(true);
  const [projOpen, setProjOpen] = useState(true);
  const [hovFav, setHovFav] = useState<string|null>(null);
  const [hovNav, setHovNav] = useState<string|null>(null);

  return (
    <div style={{ width:200, minWidth:200, height:"100%", background:"#1A1A1A", borderRight:"1px solid #252525", display:"flex", flexDirection:"column", overflowY:"auto", flexShrink:0 }}>
      {/* Logo */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 14px 10px" }}>
        <div style={{ display:"flex", alignItems:"center", gap:8 }}>
          <div style={{ width:28, height:28, background:"linear-gradient(135deg,#4f2d8a,#7C5AC2)", borderRadius:7, display:"flex", alignItems:"center", justifyContent:"center", fontSize:14, fontWeight:800, color:"#fff", letterSpacing:"-1px" }}>
            ▲
          </div>
          <span style={{ fontSize:14, fontWeight:700, color:"#f0f0f0", letterSpacing:"-0.3px" }}>brandux</span>
        </div>
        <button style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", padding:2 }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none"><path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ padding:"4px 6px" }}>
        {NAV_ITEMS.map(item=>(
          <div key={item.label} onMouseEnter={()=>setHovNav(item.label)} onMouseLeave={()=>setHovNav(null)}
            style={{ display:"flex", alignItems:"center", gap:9, padding:"7px 8px", color: hovNav===item.label?"#c4c4c8":"#666", cursor:"pointer", fontSize:13, borderRadius:6, background: hovNav===item.label?"#242424":"transparent", transition:"all 0.12s" }}>
            <NavIcon icon={item.icon}/><span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ height:8 }}/>

      {/* Favorites */}
      <div style={{ padding:"0 6px" }}>
        <button onClick={()=>setFavOpen(!favOpen)} style={{ display:"flex", alignItems:"center", justifyContent:"space-between", width:"100%", padding:"5px 8px", background:"transparent", border:"none", color:"#555", cursor:"pointer", fontSize:11, fontWeight:600, letterSpacing:"0.04em" }}>
          <span>Favorite</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: favOpen?"rotate(0)":"rotate(-90deg)", transition:"0.2s" }}>
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {favOpen && (
          <div>
            {[
              { name:"StrataScratch", color:"#10B981", iconShape:"circle", active:true },
              { name:"AlertSec",      color:"#3B82F6", iconShape:"square",  active:false },
            ].map(fav=>(
              <div key={fav.name} onMouseEnter={()=>setHovFav(fav.name)} onMouseLeave={()=>setHovFav(null)}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"6px 8px", background: fav.active?"#242424": hovFav===fav.name?"#1e1e1e":"transparent", borderRadius:6, cursor:"pointer", fontSize:13, color: fav.active?"#e0e0e0":"#888", position:"relative" }}>
                {/* Faithful icon from reference */}
                <div style={{
                  width:18, height:18,
                  borderRadius: fav.iconShape==="circle" ? "50%" : 5,
                  background: fav.color,
                  flexShrink:0,
                  display:"flex", alignItems:"center", justifyContent:"center",
                  fontSize:9, fontWeight:800, color:"#fff",
                }}>
                  {fav.name[0]}
                </div>
                <span style={{ flex:1, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fav.name}</span>
                {hovFav===fav.name && <span style={{ color:"#555", fontSize:13, letterSpacing:1 }}>···</span>}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height:6 }}/>

      {/* Projects */}
      <div style={{ padding:"0 6px", flex:1 }}>
        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"5px 8px" }}>
          <span style={{ fontSize:11, fontWeight:600, color:"#555", letterSpacing:"0.04em" }}>Projects</span>
          <div style={{ display:"flex", gap:4 }}>
            <button style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer", fontSize:15, lineHeight:1 }}>+</button>
            <button onClick={()=>setProjOpen(!projOpen)} style={{ background:"transparent", border:"none", color:"#555", cursor:"pointer" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none" style={{ transform: projOpen?"rotate(0)":"rotate(-90deg)", transition:"0.2s" }}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        {projOpen && (
          <div>
            {PROJECT_ITEMS.map(proj=>(
              <div key={proj.name}
                style={{ display:"flex", alignItems:"center", gap:8, padding:"5px 8px", borderRadius:6, cursor:"pointer", fontSize:12, color:"#777" }}
                onMouseEnter={e=>{ (e.currentTarget as HTMLElement).style.background="#242424"; (e.currentTarget as HTMLElement).style.color="#bbb"; }}
                onMouseLeave={e=>{ (e.currentTarget as HTMLElement).style.background="transparent"; (e.currentTarget as HTMLElement).style.color="#777"; }}>
                <div style={{ width:18, height:18, borderRadius:5, background:proj.color, flexShrink:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:9, fontWeight:700, color:"rgba(255,255,255,0.9)", position:"relative", overflow:"hidden" }}>
                  <div style={{ position:"absolute", top:-3, right:-3, width:10, height:10, borderRadius:"50%", background:"rgba(255,255,255,0.18)" }}/>
                  {proj.name[0]}
                </div>
                <span style={{ overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{proj.name}</span>
              </div>
            ))}
            <div style={{ padding:"6px 8px" }}>
              <span style={{ fontSize:11, color:"#3a3a3a", cursor:"pointer" }}>Show All Projects ∨</span>
            </div>
          </div>
        )}
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
        {/* Left */}
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
          {/* Status badge */}
          <div style={{ display:"flex", alignItems:"center", gap:6, background:"rgba(16,185,129,0.12)", border:"1px solid rgba(16,185,129,0.25)", borderRadius:20, padding:"4px 10px", marginLeft:4 }}>
            <div style={{ width:15, height:15, borderRadius:"50%", background:"#10B981", display:"flex", alignItems:"center", justifyContent:"center" }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none"><path d="M1.5 4L3 5.5L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </div>
            <span style={{ fontSize:12, color:"#10B981", fontWeight:500 }}>According to plan</span>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 3.5l2.5 2.5 2.5-2.5" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </div>
        </div>
        {/* Right */}
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <AvatarCluster count={5} size={28}/>
          <button style={{ width:30, height:30, borderRadius:"50%", background:"#242424", border:"1px solid #2e2e2e", display:"flex", alignItems:"center", justifyContent:"center", cursor:"pointer", color:"#666" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none"><circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/><path d="M21 21l-3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/></svg>
          </button>
        </div>
      </div>
      {/* Tabs */}
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

// ─── Board ────────────────────────────────────────────────────────────────────

function Board() {
  return (
    <div style={{ flex:1, overflowX:"auto", overflowY:"auto", padding:"18px 20px", display:"flex", gap:16, alignItems:"flex-start", background:"#111111" }}>
      {COLUMNS.map(col=><BoardColumn key={col.id} col={col}/>)}
    </div>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export function TeltechLedger() {
  return (
    <div style={{ width:"100vw", height:"100vh", display:"flex", background:"#111111", fontFamily:"'Inter','SF Pro Display',-apple-system,'Segoe UI',sans-serif", overflow:"hidden", color:"#e0e0e0", fontSize:13 }}>
      <Sidebar/>
      <div style={{ flex:1, display:"flex", flexDirection:"column", overflow:"hidden", minWidth:0 }}>
        <Header/>
        <Board/>
      </div>
    </div>
  );
}
