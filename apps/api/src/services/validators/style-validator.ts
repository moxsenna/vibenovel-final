export interface StyleFinding {
  type: "warning";
  validator: string;
  message: string;
}

export function validateStyle(): StyleFinding[] {
  const findings: StyleFinding[] = [];
  return findings;
}
