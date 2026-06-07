import { Button } from "@/components/ui";

export interface OutlineLoadMoreButtonProps {
  label: string;
  hint: string;
}

export function OutlineLoadMoreButton({ label, hint }: OutlineLoadMoreButtonProps) {
  return (
    <div className="mt-8 flex flex-col items-center gap-2">
      <Button
        variant="ghost"
        pill
        disabled
        className="border-primary-fixed bg-surface text-primary shadow-sm"
        title={hint}
      >
        {label}
      </Button>
      <p className="max-w-md text-center font-body-sm text-body-sm text-muted-text">{hint}</p>
    </div>
  );
}