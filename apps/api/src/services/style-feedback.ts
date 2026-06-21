import type { JsonObject } from "@vibenovel/shared";
import type { AppBindings } from "../env.js";
import { createServiceRoleClient } from "../lib/supabase.js";
import {
  getStyleProfileForOwner,
  upsertStyleProfileForOwner,
} from "./style-profile.js";

export interface StyleFeedbackEvent {
  projectId: string;
  sourceVersionId: string | null;
  editedVersionId: string | null;
  feedbackType: string;
  appliedToProfileVersion: number | null;
}

export interface StyleEditMetrics {
  paragraphWordDelta: number;
  sentenceWordDelta: number;
  dialogueDensityDelta: number;
  expositionMarkerDeletions: number;
  endingWordDelta: number;
}

function average(values: number[]): number {
  return values.length > 0
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : 0;
}

function textMetrics(text: string) {
  const paragraphs = text.split(/\n\s*\n/).map((item) => item.trim()).filter(Boolean);
  const sentences = text.match(/[^.!?]+[.!?]?/g)?.map((item) => item.trim()).filter(Boolean) ?? [];
  const dialogue = text.split(/\n/).filter((line) => /^\s*[-"“]/.test(line)).length;
  return {
    paragraphWords: average(paragraphs.map((item) => item.split(/\s+/).length)),
    sentenceWords: average(sentences.map((item) => item.split(/\s+/).length)),
    dialogueDensity: paragraphs.length > 0 ? dialogue / paragraphs.length : 0,
    expositionMarkers:
      text.match(/\b(sementara itu|pada akhirnya|seperti yang diketahui|dengan kata lain)\b/gi)
        ?.length ?? 0,
    endingWords: paragraphs.at(-1)?.split(/\s+/).length ?? 0,
  };
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

export function extractStyleEditMetrics(
  sourceText: string,
  editedText: string,
): StyleEditMetrics {
  const source = textMetrics(sourceText);
  const edited = textMetrics(editedText);
  return {
    paragraphWordDelta: round(edited.paragraphWords - source.paragraphWords),
    sentenceWordDelta: round(edited.sentenceWords - source.sentenceWords),
    dialogueDensityDelta: round(edited.dialogueDensity - source.dialogueDensity),
    expositionMarkerDeletions: Math.max(
      0,
      source.expositionMarkers - edited.expositionMarkers,
    ),
    endingWordDelta: edited.endingWords - source.endingWords,
  };
}

export function createStyleFeedback(input: StyleFeedbackEvent): StyleFeedbackEvent {
  return input;
}

export async function recordAcceptedStyleEdit(
  bindings: AppBindings,
  ownerId: string,
  input: {
    projectId: string;
    sourceVersionId: string;
    editedVersionId: string;
    sourceText: string;
    editedText: string;
  },
): Promise<void> {
  const metrics = extractStyleEditMetrics(input.sourceText, input.editedText);
  const admin = createServiceRoleClient(bindings);
  const { error } = await admin.from("style_feedback_events").insert({
    project_id: input.projectId,
    source_version_id: input.sourceVersionId,
    edited_version_id: input.editedVersionId,
    feedback_type: "accepted_user_edit",
    feedback_json: metrics as unknown as JsonObject,
    applied_to_profile_version: null,
  });
  if (error) {
    console.warn("style feedback insert skipped:", error.message);
    return;
  }

  const { data: pending } = await admin
    .from("style_feedback_events")
    .select("id, feedback_json")
    .eq("project_id", input.projectId)
    .is("applied_to_profile_version", null)
    .order("created_at", { ascending: true })
    .limit(20);
  const events = (pending ?? []) as Array<{ id: string; feedback_json: StyleEditMetrics }>;
  if (events.length < 3) return;

  const profile = await getStyleProfileForOwner(bindings, ownerId, input.projectId);
  if (!profile) return;
  const averageParagraphDelta = average(
    events.map((event) => Number(event.feedback_json.paragraphWordDelta) || 0),
  );
  const averageDialogueDelta = average(
    events.map((event) => Number(event.feedback_json.dialogueDensityDelta) || 0),
  );
  const nextRules = {
    ...profile.operationalRules,
    paragraphLength:
      averageParagraphDelta <= -10
        ? ("short" as const)
        : averageParagraphDelta >= 10
          ? ("long" as const)
          : profile.operationalRules.paragraphLength,
    dialogueDensity:
      averageDialogueDelta >= 0.15
        ? ("high" as const)
        : averageDialogueDelta <= -0.15
          ? ("low" as const)
          : profile.operationalRules.dialogueDensity,
  };
  const updated = await upsertStyleProfileForOwner(
    bindings,
    ownerId,
    input.projectId,
    {
      operationalRules: nextRules,
      metrics: {
        feedbackEventCount: events.length,
        averageParagraphDelta: round(averageParagraphDelta),
        averageDialogueDelta: round(averageDialogueDelta),
      },
      source: "accepted_user_edits",
      sourceProseVersionIds: events.map((event) => event.id),
    },
  );
  await admin
    .from("style_feedback_events")
    .update({ applied_to_profile_version: updated.version })
    .in("id", events.map((event) => event.id));
}
