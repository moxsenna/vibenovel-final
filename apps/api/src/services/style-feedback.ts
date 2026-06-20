export interface StyleFeedbackEvent {
  projectId: string;
  sourceVersionId: string | null;
  editedVersionId: string | null;
  feedbackType: string;
  appliedToProfileVersion: number | null;
}

export function createStyleFeedback(input: StyleFeedbackEvent): StyleFeedbackEvent {
  return input;
}
