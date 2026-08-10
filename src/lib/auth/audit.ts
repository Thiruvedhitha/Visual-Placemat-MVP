import { getSupabaseAdmin } from "@/lib/db/postgres/client";

type AuditOptions = {
  actorId: string;
  action: string;
  targetUserId?: string | null;
  clientId?: string | null;
  catalogId?: string | null;
  previousValue?: object | null;
  newValue?: object | null;
  reason?: string | null;
};

export async function logAudit(opts: AuditOptions): Promise<void> {
  try {
    await getSupabaseAdmin().from("access_audit_log").insert({
      actor_id:       opts.actorId,
      action:         opts.action,
      target_user_id: opts.targetUserId ?? null,
      client_id:      opts.clientId    ?? null,
      catalog_id:     opts.catalogId   ?? null,
      previous_value: opts.previousValue ?? null,
      new_value:      opts.newValue      ?? null,
      reason:         opts.reason        ?? null,
    });
  } catch {
    // Audit failures are non-fatal; main operation already completed
  }
}
