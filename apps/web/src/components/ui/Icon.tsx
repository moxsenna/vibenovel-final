import type { HTMLAttributes } from "react";

export interface IconProps extends HTMLAttributes<HTMLSpanElement> {
  name: string;
  filled?: boolean;
  size?: number;
}

/**
 * Material Symbols Outlined — matches Stitch icon usage.
 * Fallback: icon name renders as accessible text if font fails to load.
 */
export function Icon({ name, filled = false, size = 24, className = "", ...props }: IconProps) {
  return (
    <span
      className={`material-symbols-outlined inline-flex items-center justify-center leading-none ${filled ? "filled" : ""} ${className}`}
      style={{ fontSize: size }}
      aria-hidden="true"
      {...props}
    >
      {name}
    </span>
  );
}