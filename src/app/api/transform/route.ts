import { NextResponse } from "next/server";
import OpenAI from "openai";
import { buildCommandPrompt } from "@/lib/commands/promptBuilder";
import type { TransformRequest, DiagramCommand } from "@/lib/commands/index";

export async function GET() {
  return NextResponse.json(
    { message: "Use POST to send a transform prompt" },
    { status: 405 }
  );
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

  const { prompt, capabilities, nodeStyles = {} } = body;

  if (!prompt || typeof prompt !== "string" || prompt.trim() === "") {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }
  if (!Array.isArray(capabilities)) {
    return NextResponse.json({ error: "capabilities array is required" }, { status: 400 });
  }

  const openai = new OpenAI({ apiKey });
  const systemPrompt = buildCommandPrompt(capabilities, nodeStyles);

  let parsed: { commands?: DiagramCommand[]; summary?: string };
  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4.1-mini",
      max_tokens: 2048,
      temperature: 0,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: prompt.trim() },
      ],
    });
    const content = response.choices[0]?.message?.content ?? "{}";
    parsed = JSON.parse(content);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "OpenAI API error";
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({
    commands: Array.isArray(parsed.commands) ? parsed.commands : [],
    summary: parsed.summary ?? "",
  });
}

