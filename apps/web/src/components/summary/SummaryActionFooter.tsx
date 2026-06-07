import { Link } from "react-router-dom";
import { Button, Icon } from "@/components/ui";

export interface SummaryActionFooterProps {
  approveCta: string;
  backToWriteCta: string;
  publishRoute: string;
  writeRoute: string;
}

export function SummaryActionFooter({
  approveCta,
  backToWriteCta,
  publishRoute,
  writeRoute,
}: SummaryActionFooterProps) {
  return (
    <footer className="fixed bottom-0 left-0 z-50 flex w-full justify-center border-t border-border bg-surface/90 px-md py-4 shadow-[0_-4px_24px_rgba(31,41,51,0.05)] backdrop-blur-md md:left-64 md:w-[calc(100%-16rem)]">
      <div className="flex w-full max-w-editor flex-col-reverse items-center justify-end gap-4 md:flex-row">
        <Link to={writeRoute} className="w-full md:w-auto">
          <Button
            variant="ghost"
            className="h-12 w-full justify-center rounded-xl px-6 text-on-surface-variant hover:bg-surface-variant md:w-auto"
          >
            {backToWriteCta}
          </Button>
        </Link>
        <Link to={publishRoute} className="w-full md:w-auto">
          <Button
            variant="primary"
            className="h-12 w-full justify-center rounded-xl px-8 shadow-[0_4px_12px_rgba(130,56,80,0.2)] md:w-auto"
            rightIcon={<Icon name="arrow_forward" size={18} />}
          >
            {approveCta}
          </Button>
        </Link>
      </div>
    </footer>
  );
}