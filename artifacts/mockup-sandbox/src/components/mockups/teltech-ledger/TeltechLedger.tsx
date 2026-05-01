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
  maxProgress: number;
  estTime: string;
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
        maxProgress: 100,
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
        maxProgress: 100,
        estTime: "Est: 8:00 h",
      },
      {
        id: "u3",
        tags: [],
        title: "Get customer feedback for Clutch",
        assignees: 1,
        addAssignee: true,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "calendar",
        progress: 0,
        maxProgress: 100,
        estTime: "",
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
        maxProgress: 100,
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
        maxProgress: 100,
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
        maxProgress: 100,
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
        maxProgress: 100,
        estTime: "Est: 8:00 h",
      },
      {
        id: "t4",
        coverImage: "photo",
        tags: [],
        title: "StrataScratch - Social Campaign Photos",
        assignees: 2,
        timerState: "idle",
        timerValue: "00:00",
        footerIcon: "calendar",
        progress: 0,
        maxProgress: 100,
        estTime: "Est: 2:00 h",
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
        maxProgress: 100,
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
        maxProgress: 100,
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
        maxProgress: 100,
        estTime: "Est: 1:00 h",
      },
      {
        id: "d4",
        tags: [
          { label: "UX/UI", color: "purple" },
          { label: "Marketing", color: "yellow" },
        ],
        date: "8 Jun",
        title: "StrataScratch - Email Newsletter",
        assignees: 2,
        comments: 5,
        timerState: "running",
        timerValue: "2:15 h",
        footerIcon: "timer",
        progress: 60,
        maxProgress: 100,
        estTime: "Est: 6:00 h",
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
        maxProgress: 100,
        estTime: "Est: 8:00 h",
      },
      {
        id: "r2",
        coverImage: "design",
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
        maxProgress: 100,
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
        maxProgress: 100,
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
        maxProgress: 100,
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
        maxProgress: 100,
        estTime: "Est: 2:00 h",
      },
    ],
  },
];

// ─── Color Helpers ────────────────────────────────────────────────────────────

const TAG_STYLES: Record<TagColor, { bg: string; text: string }> = {
  purple: { bg: "rgba(124, 90, 194, 0.25)", text: "#a78bfa" },
  yellow: { bg: "rgba(234, 179, 8, 0.25)", text: "#fbbf24" },
  gray: { bg: "rgba(120, 113, 108, 0.3)", text: "#a8a29e" },
  blue: { bg: "rgba(59, 130, 246, 0.25)", text: "#60a5fa" },
  pink: { bg: "rgba(236, 72, 153, 0.25)", text: "#f472b6" },
  red: { bg: "rgba(239, 68, 68, 0.25)", text: "#f87171" },
};

// ─── Avatar ───────────────────────────────────────────────────────────────────

const AVATAR_COLORS = [
  "#7C5AC2", "#3B82F6", "#10B981", "#F59E0B",
  "#EC4899", "#6366F1", "#14B8A6", "#F97316",
];

function Avatar({ index, size = 24 }: { index: number; size?: number }) {
  const color = AVATAR_COLORS[index % AVATAR_COLORS.length];
  const initials = ["AS", "MK", "JL", "RD", "TW"][index % 5];
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: color,
        border: "2px solid #2D2D30",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: size * 0.35,
        fontWeight: 600,
        color: "#fff",
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  );
}

function AvatarCluster({ count, size = 22 }: { count: number; size?: number }) {
  const shown = Math.min(count, 4);
  return (
    <div style={{ display: "flex", alignItems: "center" }}>
      {Array.from({ length: shown }).map((_, i) => (
        <div key={i} style={{ marginLeft: i === 0 ? 0 : -(size * 0.35) }}>
          <Avatar index={i} size={size} />
        </div>
      ))}
    </div>
  );
}

// ─── Cover Images ─────────────────────────────────────────────────────────────

function CoverImage({ type }: { type: string }) {
  if (type === "dashboard") {
    return (
      <div
        style={{
          width: "100%",
          height: 110,
          borderRadius: "8px 8px 0 0",
          background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 40%, #0f3460 70%, #533483 100%)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 8,
          padding: "0 12px",
        }}
      >
        {[
          { w: 80, h: 50, bg: "rgba(124,90,194,0.6)" },
          { w: 60, h: 65, bg: "rgba(59,130,246,0.5)" },
          { w: 50, h: 40, bg: "rgba(16,185,129,0.5)" },
        ].map((r, i) => (
          <div
            key={i}
            style={{
              width: r.w, height: r.h,
              background: r.bg,
              borderRadius: 6,
              flexShrink: 0,
            }}
          />
        ))}
      </div>
    );
  }
  if (type === "design") {
    return (
      <div
        style={{
          width: "100%",
          height: 110,
          borderRadius: "8px 8px 0 0",
          background: "linear-gradient(135deg, #134e4a 0%, #065f46 50%, #047857 100%)",
          overflow: "hidden",
          position: "relative",
          display: "flex",
          alignItems: "flex-end",
          padding: 12,
          gap: 6,
        }}
      >
        {[40, 70, 55, 80, 45].map((h, i) => (
          <div
            key={i}
            style={{
              width: 20, height: h,
              background: `rgba(255,255,255,${0.1 + i * 0.05})`,
              borderRadius: "4px 4px 0 0",
            }}
          />
        ))}
      </div>
    );
  }
  if (type === "photo") {
    return (
      <div
        style={{
          width: "100%",
          height: 110,
          borderRadius: "8px 8px 0 0",
          background: "linear-gradient(160deg, #d4a574 0%, #c8956c 30%, #b07d55 60%, #8b6347 100%)",
          overflow: "hidden",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 32, marginBottom: 4 }}>👩🏾</div>
          <div style={{ width: 60, height: 60, background: "rgba(255,255,255,0.15)", borderRadius: "50%", margin: "0 auto" }} />
        </div>
      </div>
    );
  }
  return null;
}

// ─── TagBadge ────────────────────────────────────────────────────────────────

function TagBadge({ tag }: { tag: Tag }) {
  const s = TAG_STYLES[tag.color];
  return (
    <span
      style={{
        background: s.bg,
        color: s.text,
        fontSize: 10,
        fontWeight: 500,
        padding: "2px 7px",
        borderRadius: 4,
        whiteSpace: "nowrap",
      }}
    >
      {tag.label}
    </span>
  );
}

// ─── Timer Button ─────────────────────────────────────────────────────────────

function TimerButton({ state, value }: { state: TimerState; value: string }) {
  if (state === "running") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          style={{
            width: 22, height: 22,
            borderRadius: "50%",
            background: "rgba(124,90,194,0.25)",
            border: "1.5px solid #7C5AC2",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ display: "flex", gap: 2 }}>
            <div style={{ width: 2.5, height: 8, background: "#7C5AC2", borderRadius: 1 }} />
            <div style={{ width: 2.5, height: 8, background: "#7C5AC2", borderRadius: 1 }} />
          </div>
        </button>
        <span style={{ fontSize: 11, color: "#7C5AC2", fontWeight: 600 }}>{value}</span>
      </div>
    );
  }
  if (state === "overtime") {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
        <button
          style={{
            width: 22, height: 22,
            borderRadius: "50%",
            background: "rgba(239,68,68,0.2)",
            border: "1.5px solid #ef4444",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer",
          }}
        >
          <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #ef4444", marginLeft: 1 }} />
        </button>
        <span style={{ fontSize: 11, color: "#ef4444", fontWeight: 600 }}>{value}</span>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button
        style={{
          width: 22, height: 22,
          borderRadius: "50%",
          background: "transparent",
          border: "1.5px solid #555",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 0, height: 0, borderTop: "4px solid transparent", borderBottom: "4px solid transparent", borderLeft: "6px solid #888", marginLeft: 1 }} />
      </button>
      <span style={{ fontSize: 11, color: "#666" }}>{value}</span>
    </div>
  );
}

function CalendarButton() {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
      <button
        style={{
          width: 22, height: 22,
          borderRadius: "50%",
          background: "transparent",
          border: "1.5px solid #555",
          display: "flex", alignItems: "center", justifyContent: "center",
          cursor: "pointer",
        }}
      >
        <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
          <rect x="1" y="3" width="14" height="12" rx="2" stroke="#888" strokeWidth="1.5"/>
          <path d="M5 1v4M11 1v4M1 7h14" stroke="#888" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      </button>
    </div>
  );
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────

function ProgressBar({ progress, state }: { progress: number; state: TimerState }) {
  const fill = state === "running" ? "#7C5AC2" : state === "overtime" ? "#ef4444" : "#444";
  const pct = Math.min(progress, 100);
  return (
    <div style={{ height: 4, background: "#3a3a3a", borderRadius: 2, overflow: "hidden", flex: 1 }}>
      <div
        style={{
          width: `${pct}%`,
          height: "100%",
          background: fill,
          borderRadius: 2,
        }}
      />
    </div>
  );
}

// ─── Task Card ────────────────────────────────────────────────────────────────

function TaskCard({ task }: { task: Task }) {
  const [hovered, setHovered] = useState(false);

  return (
    <div
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: "#2D2D30",
        borderRadius: 8,
        overflow: "hidden",
        boxShadow: hovered
          ? "0 8px 24px rgba(0,0,0,0.5), 0 2px 8px rgba(0,0,0,0.4)"
          : "0 2px 6px rgba(0,0,0,0.2)",
        transform: hovered ? "translateY(-1px)" : "translateY(0)",
        transition: "all 0.15s ease",
        cursor: "pointer",
        flexShrink: 0,
      }}
    >
      {task.coverImage && <CoverImage type={task.coverImage} />}

      <div style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Tags + date row */}
        {(task.tags.length > 0 || task.date) && (
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 4 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, flex: 1 }}>
              {task.tags.map((tag) => (
                <TagBadge key={tag.label} tag={tag} />
              ))}
              {task.tags.length === 0 && !task.date && (
                <span style={{
                  fontSize: 10, color: "#666", padding: "2px 7px",
                  border: "1px dashed #444", borderRadius: 4,
                }}>
                  Add Status
                </span>
              )}
            </div>
            {task.date && (
              <span style={{ fontSize: 10, color: "#888", whiteSpace: "nowrap", flexShrink: 0 }}>
                {task.date}
              </span>
            )}
          </div>
        )}
        {task.tags.length === 0 && !task.date && task.id !== "u3" && (
          <div>
            <span style={{
              fontSize: 10, color: "#666", padding: "2px 7px",
              border: "1px dashed #444", borderRadius: 4,
            }}>
              Add Status
            </span>
          </div>
        )}
        {task.id === "u3" && (
          <div>
            <span style={{
              fontSize: 10, color: "#666", padding: "2px 7px",
              border: "1px dashed #444", borderRadius: 4,
            }}>
              Add Status
            </span>
          </div>
        )}

        {/* Title */}
        <div style={{ fontSize: 13, fontWeight: 500, color: "#e4e4e7", lineHeight: 1.4 }}>
          {task.title}
        </div>

        {/* Footer row 1: avatars + actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            {task.assignees > 0 && <AvatarCluster count={task.assignees} size={22} />}
            {task.addAssignee && (
              <button style={{
                width: 22, height: 22, borderRadius: "50%",
                border: "1.5px dashed #555", background: "transparent",
                display: "flex", alignItems: "center", justifyContent: "center",
                cursor: "pointer", color: "#666", fontSize: 14,
              }}>+</button>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {task.attachments !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#666", fontSize: 11 }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M13 7L8 12C6.5 13.5 4.5 13.5 3 12C1.5 10.5 1.5 8.5 3 7L8 2C9 1 10.5 1 11.5 2C12.5 3 12.5 4.5 11.5 5.5L7 10C6.5 10.5 5.5 10.5 5 10C4.5 9.5 4.5 8.5 5 8L9 4" stroke="#888" strokeWidth="1.3" strokeLinecap="round"/>
                </svg>
                <span>{task.attachments}</span>
              </div>
            )}
            {task.comments !== undefined && (
              <div style={{ display: "flex", alignItems: "center", gap: 3, color: "#666", fontSize: 11 }}>
                <svg width="11" height="11" viewBox="0 0 16 16" fill="none">
                  <path d="M14 9.5C14 10.33 13.33 11 12.5 11H5L2 14V3.5C2 2.67 2.67 2 3.5 2H12.5C13.33 2 14 2.67 14 3.5V9.5Z" stroke="#888" strokeWidth="1.3" strokeLinejoin="round"/>
                </svg>
                <span>{task.comments}</span>
              </div>
            )}
            {task.footerIcon === "timer" ? (
              <TimerButton state={task.timerState} value={task.timerValue} />
            ) : (
              <CalendarButton />
            )}
          </div>
        </div>

        {/* Footer row 2: progress + est */}
        {task.estTime && (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <ProgressBar progress={task.progress} state={task.timerState} />
            <span style={{ fontSize: 10, color: "#666", whiteSpace: "nowrap", flexShrink: 0 }}>
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
    <div
      style={{
        minWidth: 240,
        width: 240,
        display: "flex",
        flexDirection: "column",
        gap: 10,
        flexShrink: 0,
      }}
    >
      {/* Column header */}
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        paddingBottom: 8,
      }}>
        <span style={{ fontSize: 13, fontWeight: 600, color: "#e4e4e7" }}>{col.title}</span>
        <span style={{ fontSize: 11, color: "#666" }}>{col.count} Tasks</span>
        <div style={{ flex: 1 }} />
        <button style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>+</button>
        <button style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: 16, lineHeight: 1 }}>···</button>
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
  { name: "Apvision", color: "#6366F1" },
  { name: "AlertSec", color: "#3B82F6" },
  { name: "Bomani Cold Buzz", color: "#F59E0B" },
  { name: "Danyon", color: "#EC4899" },
  { name: "JB Consulting", color: "#10B981" },
  { name: "My Choice Software", color: "#8B5CF6" },
  { name: "StrataScratch", color: "#14B8A6" },
  { name: "Wake Up Coffee", color: "#F97316" },
];

function NavIcon({ icon }: { icon: string }) {
  const paths: Record<string, JSX.Element> = {
    home: <path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>,
    dashboard: <><rect x="3" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="3" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="3" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/><rect x="14" y="14" width="7" height="7" rx="1" stroke="currentColor" strokeWidth="1.5"/></>,
    projects: <><path d="M3 3h18v4H3zM3 10h18v4H3zM3 17h18v4H3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" fill="none"/></>,
    tasks: <><path d="M9 11l3 3L22 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></>,
    members: <><circle cx="12" cy="8" r="4" stroke="currentColor" strokeWidth="1.5"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    goals: <><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M12 4v2M12 18v2M4 12H2M22 12h-2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></>,
    settings: <><circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.5"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-2 2 2 2 0 01-2-2v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83 0 2 2 0 010-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 01-2-2 2 2 0 012-2h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 010-2.83 2 2 0 012.83 0l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 012-2 2 2 0 012 2v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 0 2 2 0 010 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 012 2 2 2 0 01-2 2h-.09a1.65 1.65 0 00-1.51 1z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/></>,
  };
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      {paths[icon]}
    </svg>
  );
}

function Sidebar() {
  const [favOpen, setFavOpen] = useState(true);
  const [projOpen, setProjOpen] = useState(true);

  return (
    <div
      style={{
        width: 210,
        minWidth: 210,
        height: "100%",
        background: "#1E1E1E",
        borderRight: "1px solid #2a2a2a",
        display: "flex",
        flexDirection: "column",
        overflowY: "auto",
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "16px 16px 12px",
        borderBottom: "1px solid #2a2a2a",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{
            width: 26, height: 26,
            background: "linear-gradient(135deg, #7C5AC2, #a78bfa)",
            borderRadius: 6,
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 13, fontWeight: 700, color: "#fff",
          }}>A</div>
          <span style={{ fontSize: 14, fontWeight: 700, color: "#fff", letterSpacing: "-0.3px" }}>brandux</span>
        </div>
        <button style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
            <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
          </svg>
        </button>
      </div>

      {/* Nav items */}
      <nav style={{ padding: "8px 0" }}>
        {NAV_ITEMS.map((item) => (
          <div
            key={item.label}
            style={{
              display: "flex", alignItems: "center", gap: 10,
              padding: "7px 16px",
              color: "#888",
              cursor: "pointer",
              fontSize: 13,
              borderRadius: 6,
              margin: "1px 6px",
              transition: "all 0.15s",
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLElement).style.background = "#2a2a2a";
              (e.currentTarget as HTMLElement).style.color = "#ccc";
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLElement).style.background = "transparent";
              (e.currentTarget as HTMLElement).style.color = "#888";
            }}
          >
            <NavIcon icon={item.icon} />
            <span>{item.label}</span>
          </div>
        ))}
      </nav>

      {/* Favorite section */}
      <div style={{ padding: "4px 6px" }}>
        <button
          onClick={() => setFavOpen(!favOpen)}
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            width: "100%", padding: "6px 10px",
            background: "transparent", border: "none",
            color: "#666", cursor: "pointer", fontSize: 11, fontWeight: 600,
            textTransform: "uppercase", letterSpacing: "0.05em",
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
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  padding: "6px 10px",
                  background: fav.active ? "#2a2a2a" : "transparent",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 13,
                  color: fav.active ? "#e4e4e7" : "#888",
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  background: fav.color,
                  flexShrink: 0,
                }} />
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {fav.name}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Projects section */}
      <div style={{ padding: "4px 6px", flex: 1 }}>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "6px 10px",
        }}>
          <span style={{ fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Projects
          </span>
          <div style={{ display: "flex", gap: 6 }}>
            <button
              onClick={() => setProjOpen(!projOpen)}
              style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer", fontSize: 14 }}
            >+</button>
            <button
              onClick={() => setProjOpen(!projOpen)}
              style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}
            >
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
                  padding: "5px 10px",
                  borderRadius: 6,
                  cursor: "pointer",
                  fontSize: 12,
                  color: "#888",
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "#2a2a2a";
                  (e.currentTarget as HTMLElement).style.color = "#ccc";
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = "transparent";
                  (e.currentTarget as HTMLElement).style.color = "#888";
                }}
              >
                <div style={{
                  width: 16, height: 16, borderRadius: 4,
                  background: proj.color,
                  flexShrink: 0,
                }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {proj.name}
                </span>
              </div>
            ))}
            <div style={{ padding: "6px 10px" }}>
              <span style={{ fontSize: 11, color: "#555", cursor: "pointer" }}>Show All Projects ∨</span>
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
    <div style={{
      background: "#1E1E1E",
      borderBottom: "1px solid #2a2a2a",
      flexShrink: 0,
    }}>
      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 24px",
      }}>
        {/* Left: project info */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{
            width: 34, height: 34, borderRadius: "50%",
            background: "linear-gradient(135deg, #14B8A6, #0891b2)",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontSize: 14, fontWeight: 700, color: "#fff",
          }}>S</div>
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 700, color: "#fff" }}>StrataScratch</span>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path d="M3 5l4 4 4-4" stroke="#888" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={{ display: "flex", gap: 8, marginLeft: 4 }}>
            <button style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M12 8v4l2 2" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
            </button>
            <button style={{ background: "transparent", border: "none", color: "#666", cursor: "pointer" }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
                <polygon points="12,2 15.09,8.26 22,9.27 17,14.14 18.18,21.02 12,17.77 5.82,21.02 7,14.14 2,9.27 8.91,8.26" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
              </svg>
            </button>
          </div>
          {/* Status badge */}
          <div style={{
            display: "flex", alignItems: "center", gap: 6,
            background: "rgba(16,185,129,0.15)",
            border: "1px solid rgba(16,185,129,0.3)",
            borderRadius: 20,
            padding: "4px 12px",
            marginLeft: 4,
          }}>
            <div style={{
              width: 16, height: 16, borderRadius: "50%",
              background: "rgba(16,185,129,0.3)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none">
                <path d="M1.5 4.5L3.5 6.5L7.5 2.5" stroke="#10B981" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <span style={{ fontSize: 12, color: "#10B981", fontWeight: 500 }}>According to plan</span>
            <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
              <path d="M2 4l3 3 3-3" stroke="#10B981" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        </div>

        {/* Right: avatars + search */}
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <AvatarCluster count={5} size={28} />
          <button style={{
            width: 30, height: 30, borderRadius: "50%",
            background: "#2D2D30",
            border: "1px solid #3a3a3a",
            display: "flex", alignItems: "center", justifyContent: "center",
            cursor: "pointer", color: "#888",
          }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
              <circle cx="11" cy="11" r="8" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M21 21l-4.35-4.35" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{
        display: "flex", alignItems: "center", gap: 2,
        padding: "0 24px",
        overflowX: "auto",
      }}>
        {TABS.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              padding: "8px 14px",
              background: "transparent",
              border: "none",
              borderBottom: `2.5px solid ${activeTab === tab ? "#7C5AC2" : "transparent"}`,
              color: activeTab === tab ? "#fff" : "#666",
              fontWeight: activeTab === tab ? 600 : 400,
              fontSize: 13,
              cursor: "pointer",
              whiteSpace: "nowrap",
              transition: "all 0.15s",
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
    <div
      style={{
        flex: 1,
        overflowX: "auto",
        overflowY: "auto",
        padding: "20px 24px",
        display: "flex",
        gap: 20,
        alignItems: "flex-start",
      }}
    >
      {COLUMNS.map((col) => (
        <BoardColumn key={col.id} col={col} />
      ))}
    </div>
  );
}

// ─── App Root ─────────────────────────────────────────────────────────────────

export function TeltechLedger() {
  return (
    <div
      style={{
        width: "100vw",
        height: "100vh",
        display: "flex",
        background: "#121212",
        fontFamily: "'Inter', 'Roboto', -apple-system, sans-serif",
        overflow: "hidden",
        color: "#e4e4e7",
      }}
    >
      <Sidebar />
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minWidth: 0 }}>
        <Header />
        <Board />
      </div>
    </div>
  );
}
