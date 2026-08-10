/** Parse a WebVTT string (Teams/Zoom native export) into plain text. */
export function parseVtt(vtt: string): string {
  const lines = vtt.split(/\r?\n/);
  const out: string[] = [];
  for (const line of lines) {
    const t = line.trim();
    if (!t) continue;
    if (t === "WEBVTT") continue;
    if (/^\d+$/.test(t)) continue;                          // cue sequence number
    if (/-->/.test(t)) continue;                             // timestamp range
    if (/^(NOTE|STYLE|REGION)\b/.test(t)) continue;
    out.push(t);
  }
  return out.join("\n");
}
