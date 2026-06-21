import type { Fact } from "@vibenovel/shared";
import { Badge, Button, Card, Icon } from "@/components/ui";

export interface CanonFactsPanelProps {
  facts: Fact[];
  savingKey: string | null;
  onToggleLock: (fact: Fact) => void;
}

export function CanonFactsPanel({ facts, savingKey, onToggleLock }: CanonFactsPanelProps) {
  return (
    <Card className="space-y-4" aria-labelledby="canon-facts-heading">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 id="canon-facts-heading" className="font-headline-sm text-headline-sm text-on-surface">
            Fakta Canon
          </h2>
          <p className="mt-1 font-body-sm text-body-sm text-muted-text">
            Hanya fakta berstatus confirmed yang masuk konteks Writer.
          </p>
        </div>
        <Icon name="push_pin" className="text-primary" />
      </div>

      {facts.length === 0 ? (
        <p className="font-body-sm text-body-sm text-muted-text">Belum ada fakta canon.</p>
      ) : (
        <ul className="space-y-3">
          {facts.map((fact) => (
            <li key={fact.id} className="rounded-xl border border-border bg-surface-soft p-4">
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant={fact.isLocked ? "success" : "neutral"}>
                  {fact.isLocked ? "Terkunci" : "Terbuka"}
                </Badge>
                <Badge>{fact.canonStatus}</Badge>
                <Badge>{fact.source}</Badge>
                <Badge>{fact.importance}</Badge>
              </div>
              <p className="my-3 font-body-md text-body-md text-on-surface">{fact.text}</p>
              <Button
                size="sm"
                variant="ghost"
                disabled={savingKey === `fact:${fact.id}`}
                onClick={() => onToggleLock(fact)}
              >
                {savingKey === `fact:${fact.id}`
                  ? "Menyimpan..."
                  : fact.isLocked
                    ? "Buka kunci"
                    : "Kunci fakta"}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
