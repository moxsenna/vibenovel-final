export interface RetentionFinding {
  type: "warning";
  validator: string;
  message: string;
}

export function validateRetentionHook(prose: string): RetentionFinding[] {
  return [];
}
