import type { ChapterBadge, ChapterBadgeType } from "@/types";
import { Badge, Icon } from "@/components/ui";
import type { BadgeVariant } from "@/components/ui";

const BADGE_CONFIG: Record<
  ChapterBadgeType,
  { variant: BadgeVariant; icon: string }
> = {
  reveal: { variant: "accent", icon: "visibility" },
  mini_victory: { variant: "success", icon: "emoji_events" },
  conflict: { variant: "danger", icon: "swords" },
  emotion: { variant: "primary", icon: "favorite" },
  cliffhanger: { variant: "warning", icon: "front_hand" },
};

export interface OutlineChapterBadgeProps {
  badge: ChapterBadge;
}

export function OutlineChapterBadge({ badge }: OutlineChapterBadgeProps) {
  const config = BADGE_CONFIG[badge.type];

  return (
    <Badge variant={config.variant} icon={<Icon name={config.icon} size={14} />}>
      {badge.label}
    </Badge>
  );
}