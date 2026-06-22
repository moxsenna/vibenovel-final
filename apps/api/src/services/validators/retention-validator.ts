export interface RetentionFinding {
  type: "warning";
  validator: string;
  message: string;
}

export function validateRetentionHook(_prose: string): RetentionFinding[] {
  return [];
}
