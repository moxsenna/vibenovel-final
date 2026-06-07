export type ConceptAccent = "primary-soft" | "secondary-container" | "success-soft";

export interface StoryConcept {
  id: string;
  title: string;
  /** Pitch singkat — tampil italic seperti Stitch */
  pitchShort: string;
  /** Label badge genre/rasa cerita */
  badgeLabel: string;
  badgeIcon: string;
  badgeToneClass: string;
  mainConflict: string;
  readerPromise: string;
  /** Kenapa pembaca bisa tertarik lanjut baca */
  commercialStrength: string;
  decorativeAccent: ConceptAccent;
  /** Kartu rekomendasi utama (border highlight) */
  featured?: boolean;
  foundationRoute: string;
}