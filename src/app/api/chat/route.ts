import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/db/postgres/client";

type ChatMsg = { role: string; text: string; ts?: string };
type CommitEntry = {
  prompt: string;
  summary: string;
  adds: number;
  deletes: number;
  renames: number;
  styles: number;
  ts: string;
};
type ArchivedSession = {
  name: string;
  messages: ChatMsg[];
  commits: CommitEntry[];
  ts: string;
};
type ChatHistory = {
  map: ChatMsg[];
  commits?: CommitEntry[];
  sessions?: ArchivedSession[];
};

const MAX_MESSAGES = 100;
const MAX_COMMITS = 50;
const MAX_SESSIONS = 20;

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
  return NextResponse.json({
    messages: history.map ?? [],
    commits: history.commits ?? [],
    sessions: history.sessions ?? [],
  });
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
  // Auto-stamp messages that don't have a timestamp
  const stamped = messages.map(m => ({ ...m, ts: m.ts || new Date().toISOString() }));
  history.map = [...current, ...stamped].slice(-MAX_MESSAGES);

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
    .update({ chat_history: { map: [], commits: [] } })
    .eq("id", catalogId);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// PUT /api/chat  { catalogId, commit } OR { catalogId, archiveSession: true }
export async function PUT(req: Request) {
  let body: { catalogId: string; commit?: CommitEntry; archiveSession?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { catalogId } = body;

  if (!catalogId) {
    return NextResponse.json({ error: "catalogId required" }, { status: 400 });
  }

  const { data, error: readErr } = await supabaseAdmin
    .from("capability_catalogs")
    .select("chat_history")
    .eq("id", catalogId)
    .single();

  if (readErr) {
    if (readErr.code === "PGRST116") {
      return NextResponse.json({ ok: true, skipped: true });
    }
    return NextResponse.json({ error: readErr.message }, { status: 500 });
  }

  const history: ChatHistory = data?.chat_history ?? { map: [], commits: [], sessions: [] };

  // Archive current session → move messages+commits into sessions[], clear active
  if (body.archiveSession) {
    const currentMsgs = history.map ?? [];
    const currentCommits = history.commits ?? [];
    if (currentMsgs.length > 0) {
      const firstUserMsg = currentMsgs.find(m => m.role === "user");
      const sessionName = firstUserMsg?.text?.slice(0, 80) || "Untitled chat";
      const session: ArchivedSession = {
        name: sessionName,
        messages: currentMsgs,
        commits: currentCommits,
        ts: new Date().toISOString(),
      };
      const sessions = history.sessions ?? [];
      sessions.push(session);
      history.sessions = sessions.slice(-MAX_SESSIONS);
    }
    history.map = [];
    history.commits = [];
  }

  // Append a commit
  if (body.commit?.prompt) {
    const commits = history.commits ?? [];
    commits.push({ ...body.commit, ts: body.commit.ts || new Date().toISOString() });
    history.commits = commits.slice(-MAX_COMMITS);
  }

  const { error: writeErr } = await supabaseAdmin
    .from("capability_catalogs")
    .update({ chat_history: history })
    .eq("id", catalogId);

  if (writeErr) {
    return NextResponse.json({ error: writeErr.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
