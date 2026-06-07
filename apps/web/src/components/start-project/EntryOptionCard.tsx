import { Link } from "react-router-dom";
import { Badge, Icon } from "@/components/ui";
import type { StartProjectOption } from "@/mocks/startProject";

export interface EntryOptionCardProps {
  option: StartProjectOption;
}

const CARD_BASE =
  "group relative rounded-[20px] border border-border bg-surface p-lg text-left transition-all duration-300 hover:-translate-y-1 hover:border-primary-container hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary-soft";

export function EntryOptionCard({ option }: EntryOptionCardProps) {
  const { prominent, badge, icon, iconBg, iconColor, iconFilled, title, description, ctaLabel, to } =
    option;

  if (prominent) {
    return (
      <Link
        to={to}
        className={`${CARD_BASE} col-span-1 flex flex-col items-start gap-md md:col-span-2 sm:flex-row sm:items-center`}
      >
        {badge && (
          <Badge variant="accent" className="absolute top-md right-md">
            {badge}
          </Badge>
        )}
        <div
          className={`flex-shrink-0 rounded-xl p-md transition-transform duration-300 group-hover:scale-110 ${iconBg} ${iconColor}`}
        >
          <Icon name={icon} size={32} filled={iconFilled} />
        </div>
        <div className="min-w-0 flex-grow">
          <h2 className="mb-xs font-headline-md text-headline-md text-on-surface transition-colors group-hover:text-primary">
            {title}
          </h2>
          <p className="font-body-md text-body-md text-muted-text">{description}</p>
          <span className="mt-sm inline-flex items-center gap-1 font-label-md text-label-md text-primary">
            {ctaLabel}
            <Icon name="arrow_forward" size={16} className="transition-transform group-hover:translate-x-1" />
          </span>
        </div>
        <Icon
          name="arrow_forward"
          size={24}
          className="hidden flex-shrink-0 text-border transition-colors group-hover:text-primary sm:block"
        />
      </Link>
    );
  }

  return (
    <Link to={to} className={`${CARD_BASE} flex flex-col gap-md`}>
      {badge && (
        <Badge variant="neutral" className="absolute top-md right-md">
          {badge}
        </Badge>
      )}
      <div
        className={`w-fit rounded-lg p-sm transition-colors group-hover:bg-accent-soft ${iconBg} ${iconColor}`}
      >
        <Icon name={icon} size={24} filled={iconFilled} />
      </div>
      <div>
        <h2 className="mb-xs font-headline-md text-headline-md text-on-surface transition-colors group-hover:text-primary">
          {title}
        </h2>
        <p className="mb-sm font-body-md text-body-md text-muted-text">{description}</p>
        <span className="inline-flex items-center gap-1 font-label-md text-label-md text-primary">
          {ctaLabel}
          <Icon name="arrow_forward" size={16} className="transition-transform group-hover:translate-x-1" />
        </span>
      </div>
    </Link>
  );
}