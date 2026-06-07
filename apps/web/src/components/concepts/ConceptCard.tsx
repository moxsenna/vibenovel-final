import { Link } from "react-router-dom";
import type { StoryConcept } from "@/types";
import { Badge, Button, Card, Icon } from "@/components/ui";

const ACCENT_BG: Record<StoryConcept["decorativeAccent"], string> = {
  "primary-soft": "bg-primary-soft",
  "secondary-container": "bg-secondary-container",
  "success-soft": "bg-success-soft",
};

function SectionLabel({ children }: { children: string }) {
  return (
    <h4 className="mb-1.5 font-label-md text-label-md uppercase tracking-wider text-muted-text text-[11px]">
      {children}
    </h4>
  );
}

export interface ConceptCardProps {
  concept: StoryConcept;
}

export function ConceptCard({ concept }: ConceptCardProps) {
  const accentBg = ACCENT_BG[concept.decorativeAccent];

  return (
    <Card
      padding="sm"
      shadow={false}
      className={[
        "glass-card group relative flex flex-col overflow-hidden rounded-[20px] !border-0 p-6 transition-transform duration-300 hover:-translate-y-1 md:p-8",
        concept.featured ? "border-2 !border-primary-soft shadow-lg" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div
        className={`absolute -right-8 -top-8 z-0 h-32 w-32 rounded-bl-full opacity-50 transition-transform group-hover:scale-110 ${accentBg}`}
        aria-hidden="true"
      />

      {concept.featured && (
        <div className="absolute right-6 top-6 z-20">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary text-on-primary shadow-sm">
            <Icon name="star" size={14} filled />
          </span>
        </div>
      )}

      <div className="relative z-10 flex flex-1 flex-col">
        <div className="mb-5 flex items-start justify-between">
          <Badge
            variant="neutral"
            icon={<Icon name={concept.badgeIcon} size={16} />}
            className={`gap-1.5 rounded-full border-0 bg-surface-container-low px-3 py-1.5 shadow-sm ${concept.badgeToneClass}`}
          >
            {concept.badgeLabel}
          </Badge>
        </div>

        <h3 className="mb-5 font-headline-lg text-headline-lg text-on-surface">{concept.title}</h3>

        <div className="mb-6 flex flex-1 flex-col space-y-5">
          <div>
            <SectionLabel>Pitch Singkat</SectionLabel>
            <p className="font-body-md text-body-md italic leading-relaxed text-on-surface-variant">
              &ldquo;{concept.pitchShort}&rdquo;
            </p>
          </div>

          <div>
            <SectionLabel>Janji ke Pembaca</SectionLabel>
            <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
              {concept.readerPromise}
            </p>
          </div>

          <div>
            <SectionLabel>Konflik Utama</SectionLabel>
            <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
              {concept.mainConflict}
            </p>
          </div>

          <Card
            padding="sm"
            shadow={false}
            className="mt-2 rounded-xl border-primary-soft bg-surface-soft/80"
          >
            <h4 className="mb-1.5 flex items-center gap-1.5 font-label-md text-label-md text-primary-dark">
              <Icon name="trending_up" size={16} />
              Kenapa Pembaca Bisa Tertarik
            </h4>
            <p className="font-body-sm text-body-sm leading-relaxed text-on-surface-variant">
              {concept.commercialStrength}
            </p>
          </Card>
        </div>

        <Link to={concept.foundationRoute} className="mt-auto block w-full">
          <Button
            variant="primary"
            className="w-full rounded-xl py-3 shadow-md md:py-4"
            rightIcon={<Icon name="arrow_forward" size={18} />}
          >
            Pilih Konsep Ini
          </Button>
        </Link>
      </div>
    </Card>
  );
}