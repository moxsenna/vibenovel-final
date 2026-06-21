import { Link } from "react-router-dom";
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import {
  CanonFactsPanel,
  CharacterContinuityPanel,
  OpenLoopsPanel,
  RevealSchedulePanel,
  StyleProfilePanel,
} from "@/components/story-control";
import { Badge, Card, Icon } from "@/components/ui";
import { useStoryControlData } from "@/hooks/useStoryControlData";
import { ROUTES } from "@/routes/paths";

export function StoryControlPage() {
  const control = useStoryControlData();

  if (control.loading) {
    return (
      <div className="mx-auto w-full max-w-detail">
        <p role="status" className="font-body-md text-body-md text-muted-text">
          Memuat Story Control...
        </p>
      </div>
    );
  }

  if (control.settings?.creatorMode !== "advanced") {
    return (
      <div className="mx-auto w-full max-w-detail">
        <Card className="space-y-4 text-center">
          <Icon name="tune" size={36} className="mx-auto text-primary" />
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Story Control khusus Creator Advanced
          </h1>
          <p className="font-body-md text-body-md text-muted-text">
            Aktifkan Creator Mode Advanced untuk mengelola canon, reveal, continuity,
            dan Voice Lock secara eksplisit.
          </p>
          <Link
            to={ROUTES.settings}
            className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-5 py-2.5 font-label-md text-on-primary"
          >
            Buka Pengaturan
          </Link>
        </Card>
        <IntegrationNotice message={control.notice} className="mt-4" />
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="primary">Creator Advanced</Badge>
          <Badge>Owner-scoped</Badge>
          <Badge>Audit aktif</Badge>
        </div>
        <div>
          <h1 className="font-headline-lg text-headline-lg text-on-surface">
            Story Control Center
          </h1>
          <p className="mt-2 max-w-3xl font-body-md text-body-md text-muted-text">
            Kendalikan sumber kebenaran cerita secara terarah. Planning truth tetap
            tersembunyi dari response default dan tidak pernah masuk Writer packet.
          </p>
        </div>
      </header>

      <IntegrationNotice message={control.notice} />

      <div className="grid gap-6 md:grid-cols-2">
        <CanonFactsPanel
          facts={control.facts}
          savingKey={control.savingKey}
          onToggleLock={(fact) => void control.toggleFactLock(fact)}
        />
        <OpenLoopsPanel
          openLoops={control.openLoops}
          savingKey={control.savingKey}
          onStatusChange={(loopId, status) => void control.updateOpenLoopStatus(loopId, status)}
        />
        <RevealSchedulePanel
          reveals={control.reveals}
          savingKey={control.savingKey}
          onStatusChange={(revealId, status) => void control.updateRevealStatus(revealId, status)}
          onReplaceTruth={control.replaceRevealTruth}
        />
        <CharacterContinuityPanel
          characters={control.characters}
          facts={control.facts}
          selectedCharacterId={control.selectedCharacterId}
          state={control.characterState}
          history={control.characterStateHistory}
          knowledge={control.characterKnowledge}
          loading={control.continuityLoading}
          savingKey={control.savingKey}
          onSelectCharacter={control.setSelectedCharacterId}
          onSaveState={control.saveCharacterState}
          onSaveKnowledge={control.saveCharacterKnowledge}
        />
        <StyleProfilePanel
          profile={control.styleProfile}
          rules={control.effectiveStyleRules}
          saving={control.savingKey === "style-profile"}
          onSave={control.saveStyleProfile}
        />
      </div>
    </div>
  );
}
