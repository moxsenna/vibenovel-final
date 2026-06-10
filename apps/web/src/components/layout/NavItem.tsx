import { Link, useLocation } from "react-router-dom";
import { Icon } from "@/components/ui";
import { isNavItemActive } from "@/utils/navigation";

export interface NavItemProps {
  to: string;
  label: string;
  icon: string;
  filledWhenActive?: boolean;
  disabled?: boolean;
  lockHint?: string;
}

export function NavItem({
  to,
  label,
  icon,
  filledWhenActive = false,
  disabled = false,
  lockHint,
}: NavItemProps) {
  const { pathname } = useLocation();
  const isActive = !disabled && isNavItemActive(to, pathname);

  const className = [
    "flex items-center gap-3 rounded-xl px-4 py-3 transition-all",
    "font-label-md text-label-md outline-none",
    "focus:outline-none focus-visible:outline-none",
    "focus-visible:ring-2 focus-visible:ring-primary-soft focus-visible:ring-offset-0",
    disabled
      ? "cursor-not-allowed text-muted-text opacity-50"
      : isActive
        ? "bg-primary-soft font-bold text-primary shadow-sm"
        : "text-on-surface-variant hover:bg-surface-container",
  ].join(" ");

  if (disabled) {
    return (
      <span
        className={className}
        title={lockHint ?? "Langkah ini belum tersedia"}
        aria-disabled="true"
      >
        <Icon name={icon} size={22} className="text-muted-text" />
        {label}
      </span>
    );
  }

  return (
    <Link to={to} className={className} aria-current={isActive ? "page" : undefined}>
      <Icon
        name={icon}
        size={22}
        filled={isActive && filledWhenActive}
        className={isActive ? "text-primary" : "text-muted-text"}
      />
      {label}
    </Link>
  );
}