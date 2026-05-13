import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

type ChatMsg = { role: string; text: string };
type ChatHistory = { map: ChatMsg[] };

const MAX_MESSAGES = 100;

// GET /api/chat?catalogId=xxx
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const catalogId = searchParams.get("catalogId");

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId is required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("capability_catalogs")
    .select("chat_history")
    .eq("id", catalogId)
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const history: ChatHistory = data?.chat_history ?? { map: [] };
  return NextResponse.json({ messages: history.map ?? [] });
}

// POST /api/chat  { catalogId, messages: [{ role, text }] }
export async function POST(req: Request) {
  let body: { catalogId: string; messages: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { catalogId, messages } = body;

  if (!catalogId || !Array.isArray(messages) || messages.length === 0) {
    return NextResponse.json({ error: "catalogId and messages[] required" }, { status: 400 });
  }

  // Read current history
  const { data, error: readErr } = await supabaseAdmin
    .from("capability_catalogs")
    .select("chat_history")
    .eq("id", catalogId)
    .single();

  if (readErr) {
    console.error("[/api/chat POST] Read error for catalog", catalogId, ":", readErr.message);
    if (readErr.code === "PGRST116") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const history: ChatHistory = data?.chat_history ?? { map: [] };
  const current = history.map ?? [];
  history.map = [...current, ...messages].slice(-MAX_MESSAGES);

  const { error: writeErr } = await supabaseAdmin
    .from("capability_catalogs")
    .update({ chat_history: history })
    .eq("id", catalogId);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/chat?catalogId=xxx
export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const catalogId = searchParams.get("catalogId");

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId is required" }, { status: 400 });
  }

  const { error: writeErr } = await supabaseAdmin
    .from("capability_catalogs")
    .update({ chat_history: { map: [] } })
    .eq("id", catalogId);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
