import {
  ChatPanel,
  DetectedSignalsPanel,
  IntakePageHeader,
  IntakeProgressCard,
} from "@/components/intake";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useIntakeData } from "@/hooks/useIntakeData";

/**
 * Chat Story Agent Intake — Sprint 1 Task 1.7 (+ Sprint 3 Task 3.6 API integration)
 * Source: stitch-reference/beri_tahu_ide_ceritamu_refined
 * Wrapped by AppShell via router layout.
 */
export function IntakePage() {
  const { session, notice, loading, sending, apiMode, sendMessage } = useIntakeData();

  return (
    <div className="flex w-full flex-col">
      <IntakePageHeader title={session.pageTitle} />

      <IntegrationNotice message={notice} />

      {loading ? (
        <p className="mb-4 font-body-sm text-body-sm text-muted-text" role="status">
          Memuat sesi intake...
        </p>
      ) : null}

      <div className="flex flex-1 flex-col gap-6 lg:flex-row">
        <ChatPanel
          introTitle={session.introTitle}
          introSubtitle={session.introSubtitle}
          initialMessages={session.messages}
          suggestedActions={session.suggestedActions}
          inputPlaceholder={session.inputPlaceholder}
          inputTip={session.inputTip}
          apiMode={apiMode}
          sending={sending}
          onSendMessage={apiMode ? sendMessage : undefined}
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