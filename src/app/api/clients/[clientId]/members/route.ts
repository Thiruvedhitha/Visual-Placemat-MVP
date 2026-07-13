import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/auth/getUser";
import {
  getUserClientRole,
  getClientMembers,
  addClientMember,
  updateMemberRole,
  removeClientMember,
  isLastAdmin,
  findUserByEmail,
} from "@/lib/db/clients";

interface RouteParams {
  params: { clientId: string };
}

/** GET /api/clients/[clientId]/members — List all members */
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
    const members = await getClientMembers(clientId);
    return NextResponse.json(members);
  } catch (err) {
    console.error("GET /api/clients/[clientId]/members error:", err);
    return NextResponse.json({ error: "Failed to fetch members" }, { status: 500 });
  }
}

/** POST /api/clients/[clientId]/members — Add a member by email (admin only) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const requesterRole = await getUserClientRole(clientId, user.id);
  if (requesterRole !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { email, role } = body;

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email is required" }, { status: 400 });
    }

    const validRoles = ["admin", "editor", "viewer"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: "Role must be admin, editor, or viewer" }, { status: 400 });
    }

    // Find user by email
    const targetUser = await findUserByEmail(email.trim());
    if (!targetUser) {
      return NextResponse.json(
        { error: "User not found. They must sign in at least once before being added." },
        { status: 404 }
      );
    }

    const member = await addClientMember(clientId, targetUser.id, role, user.id);
    return NextResponse.json(member, { status: 201 });
  } catch (err: unknown) {
    const pgError = err as { code?: string };
    if (pgError.code === "23505") {
      return NextResponse.json({ error: "User is already a member of this client" }, { status: 409 });
    }
    console.error("POST /api/clients/[clientId]/members error:", err);
    return NextResponse.json({ error: "Failed to add member" }, { status: 500 });
  }
}

/** PATCH /api/clients/[clientId]/members — Change a member's role (admin only) */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const requesterRole = await getUserClientRole(clientId, user.id);
  if (requesterRole !== "admin") {
    return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  }

  try {
    const body = await request.json();
    const { user_id, role } = body;

    if (!user_id || typeof user_id !== "string") {
      return NextResponse.json({ error: "user_id is required" }, { status: 400 });
    }

    const validRoles = ["admin", "editor", "viewer"];
    if (!role || !validRoles.includes(role)) {
      return NextResponse.json({ error: "Role must be admin, editor, or viewer" }, { status: 400 });
    }

    // Prevent demoting the last admin
    if (role !== "admin") {
      const lastAdmin = await isLastAdmin(clientId, user_id);
      if (lastAdmin) {
        return NextResponse.json(
          { error: "Cannot change role of the last admin. Promote another member first." },
          { status: 400 }
        );
      }
    }

    await updateMemberRole(clientId, user_id, role);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("PATCH /api/clients/[clientId]/members error:", err);
    return NextResponse.json({ error: "Failed to update member role" }, { status: 500 });
  }
}

/** DELETE /api/clients/[clientId]/members — Remove a member (admin or self) */
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { clientId } = params;
  const { searchParams } = new URL(request.url);
  const targetUserId = searchParams.get("user_id");

  if (!targetUserId) {
    return NextResponse.json({ error: "user_id query parameter is required" }, { status: 400 });
  }

  const requesterRole = await getUserClientRole(clientId, user.id);

  // Must be admin or removing self
  if (requesterRole !== "admin" && targetUserId !== user.id) {
    return NextResponse.json({ error: "Admin access required to remove others" }, { status: 403 });
  }

  // Prevent removing last admin
  const lastAdmin = await isLastAdmin(clientId, targetUserId);
  if (lastAdmin) {
    return NextResponse.json(
      { error: "Cannot remove the last admin. Promote another member first." },
      { status: 400 }
    );
  }

  try {
    await removeClientMember(clientId, targetUserId);
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("DELETE /api/clients/[clientId]/members error:", err);
    return NextResponse.json({ error: "Failed to remove member" }, { status: 500 });
  }
}
