import type { HTMLAttributes, ReactNode } from "react";

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: "sm" | "md" | "lg";
  shadow?: boolean;
}

const paddingClasses = {
  sm: "p-md",
  md: "p-lg",
  lg: "p-xl",
};

export function Card({
  children,
  padding = "md",
  shadow = true,
  className = "",
  ...props
}: CardProps) {
  return (
    <div
      className={[
        "bg-surface border border-border rounded-xl",
        shadow ? "shadow-sm" : "",
        paddingClasses[padding],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    >
      {children}
    </div>
  );
}