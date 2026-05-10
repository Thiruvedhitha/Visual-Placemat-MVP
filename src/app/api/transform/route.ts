import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildCommandPrompt } from "@/lib/commands/promptBuilder";
import type { TransformRequest, DiagramCommand } from "@/lib/commands/index";
import type { Capability } from "@/types/capability";

export async function GET() {
  return NextResponse.json(
    { message: "Use POST to send a transform prompt" },
    { status: 405 }
  );
}

/**
 * Trims the capability list to only what the AI needs.
 * Uses the PURE user request (strips any [Context:...] prefix added by the
 * sidebar) so the selected node never biases which nodes are included.
 *
 * Strategy:
 * - Always send all L0 + L1 (structure overview)
 * - L2: only nodes whose name matches a keyword from the user's request
 * - L3: only direct children of matched L2s  (no sibling expansion — saves tokens)
 * - Fallback: if no L2 matched, send all L2 but NO L3
 */
function trimCapabilities(caps: Capability[], fullPrompt: string): Capability[] {
  // Strip the [Context: ...] prefix injected by RightSidebar so the selected
  // node's name doesn't pollute the keyword matching
  const userRequest = fullPrompt.replace(/^\[Context:[^\]]*\]\s*/i, "").trim();
  const words = userRequest.toLowerCase().split(/\s+/).filter((w) => w.length > 3);

  const l0l1 = caps.filter((c) => c.level <= 1);
  const l2 = caps.filter((c) => c.level === 2);
  const l3 = caps.filter((c) => c.level === 3);

  // L2 whose name or description contains a keyword from the actual request
  const matchedL2Ids = new Set(
    l2
      .filter((c) =>
        words.some(
          (w) =>
            c.name.toLowerCase().includes(w) ||
            (c.description ?? "").toLowerCase().includes(w)
        )
      )
      .map((c) => c.id)
  );

  // L3 children of matched L2s only (no sibling expansion — keeps token count low)
  const relevantL3 = l3.filter((c) => matchedL2Ids.has(c.parent_id ?? ""));

  // Fallback: no L2 matched → send all L2, skip L3 entirely
  const relevantL2 =
    matchedL2Ids.size > 0 ? l2.filter((c) => matchedL2Ids.has(c.id)) : l2;
  const finalL3 = matchedL2Ids.size > 0 ? relevantL3 : [];

  return [...l0l1, ...relevantL2, ...finalL3];
}

export async function POST(req: Request) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "GEMINI_API_KEY is not configured on the server" },
      { status: 500 }
    );
  }

  let body: TransformRequest;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, capabilities, nodeStyles = {} } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!Array.isArray(capabilities)) {
    return NextResponse.json({ error: "capabilities array is required" }, { status: 400 });
  }

  // Trim to relevant subset before building the prompt
  const trimmed = trimCapabilities(capabilities, prompt);
  const systemPrompt = buildCommandPrompt(trimmed, nodeStyles);

  // ── Request log ──────────────────────────────────────────────────────────────
  console.log("\n[AI Transform] ── Incoming request ──────────────────────");
  console.log("  Prompt       :", prompt.trim());
  console.log("  Capabilities :", capabilities.length, "total →", trimmed.length, "sent to AI");
  console.log("  NodeStyles   :", Object.keys(nodeStyles).length, "overrides");
  console.log("─────────────────────────────────────────────────────────\n");

  const gemini = new OpenAI({
    apiKey,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
  });

  const callGemini = async () =>
    gemini.chat.completions.create({
      model: "gemini-2.5-flash",
      max_tokens: 2048,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt.trim() },
      ],
    });

  // Exponential backoff: retry up to 3 times on 429 (6s → 12s → 24s)
  const callGeminiWithRetry = async () => {
    const delays = [6000, 12000, 24000];
    let lastErr: unknown;
    for (let attempt = 0; attempt <= delays.length; attempt++) {
      try {
        return await callGemini();
      } catch (err: unknown) {
        lastErr = err;
        const msg = err instanceof Error ? err.message : String(err);
        if (msg.includes("429") && attempt < delays.length) {
          const wait = delays[attempt];
          console.warn(`[AI Transform] 429 rate limit — retrying in ${wait / 1000}s… (attempt ${attempt + 1}/${delays.length})`);
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
      response = await callGeminiWithRetry();
    } catch (firstErr: unknown) {
      throw firstErr;
    }

    const content = response.choices[0]?.message?.content ?? "{}";

    // ── Raw response log ─────────────────────────────────────────────────────
    console.log("[AI Transform] ── Raw response ───────────────────────────");
    console.log(content);
    console.log("─────────────────────────────────────────────────────────\n");

    parsed = JSON.parse(content);
  } catch (err: unknown) {
    const raw = err instanceof Error ? err.message : "Gemini API error";
    const userMsg = raw.includes("429")
      ? "Gemini rate limit reached — please wait a few seconds and try again"
      : raw;

    console.error("[AI Transform] ── ERROR ──────────────────────────────────");
    console.error("  Message:", raw);
    console.error("─────────────────────────────────────────────────────────\n");
    return NextResponse.json({ error: userMsg }, { status: 502 });
  }

  const commands = Array.isArray(parsed.commands) ? parsed.commands : [];
  const summary = parsed.summary ?? "";

  // ── Commands log ─────────────────────────────────────────────────────────
  console.log("[AI Transform] ── Commands returned ─────────────────────");
  console.log("  Summary  :", summary);
  console.log("  Commands :", JSON.stringify(commands, null, 2));
  console.log("─────────────────────────────────────────────────────────\n");

  return NextResponse.json({ commands, summary });
}

