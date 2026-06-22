export interface MobileReadabilityFinding {
  type: "warning";
  validator: string;
  message: string;
}

export function validateMobileReadability(prose: string): MobileReadabilityFinding[] {
  const findings: MobileReadabilityFinding[] = [];
  const paragraphs = prose.split(/\n\s*\n/);
  for (let i = 0; i < paragraphs.length; i++) {
    const wordCount = paragraphs[i].split(/\s+/).length;
    if (wordCount > 150) {
      findings.push({
        type: "warning",
        validator: "mobile-readability",
        message: `Paragraph ${i + 1} has ${wordCount} words, consider splitting for mobile readability`,
      });
    }
  }
  return findings;
}
