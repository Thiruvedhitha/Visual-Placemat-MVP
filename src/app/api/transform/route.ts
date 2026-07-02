import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildCommandPrompt, buildSuggestionPrompt, buildChatPrompt } from "@/lib/commands/promptBuilder";
import type { TransformRequest, DiagramCommand, ChatHistoryMessage } from "@/lib/commands/index";
import type { Capability } from "@/types/capability";
import { getSupabaseAdmin } from "@/lib/db/postgres/client";

// ── Usage logging ──────────────────────────────────────────────────────────
async function appendUsageLog(entry: {
  timestamp: string;
  model: string;
  mode: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  cost_usd: number;
}) {
  try {
    const { error } = await getSupabaseAdmin()
      .from("ai_usage_log")
      .insert(entry);
    if (error) console.warn("[Usage Log] Supabase insert error:", error.message);
  } catch (e) {
    console.warn("[Usage Log] Failed to write:", e);
  }
}

export async function GET() {
  return NextResponse.json(
    { message: "Use POST to send a transform prompt" },
    { status: 405 }
  );
}

/**
 * Computes the canonical hierarchical number for a capability (e.g. "1.7.5.1")
 * using sort_order — must stay in sync with promptBuilder.getNumber and the canvas.
 */
function getCapabilityNumber(capId: string, caps: Capability[]): string {
  const byId = new Map(caps.map((c) => [c.id, c]));
  const path: number[] = [];
  let current = byId.get(capId);
  while (current) {
    const parentId = current.parent_id ?? null;
    const siblings = caps.filter((c) => (c.parent_id ?? null) === parentId);
    siblings.sort((a, b) => a.sort_order - b.sort_order);
    path.unshift(siblings.findIndex((c) => c.id === current!.id) + 1);
    current = current.parent_id ? byId.get(current.parent_id) : undefined;
  }
  return path.join(".");
}

/**
 * Trims the capability list to only what the AI needs.
 * Uses the PURE user request (strips any [Context:...] prefix added by the
 * sidebar) so the selected node never biases which nodes are included.
 *
 * Strategy:
 * - Always send all L0 + L1 (structure overview)
 * - If the prompt contains hierarchical numbers (e.g. 1.6.1.1), resolve those
 *   nodes and force-include them plus all their ancestors and siblings
 * - L2: only nodes whose name matches a keyword from the user's request
 * - L3: only direct children of matched L2s  (no sibling expansion — saves tokens)
 * - Fallback: if no L2 matched, send all L2 but NO L3
 */
function trimCapabilities(caps: Capability[], fullPrompt: string): Capability[] {
  // Strip the [Context: ...] prefix injected by RightSidebar so the selected
  // node's name doesn't pollute the keyword matching
  const userRequest = fullPrompt.replace(/^\[Context:[^\]]*\]\s*/i, "").trim();
  const lower = userRequest.toLowerCase();
  const words = lower.split(/\s+/).filter((w) => w.length > 3);

  // Extract the canvas-selected node ID injected by AIMapEditor buildPrompt.
  // This node must ALWAYS be included in the trimmed set regardless of keywords.
  const canvasSelectedMatch = fullPrompt.match(/id\s+"([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})"/i);
  const canvasSelectedId = canvasSelectedMatch ? canvasSelectedMatch[1] : null;

  // If user explicitly references a level (L0, L1, L2, L3), include ALL nodes at that level
  // plus all ancestor levels so the tree structure stays intact for the AI
  const mentionedLevels = new Set<number>();
  Array.from(lower.matchAll(/\bl([0-3])\b/g)).forEach((m) => {
    mentionedLevels.add(Number(m[1]));
  });
  if (mentionedLevels.size > 0) {
    // Compute the max mentioned level and include everything up to it
    const maxLevel = Math.max(...Array.from(mentionedLevels));
    return caps.filter((c) => c.level <= maxLevel);
  }

  // Detect hierarchical number references in the prompt (e.g. "1.6.1.1", "2.3")
  const numberRefs = Array.from(lower.matchAll(/\b(\d+(?:\.\d+){1,3})\b/g)).map((m) => m[1]);
  if (numberRefs.length > 0) {
    // Build number→id map for all caps (computed once)
    const numberMap = new Map<string, string>();
    for (const cap of caps) {
      numberMap.set(getCapabilityNumber(cap.id, caps), cap.id);
    }
    const byId = new Map(caps.map((c) => [c.id, c]));

    // Collect the directly referenced nodes plus all ancestors
    const forceIncludeIds = new Set<string>();
    for (const ref of numberRefs) {
      const id = numberMap.get(ref);
      if (!id) continue;
      // Walk up to root, adding every ancestor
      let cur = byId.get(id);
      while (cur) {
        forceIncludeIds.add(cur.id);
        cur = cur.parent_id ? byId.get(cur.parent_id) : undefined;
      }
      // Also include direct children so the AI can see the node's contents
      caps.filter((c) => c.parent_id === id).forEach((c) => forceIncludeIds.add(c.id));
    }

    if (forceIncludeIds.size > 0) {
      // Always include all L0+L1, plus the resolved nodes/ancestors/children
      const base = new Set(caps.filter((c) => c.level <= 1).map((c) => c.id));
      return caps.filter((c) => base.has(c.id) || forceIncludeIds.has(c.id));
    }
  }

  const l0l1 = caps.filter((c) => c.level <= 1);
  const l2 = caps.filter((c) => c.level === 2);
  const l3 = caps.filter((c) => c.level === 3);

  const matchesKeyword = (c: Capability) =>
    words.some(
      (w) =>
        c.name.toLowerCase().includes(w) ||
        (c.description ?? "").toLowerCase().includes(w)
    );

  // L2 whose name or description contains a keyword from the actual request
  const matchedL2Ids = new Set(
    l2.filter(matchesKeyword).map((c) => c.id)
  );

  // L3 children of matched L2s OR L3 nodes whose own name/description matches
  const relevantL3 = l3.filter(
    (c) => matchedL2Ids.has(c.parent_id ?? "") || matchesKeyword(c)
  );

  // Fallback: no L2 matched → send all L2, skip L3 entirely
  const relevantL2 =
    matchedL2Ids.size > 0 ? l2.filter((c) => matchedL2Ids.has(c.id)) : l2;
  const finalL3 = matchedL2Ids.size > 0 ? relevantL3 : [];

  const trimmed = [...l0l1, ...relevantL2, ...finalL3];

  // Always include the canvas-selected node plus its siblings (so the AI can
  // see it in context) regardless of keyword matching.
  if (canvasSelectedId && !trimmed.find((c) => c.id === canvasSelectedId)) {
    const selectedCap = caps.find((c) => c.id === canvasSelectedId);
    if (selectedCap) {
      // Add the node itself and its siblings (same parent) for context
      const siblings = caps.filter((c) => c.parent_id === selectedCap.parent_id);
      const idsAlready = new Set(trimmed.map((c) => c.id));
      siblings.forEach((s) => { if (!idsAlready.has(s.id)) trimmed.push(s); });
    }
  }

  return trimmed;
}

export async function POST(req: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  let body: TransformRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, capabilities, nodeStyles = {}, history = [], mode = "command", legend } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!Array.isArray(capabilities)) {
    return NextResponse.json({ error: "capabilities array is required" }, { status: 400 });
  }

  // For chat + suggest modes send all capabilities (don't trim — AI needs real IDs for every node it references)
  const trimmed = (mode === "chat" || mode === "suggest") ? capabilities : trimCapabilities(capabilities, prompt);
  const systemPrompt = mode === "suggest"
    ? buildSuggestionPrompt(trimmed, nodeStyles, capabilities)
    : mode === "chat"
    ? buildChatPrompt(trimmed, nodeStyles, capabilities)
    : buildCommandPrompt(trimmed, nodeStyles, capabilities, legend ? { fill: legend.fill, border: legend.border, textColor: (legend as { fill: typeof legend.fill; border: typeof legend.border; textColor?: Array<{ id: string; label: string; color: string }> }).textColor ?? [] } : undefined);

  // ── Request log ──────────────────────────────────────────────────────────────
  console.log("\n[AI Transform] ── Incoming request ──────────────────────");
  console.log("  Prompt       :", prompt.trim());
  console.log("  Capabilities :", capabilities.length, "total →", trimmed.length, "sent to AI");
  console.log("  NodeStyles   :", Object.keys(nodeStyles).length, "overrides");
  console.log("  History turns:", history.length);
  console.log("─────────────────────────────────────────────────────────\n");

  // Build history messages, capped at last 20 turns to stay within token limits
  const recentHistory = (history as ChatHistoryMessage[]).slice(-20);
  const historyMessages = recentHistory.map((m) => ({
    role: m.role as "user" | "assistant",
    content: m.content,
  }));

  const openai = new OpenAI({
    apiKey,
  });

  const callOpenAI = async () =>
    openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 8192,
      // chat mode returns plain text — don't force JSON
      ...(mode !== "chat" ? { response_format: { type: "json_object" as const } } : {}),
      messages: [
        { role: "system", content: systemPrompt },
        ...historyMessages,
        { role: "user", content: prompt.trim() },
      ],
    });

  // Exponential backoff: retry up to 3 times on 429 (5s → 10s → 20s)
  const callOpenAIWithRetry = async () => {
    const delays = [5000, 10000, 20000];
    let lastErr: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await callOpenAI();
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") && attempt < delays.length) {
          const wait = delays[attempt];
          console.warn(`[AI Transform] 429 rate-limit — retrying in ${wait / 1000}s… (attempt ${attempt + 1}/${delays.length})`);
          await new Promise((r) => setTimeout(r, wait));
        } else {
          throw err;
        }
      }
    }
    throw lastErr;
  };

  let parsed: { commands?: DiagramCommand[]; summary?: string };
  try {
    let response;
    try {
      response = await callOpenAIWithRetry();
    } catch (firstErr: unknown) {
      throw firstErr;
    }

    const content = response.choices[0]?.message?.content ?? "{}";

    // ── Usage logging ─────────────────────────────────────────────────────
    if (response.usage) {
      const { prompt_tokens, completion_tokens, total_tokens } = response.usage;
      // gpt-4.1-mini pricing: $0.40/1M input, $1.60/1M output
      const cost_usd =
        (prompt_tokens / 1_000_000) * 0.4 +
        (completion_tokens / 1_000_000) * 1.6;
      const entry = {
        timestamp: new Date().toISOString(),
        model: "gpt-4.1-mini",
        mode: mode ?? "transform",
        prompt_tokens,
        completion_tokens,
        total_tokens,
        cost_usd: parseFloat(cost_usd.toFixed(6)),
      };
      void appendUsageLog(entry);
      console.log(
        `[AI Transform] tokens → prompt:${prompt_tokens} completion:${completion_tokens} total:${total_tokens} cost:$${cost_usd.toFixed(5)}`
      );
    }

    // ── Raw response log ─────────────────────────────────────────────────────
    console.log("[AI Transform] ── Raw response ───────────────────────────");
    console.log(content);
    console.log("─────────────────────────────────────────────────────────\n");

    // Chat mode: return plain text directly without JSON parsing
    if (mode === "chat") {
      return NextResponse.json({ reply: content.trim() });
    }

    try {
      parsed = JSON.parse(content);
    } catch (parseErr) {
      // Attempt to salvage complete commands from a truncated JSON response.
      // Extract the commands array portion and close it at the last complete object.
      const salvaged = content.replace(/,\s*\{[^{}]*$/, "").replace(/^([\s\S]*"commands"\s*:\s*\[)([\s\S]*)$/, (_, head, body) => {
        const trimmedBody = body.replace(/,?\s*$/, "");
        return `{${head.slice(head.indexOf('"commands"'))}${trimmedBody}], "summary": "(response truncated — partial results applied)"}`.replace(/^/, "{");
      });
      try {
        // Simplest salvage: extract each complete {...} command object
        const commandMatches = content.match(/\{[^{}]+\}/g) ?? [];
        const salvageCmds = commandMatches
          .map((s) => { try { return JSON.parse(s); } catch { return null; } })
          .filter((o) => o && typeof o.type === "string" && typeof o.nodeId === "string");
        parsed = { commands: salvageCmds, summary: "(response was truncated — partial results applied)" };
        console.warn("[AI Transform] JSON truncated — salvaged", salvageCmds.length, "commands");
      } catch {
        throw parseErr;
      }
    }
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "OpenAI API error";
    // Log the full error object so we can see the real OpenAI response body
    console.error("[AI Transform] ── ERROR ──────────────────────────────────");
    console.error("  Message:", raw);
    if (err && typeof err === "object" && "status" in err) {
      console.error("  Status :", (err as { status: unknown }).status);
    }
    if (err && typeof err === "object" && "error" in err) {
      console.error("  Body   :", JSON.stringify((err as { error: unknown }).error, null, 2));
    }
    console.error("─────────────────────────────────────────────────────────\n");

    const userMsg = raw.includes("429")
      ? "OpenAI rate limit reached — please wait a few seconds and try again"
      : raw;
    return NextResponse.json({ error: userMsg }, { status: 502 });
  }

  const commands = Array.isArray(parsed.commands) ? parsed.commands : [];
  const summary = parsed.summary ?? "";

  // ── Commands log ─────────────────────────────────────────────────────────
  console.log("[AI Transform] ── Commands returned ─────────────────────");
  console.log("  Summary  :", summary);
  console.log("  Commands :", JSON.stringify(commands, null, 2));
  console.log("─────────────────────────────────────────────────────────\n");

  if (mode === "suggest") {
    const proposals = Array.isArray((parsed as { proposals?: unknown[] }).proposals)
      ? (parsed as { proposals: unknown[] }).proposals
      : [];
    console.log("[AI Transform] ── Proposals returned ────────────────────");
    console.log("  Summary  :", parsed.summary ?? "");
    console.log("  Count    :", proposals.length);
    console.log("─────────────────────────────────────────────────────────\n");
    return NextResponse.json({ proposals, summary: parsed.summary ?? "" });
  }

  return NextResponse.json({ commands, summary });
}

