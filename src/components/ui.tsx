import type { ReactNode } from "react";
import { cn } from "../lib/cn";

export function Button({
  className,
  variant = "secondary",
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "secondary" | "ghost" | "danger";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
        "focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/50 disabled:cursor-not-allowed disabled:opacity-50",
        variant === "primary" &&
          "border border-emerald-500/40 bg-emerald-600/90 text-white hover:bg-emerald-500",
        variant === "secondary" &&
          "border border-white/10 bg-white/5 text-gray-300 hover:bg-white/10 hover:text-white",
        variant === "ghost" &&
          "border border-transparent bg-transparent text-gray-400 hover:bg-white/5 hover:text-white",
        variant === "danger" &&
          "border border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
        className
      )}
      {...props}
    />
  );
}

export function Badge({ className, ...props }: React.HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        className
      )}
      {...props}
    />
  );
}

export function TextField({
  label,
  className,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1">
      {label ? (
        <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
          {label}
        </span>
      ) : null}
      <input
        className={cn(
          "h-8 w-full min-w-0 rounded-md border border-white/10 bg-panel-2/80 px-2.5 text-xs text-gray-200",
          "placeholder:text-gray-600 focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30",
          className
        )}
        {...props}
      />
    </label>
  );
}

export function SelectField({
  label,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { label?: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1.5">
      {label ? (
        <span className="text-[10px] font-medium uppercase tracking-widest text-gray-500">
          {label}
        </span>
      ) : null}
      <select
        className={cn(
          "h-8 w-full min-w-0 appearance-none rounded-md border border-white/10 bg-panel-2/80 px-2.5 text-xs text-gray-200",
          "focus:border-emerald-500/50 focus:outline-none focus:ring-1 focus:ring-emerald-500/30",
          className
        )}
        {...props}
      >
        {children}
      </select>
    </label>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gray-500">
      {children}
    </div>
  );
}

export function Panel({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "panel rounded-xl border border-emerald-500/10 bg-panel/70 shadow-lg shadow-black/40 backdrop-blur-md",
        className
      )}
    >
      {children}
    </div>
  );
}