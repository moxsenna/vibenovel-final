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
import { IntegrationNotice } from "@/components/common/IntegrationNotice";
import { useSettingsData } from "@/hooks/useSettingsData";
import {
  getProseBeatCreditCost,
  getProseRewriteCreditCost,
  getPublishCopyCreditCost,
} from "@/services/ai";

/**
 * Pengaturan Pemakaian — Sprint 1 Task 1.14 (+ Sprint 2 Task 2.13 API integration)
 * Source: stitch-reference/pengaturan_pemakaian
 * Wrapped by AppShell via router layout.
 */
export function SettingsPage() {
  const {
    settings,
    selectedTier,
    setSelectedTier,
    notice,
    saveMessage,
    loading,
    saving,
    handleCancel,
    handleSave,
  } = useSettingsData();

  const { pageCopy } = settings;
  const costEstimates = [
    { label: "Tulis Beat dengan AI", cost: getProseBeatCreditCost(selectedTier) },
    { label: "Rewrite teks", cost: getProseRewriteCreditCost(selectedTier) },
    { label: "Publish copy", cost: getPublishCopyCreditCost(selectedTier) },
  ];

  return (
    <div className="mx-auto flex w-full max-w-detail flex-col gap-lg pb-8">
      <SettingsPageHeader title={pageCopy.title} subtitle={pageCopy.subtitle} />

      <IntegrationNotice message={notice} />
      {saveMessage ? <IntegrationNotice message={saveMessage} /> : null}

      {loading ? (
        <p className="font-body-sm text-body-sm text-muted-text" role="status">
          Memuat pengaturan...
        </p>
      ) : null}

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
          costEstimates={costEstimates}
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
        saveCta={saving ? "Menyimpan..." : pageCopy.saveCta}
        onCancel={handleCancel}
        onSave={() => void handleSave()}
      />
    </div>
  );
}
