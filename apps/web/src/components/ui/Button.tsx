import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost";
export type ButtonSize = "md" | "sm";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  pill?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary text-on-primary hover:bg-primary-dark shadow-sm disabled:opacity-50",
  secondary:
    "bg-primary-soft text-primary hover:bg-primary-fixed disabled:opacity-50",
  ghost:
    "bg-transparent text-on-surface-variant hover:bg-surface-container-high border border-border disabled:opacity-50",
};

const sizeClasses: Record<ButtonSize, string> = {
  md: "min-h-[44px] px-5 py-2.5 text-label-md font-label-md",
  sm: "min-h-[36px] px-4 py-2 text-label-sm font-label-sm",
};

export function Button({
  variant = "primary",
  size = "md",
  pill = false,
  leftIcon,
  rightIcon,
  className = "",
  children,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        "inline-flex items-center justify-center gap-2 font-medium transition-colors",
        "rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-2",
        pill ? "rounded-pill" : "",
        variantClasses[variant],
        sizeClasses[size],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {leftIcon}
      {children}
      {rightIcon}
    </button>
  );
}