import { createClient, SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

/** Client-side Supabase client (uses anon key, subject to RLS) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Validate that all required server-side env vars are present. Throws a descriptive error if not. */
export function requireServerEnv() {
  const missing: string[] = [];
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push("NEXT_PUBLIC_SUPABASE_URL");
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push("SUPABASE_SERVICE_ROLE_KEY");
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(", ")}. Please set them in your Render dashboard under Environment.`);
  }
}

let _supabaseAdmin: SupabaseClient | null = null;

/** Server-side Supabase client (uses service role key, bypasses RLS). Lazily initialized. */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_supabaseAdmin) {
    requireServerEnv();
    _supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return _supabaseAdmin;
}

/** @deprecated Use getSupabaseAdmin() instead to get clearer errors when env vars are missing */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = getSupabaseAdmin();
    const value = client[prop as keyof SupabaseClient];
    if (typeof value === "function") {
      return (value as (...args: unknown[]) => unknown).bind(client);
    }
    return value;
  },
});
