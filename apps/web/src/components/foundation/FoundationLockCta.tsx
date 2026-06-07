import { Link } from "react-router-dom";
import { Button, Icon } from "@/components/ui";

export interface FoundationLockCtaProps {
  label: string;
  outlineRoute: string;
  locked?: boolean;
  locking?: boolean;
  onLock?: () => void | Promise<void>;
}

export function FoundationLockCta({
  label,
  outlineRoute,
  locked = false,
  locking = false,
  onLock,
}: FoundationLockCtaProps) {
  if (onLock) {
    return (
      <div className="flex w-full flex-col gap-3 self-end md:w-auto">
        <Button
          variant="primary"
          className="min-h-[48px] w-full rounded-xl px-8 py-3 md:w-auto"
          leftIcon={<Icon name="lock" size={20} filled />}
          disabled={locked || locking}
          onClick={() => void onLock()}
        >
          {locking ? "Mengunci..." : locked ? "Fondasi Terkunci" : label}
        </Button>
        {locked && (
          <Link to={outlineRoute} className="block w-full md:w-auto">
            <Button variant="secondary" className="w-full rounded-xl md:w-auto">
              Lanjut ke Outline
            </Button>
          </Link>
        )}
      </div>
    );
  }

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