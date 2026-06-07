import { Link } from "react-router-dom";
import { Button, Icon } from "@/components/ui";

export interface FoundationLockCtaProps {
  label: string;
  outlineRoute: string;
}

export function FoundationLockCta({ label, outlineRoute }: FoundationLockCtaProps) {
  return (
    <Link to={outlineRoute} className="block w-full self-end md:w-auto">
      <Button
        variant="primary"
        className="min-h-[48px] w-full rounded-xl px-8 py-3 md:w-auto"
        leftIcon={<Icon name="lock" size={20} filled />}
      >
        {label}
      </Button>
    </Link>
  );
}