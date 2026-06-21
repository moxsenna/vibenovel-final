import type { InputHTMLAttributes } from "react";

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  inputSize?: "md" | "sm";
}

const sizeClasses = {
  md: "min-h-[44px] px-4 py-2.5 text-body-md font-body-md",
  sm: "min-h-[36px] px-3 py-2 text-body-sm font-body-sm",
};

export function Input({
  className = "",
  inputSize = "md",
  type = "text",
  ...props
}: InputProps) {
  return (
    <input
      type={type}
      className={[
        "w-full rounded-md border border-border bg-surface text-on-surface",
        "placeholder:text-muted-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-soft",
        sizeClasses[inputSize],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...props}
    />
  );
}