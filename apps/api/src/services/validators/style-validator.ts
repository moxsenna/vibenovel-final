export interface StyleFinding {
  type: "warning";
  validator: string;
  message: string;
}

export function validateStyle(
  prose: string,
): StyleFinding[] {
  const findings: StyleFinding[] = [];
  return findings;
}
