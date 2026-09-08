import { getSupabaseAdmin } from "./postgres/client";
import type { Client, ClientMember, CapabilityCatalog } from "@/types/capability";

// ─── Clients ────────────────────────────────────────────────

/** Get all clients the user has membership for */
export async function getClientsForUser(userId: string): Promise<Client[]> {
  const db = getSupabaseAdmin();

  // Step 1: get client IDs user is a member of
  const { data: memberships, error: memError } = await db
    .from("client_members")
    .select("client_id, role")
    .eq("user_id", userId);

  if (memError) throw memError;
  const clientIds = (memberships ?? []).map((m) => m.client_id);
  if (clientIds.length === 0) return [];

  // Step 2: fetch those clients
  const { data, error } = await db
    .from("clients")
    .select("*")
    .in("id", clientIds)
    .order("name");

  if (error) throw error;
  const roleMap = new Map((memberships ?? []).map((m) => [m.client_id, m.role]));
  return (data ?? []).map((client) => ({ ...client, role: roleMap.get(client.id) })) as Client[];
}

/** Get a single client by ID (no auth check — use RLS or verify membership upstream) */
export async function getClientById(clientId: string): Promise<Client | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("clients")
    .select("*")
    .eq("id", clientId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data as Client | null;
}

/** Create a new client folder */
export async function createClient(
  name: string,
  createdBy: string,
  opts?: { industry?: string; description?: string }
): Promise<Client> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("clients")
    .insert({
      name,
      created_by: createdBy,
      industry: opts?.industry ?? null,
      description: opts?.description ?? null,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Client;
}

/** Update client details (name, industry, description) */
export async function updateClient(
  clientId: string,
  updates: Partial<Pick<Client, "name" | "industry" | "description" | "logo_url">>
): Promise<Client> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("clients")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", clientId)
    .select()
    .single();

  if (error) throw error;
  return data as Client;
}

/** Delete a client folder */
export async function deleteClient(clientId: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db.from("clients").delete().eq("id", clientId);
  if (error) throw error;
}

// ─── Client Members ─────────────────────────────────────────

/** Get all members of a client, enriched with email and display_name from user_profiles */
export async function getClientMembers(clientId: string): Promise<(ClientMember & { email: string; display_name: string })[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("client_members")
    .select("*")
    .eq("client_id", clientId)
    .order("created_at");

  if (error) throw error;
  const members = (data ?? []) as ClientMember[];
  if (members.length === 0) return [];

  const userIds = members.map((m) => m.user_id);
  const { data: profiles } = await db
    .from("user_profiles")
    .select("user_id, email, display_name")
    .in("user_id", userIds);

  const profileMap = new Map((profiles ?? []).map((p) => [p.user_id, p]));
  return members.map((m) => ({
    ...m,
    email:        profileMap.get(m.user_id)?.email        ?? m.user_id,
    display_name: profileMap.get(m.user_id)?.display_name ?? "",
  }));
}

/** Get user's role in a client (null if not a member) */
export async function getUserClientRole(
  clientId: string,
  userId: string
): Promise<"admin" | "editor" | "viewer" | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("client_members")
    .select("role")
    .eq("client_id", clientId)
    .eq("user_id", userId)
    .single();

  if (error && error.code !== "PGRST116") throw error;
  return data?.role ?? null;
}

/** Add a member to a client */
export async function addClientMember(
  clientId: string,
  userId: string,
  role: "admin" | "editor" | "viewer",
  invitedBy: string
): Promise<ClientMember> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("client_members")
    .insert({ client_id: clientId, user_id: userId, role, invited_by: invitedBy })
    .select()
    .single();

  if (error) throw error;
  return data as ClientMember;
}

/** Update a member's role */
export async function updateMemberRole(
  clientId: string,
  userId: string,
  role: "admin" | "editor" | "viewer"
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("client_members")
    .update({ role })
    .eq("client_id", clientId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Remove a member from a client */
export async function removeClientMember(clientId: string, userId: string): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("client_members")
    .delete()
    .eq("client_id", clientId)
    .eq("user_id", userId);

  if (error) throw error;
}

/** Check if user is the last admin (prevent orphaned clients) */
export async function isLastAdmin(clientId: string, userId: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { count, error } = await db
    .from("client_members")
    .select("*", { count: "exact", head: true })
    .eq("client_id", clientId)
    .eq("role", "admin");

  if (error) throw error;
  if ((count ?? 0) > 1) return false;

  // Check if the single admin IS this user
  const { data } = await db
    .from("client_members")
    .select("user_id")
    .eq("client_id", clientId)
    .eq("role", "admin")
    .single();

  return data?.user_id === userId;
}

// ─── Catalogs within Clients ────────────────────────────────

/** Get all catalogs for a client */
export async function getCatalogsForClient(clientId: string): Promise<CapabilityCatalog[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("capability_catalogs")
    .select("*")
    .eq("client_id", clientId)
    .eq("status", "active")
    .order("updated_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CapabilityCatalog[];
}

/** Move a catalog to a different client */
export async function moveCatalogToClient(
  catalogId: string,
  targetClientId: string | null
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from("capability_catalogs")
    .update({ client_id: targetClientId, updated_at: new Date().toISOString() })
    .eq("id", catalogId);

  if (error) throw error;
}

/** Look up a user by email — first tries user_profiles, then falls back to auth.admin.listUsers */
export async function findUserByEmail(email: string): Promise<{ id: string; email: string } | null> {
  const db = getSupabaseAdmin();

  // Fast path: user_profiles table (populated after migration)
  const { data: profile } = await db
    .from("user_profiles")
    .select("user_id, email")
    .eq("email", email.toLowerCase().trim())
    .maybeSingle();
  if (profile) return { id: profile.user_id, email: profile.email };

  // Fallback: auth.admin.listUsers (O(n), kept until all profiles are synced)
  const { data, error } = await db.auth.admin.listUsers();
  if (error) throw error;
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  return user ? { id: user.id, email: user.email! } : null;
}
