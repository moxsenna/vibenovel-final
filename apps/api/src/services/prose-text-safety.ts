const FORBIDDEN_PACKET_PATTERNS = [
  "planning_truth",
  "packet_json",
  "full_prompt",
  "safety_envelope",
];

export function assertProseTextSafe(prose: string): void {
  for (const pattern of FORBIDDEN_PACKET_PATTERNS) {
    if (prose.includes(pattern)) {
      throw new Error(`Prose contains forbidden pattern: ${pattern}`);
    }
  }
}
