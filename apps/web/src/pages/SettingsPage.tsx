import { useMemo, useState } from "react";
import {
  SettingsAccountSection,
  SettingsActionSection,
  SettingsCreditCard,
  SettingsPageHeader,
  SettingsQualityModeSection,
  SettingsSprintNote,
  SettingsUsageSection,
  SettingsWriterPreferencesSection,
} from "@/components/settings";
import type { ModelTier } from "@/types";
import { mockSettings } from "@/mocks/settings";

/**
 * Pengaturan Pemakaian — Sprint 1 Task 1.14 (+ 1.17 desktop 2-col polish)
 * Source: stitch-reference/pengaturan_pemakaian
 * Wrapped by AppShell via router layout.
 */
export function SettingsPage() {
  const settings = mockSettings;
  const { pageCopy } = settings;

  const initialTier = useMemo(
    () => settings.modelTiers.find((tier) => tier.isSelected)?.id ?? "seimbang",
    [settings.modelTiers],
  );

  const [selectedTier, setSelectedTier] = useState<ModelTier>(initialTier);

  const handleCancel = () => {
    setSelectedTier(initialTier);
  };

  const handleSave = () => {
    // Sprint 1: local UI only — no persistence layer yet.
  };

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-lg pb-8">
      <SettingsPageHeader title={pageCopy.title} subtitle={pageCopy.subtitle} />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <SettingsCreditCard
          title={pageCopy.creditCardTitle}
          subtitle={pageCopy.creditCardSubtitle}
          creditsRemaining={settings.creditsRemaining}
          balanceLabel={pageCopy.creditBalanceLabel}
        />

        <SettingsUsageSection
          title={pageCopy.usageSectionTitle}
          usedLabel={pageCopy.usageUsedLabel}
          upgradeCta={pageCopy.usageUpgradeCta}
          usage={settings.monthlyUsage}
          className="h-full"
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2 lg:items-start">
        <SettingsQualityModeSection
          title={pageCopy.qualityModeTitle}
          subtitle={pageCopy.qualityModeSubtitle}
          tiers={settings.modelTiers}
          selectedTier={selectedTier}
          onSelectTier={setSelectedTier}
        />

        <div className="flex flex-col gap-6">
          <SettingsAccountSection
            title={pageCopy.accountSectionTitle}
            displayNameLabel={pageCopy.displayNameLabel}
            emailLabel={pageCopy.emailLabel}
            planLabel={pageCopy.planLabel}
            editProfileCta={pageCopy.editProfileCta}
            displayName={settings.displayName}
            email={settings.email}
            plan={settings.planLabel}
          />

          <SettingsWriterPreferencesSection
            title={pageCopy.writerPreferencesTitle}
            preferences={settings.writerPreferences}
          />
        </div>
      </div>

      <SettingsSprintNote title={pageCopy.sprintNoteTitle} body={pageCopy.sprintNoteBody} />

      <SettingsActionSection
        cancelCta={pageCopy.cancelCta}
        saveCta={pageCopy.saveCta}
        onCancel={handleCancel}
        onSave={handleSave}
      />
    </div>
  );
}