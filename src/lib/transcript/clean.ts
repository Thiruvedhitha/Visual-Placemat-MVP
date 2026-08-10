export interface CleanResult {
  cleaned: string;
  /** cleanedLineIdx → originalLineIdx mapping for source-quote reconstruction */
  sourceMap: number[];
}

const TIMESTAMP_LINE = /^\s*\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\s*$/;
const BRACKETED_STAGE = /^\s*\[.*\]\s*$/;
const INLINE_TIMESTAMP = /\s*\(\d{1,2}:\d{2}(:\d{2})?\)\s*/g;
const SPEAKER_PREFIX = /^([A-Z][a-zÀ-ÿ]+ [A-Z][a-zÀ-ÿ]+|Speaker \d+):\s*/;
const FILLERS = /\b(um+|uh+|you know|like|sort of|kind of|basically|literally|actually|right\?)\b[,]?\s*/gi;

/** Normalise a string for dedup comparison. */
function normalise(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

export function cleanTranscript(raw: string): CleanResult {
  const rawLines = raw.split(/\r?\n/);
  const kept: string[] = [];
  const sourceMap: number[] = [];
  const seen = new Set<string>();

  for (let i = 0; i < rawLines.length; i++) {
    let line = rawLines[i];

    if (TIMESTAMP_LINE.test(line)) continue;
    if (BRACKETED_STAGE.test(line)) continue;

    line = line.replace(INLINE_TIMESTAMP, " ");
    line = line.replace(SPEAKER_PREFIX, "");
    line = line.replace(FILLERS, " ");
    line = line.replace(/\s{2,}/g, " ").trim();

    // drop short noise lines
    if (line.split(/\s+/).filter(Boolean).length < 3) continue;

    // dedup near-identical lines
    const norm = normalise(line);
    if (seen.has(norm)) continue;
    seen.add(norm);

    kept.push(line);
    sourceMap.push(i);
  }

  return { cleaned: kept.join("\n"), sourceMap };
}
