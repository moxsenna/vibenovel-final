import type {
  WriterCanonFactSummary,
  WriterContextPacket,
} from "@vibenovel/shared";

/**
 * Normalize legacy context packets to v3-compatible structure.
 *
 * - Legacy `canon.facts: string[]` → `WriterCanonFactSummary[]`
 * - Missing `continuity.precedingProseTail` → `null`
 */
export function normalizeCanonFacts(
  packet: WriterContextPacket,
): WriterCanonFactSummary[] {
  const facts = packet.canon.facts;
  if (facts.length === 0) return [];

  // If already structured (objects with id/text), return as-is
  if (typeof facts[0] === "object") {
    return facts as unknown as WriterCanonFactSummary[];
  }

  // Legacy: array of plain strings
  return (facts as unknown as string[]).map((text, index) => ({
    id: `legacy:${index}`,
    text,
    category: "legacy",
    importance: "unknown",
  }));
}

/**
 * Check if a packet is v3 or older — based on fact type.
 */
export function isPacketV3(packet: WriterContextPacket): boolean {
  const facts = packet.canon.facts;
  if (facts.length === 0) return true;
  return typeof facts[0] === "object";
}
