import { useEffect, useState } from "react";
import {
  CHARACTER_KNOWLEDGE_STATUSES,
  type Character,
  type CharacterKnowledge,
  type CharacterKnowledgeStatus,
  type CharacterState,
  type Fact,
} from "@vibenovel/shared";
import { Badge, Button, Card, Input, Icon } from "@/components/ui";

export interface CharacterContinuityPanelProps {
  characters: Character[];
  facts: Fact[];
  selectedCharacterId: string | null;
  state: CharacterState | null;
  history: CharacterState[];
  knowledge: CharacterKnowledge[];
  loading: boolean;
  savingKey: string | null;
  onSelectCharacter: (characterId: string) => void;
  onSaveState: (input: {
    chapterNumber: number;
    emotionalState?: string | null;
    physicalState?: string | null;
    currentGoal?: string | null;
  }) => Promise<void>;
  onSaveKnowledge: (
    factId: string,
    status: CharacterKnowledgeStatus,
  ) => Promise<void>;
}

export function CharacterContinuityPanel({
  characters,
  facts,
  selectedCharacterId,
  state,
  history,
  knowledge,
  loading,
  savingKey,
  onSelectCharacter,
  onSaveState,
  onSaveKnowledge,
}: CharacterContinuityPanelProps) {
  const [chapterNumber, setChapterNumber] = useState(1);
  const [emotionalState, setEmotionalState] = useState("");
  const [physicalState, setPhysicalState] = useState("");
  const [currentGoal, setCurrentGoal] = useState("");

  useEffect(() => {
    setChapterNumber(state?.chapterNumber ?? Math.max(1, history.at(-1)?.chapterNumber ?? 1));
    setEmotionalState(state?.emotionalState ?? "");
    setPhysicalState(state?.physicalState ?? "");
    setCurrentGoal(state?.currentGoal ?? "");
  }, [history, state]);

  const knowledgeByFact = new Map(knowledge.map((item) => [item.factId, item]));
  const selectedCharacter = characters.find(
    (character) => character.id === selectedCharacterId,
  );

  return (
    <Card className="space-y-4 md:col-span-2" aria-labelledby="character-continuity-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="character-continuity-heading" className="font-headline-sm text-headline-sm text-on-surface">
            Continuity Tokoh
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text">
            State dan knowledge terpisah dari canon facts; edit manual selalu diaudit.
          </p>
        </div>
        <Icon name="psychology" className="text-primary" />
      </div>

      {characters.length === 0 ? (
        <p className="font-body-sm text-body-sm text-muted-text">Belum ada tokoh.</p>
      ) : (
        <>
          <label className="block font-label-sm text-label-sm text-on-surface-variant">
            Tokoh
            <select
              className="mt-1 min-h-[44px] w-full rounded-md border border-border bg-surface px-3"
              value={selectedCharacterId ?? ""}
              onChange={(event) => onSelectCharacter(event.target.value)}
            >
              {characters.map((character) => (
                <option key={character.id} value={character.id}>
                  {character.name} — {character.roleLabel}
                </option>
              ))}
            </select>
          </label>
          {selectedCharacter ? (
            <div className="flex flex-wrap gap-2">
              <Badge>{selectedCharacter.status}</Badge>
              <Badge>Sumber: {selectedCharacter.source}</Badge>
              <Badge>{selectedCharacter.importance}</Badge>
            </div>
          ) : null}

          {loading ? (
            <p role="status" className="font-body-sm text-body-sm text-muted-text">
              Memuat continuity tokoh...
            </p>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              <section className="space-y-3 rounded-xl border border-border bg-surface-soft p-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-label-lg text-label-lg text-on-surface">Snapshot state</h3>
                  <Badge>{history.length} riwayat</Badge>
                </div>
                <label className="block font-label-sm text-label-sm">
                  Bab efektif
                  <Input
                    type="number"
                    min={1}
                    value={chapterNumber}
                    onChange={(event) => setChapterNumber(Number(event.target.value))}
                  />
                </label>
                <label className="block font-label-sm text-label-sm">
                  Kondisi emosi
                  <Input value={emotionalState} onChange={(event) => setEmotionalState(event.target.value)} />
                </label>
                <label className="block font-label-sm text-label-sm">
                  Kondisi fisik
                  <Input value={physicalState} onChange={(event) => setPhysicalState(event.target.value)} />
                </label>
                <label className="block font-label-sm text-label-sm">
                  Tujuan saat ini
                  <Input value={currentGoal} onChange={(event) => setCurrentGoal(event.target.value)} />
                </label>
                <Button
                  size="sm"
                  disabled={savingKey === "character-state" || chapterNumber < 1}
                  onClick={() => void onSaveState({
                    chapterNumber,
                    emotionalState: emotionalState || null,
                    physicalState: physicalState || null,
                    currentGoal: currentGoal || null,
                  })}
                >
                  {savingKey === "character-state" ? "Menyimpan..." : "Simpan snapshot"}
                </Button>
              </section>

              <section className="space-y-3 rounded-xl border border-border bg-surface-soft p-4">
                <h3 className="font-label-lg text-label-lg text-on-surface">Pengetahuan terhadap fakta</h3>
                {facts.length === 0 ? (
                  <p className="font-body-sm text-body-sm text-muted-text">Belum ada fakta.</p>
                ) : (
                  <ul className="max-h-[32rem] space-y-3 overflow-y-auto pr-1">
                    {facts.map((fact) => {
                      const row = knowledgeByFact.get(fact.id);
                      const value = row?.knowledgeStatus ?? CHARACTER_KNOWLEDGE_STATUSES.unknown;
                      return (
                        <li key={fact.id} className="rounded-lg border border-border bg-surface p-3">
                          <p className="font-body-sm text-body-sm text-on-surface">{fact.text}</p>
                          <label className="mt-2 block font-label-sm text-label-sm">
                            Status knowledge
                            <select
                              className="mt-1 min-h-[38px] w-full rounded-md border border-border bg-surface px-3"
                              value={value}
                              disabled={savingKey === `knowledge:${fact.id}`}
                              onChange={(event) =>
                                void onSaveKnowledge(
                                  fact.id,
                                  event.target.value as CharacterKnowledgeStatus,
                                )
                              }
                            >
                              {Object.values(CHARACTER_KNOWLEDGE_STATUSES).map((status) => (
                                <option key={status} value={status}>{status}</option>
                              ))}
                            </select>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </Card>
  );
}
