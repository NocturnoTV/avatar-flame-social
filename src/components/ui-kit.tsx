import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/utils";

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50",
        variant === "primary" && "spark-gradient text-white shadow-lg shadow-primary/25",
        variant === "outline" && "border border-border bg-transparent text-foreground hover:bg-muted",
        variant === "ghost" && "text-muted-foreground hover:bg-muted hover:text-foreground",
        variant === "danger" && "bg-destructive text-destructive-foreground",
        size === "sm" && "h-9 px-4 text-sm",
        size === "md" && "h-11 px-5 text-sm",
        size === "lg" && "h-13 px-7 text-base",
        size === "icon" && "h-11 w-11",
        className,
      )}
      {...props}
    />
  );
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-12 w-full rounded-2xl border border-input bg-surface px-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "w-full rounded-2xl border border-input bg-surface p-4 text-base text-foreground outline-none transition placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-primary/30",
        className,
      )}
      {...props}
    />
  );
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={cn(
        "h-12 w-full appearance-none rounded-2xl border border-input bg-surface px-4 text-base text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/30",
        className,
      )}
      {...props}
    >
      {children}
    </select>
  );
}

export function Label({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <span className={cn("mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground", className)}>
      {children}
    </span>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-3xl border border-border bg-card p-5 shadow-sm", className)}>
      {children}
    </div>
  );
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  center,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  /** Always centered on screen instead of anchored to the bottom on mobile -
   * use for content someone needs to act on right away (e.g. payment forms),
   * where scrolling down to find it would be confusing. */
  center?: boolean;
}) {
  if (!open) return null;
  // Portaled straight to <body> - rendered inline, this would sit wherever
  // its caller happens to be in the page (some Android WebViews mis-render
  // "fixed" inside a tall/scrollable ancestor), showing up mid-page or at
  // the very bottom instead of pinned to the screen.
  return createPortal(
    <div
      className={cn(
        "fixed inset-0 z-[100] flex justify-center bg-black/60 p-0 backdrop-blur-sm sm:items-center sm:p-4",
        center ? "items-center p-4" : "items-end",
      )}
    >
      <button aria-label="close" className="absolute inset-0 cursor-default" onClick={onClose} />
      <div className="relative z-10 max-h-[85vh] w-full overflow-y-auto rounded-t-3xl border border-border bg-card p-5 sm:max-w-md sm:rounded-3xl">
        {title ? <h2 className="mb-4 text-lg font-bold">{title}</h2> : null}
        {children}
      </div>
    </div>,
    document.body,
  );
}
