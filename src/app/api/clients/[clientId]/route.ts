import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import {
  getClientById,
  getUserClientRole,
  updateClient,
  deleteClient,
  getCatalogsForClient,
} from "@/lib/db/clients";

interface RouteParams {
  params: { clientId: string };
}

/** GET /api/clients/[clientId] — Get client details + catalogs */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const role = await getUserClientRole(clientId, user.id);
  if (!role) {
    return NextResponse.json({ error: "Not a member of this client" }, { status: 403 });
  }

  try {
    const [client, catalogs] = await Promise.all([
      getClientById(clientId),
      getCatalogsForClient(clientId),
    ]);

    if (!client) {
      return NextResponse.json({ error: "Client not found" }, { status: 404 });
    }

    return NextResponse.json({ ...client, role, catalogs });
  } catch (err) {
    console.error("GET /api/clients/[clientId] error:", err);
    return NextResponse.json({ error: "Failed to fetch client" }, { status: 500 });
  }
}

/** PATCH /api/clients/[clientId] — Update client details (admin only) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const role = await getUserClientRole(clientId, user.id);
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const allowed = ["name", "industry", "description", "logo_url"] as const;
    const updates: Record<string, string> = {};

    for (const key of allowed) {
      if (key in body && typeof body[key] === "string") {
        updates[key] = body[key].trim();
      }
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    const client = await updateClient(clientId, updates);
    return NextResponse.json(client);
  } catch (err) {
    console.error("PATCH /api/clients/[clientId] error:", err);
    return NextResponse.json({ error: "Failed to update client" }, { status: 500 });
  }
}

/** DELETE /api/clients/[clientId] — Delete client folder (admin only) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const role = await getUserClientRole(clientId, user.id);
  if (role !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    await deleteClient(clientId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/clients/[clientId] error:", err);
    return NextResponse.json({ error: "Failed to delete client" }, { status: 500 });
  }
}
