import OpenAI from "openai";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";
import { buildTranscriptPrompt } from "@/lib/commands/promptBuilder";
import type { TranscriptAnalysis } from "@/lib/commands/index";
import type { Capability } from "@/types/capability";
import type { NodeStylePatch } from "@/lib/commands/index";

// ── Constants ──────────────────────────────────────────────────────────────

/** ~15K words — matches the Approach A "when to reconsider" threshold */
const MAX_TRANSCRIPT_CHARS = 60_000;

type LegendEntry = { id: string; label: string; color: string };
type LegendConfig = { fill: LegendEntry[]; border: LegendEntry[]; textColor: LegendEntry[] };

// ── Cleaning ───────────────────────────────────────────────────────────────

/**
 * Strips noise from raw Teams/Zoom/Google Meet transcript exports.
 * Pure regex — no tokens consumed.
 */
export function cleanTranscript(raw: string): string {
  let t = raw;
  // Timestamps  e.g. [00:01:23] or 0:01 or 00:01:23.456
  t = t.replace(/\[?\d{1,2}:\d{2}(:\d{2})?(\.\d+)?\]?\s*/g, "");
  // Filler words
  t = t.replace(/\b(um|uh|uhh|hmm|you know|like|basically|actually|so yeah|right right)\b/gi, "");
  // Caption artefacts
  t = t.replace(/\[(inaudible|crosstalk|laughter|pause|silence|applause)\]/gi, "");
  // Meeting admin noise
  t = t.replace(/^.*\b(mute|unmute|can you hear me|screen share|you're on mute|sorry i'm late|let me share)\b.*$/gim, "");
  // Collapse whitespace
  t = t.replace(/\s{2,}/g, " ").replace(/\n{3,}/g, "\n\n");
  // Drop lines that are too short to carry meaning
  return t
    .split("\n")
    .filter((line) => line.trim().length >= 5)
    .join("\n")
    .trim();
}

export function truncateIfNeeded(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
  // Cut at a newline boundary near the limit so we don't split a sentence
  const cut = text.lastIndexOf("\n", MAX_TRANSCRIPT_CHARS);
  return (cut > MAX_TRANSCRIPT_CHARS * 0.5 ? text.slice(0, cut) : text.slice(0, MAX_TRANSCRIPT_CHARS)).trim()
    + "\n\n[Transcript truncated — first ~15K words analysed]";
}

// ── LLM extraction ─────────────────────────────────────────────────────────

/**
 * Single-pass LLM extraction (Approach A).
 * Returns the full TranscriptAnalysis: understanding + todos (each with a DiagramCommand).
 * Mirrors the usage-logging pattern from /api/transform.
 */
export async function analyzeTranscript(args: {
  cleaned: string;
  capabilities: Capability[];
  nodeStyles: Record<string, NodeStylePatch>;
  legend: LegendConfig | null;
}): Promise<TranscriptAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not configured");

  const openai = new OpenAI({ apiKey });

  const systemPrompt = buildTranscriptPrompt(
    args.capabilities,
    args.nodeStyles,
    args.legend ?? undefined,
    args.capabilities,
  );

  const response = await openai.chat.completions.create({
    model: "gpt-4.1-mini",
    max_tokens: 8192,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: args.cleaned },
    ],
  });

  // ── Usage logging (mirrors /api/transform) ────────────────────────────
  if (response.usage) {
    const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
    const cost_usd = (prompt_tokens / 1_000_000) * 0.4 + (completion_tokens / 1_000_000) * 1.6;
    try {
      await getSupabaseAdmin().from("ai_usage_log").insert({
        timestamp: new Date().toISOString(),
        model: "gpt-4.1-mini",
        mode: "transcript",
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_usd: parseFloat(cost_usd.toFixed(6)),
      });
    } catch {
      // non-fatal — don't fail the analysis if logging fails
    }
    console.log(
      `[Transcript] tokens → prompt:${prompt_tokens} completion:${completion_tokens} total:${total_tokens} cost:$${cost_usd.toFixed(5)}`
    );
  }

  const content = response.choices[0]?.message?.content ?? "{}";
  console.log("[Transcript] ── Raw response ──\n", content.slice(0, 500), "...\n────────");

  let parsed: TranscriptAnalysis;
  try {
    parsed = JSON.parse(content) as TranscriptAnalysis;
  } catch {
    // Partial salvage: try to find a "todos" array even if the outer object is malformed
    const arrMatch = content.match(/"todos"\s*:\s*(\[[\s\S]*)/);
    if (arrMatch) {
      try {
        // Find matching closing bracket
        let depth = 0, end = -1;
        for (let i = 0; i < arrMatch[1].length; i++) {
          if (arrMatch[1][i] === "[") depth++;
          if (arrMatch[1][i] === "]") { depth--; if (depth === 0) { end = i; break; } }
        }
        const arr = JSON.parse(end >= 0 ? arrMatch[1].slice(0, end + 1) : arrMatch[1] + "]");
        parsed = { understanding: "(response truncated)", todos: Array.isArray(arr) ? arr : [] };
      } catch {
        parsed = { understanding: "(could not parse AI response)", todos: [] };
      }
    } else {
      parsed = { understanding: "(could not parse AI response)", todos: [] };
    }
  }

  parsed.todos = Array.isArray(parsed.todos) ? parsed.todos : [];
  parsed.understanding = parsed.understanding ?? "";
  return parsed;
}
