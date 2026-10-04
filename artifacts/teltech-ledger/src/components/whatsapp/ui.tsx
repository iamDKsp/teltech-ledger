import {
  forwardRef,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
} from "react";
import { ChevronDown, CircleHelp, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function formatPhone(raw?: string | null): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (!digits) return "";
  const local = digits.startsWith("55") && digits.length >= 12 ? digits.slice(2) : digits;
  const prefix = digits.startsWith("55") && digits.length >= 12 ? "+55 " : "";
  if (local.length === 11) return `${prefix}(${local.slice(0, 2)}) ${local.slice(2, 7)}-${local.slice(7)}`;
  if (local.length === 10) return `${prefix}(${local.slice(0, 2)}) ${local.slice(2, 6)}-${local.slice(6)}`;
  return `+${digits}`;
}

export function timeAgo(value?: string | null): string {
  if (!value) return "";
  const diff = Date.now() - new Date(value).getTime();
  if (!Number.isFinite(diff) || diff < 0) return "";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "agora mesmo";
  if (minutes < 60) return `há ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `há ${hours} h`;
  return `há ${Math.floor(hours / 24)} d`;
}

export function readableDate(value?: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────

export const WhatsAppTooltipProvider = ({ children }: { children: ReactNode }) => (
  <TooltipProvider delayDuration={120} skipDelayDuration={300}>
    {children}
  </TooltipProvider>
);

/** Tooltip no padrão visual da marca (popover escuro com borda). */
export function Tip({
  content,
  children,
  side = "top",
}: {
  content: ReactNode;
  children: ReactNode;
  side?: "top" | "bottom" | "left" | "right";
}) {
  if (!content) return <>{children}</>;
  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent
        side={side}
        sideOffset={8}
        className="max-w-[17rem] rounded-lg border border-border bg-popover px-3 py-2 text-xs leading-relaxed text-popover-foreground shadow-card"
      >
        {content}
      </TooltipContent>
    </Tooltip>
  );
}

/** Ícone de ajuda "?" com explicação ao passar o mouse. */
export function HelpTip({ children }: { children: ReactNode }) {
  return (
    <Tip content={children}>
      <button
        type="button"
        aria-label="Ajuda"
        className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/70 transition hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
      >
        <CircleHelp size={14} />
      </button>
    </Tip>
  );
}

// ─── Layout ───────────────────────────────────────────────────────────────────

export function Card({
  icon,
  title,
  description,
  action,
  tone = "primary",
  children,
  className,
}: {
  icon?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  tone?: "primary" | "success" | "secondary";
  children?: ReactNode;
  className?: string;
}) {
  const toneClass = {
    primary: "bg-primary/10 text-primary border-primary/20",
    success: "bg-success/10 text-success border-success/20",
    secondary: "bg-secondary/10 text-secondary border-secondary/20",
  }[tone];
  return (
    <section className={cn("glass shadow-card relative overflow-hidden rounded-xl p-5 sm:p-6", className)}>
      {(title || action) && (
        <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {icon && <div className={cn("rounded-lg border p-2.5", toneClass)}>{icon}</div>}
            <div>
              <h2 className="text-base font-semibold text-foreground">{title}</h2>
              {description && <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action}
        </header>
      )}
      {children}
    </section>
  );
}

export function SubHeading({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <div className="mb-3 flex items-center gap-2">
      <h3 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{children}</h3>
      {hint && <HelpTip>{hint}</HelpTip>}
    </div>
  );
}

// ─── Form controls ────────────────────────────────────────────────────────────

export const inputClass =
  "w-full rounded-lg border border-border bg-input px-3 py-2.5 text-sm text-foreground outline-none transition placeholder:text-muted-foreground/60 hover:border-primary/40 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

export function Field({
  label,
  help,
  hint,
  error,
  children,
  className,
}: {
  label: ReactNode;
  help?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <div className="mb-1.5 flex items-center gap-1.5">
        <label className="text-xs font-semibold text-foreground/90">{label}</label>
        {help && <HelpTip>{help}</HelpTip>}
      </div>
      {children}
      {error ? (
        <p className="mt-1.5 text-[11px] text-destructive">{error}</p>
      ) : hint ? (
        <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

export const TextInput = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => <input ref={ref} className={cn(inputClass, className)} {...props} />,
);
TextInput.displayName = "TextInput";

/** Campo numérico com sufixo (ex.: "dias", "h"). */
export function NumberInput({
  suffix,
  className,
  ...props
}: InputHTMLAttributes<HTMLInputElement> & { suffix?: string }) {
  return (
    <div className="relative">
      <input type="number" inputMode="numeric" className={cn(inputClass, suffix && "pr-14", className)} {...props} />
      {suffix && (
        <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-xs font-medium text-muted-foreground">
          {suffix}
        </span>
      )}
    </div>
  );
}

export const SelectInput = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  ({ className, children, ...props }, ref) => (
    <div className="relative">
      <select ref={ref} className={cn(inputClass, "cursor-pointer pr-9", className)} {...props}>
        {children}
      </select>
      <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
    </div>
  ),
);
SelectInput.displayName = "SelectInput";

/** Linha com título, descrição e interruptor. */
export function ToggleRow({
  title,
  description,
  help,
  checked,
  onChange,
  disabled,
  icon,
}: {
  title: ReactNode;
  description?: ReactNode;
  help?: ReactNode;
  checked: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
  icon?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-4 rounded-xl border p-4 transition",
        checked ? "border-primary/30 bg-primary/[0.06]" : "border-border bg-background/40",
        disabled && "opacity-60",
      )}
    >
      <div className="flex min-w-0 items-start gap-3">
        {icon && <div className={cn("mt-0.5 shrink-0", checked ? "text-primary" : "text-muted-foreground")}>{icon}</div>}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
            {title}
            {help && <HelpTip>{help}</HelpTip>}
          </div>
          {description && <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{description}</p>}
        </div>
      </div>
      <Switch checked={checked} onCheckedChange={onChange} disabled={disabled} aria-label={typeof title === "string" ? title : undefined} />
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (value: T) => void;
  options: { value: T; label: ReactNode; description?: ReactNode; badge?: ReactNode; tip?: ReactNode; icon?: ReactNode }[];
}) {
  return (
    <div role="radiogroup" className="grid gap-2 sm:grid-cols-2">
      {options.map((option) => {
        const active = option.value === value;
        const button = (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onChange(option.value)}
            className={cn(
              "flex h-full w-full items-start gap-3 rounded-xl border p-3.5 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
              active ? "border-primary/60 bg-primary/10 shadow-[0_0_0_1px_hsl(var(--primary)/0.25)]" : "border-border bg-background/40 hover:border-primary/30 hover:bg-background/70",
            )}
          >
            <span
              className={cn(
                "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2",
                active ? "border-primary" : "border-muted-foreground/50",
              )}
            >
              {active && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
            </span>
            <span className="min-w-0">
              <span className="flex flex-wrap items-center gap-2 text-sm font-semibold text-foreground">
                {option.icon}
                {option.label}
                {option.badge}
              </span>
              {option.description && <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{option.description}</span>}
            </span>
          </button>
        );
        return option.tip ? (
          <Tip key={option.value} content={option.tip}>
            {button}
          </Tip>
        ) : (
          button
        );
      })}
    </div>
  );
}

export function Badge({
  tone = "muted",
  children,
  className,
}: {
  tone?: "muted" | "primary" | "success" | "danger" | "warning";
  children: ReactNode;
  className?: string;
}) {
  const toneClass = {
    muted: "bg-muted/60 text-muted-foreground border-border",
    primary: "bg-primary/12 text-primary border-primary/25",
    success: "bg-success/12 text-success border-success/25",
    danger: "bg-destructive/12 text-destructive border-destructive/25",
    warning: "bg-amber-500/12 text-amber-400 border-amber-500/25",
  }[tone];
  return (
    <span className={cn("inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold", toneClass, className)}>
      {children}
    </span>
  );
}

// ─── Buttons ──────────────────────────────────────────────────────────────────

type ButtonVariant = "primary" | "secondary" | "ghost" | "danger" | "success";

interface BtnProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "icon";
  loading?: boolean;
  /** Explicação exibida ao passar o mouse (inclusive quando o botão está desabilitado). */
  tip?: ReactNode;
  icon?: ReactNode;
}

const variantClass: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-primary to-primary-glow text-primary-foreground shadow-glow hover:brightness-110 focus-visible:ring-primary",
  secondary: "border border-border bg-muted/40 text-foreground hover:border-primary/40 hover:bg-muted focus-visible:ring-primary",
  ghost: "text-muted-foreground hover:bg-muted/60 hover:text-foreground focus-visible:ring-primary",
  danger:
    "border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:ring-destructive",
  success: "border border-success/40 bg-success/10 text-success hover:bg-success/20 focus-visible:ring-success",
};

export const Btn = forwardRef<HTMLButtonElement, BtnProps>(
  ({ variant = "secondary", size = "md", loading, tip, icon, className, children, disabled, type = "button", ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50",
          size === "sm" && "px-3 py-1.5 text-xs",
          size === "md" && "px-4 py-2.5 text-sm",
          size === "icon" && "h-8 w-8 text-xs",
          variantClass[variant],
          className,
        )}
        {...props}
      >
        {loading ? <Loader2 size={15} className="animate-spin" /> : icon}
        {children}
      </button>
    );
    if (!tip) return button;
    // Botões desabilitados não disparam eventos de mouse; o span mantém o tooltip funcionando.
    return (
      <Tip content={tip}>
        {disabled || loading ? <span className="inline-flex cursor-not-allowed">{button}</span> : button}
      </Tip>
    );
  },
);
Btn.displayName = "Btn";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("animate-spin", className)} />;
}

// ─── WhatsApp-style text ──────────────────────────────────────────────────────

/** Renderiza *negrito* e _itálico_ como o WhatsApp faz. */
export function WhatsAppText({ text }: { text: string }) {
  const parts = text.split(/(\*[^*\n]+\*|_[^_\n]+_)/g);
  return (
    <>
      {parts.map((part, index) => {
        if (part.length > 2 && part.startsWith("*") && part.endsWith("*")) return <strong key={index}>{part.slice(1, -1)}</strong>;
        if (part.length > 2 && part.startsWith("_") && part.endsWith("_")) return <em key={index}>{part.slice(1, -1)}</em>;
        return <span key={index}>{part}</span>;
      })}
    </>
  );
}
