import {
  ChatPanel,
  DetectedSignalsPanel,
  IntakePageHeader,
  IntakeProgressCard,
} from "@/components/intake";
import { mockIntakeSession } from "@/mocks/intake";

/**
 * Chat Story Agent Intake — Sprint 1 Task 1.7
 * Source: stitch-reference/beri_tahu_ide_ceritamu_refined
 * Wrapped by AppShell via router layout.
 */
export function IntakePage() {
  const session = mockIntakeSession;

  return (
    <div className="flex w-full flex-col">
      <IntakePageHeader title={session.pageTitle} />

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        <ChatPanel
          introTitle={session.introTitle}
          introSubtitle={session.introSubtitle}
          initialMessages={session.messages}
          suggestedActions={session.suggestedActions}
          inputPlaceholder={session.inputPlaceholder}
          inputTip={session.inputTip}
        />

        <aside className="flex w-full flex-col gap-4 overflow-y-auto lg:w-[320px] xl:w-[360px]">
          <DetectedSignalsPanel signals={session.detectedSignals} />
          <IntakeProgressCard
            progress={session.progress}
            progressPercent={session.progressPercent}
            ctaLabel={session.ctaLabel}
            ctaHint={session.ctaHint}
            conceptsRoute={session.conceptsRoute}
          />
        </aside>
      </div>
    </div>
  );
}