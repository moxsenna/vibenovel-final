import { useMemo, useState } from "react";
import type { StoryCheckItem } from "@/types";
import { Icon } from "@/components/ui";

export interface WriterMobileCheckSheetProps {
  title: string;
  checks: StoryCheckItem[];
}

export function WriterMobileCheckSheet({ title, checks }: WriterMobileCheckSheetProps) {
  const [expanded, setExpanded] = useState(false);

  const summary = useMemo(() => {
    const okCount = checks.filter((c) => c.status === "ok").length;
    const warnCount = checks.filter((c) => c.status === "warning").length;
    return `${okCount} aman · ${warnCount} perlu dicek`;
  }, [checks]);

  return (
    <div
      className={[
        "fixed bottom-0 left-0 z-30 w-full rounded-t-[20px] border-t border-border bg-surface shadow-[0_-8px_24px_rgba(31,41,51,0.06)] transition-transform duration-300 ease-in-out",
        expanded ? "translate-y-0" : "translate-y-[calc(100%-4rem)]",
      ].join(" ")}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full cursor-pointer text-left"
        aria-expanded={expanded}
      >
        <div className="mx-auto mb-3 mt-3 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
        <div className="flex items-center justify-between px-lg pb-4">
          <div className="flex items-center gap-2 text-primary">
            <Icon name="verified" size={22} filled />
            <div className="flex flex-col">
              <span className="font-label-md text-label-md font-semibold">
                {title} • {summary}
              </span>
            </div>
          </div>
          <Icon
            name="expand_less"
            size={24}
            className={[
              "text-on-surface-variant transition-transform duration-300",
              expanded ? "rotate-180" : "",
            ].join(" ")}
          />
        </div>
      </button>

      <div className="max-h-[min(500px,50vh)] overflow-y-auto px-lg pb-lg">
        <div className="mb-6 space-y-4">
          <div className="grid grid-cols-1 gap-3">
            {checks
              .filter((check) => check.status === "ok")
              .map((check) => (
                <div key={check.id} className="flex items-center gap-2 text-tertiary">
                  <Icon name="check_circle" size={18} />
                  <span className="font-body-sm text-body-sm">{check.label}</span>
                </div>
              ))}
          </div>

          {checks.some((c) => c.status === "warning") && (
            <>
              <div className="h-px w-full bg-border" />
              {checks
                .filter((check) => check.status === "warning")
                .map((check) => (
                  <div key={check.id} className="flex items-start gap-3">
                    <Icon name="warning" size={20} className="mt-0.5 text-warning" />
                    <div>
                      <h4 className="font-label-md text-label-md text-on-surface">
                        {check.label}
                      </h4>
                      {check.detail && (
                        <p className="mt-1 font-body-sm text-body-sm text-on-surface-variant">
                          {check.detail}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}