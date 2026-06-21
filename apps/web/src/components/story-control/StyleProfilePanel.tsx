import { useEffect, useState } from "react";
import { Badge, Button, Card, Input, Icon } from "@/components/ui";
import type {
  OperationalStyleRules,
  StyleProfile,
} from "@/services/storyControl";

function lines(value: string): string[] {
  return value.split("\n").map((item) => item.trim()).filter(Boolean);
}

export interface StyleProfilePanelProps {
  profile: StyleProfile | null;
  rules: OperationalStyleRules;
  saving: boolean;
  onSave: (rules: OperationalStyleRules) => Promise<void>;
}

export function StyleProfilePanel({
  profile,
  rules,
  saving,
  onSave,
}: StyleProfilePanelProps) {
  const [draft, setDraft] = useState(rules);
  const [narrationStyle, setNarrationStyle] = useState("");
  const [forbiddenStyle, setForbiddenStyle] = useState("");
  const [signatureMoves, setSignatureMoves] = useState("");
  const [endingRhythm, setEndingRhythm] = useState("");

  useEffect(() => {
    setDraft(rules);
    setNarrationStyle(rules.narrationStyle.join("\n"));
    setForbiddenStyle(rules.forbiddenStyle.join("\n"));
    setSignatureMoves(rules.signatureMoves.join("\n"));
    setEndingRhythm(rules.endingRhythm.join("\n"));
  }, [rules]);

  const selectClass =
    "mt-1 min-h-[40px] w-full rounded-md border border-border bg-surface px-3";
  const textareaClass =
    "mt-1 min-h-24 w-full rounded-md border border-border bg-surface p-3 font-body-sm text-body-sm";

  return (
    <Card className="space-y-4 md:col-span-2" aria-labelledby="style-profile-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="style-profile-heading" className="font-headline-sm text-headline-sm text-on-surface">
            Voice Lock
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text">
            Aturan operasional pendek yang masuk Writer packet dan style validator.
          </p>
        </div>
        <Icon name="palette" className="text-primary" />
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant={profile ? "success" : "neutral"}>
          {profile ? `Versi ${profile.version}` : "Default belum disimpan"}
        </Badge>
        <Badge>{profile?.status ?? "draft"}</Badge>
        <Badge>Sumber: {profile?.source ?? "default"}</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <label className="font-label-sm text-label-sm">
          Panjang paragraf
          <select
            className={selectClass}
            value={draft.paragraphLength}
            onChange={(event) => setDraft((current) => ({
              ...current,
              paragraphLength: event.target.value as OperationalStyleRules["paragraphLength"],
            }))}
          >
            <option value="short">short</option>
            <option value="medium">medium</option>
            <option value="long">long</option>
          </select>
        </label>
        <label className="font-label-sm text-label-sm">
          Kepadatan dialog
          <select
            className={selectClass}
            value={draft.dialogueDensity}
            onChange={(event) => setDraft((current) => ({
              ...current,
              dialogueDensity: event.target.value as OperationalStyleRules["dialogueDensity"],
            }))}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="font-label-sm text-label-sm">
          Rata-rata kata/kalimat
          <Input
            type="number"
            min={1}
            value={draft.averageSentenceWords ?? ""}
            onChange={(event) => setDraft((current) => ({
              ...current,
              averageSentenceWords: event.target.value ? Number(event.target.value) : null,
            }))}
          />
        </label>
        <label className="font-label-sm text-label-sm">
          Toleransi eksposisi
          <select
            className={selectClass}
            value={draft.expositionTolerance}
            onChange={(event) => setDraft((current) => ({
              ...current,
              expositionTolerance: event.target.value as OperationalStyleRules["expositionTolerance"],
            }))}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
        <label className="font-label-sm text-label-sm">
          Kepadatan metafora
          <select
            className={selectClass}
            value={draft.metaphorDensity}
            onChange={(event) => setDraft((current) => ({
              ...current,
              metaphorDensity: event.target.value as OperationalStyleRules["metaphorDensity"],
            }))}
          >
            <option value="low">low</option>
            <option value="medium">medium</option>
            <option value="high">high</option>
          </select>
        </label>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <label className="font-label-sm text-label-sm">
          Gaya narasi — satu aturan per baris
          <textarea className={textareaClass} value={narrationStyle} onChange={(event) => setNarrationStyle(event.target.value)} />
        </label>
        <label className="font-label-sm text-label-sm">
          Gaya terlarang — satu aturan per baris
          <textarea className={textareaClass} value={forbiddenStyle} onChange={(event) => setForbiddenStyle(event.target.value)} />
        </label>
        <label className="font-label-sm text-label-sm">
          Signature moves
          <textarea className={textareaClass} value={signatureMoves} onChange={(event) => setSignatureMoves(event.target.value)} />
        </label>
        <label className="font-label-sm text-label-sm">
          Ritme ending
          <textarea className={textareaClass} value={endingRhythm} onChange={(event) => setEndingRhythm(event.target.value)} />
        </label>
      </div>

      <Button
        disabled={saving}
        onClick={() => void onSave({
          ...draft,
          narrationStyle: lines(narrationStyle),
          forbiddenStyle: lines(forbiddenStyle),
          signatureMoves: lines(signatureMoves),
          endingRhythm: lines(endingRhythm),
        })}
      >
        {saving ? "Menyimpan Voice Lock..." : "Simpan Voice Lock"}
      </Button>
    </Card>
  );
}
