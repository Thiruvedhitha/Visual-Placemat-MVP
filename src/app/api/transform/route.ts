import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { buildCommandPrompt } from "@/lib/commands/promptBuilder";
import type { TransformRequest, DiagramCommand } from "@/lib/commands/index";

export async function GET() {
  return NextResponse.json(
    { message: "Use POST to send a transform prompt" },
    { status: 405 }
  );
}

export async function POST(req: Request) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY is not configured on the server" },
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

  const anthropic = new Anthropic({ apiKey });
  const systemPrompt = buildCommandPrompt(capabilities, nodeStyles);

  let rawText: string;
  try {
    const message = await anthropic.messages.create({
      model: "claude-opus-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: prompt.trim() }],
    });
    const block = message.content.find((b) => b.type === "text");
    rawText = block?.type === "text" ? block.text : "";
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Anthropic API error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  // Extract the JSON object from the response
  const jsonMatch = rawText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    return NextResponse.json(
      { error: "LLM returned no valid JSON", raw: rawText },
      { status: 502 }
    );
  }

  let parsed: { commands?: DiagramCommand[]; summary?: string };
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse LLM JSON", raw: rawText },
      { status: 502 }
    );
  }

  return NextResponse.json({
    commands: Array.isArray(parsed.commands) ? parsed.commands : [],
    summary: parsed.summary ?? "",
  });
}

