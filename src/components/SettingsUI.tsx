import { useNavigate } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

export function SettingsShell({
  title,
  children,
  action,
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <div className="min-h-screen bg-background pb-28">
      <header className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b border-border px-5 py-3 flex items-center gap-3">
        <button
          onClick={() => (history.length > 1 ? history.back() : navigate({ to: "/settings" }))}
          aria-label="Back"
          className="h-9 w-9 rounded-full bg-muted flex items-center justify-center"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <h1 className="text-xl font-semibold tracking-tight flex-1 truncate">{title}</h1>
        {action}
      </header>
      <div className="px-5 pt-5 max-w-md mx-auto">{children}</div>
    </div>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 text-[11px] font-bold uppercase tracking-[0.12em] bg-gradient-brand bg-clip-text text-transparent">
      {children}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative shrink-0 h-6 w-11 rounded-full transition ${
        checked ? "bg-gradient-brand" : "bg-muted"
      } ${disabled ? "opacity-40" : ""}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
          checked ? "left-[22px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

export function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden divide-y divide-border">
      {children}
    </div>
  );
}

export function Row({
  title,
  subtitle,
  right,
  onClick,
  danger,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  onClick?: () => void;
  danger?: boolean;
}) {
  const inner = (
    <div className="flex items-center gap-3 px-4 py-3.5 text-left w-full">
      <div className="min-w-0 flex-1">
        <div className={`text-[15px] font-medium ${danger ? "text-destructive" : ""}`}>{title}</div>
        {subtitle && <div className="mt-0.5 text-xs text-muted-foreground leading-snug">{subtitle}</div>}
      </div>
      {right}
    </div>
  );
  if (!onClick) return inner;
  return (
    <button type="button" onClick={onClick} className="w-full hover:bg-muted/50 transition">
      {inner}
    </button>
  );
}
