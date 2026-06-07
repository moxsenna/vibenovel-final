import type { HTMLAttributes, ReactNode } from "react";

export type BadgeVariant =
  | "neutral"
  | "primary"
  | "accent"
  | "success"
  | "warning"
  | "danger";

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  children: ReactNode;
  variant?: BadgeVariant;
  icon?: ReactNode;
}

const variantClasses: Record<BadgeVariant, string> = {
  neutral: "bg-surface-container text-on-surface-variant border-outline-variant",
  primary: "bg-primary-soft text-primary border-primary-fixed",
  accent: "bg-accent-soft text-secondary border-secondary-container",
  success: "bg-success-soft text-tertiary border-tertiary-container",
  warning: "bg-warning-soft text-warning border-warning/30",
  danger: "bg-danger-soft text-danger border-danger/30",
};

export function Badge({
  children,
  variant = "neutral",
  icon,
  className = "",
  ...props
}: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1 px-2.5 py-1 rounded-pill",
        "text-label-sm font-label-sm border",
        variantClasses[variant],
        className,
      ].join(" ")}
      {...props}
    >
      {icon}
      {children}
    </span>
  );
}