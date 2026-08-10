import type { Capability } from "@/types/capability";

/** Levenshtein distance between two strings. */
function levenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, (_, i) =>
    Array.from({ length: n + 1 }, (_, j) => (i === 0 ? j : j === 0 ? i : 0))
  );
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] =
        a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

function normalize(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function similarity(a: string, b: string): number {
  const na = normalize(a);
  const nb = normalize(b);
  if (na === nb) return 1;
  const maxLen = Math.max(na.length, nb.length);
  if (maxLen === 0) return 1;
  return 1 - levenshtein(na, nb) / maxLen;
}

export interface ResolveResult {
  id: string;
  name: string;
  confidence: number;
}

/** Find the best-matching existing capability for a proposed name. Threshold 0.75. */
export function resolveCapabilityName(
  proposed: string,
  existing: Capability[]
): ResolveResult | null {
  const THRESHOLD = 0.75;
  let best: ResolveResult | null = null;

  for (const cap of existing) {
    const score = similarity(proposed, cap.name);
    if (score >= THRESHOLD && (!best || score > best.confidence)) {
      best = { id: cap.id, name: cap.name, confidence: score };
    }
  }
  return best;
}
