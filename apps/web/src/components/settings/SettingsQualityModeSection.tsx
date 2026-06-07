import type { ModelTier, ModelTierOption } from "@/types";
import { Badge, Card, Icon } from "@/components/ui";

export interface SettingsQualityModeSectionProps {
  title: string;
  subtitle: string;
  tiers: ModelTierOption[];
  selectedTier: ModelTier;
  onSelectTier: (tier: ModelTier) => void;
}

const badgeVariantMap = {
  neutral: "neutral",
  primary: "primary",
  success: "success",
} as const;

export function SettingsQualityModeSection({
  title,
  subtitle,
  tiers,
  selectedTier,
  onSelectTier,
}: SettingsQualityModeSectionProps) {
  return (
    <Card
      padding="lg"
      className="flex h-full flex-col rounded-[20px] border-border/50 shadow-sm"
    >
      <div className="mb-6 flex items-center gap-2">
        <Icon name="psychology" size={22} className="text-secondary" />
        <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
      </div>
      <p className="mb-6 font-body-sm text-body-sm text-muted-text">{subtitle}</p>

      <div className="flex flex-1 flex-col gap-3" role="radiogroup" aria-label={title}>
        {tiers.map((tier) => {
          const isSelected = selectedTier === tier.id;

          return (
            <label
              key={tier.id}
              className={[
                "group relative flex cursor-pointer items-start gap-4 rounded-xl border p-4 transition-colors",
                isSelected
                  ? "border-2 border-primary bg-primary-soft/30"
                  : "border-border hover:bg-surface-soft",
              ].join(" ")}
            >
              <input
                type="radio"
                name="quality_mode"
                value={tier.id}
                checked={isSelected}
                onChange={() => onSelectTier(tier.id)}
                className="mt-1 border-outline-variant text-primary focus:ring-primary"
              />
              <div className="flex-1">
                <p
                  className={[
                    "mb-1 flex items-center justify-between gap-2 font-label-md text-label-md",
                    isSelected ? "font-bold text-primary" : "text-on-surface",
                  ].join(" ")}
                >
                  {tier.label}
                  <Badge variant={badgeVariantMap[tier.badgeVariant]} className="font-normal">
                    {tier.badgeLabel}
                  </Badge>
                </p>
                <p
                  className={[
                    "font-body-sm text-body-sm",
                    isSelected ? "text-on-surface-variant" : "text-muted-text",
                  ].join(" ")}
                >
                  {tier.description}
                </p>
              </div>
            </label>
          );
        })}
      </div>
    </Card>
  );
}