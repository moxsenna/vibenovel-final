import type { WriterPreferences } from "@/types";
import { Card, Icon } from "@/components/ui";

export interface SettingsWriterPreferencesSectionProps {
  title: string;
  preferences: WriterPreferences;
}

interface PreferenceRowProps {
  icon: string;
  label: string;
  value: string;
}

function PreferenceRow({ icon, label, value }: PreferenceRowProps) {
  return (
    <button
      type="button"
      disabled
      title="Belum tersedia di Sprint 1 — UI demo saja"
      className="mb-2 flex w-full items-center justify-between rounded-lg p-3 text-left opacity-80"
    >
      <div className="flex min-w-0 items-center gap-3">
        <Icon name={icon} size={20} className="shrink-0 text-muted-text" />
        <span className="font-body-md text-body-md text-on-surface">{label}</span>
      </div>
      <div className="flex shrink-0 items-center gap-1 text-muted-text">
        <span className="max-w-[9rem] truncate font-label-sm text-label-sm sm:max-w-none">
          {value}
        </span>
        <Icon name="chevron_right" size={18} />
      </div>
    </button>
  );
}

export function SettingsWriterPreferencesSection({
  title,
  preferences,
}: SettingsWriterPreferencesSectionProps) {
  return (
    <Card
      padding="lg"
      className="flex flex-1 flex-col rounded-[20px] border-border/50 shadow-sm"
    >
      <div className="mb-5 flex items-center gap-2">
        <Icon name="tune" size={22} className="text-on-surface-variant" />
        <h3 className="font-headline-md text-headline-md text-on-surface">{title}</h3>
      </div>

      <div className="flex flex-col">
        <PreferenceRow
          icon="language"
          label="Bahasa default"
          value={preferences.defaultLanguage}
        />
        <PreferenceRow
          icon="auto_awesome"
          label="Gaya output default"
          value={preferences.defaultOutputStyle}
        />
        <PreferenceRow
          icon="smartphone"
          label="Format bacaan"
          value={preferences.defaultFormat}
        />
      </div>
    </Card>
  );
}