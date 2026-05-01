import { useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

type TagColor = "purple" | "yellow" | "gray" | "blue" | "pink" | "red";

interface Tag {
  label: string;
  color: TagColor;
}

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
}

interface Column {
  id: string;
  title: string;
  count: number;
  tasks: Task[];
}

// ─── Mock Data ────────────────────────────────────────────────────────────────

const COLUMNS: Column[] = [
  {
    id: "untitled",
    title: "Untitled",
    count: 4,
    tasks: [
      {
        id: "u1",
        tags: [{ label: "QA", color: "blue" }],
        title: "Testing (Platform Pages)",
        assignees: 2,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "calendar",
        progress: 0,
        estTime: "",
      },
      {
        id: "u2",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "No billing", color: "gray" },
        ],
        title: "StrataScratch - Dribbble Presentation (Shot #4)",
        assignees: 3,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "timer",
        progress: 0,
        estTime: "Est: 8:00 h",
      },
      {
        id: "u3",
        tags: [],
        title: "Get customer feedback for Clutch",
        assignees: 1,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "calendar",
        progress: 0,
        estTime: "",
        showStatusBadge: true,
      },
      {
        id: "u4",
        tags: [{ label: "Management", color: "pink" }],
        title: "Project retrospective",
        assignees: 0,
        addAssignee: true,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "calendar",
        progress: 0,
        estTime: "Est: 2:00 h",
      },
    ],
  },
  {
    id: "todo",
    title: "To Do",
    count: 8,
    tasks: [
      {
        id: "t1",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "Marketing", color: "yellow" },
          { label: "No billing", color: "gray" },
        ],
        date: "3 Jun",
        title: "StrataScratch - Instagram Post",
        assignees: 3,
        comments: 3,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "timer",
        progress: 0,
        estTime: "Est: 0:30 h",
      },
      {
        id: "t2",
        tags: [{ label: "UX/UI", color: "purple" }],
        date: "3 Jun",
        title: "StrataScratch - New Pricing Page",
        assignees: 1,
        attachments: 3,
        comments: 1,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "timer",
        progress: 0,
        estTime: "Est: 3:00 h",
      },
      {
        id: "t3",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "Marketing", color: "yellow" },
        ],
        date: "11 Jun",
        title: "StrataScratch - Display Ads (#3)",
        assignees: 3,
        comments: 3,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "timer",
        progress: 0,
        estTime: "Est: 8:00 h",
      },
      {
        id: "t4",
        coverImage: "photo",
        tags: [],
        title: "",
        assignees: 0,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "calendar",
        progress: 0,
        estTime: "Est: 2:00 h",
        showStatusBadge: false,
      },
    ],
  },
  {
    id: "doing",
    title: "Doing",
    count: 14,
    tasks: [
      {
        id: "d1",
        coverImage: "dashboard",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "No billing", color: "gray" },
        ],
        date: "2 Jun",
        title: "StrataScratch - Behance Presentation",
        assignees: 3,
        attachments: 2,
        comments: 17,
        timerState: "running",
        timerValue: "16:32 h",
        footerIcon: "timer",
        progress: 55,
        estTime: "Est: 30:00 h",
      },
      {
        id: "d2",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "Marketing", color: "yellow" },
        ],
        date: "4 Jun",
        title: "StrataScratch - Display Ads (#2)",
        assignees: 3,
        comments: 3,
        timerState: "running",
        timerValue: "0:57 h",
        footerIcon: "timer",
        progress: 25,
        estTime: "Est: 4:00 h",
      },
      {
        id: "d3",
        tags: [{ label: "UX/UI", color: "purple" }],
        date: "14 Jun",
        title: "Strata Scratch - Animation for loader/splash screen",
        assignees: 1,
        attachments: 1,
        comments: 1,
        timerState: "running",
        timerValue: "0:46 h",
        footerIcon: "timer",
        progress: 46,
        estTime: "Est: 1:00 h",
      },
    ],
  },
  {
    id: "review",
    title: "Review",
    count: 2,
    tasks: [
      {
        id: "r1",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "Marketing", color: "yellow" },
        ],
        date: "28 May",
        title: "StrataScratch - Display Ads",
        assignees: 3,
        comments: 3,
        timerState: "overtime",
        timerValue: "9:43",
        footerIcon: "timer",
        progress: 100,
        estTime: "Est: 8:00 h",
      },
      {
        id: "r2",
        coverImage: "figma",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "No billing", color: "gray" },
        ],
        date: "24 Jun",
        title: "StrataScratch - Dribbble Presentation (Shot #3)",
        assignees: 2,
        comments: 5,
        timerState: "overtime",
        timerValue: "2:54 h",
        footerIcon: "timer",
        progress: 100,
        estTime: "Est: 3:00 h",
      },
    ],
  },
  {
    id: "done",
    title: "Done",
    count: 6,
    tasks: [
      {
        id: "dn1",
        tags: [{ label: "UX/UI", color: "purple" }],
        title: "New website homepage",
        assignees: 2,
        timerState: "idle",
        timerValue: "8:00 h",
        footerIcon: "timer",
        progress: 100,
        estTime: "Est: 8:00 h",
      },
      {
        id: "dn2",
        tags: [{ label: "QA", color: "blue" }],
        title: "Fix and test in Zeplin",
        assignees: 1,
        timerState: "idle",
        timerValue: "3:00 h",
        footerIcon: "timer",
        progress: 100,
        estTime: "Est: 3:00 h",
      },
      {
        id: "dn3",
        tags: [{ label: "QA", color: "blue" }],
        title: "Fix the bug on mobile",
        assignees: 1,
        timerState: "idle",
        timerValue: "1:30 h",
        footerIcon: "timer",
        progress: 100,
        estTime: "Est: 2:00 h",
      },
    ],
  },
];

// ─── Color Helpers ────────────────────────────────────────────────────────────

const TAG_STYLES: Record<TagColor, { bg: string; dot: string; text: string }> = {
  purple: { bg: "rgba(124, 90, 194, 0.22)", dot: "#7C5AC2", text: "#b39deb" },
  yellow: { bg: "rgba(234, 179, 8, 0.2)",   dot: "#EAB308", text: "#fcd34d" },
  gray:   { bg: "rgba(113, 113, 122, 0.22)", dot: "#71717a", text: "#a1a1aa" },
  blue:   { bg: "rgba(59, 130, 246, 0.2)",   dot: "#3B82F6", text: "#93c5fd" },
  pink:   { bg: "rgba(236, 72, 153, 0.2)",   dot: "#EC4899", text: "#f9a8d4" },
  red:    { bg: "rgba(239, 68, 68, 0.2)",    dot: "#ef4444", text: "#fca5a5" },
};

// ─── Avatar (photo-realistic style) ──────────────────────────────────────────

type AvatarSpec = { bg: string; skin: string; label: string };
const AVATAR_SPECS: AvatarSpec[] = [
  { bg: "#4f46e5", skin: "#c6a882", label: "AS" },
  { bg: "#0891b2", skin: "#8d5524", label: "MK" },
  { bg: "#7c3aed", skin: "#e8c9a0", label: "JL" },
  { bg: "#b91c1c", skin: "#c68642", label: "RD" },
  { bg: "#065f46", skin: "#d4a574", label: "TW" },
  { bg: "#1d4ed8", skin: "#f1c27d", label: "PO" },
  { bg: "#92400e", skin: "#9a6b4b", label: "YN" },
];

function Avatar({ index, size = 24 }: { index: number; size?: number }) {
  const spec = AVATAR_SPECS[index % AVATAR_SPECS.length];
  const r = size / 2;
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: spec.bg,
      border: "2px solid #252525",
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0,
      overflow: "hidden",
      position: "relative",
    }}>
      {/* body */}
      <div style={{
        position: "absolute",
        bottom: -2,
        width: size * 0.65,
        height: size * 0.55,
        background: spec.bg,
        borderRadius: "50% 50% 0 0",
        border: `2px solid rgba(255,255,255,0.15)`,
      }} />
      {/* head */}
      <div style={{
        position: "absolute",
        top: size * 0.12,
        width: size * 0.44,
        height: size * 0.44,
        background: spec.skin,
        borderRadius: "50%",
      }} />
    </div>
  );
}

function AvatarCluster({ count, size = 22 }: { count: number; size?: number }) {
  const shown = Math.min(count, 4);
  const overlap = size * 0.32;
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: shown }).map((_, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -overlap, zIndex: shown - i }}>
          <Avatar index={i} size={size} />
        </div>
      ))}
    </div>
  );
}

// ─── Cover Images ─────────────────────────────────────────────────────────────

function CoverImage({ type }: { type: string }) {
  if (type === "dashboard") {
    // Dark UI dashboard screenshot — purple/teal theme with UI elements
    return (
      <div style={{
        width: "100%", height: 120,
        borderRadius: "8px 8px 0 0",
        background: "#0d0d1a",
        overflow: "hidden",
        position: "relative",
        display: "flex",
        flexDirection: "column",
        padding: "10px 10px 0",
        gap: 5,
      }}>
        {/* top bar */}
        <div style={{ display: "flex", gap: 4, alignItems: "center", marginBottom: 4 }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#ef4444" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#f59e0b" }} />
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e" }} />
          <div style={{ flex: 1, height: 6, borderRadius: 3, background: "#1e1e3a", marginLeft: 4 }} />
        </div>
        {/* main content area */}
        <div style={{ display: "flex", gap: 5, flex: 1 }}>
          {/* sidebar */}
          <div style={{ width: 18, background: "#12122a", borderRadius: 3, display: "flex", flexDirection: "column", gap: 3, padding: 3 }}>
            {[1,2,3,4].map(i => (
              <div key={i} style={{ height: 4, borderRadius: 2, background: i === 2 ? "#7C5AC2" : "#1e1e3a" }} />
            ))}
          </div>
          {/* content */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 4 }}>
            <div style={{ display: "flex", gap: 4, height: 30 }}>
              {[
                { bg: "linear-gradient(135deg, #7C5AC2, #a78bfa)", w: "35%" },
                { bg: "linear-gradient(135deg, #0ea5e9, #38bdf8)", w: "28%" },
                { bg: "linear-gradient(135deg, #f59e0b, #fbbf24)", w: "32%" },
              ].map((b, i) => (
                <div key={i} style={{ width: b.w, height: "100%", borderRadius: 4, background: b.bg }} />
              ))}
            </div>
            <div style={{ display: "flex", gap: 3, flex: 1, alignItems: "flex-end" }}>
              {[70, 45, 85, 55, 65, 40, 75].map((h, i) => (
                <div key={i} style={{
                  flex: 1, height: `${h}%`,
                  background: i % 3 === 0 ? "#7C5AC2" : i % 3 === 1 ? "#0ea5e9" : "#2a2a4a",
                  borderRadius: "2px 2px 0 0",
                }} />
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (type === "figma") {
    // Figma/design tool style - light background with design elements
    return (
      <div style={{
        width: "100%", height: 110,
        borderRadius: "8px 8px 0 0",
        background: "#f0fdf4",
        overflow: "hidden",
        position: "relative",
        padding: 10,
        display: "flex",
        gap: 8,
      }}>
        {/* Left panel */}
        <div style={{
          width: 70,
          background: "#fff",
          borderRadius: 4,
          padding: 6,
          boxShadow: "0 1px 4px rgba(0,0,0,0.1)",
          display: "flex",
          flexDirection: "column",
          gap: 3,
        }}>
          {["#e2e8f0","#e2e8f0","#c6f6d5","#e2e8f0","#c6f6d5"].map((c, i) => (
            <div key={i} style={{ height: 6, borderRadius: 2, background: c, width: i % 2 === 0 ? "100%" : "70%" }} />
          ))}
        </div>
        {/* Canvas area */}
        <div style={{
          flex: 1,
          background: "#e8f5e9",
          borderRadius: 4,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          padding: 6,
        }}>
          <div style={{ height: 8, borderRadius: 2, background: "#10B981", width: "80%" }} />
          <div style={{ height: 5, borderRadius: 2, background: "#a7f3d0", width: "60%" }} />
          <div style={{ display: "flex", gap: 4, marginTop: 2 }}>
            <div style={{ height: 20, flex: 1, borderRadius: 3, background: "#34d399" }} />
            <div style={{ height: 20, flex: 1, borderRadius: 3, background: "#6ee7b7" }} />
            <div style={{ height: 20, flex: 1, borderRadius: 3, background: "#a7f3d0" }} />
          </div>
        </div>
      </div>
    );
  }

  if (type === "photo") {
    // Woman photo card
    return (
      <div style={{
        width: "100%", height: 120,
        borderRadius: "8px 8px 0 0",
        background: "linear-gradient(180deg, #c8a882 0%, #b07d55 40%, #8b6347 70%, #6b4c35 100%)",
        overflow: "hidden",
        display: "flex",
        alignItems: "flex-end",
        justifyContent: "center",
        position: "relative",
      }}>
        {/* silhouette of person */}
        <svg viewBox="0 0 100 100" width="80" height="100" style={{ position: "absolute", bottom: 0 }}>
          {/* body */}
          <ellipse cx="50" cy="85" rx="25" ry="20" fill="#5a3e28" />
          {/* head */}
          <circle cx="50" cy="52" r="18" fill="#c8956c" />
          {/* hair */}
          <ellipse cx="50" cy="42" rx="18" ry="13" fill="#1a0a00" />
          <ellipse cx="38" cy="48" rx="6" ry="12" fill="#1a0a00" />
          <ellipse cx="62" cy="48" rx="6" ry="12" fill="#1a0a00" />
          {/* neck */}
          <rect x="44" y="66" width="12" height="10" fill="#c8956c" />
          {/* arm raised */}
          <ellipse cx="75" cy="70" rx="5" ry="18" fill="#c8956c" transform="rotate(-20, 75, 70)" />
          {/* hand/object */}
          <circle cx="80" cy="55" r="5" fill="#f59e0b" />
        </svg>
        {/* background wall accent */}
        <div style={{
          position: "absolute", top: 0, right: 0, width: "40%", height: "100%",
          background: "linear-gradient(180deg, #d4b896 0%, #c4a070 100%)",
        }} />
      </div>
    );
  }

  return null;
}

// ─── Tag Badge ────────────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: Tag }) {
  const s = TAG_STYLES[tag.color];
  return (
    <span style={{
      background: s.bg,
      color: s.text,
      fontSize: 10,
      fontWeight: 500,
      padding: "2px 6px 2px 5px",
      borderRadius: 4,
      whiteSpace: "nowrap",
      display: "inline-flex",
      alignItems: "center",
      gap: 4,
    }}>
      <span style={{
        width: 5, height: 5,
        borderRadius: 1.5,
        background: s.dot,
        flexShrink: 0,
        display: "inline-block",
      }} />
      {tag.label}
    </span>
  );
}

// ─── Status Badge (Add Status) ────────────────────────────────────────────────

function AddStatusBadge() {
  return (
    <span style={{
      fontSize: 10, color: "#555",
      padding: "2px 7px",
      border: "1px dashed #444",
      borderRadius: 4,
      display: "inline-flex",
      alignItems: "center",
      gap: 3,
      whiteSpace: "nowrap",
    }}>
      <span style={{ fontSize: 11, lineHeight: 1 }}>+</span>
      Add Status
    </span>
  );
}

// ─── Timer Button ─────────────────────────────────────────────────────────────

function TimerButton({ state, value }: { state: TimerState; value: string }) {
  if (state === "running") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
        <button style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "#7C5AC2",
          border: "none",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0,
          padding: 0,
        }}>
          <div style={{ display: "flex", gap: 2 }}>
            <div style={{ width: 2, height: 7, background: "#fff", borderRadius: 1 }} />
            <div style={{ width: 2, height: 7, background: "#fff", borderRadius: 1 }} />
          </div>
        </button>
        <span style={{ fontSize: 11, color: "#7C5AC2", fontWeight: 600, whiteSpace: "nowrap" }}>{value}</span>
      </div>
    );
  }
  if (state === "overtime") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
        <button style={{
          width: 20, height: 20, borderRadius: "50%",
          background: "transparent",
          border: "1.5px solid #ef4444",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer", flexShrink: 0, padding: 0,
        }}>
          <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #ef4444", marginLeft: 1 }} />
        </button>
        <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600, whiteSpace: "nowrap" }}>{value}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5, marginLeft: "auto" }}>
      <button style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "transparent",
        border: "1.5px solid #404040",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", flexShrink: 0, padding: 0,
      }}>
        <div style={{ width: 0, height: 0, borderTop: "3.5px solid transparent", borderBottom: "3.5px solid transparent", borderLeft: "5px solid #555", marginLeft: 1 }} />
      </button>
      <span style={{ fontSize: 11, color: "#505050" }}>{value}</span>
    </div>
  );
}

function CalendarIconBtn() {
  return (
    <div style={{ display: "flex", alignItems: "center", marginLeft: "auto" }}>
      <button style={{
        width: 20, height: 20, borderRadius: "50%",
        background: "transparent",
        border: "1.5px solid #404040",
        display: "flex", alignItems: "center", justifyContent: "center",
        cursor: "pointer", padding: 0,
      }}>
        <svg width="9" height="9" viewBox="0 0 16 16" fill="none">
          <rect x="1.5" y="3" width="13" height="11" rx="1.5" stroke="#555" strokeWidth="1.5"/>
          <path d="M5 1.5v3M11 1.5v3M1.5 7h13" stroke="#555" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress, state }: { progress: number; state: TimerState }) {
  const fill =
    state === "running" ? "#7C5AC2" :
    state === "overtime" ? "#ef4444" :
    progress === 100 ? "#3a3a3a" : "#3a3a3a";
  const pct = Math.min(progress, 100);
  return (
    <div style={{ height: 3, background: "#333", borderRadius: 2, overflow: "hidden", flex: 1 }}>
      <div style={{ width: `${pct}%`, height: "100%", background: fill, borderRadius: 2 }} />
    </div>
  );
}

// ─── Trash Icon ───────────────────────────────────────────────────────────────

function TrashIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
      <path d="M2 4h12M5 4V2.5A1.5 1.5 0 016.5 1h3A1.5 1.5 0 0111 2.5V4M6 7v5M10 7v5M3 4l.9 9a1.5 1.5 0 001.5 1.35h5.2A1.5 1.5 0 0012.1 13L13 4"
        stroke="#666" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: Task }) {
  const [hovered, setHovered] = useState(false);
  const hasTags = task.tags.length > 0;

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#2D2D30",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: hovered
          ? "0 10px 30px rgba(0,0,0,0.6), 0 2px 8px rgba(0,0,0,0.4)"
          : "0 1px 3px rgba(0,0,0,0.25)",
        transform: hovered ? "translateY(-1px)" : "none",
        transition: "box-shadow 0.15s, transform 0.15s",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {task.coverImage && <CoverImage type={task.coverImage} />}

      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 9 }}>
        {/* Row 1: tags + date + trash */}
        <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1, minWidth: 0 }}>
            {task.showStatusBadge && <AddStatusBadge />}
            {hasTags && task.tags.map((tag) => <TagBadge key={tag.label} tag={tag} />)}
            {!hasTags && !task.showStatusBadge && task.id !== "t4" && <AddStatusBadge />}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {task.date && (
              <span style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap" }}>{task.date}</span>
            )}
            <div style={{ opacity: hovered ? 1 : 0.4, transition: "opacity 0.15s" }}>
              <TrashIcon />
            </div>
          </div>
        </div>

        {/* Title */}
        {task.title && (
          <div style={{ fontSize: 13, fontWeight: 500, color: "#e0e0e0", lineHeight: 1.45 }}>
            {task.title}
          </div>
        )}

        {/* Footer row 1: avatars + meta + timer */}
        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
          {/* Avatars */}
          <div style={{ display: "flex", alignItems: "center", gap: 5, flex: 1, minWidth: 0 }}>
            {task.assignees > 0 && <AvatarCluster count={task.assignees} size={20} />}
            {task.addAssignee && (
              <button style={{
                width: 20, height: 20, borderRadius: "50%",
                border: "1.5px dashed #444", background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#555", fontSize: 13, lineHeight: 1,
              }}>+</button>
            )}
            {/* attachment */}
            {task.attachments !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, color: "#555", fontSize: 11 }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M13 7L8 12C6.5 13.5 4.5 13.5 3 12C1.5 10.5 1.5 8.5 3 7L8 2C9 1 10.5 1 11.5 2C12.5 3 12.5 4.5 11.5 5.5L7 10C6.5 10.5 5.5 10.5 5 10C4.5 9.5 4.5 8.5 5 8L9 4"
                    stroke="#666" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span style={{ color: "#666" }}>{task.attachments}</span>
              </div>
            )}
            {/* comments */}
            {task.comments !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 2, color: "#555", fontSize: 11 }}>
                <svg width="10" height="10" viewBox="0 0 16 16" fill="none">
                  <path d="M14 9.5C14 10.33 13.33 11 12.5 11H5L2 14V3.5C2 2.67 2.67 2 3.5 2H12.5C13.33 2 14 2.67 14 3.5V9.5Z"
                    stroke="#666" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                <span style={{ color: "#666" }}>{task.comments}</span>
              </div>
            )}
          </div>

          {/* Timer / Calendar */}
          {task.footerIcon === "timer" ? (
            <TimerButton state={task.timerState} value={task.timerValue} />
          ) : (
            <CalendarIconBtn />
          )}
        </div>

        {/* Footer row 2: progress + est */}
        {task.estTime && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ProgressBar progress={task.progress} state={task.timerState} />
            <span style={{ fontSize: 10, color: "#555", whiteSpace: "nowrap", flexShrink: 0 }}>
              {task.estTime}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Board Column ─────────────────────────────────────────────────────────────

function BoardColumn({ col }: { col: Column }) {
  return (
    <div style={{ minWidth: 228, width: 228, display: "flex", flexDirection: "column", gap: 10, flexShrink: 0 }}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 7, padding: "0 2px 6px" }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#d4d4d8" }}>{col.title}</span>
        <span style={{ fontSize: 11, color: "#555" }}>{col.count} Tasks</span>
        <div style={{ flex: 1 }} />
        <button style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 16, lineHeight: 1, padding: "0 2px" }}>+</button>
        <button style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", lineHeight: 1, padding: "0 2px", letterSpacing: 1 }}>···</button>
      </div>
      {/* Tasks */}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {col.tasks.map((task) => (
          <TaskCard key={task.id} task={task} />
        ))}
      </div>
    </div>
  );
}

// ─── Sidebar ─────────────────────────────────────────────────────────────────

const NAV_ITEMS = [
  { icon: "home", label: "Home" },
  { icon: "dashboard", label: "Dashboard" },
  { icon: "projects", label: "Projects" },
  { icon: "tasks", label: "My Tasks" },
  { icon: "members", label: "Members" },
  { icon: "goals", label: "Goals" },
  { icon: "settings", label: "Settings" },
];

const PROJECT_ITEMS = [
  { name: "Apvision",           color: "#6366F1", pattern: "circle" },
  { name: "AlertSec",           color: "#3B82F6", pattern: "shield" },
  { name: "Bomani Cold Buzz",   color: "#F59E0B", pattern: "drop" },
  { name: "Danyon",             color: "#EC4899", pattern: "d" },
  { name: "JB Consulting",      color: "#10B981", pattern: "jb" },
  { name: "My Choice Software", color: "#8B5CF6", pattern: "m" },
  { name: "StrataScratch",      color: "#14B8A6", pattern: "s" },
  { name: "Wake Up Coffee",     color: "#F97316", pattern: "w" },
];

function NavIcon({ icon }: { icon: string }) {
  const paths: Record<string, JSX.Element> = {
    home: <path d="M3 10.5L12 3l9 7.5V20a1 1 0 01-1 1H5a1 1 0 01-1-1v-9.5z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>,
    dashboard: <><rect x="3" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="3" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="3" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><rect x="13" y="13" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    projects: <><path d="M4 6h16M4 10h12M4 14h8M4 18h10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    tasks: <><path d="M9 12l3 3 5-6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none"/></>,
    members: <><circle cx="9" cy="8" r="4" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M17 8a3 3 0 010 6M21 20c0-2.5-1.8-4.6-4-5.3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    goals: <><circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="4.5" stroke="currentColor" strokeWidth="1.5" fill="none"/><circle cx="12" cy="12" r="1.5" fill="currentColor"/></>,
    settings: <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5" fill="none"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  };
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
      {paths[icon]}
    </svg>
  );
}

function ProjectIcon({ color, pattern }: { color: string; pattern: string }) {
  return (
    <div style={{
      width: 18, height: 18, borderRadius: 5,
      background: color,
      flexShrink: 0,
      display: "flex", alignItems: "center", justifyContent: "center",
      fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.9)",
      letterSpacing: "-0.5px",
      position: "relative",
      overflow: "hidden",
    }}>
      <div style={{
        position: "absolute", top: -4, right: -4,
        width: 14, height: 14, borderRadius: "50%",
        background: "rgba(255,255,255,0.15)",
      }} />
      {pattern.length <= 2 ? pattern.toUpperCase() : ""}
    </div>
  );
}

function Sidebar() {
  const [favOpen, setFavOpen] = useState(true);
  const [projOpen, setProjOpen] = useState(true);
  const [hoveredFav, setHoveredFav] = useState<string | null>(null);
  const [hoveredNav, setHoveredNav] = useState<string | null>(null);

  return (
    <div style={{
      width: 205, minWidth: 205, height: "100%",
      background: "#1C1C1C",
      borderRight: "1px solid #2a2a2a",
      display: "flex", flexDirection: "column",
      overflowY: "auto", flexShrink: 0,
    }}>
      {/* Logo */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 14px 10px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 28, height: 28,
            background: "linear-gradient(135deg, #4f46e5 0%, #7C5AC2 100%)",
            borderRadius: 7,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 800, color: "#fff",
            letterSpacing: "-1px",
          }}>A</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#f0f0f0", letterSpacing: "-0.3px" }}>brandux</span>
        </div>
        <button style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", padding: 2 }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav style={{ padding: "6px 8px" }}>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.label}
            onMouseEnter={() => setHoveredNav(item.label)}
            onMouseLeave={() => setHoveredNav(null)}
            style={{
              display: "flex", alignItems: "center", gap: 9,
              padding: "7px 8px",
              color: hoveredNav === item.label ? "#c4c4c8" : "#6b6b75",
              cursor: "pointer", fontSize: 13,
              borderRadius: 6,
              background: hoveredNav === item.label ? "#262626" : "transparent",
              transition: "all 0.12s",
            }}
          >
            <NavIcon icon={item.icon} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      <div style={{ height: 6 }} />

      {/* Favorite section */}
      <div style={{ padding: "0 8px" }}>
        <button
          onClick={() => setFavOpen(!favOpen)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "5px 8px",
            background: "transparent", border: "none",
            color: "#555", cursor: "pointer",
            fontSize: 11, fontWeight: 600,
            letterSpacing: "0.04em",
          }}
        >
          <span>Favorite</span>
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
            style={{ transform: favOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "0.2s" }}>
            <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        {favOpen && (
          <div>
            {[
              { name: "StrataScratch", color: "#10B981", active: true },
              { name: "AlertSec", color: "#3B82F6", active: false },
            ].map((fav) => (
              <div
                key={fav.name}
                onMouseEnter={() => setHoveredFav(fav.name)}
                onMouseLeave={() => setHoveredFav(null)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 8px",
                  background: fav.active ? "#262626" : hoveredFav === fav.name ? "#222" : "transparent",
                  borderRadius: 6, cursor: "pointer",
                  fontSize: 13,
                  color: fav.active ? "#e0e0e0" : "#888",
                  position: "relative",
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: "50%",
                  background: fav.color,
                  flexShrink: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 9, fontWeight: 700, color: "#fff",
                }}>
                  {fav.name[0]}
                </div>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fav.name}
                </span>
                {hoveredFav === fav.name && (
                  <span style={{ color: "#555", fontSize: 13, letterSpacing: 1 }}>···</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ height: 4 }} />

      {/* Projects section */}
      <div style={{ padding: "0 8px", flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "5px 8px" }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#555", letterSpacing: "0.04em" }}>Projects</span>
          <div style={{ display: "flex", gap: 4 }}>
            <button style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", fontSize: 15, lineHeight: 1 }}>+</button>
            <button onClick={() => setProjOpen(!projOpen)} style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer" }}>
              <svg width="10" height="10" viewBox="0 0 10 10" fill="none"
                style={{ transform: projOpen ? "rotate(0deg)" : "rotate(-90deg)", transition: "0.2s" }}>
                <path d="M2 4l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
        </div>
        {projOpen && (
          <div>
            {PROJECT_ITEMS.map((proj) => (
              <div
                key={proj.name}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "5px 8px", borderRadius: 6,
                  cursor: "pointer", fontSize: 12, color: "#777",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#262626";
                  (e.currentTarget as HTMLElement).style.color = "#bbb";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#777";
                }}
              >
                <ProjectIcon color={proj.color} pattern={proj.pattern} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {proj.name}
                </span>
              </div>
            ))}
            <div style={{ padding: "6px 8px" }}>
              <span style={{ fontSize: 11, color: "#444", cursor: "pointer" }}>Show All Projects ∨</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

const TABS = ["Overview", "List", "Boards", "Chronology", "Calendar", "Members", "Channels", "Files"];

function Header() {
  const [activeTab, setActiveTab] = useState("Boards");

  return (
    <div style={{ background: "#1C1C1C", borderBottom: "1px solid #282828", flexShrink: 0 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "11px 20px" }}>
        {/* Left */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "linear-gradient(135deg, #14B8A6 0%, #0891b2 100%)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 15, fontWeight: 700, color: "#fff",
            flexShrink: 0,
          }}>S</div>
          <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#f0f0f0" }}>StrataScratch</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3.5 5.5l3.5 3.5 3.5-3.5" stroke="#777" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ display: "flex", gap: 7, marginLeft: 2 }}>
            <button style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", padding: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v4l3 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button style={{ background: "transparent", border: "none", color: "#555", cursor: "pointer", padding: 2 }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/>
              </svg>
            </button>
          </div>
          {/* Status badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(16,185,129,0.12)",
            border: "1px solid rgba(16,185,129,0.25)",
            borderRadius: 20, padding: "4px 10px", marginLeft: 4,
          }}>
            <div style={{
              width: 15, height: 15, borderRadius: "50%",
              background: "#10B981",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <path d="M1.5 4L3 5.5L6.5 2" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>According to plan</span>
            <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
              <path d="M2 3.5l2.5 2.5 2.5-2.5" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>
        {/* Right */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <AvatarCluster count={5} size={28} />
          <button style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "#262626", border: "1px solid #333",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#777",
          }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
              <path d="M21 21l-3.8-3.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", alignItems: "center", padding: "0 20px", overflowX: "auto" }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 14px",
              background: "transparent", border: "none",
              borderBottom: `2.5px solid ${activeTab === tab ? "#7C5AC2" : "transparent"}`,
              color: activeTab === tab ? "#f0f0f0" : "#5a5a65",
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 13, cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.12s",
            }}
          >
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
    <div style={{
      flex: 1, overflowX: "auto", overflowY: "auto",
      padding: "20px 20px",
      display: "flex", gap: 18,
      alignItems: "flex-start",
      background: "#121212",
    }}>
      {COLUMNS.map((col) => (
        <BoardColumn key={col.id} col={col} />
      ))}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export function TeltechLedger() {
  return (
    <div style={{
      width: "100vw", height: "100vh",
      display: "flex",
      background: "#121212",
      fontFamily: "'Inter', 'SF Pro Display', -apple-system, 'Segoe UI', sans-serif",
      overflow: "hidden",
      color: "#e0e0e0",
      fontSize: 13,
    }}>
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Header />
        <Board />
      </div>
    </div>
  );
}
