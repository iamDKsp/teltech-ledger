import * as React from "react";
import { createPortal } from "react-dom";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { X, ChevronDown, Check, ChevronLeft, ChevronRight, CalendarDays, Search } from "lucide-react";
import "./finance-ui.css";

/**
 * Componentes próprios do módulo financeiro:
 *  - Drawer: painel lateral que desliza da esquerda (substitui os modais centralizados)
 *  - Select / Checkbox / DateInput: controles estilizados (substituem os nativos do navegador)
 *  - FinanceUiRoot: tooltip próprio (substitui o `title` do navegador) + diálogo de confirmação
 *
 * Select, Checkbox e DateInput são "drop-in": aceitam o mesmo formato de `onChange`
 * dos elementos nativos (`e.target.value` / `e.target.checked`), então a troca nos
 * formulários existentes é mecânica.
 */

// ─── Drawer ───────────────────────────────────────────────────────────────────

let scrollLocks = 0;

export interface DrawerProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  onClose: () => void;
  /** Largura máxima em px (no celular ocupa a tela toda). */
  width?: number;
  /** Botões fixos no rodapé (sempre visíveis, fora da área rolável). */
  footer?: React.ReactNode;
  children: React.ReactNode;
  /** Renderiza o painel como <form> para o rodapé submeter o formulário. */
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  closeOnOverlay?: boolean;
  zIndex?: number;
}

export function Drawer({
  title,
  subtitle,
  icon,
  onClose,
  width = 560,
  footer,
  children,
  onSubmit,
  closeOnOverlay = true,
  zIndex = 120,
}: DrawerProps) {
  const [closing, setClosing] = React.useState(false);
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;
  const closingRef = React.useRef(false);

  const requestClose = React.useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => closeRef.current(), 170);
  }, []);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      // Se houver select/calendário aberto, o ESC fecha só ele.
      if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
      requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [requestClose]);

  React.useEffect(() => {
    scrollLocks += 1;
    document.body.style.overflow = "hidden";
    return () => {
      scrollLocks -= 1;
      if (scrollLocks <= 0) {
        scrollLocks = 0;
        document.body.style.overflow = "";
      }
    };
  }, []);

  const Panel: any = onSubmit ? "form" : "div";

  return createPortal(
    <>
      <div
        className="fui-overlay"
        data-closing={closing}
        style={{ zIndex }}
        onMouseDown={(e) => {
          if (closeOnOverlay && e.target === e.currentTarget) requestClose();
        }}
      />
      <Panel
        className="fui-drawer"
        data-closing={closing}
        role="dialog"
        aria-modal="true"
        style={{ zIndex: zIndex + 1, width: `min(${width}px, 100vw)` }}
        onSubmit={onSubmit}
      >
        <div className="fui-drawer-header">
          <div style={{ display: "flex", alignItems: "flex-start", gap: 10, minWidth: 0 }}>
            {icon && <span style={{ color: "#A78BFA", display: "inline-flex", marginTop: 2 }}>{icon}</span>}
            <div style={{ minWidth: 0 }}>
              <h3 style={{ margin: 0, fontSize: 17, fontWeight: 800, color: "#fafafa" }}>{title}</h3>
              {subtitle && <p style={{ margin: "3px 0 0", fontSize: 12, color: "#888" }}>{subtitle}</p>}
            </div>
          </div>
          <button type="button" className="fui-close" onClick={requestClose} title="Fechar" aria-label="Fechar">
            <X size={17} />
          </button>
        </div>
        <div className="fui-drawer-body fui-scroll">{children}</div>
        {footer && <div className="fui-drawer-footer">{footer}</div>}
      </Panel>
    </>,
    document.body,
  );
}

// ─── Select ───────────────────────────────────────────────────────────────────

interface Opt {
  value: string;
  label: string;
  disabled?: boolean;
  group?: string;
}

function textOf(node: React.ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (React.isValidElement(node)) return textOf((node.props as { children?: React.ReactNode }).children);
  return "";
}

function parseOptions(children: React.ReactNode, group?: string): Opt[] {
  const out: Opt[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) return;
    const p = child.props as { value?: unknown; children?: React.ReactNode; disabled?: boolean; label?: string };
    if (child.type === "option") {
      out.push({ value: p.value !== undefined ? String(p.value) : textOf(p.children), label: textOf(p.children), disabled: !!p.disabled, group });
    } else if (child.type === "optgroup") {
      out.push(...parseOptions(p.children, p.label));
    } else if (child.type === React.Fragment) {
      out.push(...parseOptions(p.children, group));
    }
  });
  return out;
}

export interface SelectProps {
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  /** Aceita <option>/<optgroup> como o <select> nativo. */
  children?: React.ReactNode;
  options?: Opt[];
  placeholder?: string;
  disabled?: boolean;
  style?: React.CSSProperties;
  title?: string;
  /** Mostra o campo de busca quando houver mais opções que isso (padrão 9). */
  searchAfter?: number;
}

export function Select({ value, onChange, children, options, placeholder, disabled, style, title, searchAfter = 9 }: SelectProps) {
  const opts = React.useMemo(() => options ?? parseOptions(children), [options, children]);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const [active, setActive] = React.useState(0);
  const listRef = React.useRef<HTMLDivElement>(null);

  const selected = opts.find((o) => o.value === value);
  const showSearch = opts.length > searchAfter;
  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? opts.filter((o) => o.label.toLowerCase().includes(q)) : opts;
  }, [opts, query]);

  React.useEffect(() => {
    if (open) {
      setQuery("");
      const idx = opts.findIndex((o) => o.value === value);
      setActive(idx >= 0 ? idx : 0);
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    if (!open) return;
    listRef.current?.querySelector<HTMLElement>('[data-active="true"]')?.scrollIntoView({ block: "nearest" });
  }, [active, open]);

  const pick = (o: Opt) => {
    if (o.disabled) return;
    onChange({ target: { value: o.value } });
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const dir = e.key === "ArrowDown" ? 1 : -1;
      let i = active;
      for (let n = 0; n < filtered.length; n++) {
        i = (i + dir + filtered.length) % filtered.length;
        if (!filtered[i].disabled) break;
      }
      setActive(i);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered[active]) pick(filtered[active]);
    }
  };

  const isPlaceholder = !selected || (selected.value === "" && /^[—–-]/.test(selected.label));
  let lastGroup: string | undefined;

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" disabled={disabled} title={title} className="fui-trigger" style={{ width: "100%", ...style }}>
          <span className="fui-trigger-label" data-placeholder={isPlaceholder}>
            {selected ? selected.label : placeholder ?? "Selecione"}
          </span>
          <ChevronDown size={14} className="fui-trigger-icon" />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="fui-popover" align="start" sideOffset={6} collisionPadding={12} onKeyDown={onKeyDown}>
          <div ref={listRef} className="fui-list fui-scroll">
            {showSearch && (
              <div style={{ position: "relative", flexShrink: 0 }}>
                <Search size={12} style={{ position: "absolute", left: 9, top: 10, color: "#666" }} />
                <input
                  autoFocus
                  className="fui-search"
                  style={{ paddingLeft: 27 }}
                  placeholder="Buscar..."
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setActive(0);
                  }}
                />
              </div>
            )}
            {filtered.length === 0 && <div className="fui-empty">Nada encontrado</div>}
            {filtered.map((o, i) => {
              const header = o.group && o.group !== lastGroup ? <div key={`g-${o.group}`} className="fui-group">{o.group}</div> : null;
              lastGroup = o.group;
              return (
                <React.Fragment key={`${o.value}-${i}`}>
                  {header}
                  <button
                    type="button"
                    className="fui-item"
                    disabled={o.disabled}
                    data-active={i === active}
                    data-selected={o.value === value}
                    onMouseEnter={() => setActive(i)}
                    onClick={() => pick(o)}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{o.label}</span>
                    {o.value === value && <Check size={13} style={{ flexShrink: 0 }} />}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ─── Checkbox ─────────────────────────────────────────────────────────────────

export interface CheckboxProps {
  checked: boolean;
  onChange?: (e: { target: { checked: boolean } }) => void;
  disabled?: boolean;
  style?: React.CSSProperties;
  title?: string;
  "aria-label"?: string;
}

export function Checkbox({ checked, onChange, disabled, style, title, ...rest }: CheckboxProps) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={rest["aria-label"]}
      disabled={disabled}
      title={title}
      className="fui-check"
      style={style}
      onClick={() => onChange?.({ target: { checked: !checked } })}
    >
      <Check size={12} strokeWidth={3.5} />
    </button>
  );
}

// ─── Data / hora ──────────────────────────────────────────────────────────────

const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const DOW = ["D", "S", "T", "Q", "Q", "S", "S"];

const pad = (n: number) => String(n).padStart(2, "0");

function todayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function splitValue(value: string): { date: string; hh: string; mm: string } {
  const [date = "", time = ""] = value.split("T");
  const [hh = "", mm = ""] = time.split(":");
  return { date, hh, mm };
}

function parseDate(date: string): { y: number; m: number; d: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  return m ? { y: +m[1], m: +m[2] - 1, d: +m[3] } : null;
}

function fmtDisplay(value: string, withTime: boolean): string {
  const { date, hh, mm } = splitValue(value);
  const p = parseDate(date);
  if (!p) return "";
  const base = `${pad(p.d)}/${pad(p.m + 1)}/${p.y}`;
  return withTime ? `${base} ${hh || "00"}:${mm || "00"}` : base;
}

export interface DateInputProps {
  /** `YYYY-MM-DD` (ou `YYYY-MM-DDTHH:mm` com `withTime`). */
  value: string;
  onChange: (e: { target: { value: string } }) => void;
  withTime?: boolean;
  min?: string;
  max?: string;
  disabled?: boolean;
  placeholder?: string;
  /** Permite limpar a data (padrão: true). */
  clearable?: boolean;
  style?: React.CSSProperties;
  title?: string;
}

export function DateInput({ value, onChange, withTime = false, min, max, disabled, placeholder, clearable = true, style, title }: DateInputProps) {
  const [open, setOpen] = React.useState(false);
  const [view, setView] = React.useState<"days" | "months">("days");
  const { date, hh, mm } = splitValue(value || "");
  const parsed = parseDate(date);
  const [cursor, setCursor] = React.useState(() => {
    const p = parsed ?? parseDate(todayISO())!;
    return { y: p.y, m: p.m };
  });

  React.useEffect(() => {
    if (open) {
      const p = parseDate(splitValue(value || "").date) ?? parseDate(todayISO())!;
      setCursor({ y: p.y, m: p.m });
      setView("days");
    }
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  const emit = (nextDate: string, nextH = hh, nextM = mm) => {
    onChange({ target: { value: withTime ? `${nextDate}T${nextH || "00"}:${nextM || "00"}` : nextDate } });
  };

  const shiftMonth = (delta: number) => {
    const t = cursor.y * 12 + cursor.m + delta;
    setCursor({ y: Math.floor(t / 12), m: ((t % 12) + 12) % 12 });
  };

  const first = new Date(Date.UTC(cursor.y, cursor.m, 1)).getUTCDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(Date.UTC(cursor.y, cursor.m, 1 - first + i));
    const iso = d.toISOString().slice(0, 10);
    return { iso, day: d.getUTCDate(), outside: d.getUTCMonth() !== cursor.m };
  });
  const today = todayISO();
  const display = fmtDisplay(value || "", withTime);

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button type="button" disabled={disabled} title={title} className="fui-trigger" style={{ width: "100%", ...style }}>
          <span className="fui-trigger-label" data-placeholder={!display}>
            {display || placeholder || (withTime ? "dd/mm/aaaa hh:mm" : "dd/mm/aaaa")}
          </span>
          <CalendarDays size={14} style={{ flexShrink: 0, color: "#888" }} />
        </button>
      </PopoverPrimitive.Trigger>
      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content className="fui-popover" align="start" sideOffset={6} collisionPadding={12}>
          <div className="fui-cal">
            <div className="fui-cal-head">
              <button type="button" className="fui-cal-nav" onClick={() => (view === "days" ? shiftMonth(-1) : setCursor({ ...cursor, y: cursor.y - 1 }))} aria-label="Anterior">
                <ChevronLeft size={15} />
              </button>
              <button type="button" className="fui-cal-title" onClick={() => setView(view === "days" ? "months" : "days")}>
                {view === "days" ? `${MONTHS[cursor.m]} de ${cursor.y}` : cursor.y}
              </button>
              <button type="button" className="fui-cal-nav" onClick={() => (view === "days" ? shiftMonth(1) : setCursor({ ...cursor, y: cursor.y + 1 }))} aria-label="Próximo">
                <ChevronRight size={15} />
              </button>
            </div>

            {view === "months" ? (
              <div className="fui-month-grid">
                {MONTHS.map((name, i) => (
                  <button
                    key={name}
                    type="button"
                    className="fui-month"
                    data-selected={parsed?.y === cursor.y && parsed?.m === i}
                    onClick={() => {
                      setCursor({ ...cursor, m: i });
                      setView("days");
                    }}
                  >
                    {name.slice(0, 3)}
                  </button>
                ))}
              </div>
            ) : (
              <div className="fui-cal-grid">
                {DOW.map((d, i) => (
                  <div key={i} className="fui-cal-dow">{d}</div>
                ))}
                {cells.map((c) => (
                  <button
                    key={c.iso}
                    type="button"
                    className="fui-day"
                    data-outside={c.outside}
                    data-today={c.iso === today}
                    data-selected={c.iso === date}
                    disabled={(!!min && c.iso < min) || (!!max && c.iso > max)}
                    onClick={() => {
                      emit(c.iso);
                      if (!withTime) setOpen(false);
                    }}
                  >
                    {c.day}
                  </button>
                ))}
              </div>
            )}

            {withTime && view === "days" && (
              <div className="fui-time">
                <div style={{ flex: 1 }}>
                  <div className="fui-time-label">Hora</div>
                  <div className="fui-time-col fui-scroll">
                    {Array.from({ length: 24 }, (_, h) => pad(h)).map((h) => (
                      <button key={h} type="button" className="fui-time-item" data-selected={h === hh} onClick={() => emit(date || today, h, mm)}>
                        {h}
                      </button>
                    ))}
                  </div>
                </div>
                <div style={{ flex: 1 }}>
                  <div className="fui-time-label">Minuto</div>
                  <div className="fui-time-col fui-scroll">
                    {Array.from({ length: 60 }, (_, m) => pad(m)).map((m) => (
                      <button key={m} type="button" className="fui-time-item" data-selected={m === mm} onClick={() => emit(date || today, hh, m)}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="fui-cal-foot">
              <button
                type="button"
                className="fui-link-btn"
                onClick={() => {
                  emit(today);
                  if (!withTime) setOpen(false);
                }}
              >
                Hoje
              </button>
              {withTime ? (
                <button type="button" className="fui-link-btn" onClick={() => setOpen(false)}>
                  Pronto
                </button>
              ) : (
                clearable &&
                !!value && (
                  <button
                    type="button"
                    className="fui-link-btn"
                    style={{ color: "#999" }}
                    onClick={() => {
                      onChange({ target: { value: "" } });
                      setOpen(false);
                    }}
                  >
                    Limpar
                  </button>
                )
              )}
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
}

// ─── Tooltip próprio ──────────────────────────────────────────────────────────

/**
 * Envolve um elemento (ex.: botão desabilitado) para exibir o tooltip mesmo quando
 * o próprio elemento não recebe eventos de mouse.
 */
export function Tip({ text, children, style }: { text: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span className="fui-tipwrap" data-tip={text} style={style}>
      {children}
    </span>
  );
}

/**
 * Delegação global: qualquer elemento com `title` ou `data-tip` ganha o tooltip
 * do sistema. O `title` é migrado para `data-tip` no hover, então o tooltip nativo
 * do navegador nunca aparece. Funciona também dentro dos drawers (portais).
 */
function TooltipLayer() {
  const [tip, setTip] = React.useState<{ text: string; rect: DOMRect } | null>(null);
  const [pos, setPos] = React.useState<{ left: number; top: number } | null>(null);
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    let current: Element | null = null;
    let timer: number | undefined;
    let visible = false;

    const hide = () => {
      window.clearTimeout(timer);
      current = null;
      visible = false;
      setTip(null);
      setPos(null);
    };

    const onOver = (e: MouseEvent) => {
      const t = e.target as Element | null;
      if (!t || typeof t.closest !== "function") return;
      const el = t.closest("[title],[data-tip]") as HTMLElement | null;
      if (!el) {
        if (current) hide();
        return;
      }
      const title = el.getAttribute("title");
      if (title) {
        el.setAttribute("data-tip", title);
        el.removeAttribute("title");
      }
      const text = el.getAttribute("data-tip");
      if (!text) {
        if (current) hide();
        return;
      }
      if (el === current) return;
      window.clearTimeout(timer);
      current = el;
      const show = () => {
        if (!el.isConnected) return;
        visible = true;
        setPos(null);
        setTip({ text, rect: el.getBoundingClientRect() });
      };
      if (visible) show();
      else timer = window.setTimeout(show, 280);
    };

    document.addEventListener("mouseover", onOver);
    document.addEventListener("mousedown", hide);
    document.addEventListener("keydown", hide);
    document.addEventListener("scroll", hide, true);
    document.documentElement.addEventListener("mouseleave", hide);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener("mouseover", onOver);
      document.removeEventListener("mousedown", hide);
      document.removeEventListener("keydown", hide);
      document.removeEventListener("scroll", hide, true);
      document.documentElement.removeEventListener("mouseleave", hide);
    };
  }, []);

  React.useLayoutEffect(() => {
    if (!tip || !ref.current) return;
    const { width, height } = ref.current.getBoundingClientRect();
    const { rect } = tip;
    const left = Math.min(Math.max(8, rect.left + rect.width / 2 - width / 2), window.innerWidth - width - 8);
    let top = rect.top - height - 8;
    if (top < 8) top = rect.bottom + 8;
    setPos({ left, top });
  }, [tip]);

  if (!tip) return null;
  return createPortal(
    <div ref={ref} className="fui-tooltip" role="tooltip" style={{ left: pos?.left ?? 0, top: pos?.top ?? 0, visibility: pos ? "visible" : "hidden" }}>
      {tip.text}
    </div>,
    document.body,
  );
}

// ─── Confirmação própria (substitui window.confirm) ───────────────────────────

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmLabel?: string;
  confirmText?: string;
  cancelLabel?: string;
  danger?: boolean;
  variant?: string;
}

type ConfirmRequest = ConfirmOptions & { resolve: (ok: boolean) => void };

let confirmListener: ((req: ConfirmRequest) => void) | null = null;

/** Versão assíncrona e estilizada do `window.confirm`. */
export function confirmDialog(options: ConfirmOptions): Promise<boolean> {
  if (!confirmListener) return Promise.resolve(window.confirm(options.message));
  return new Promise((resolve) => confirmListener!({ ...options, resolve }));
}

function ConfirmHost() {
  const [req, setReq] = React.useState<ConfirmRequest | null>(null);

  React.useEffect(() => {
    confirmListener = setReq;
    return () => {
      if (confirmListener === setReq) confirmListener = null;
    };
  }, []);

  React.useEffect(() => {
    if (!req) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") answer(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }); // eslint-disable-line react-hooks/exhaustive-deps

  const answer = (ok: boolean) => {
    req?.resolve(ok);
    setReq(null);
  };

  if (!req) return null;
  const color = req.danger ? "#EF4444" : "#8B5CF6";
  return createPortal(
    <div className="fui-confirm-wrap" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
      <div className="fui-confirm" role="alertdialog" aria-modal="true">
        <h4 style={{ margin: 0, fontSize: 15, fontWeight: 800, color: "#fafafa" }}>{req.title ?? "Confirmar"}</h4>
        <p style={{ margin: 0, fontSize: 13, color: "#aaa", lineHeight: 1.5, whiteSpace: "pre-line" }}>{req.message}</p>
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
          <button
            type="button"
            onClick={() => answer(false)}
            style={{ padding: "8px 14px", borderRadius: 8, background: "transparent", border: "1px solid rgba(255,255,255,0.15)", color: "#ccc", fontSize: 12, cursor: "pointer" }}
          >
            {req.cancelLabel ?? "Cancelar"}
          </button>
          <button
            type="button"
            autoFocus
            onClick={() => answer(true)}
            style={{ padding: "8px 16px", borderRadius: 8, background: color, border: "none", color: "#fff", fontSize: 12, fontWeight: 700, cursor: "pointer" }}
          >
            {req.confirmLabel ?? "Confirmar"}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/** Monta o tooltip global e o host de confirmação; use uma vez ao redor do módulo. */
export function FinanceUiRoot({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <TooltipLayer />
      <ConfirmHost />
    </>
  );
}

// ─── Estilos reutilizáveis de botão para rodapés de drawer ────────────────────

export const drawerBtn = {
  ghost: {
    padding: "9px 14px",
    borderRadius: 8,
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.15)",
    color: "#ccc",
    fontSize: 12,
    cursor: "pointer",
  } as React.CSSProperties,
  primary: (disabled = false): React.CSSProperties => ({
    padding: "9px 18px",
    borderRadius: 8,
    background: "#8B5CF6",
    border: "none",
    color: "#fff",
    fontSize: 12,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.55 : 1,
  }),
};
