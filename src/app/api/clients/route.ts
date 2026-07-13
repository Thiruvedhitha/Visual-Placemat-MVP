import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import { getClientsForUser, createClient } from "@/lib/db/clients";

/**
 * GET /api/clients
 * Returns all client folders the current user is a member of.
 */
export async function GET() {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const clients = await getClientsForUser(user.id);
    return NextResponse.json(clients);
  } catch (err) {
    console.error("GET /api/clients error:", err);
    return NextResponse.json({ error: "Failed to fetch clients" }, { status: 500 });
  }
}

/**
 * POST /api/clients
 * Create a new client folder. The creator is auto-added as admin via DB trigger.
 */
export async function POST(request: NextRequest) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { name, industry, description } = body;

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "Client name is required" }, { status: 400 });
    }

    const client = await createClient(name.trim(), user.id, {
      industry: industry?.trim() || undefined,
      description: description?.trim() || undefined,
    });

    return NextResponse.json(client, { status: 201 });
  } catch (err) {
    console.error("POST /api/clients error:", err);
    return NextResponse.json({ error: "Failed to create client" }, { status: 500 });
  }
}
