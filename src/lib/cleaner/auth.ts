import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_DURATION_MS = 60 * 24 * 60 * 60 * 1000; // 60 days

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createCleanerSession(
  cleanerId: string
): Promise<string> {
  const supabase = createAdminClient();
  const token = crypto.randomUUID() + crypto.randomUUID();
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);

  // Clean up expired sessions for this cleaner
  await supabase
    .from("cleaner_session")
    .delete()
    .eq("cleaner_id", cleanerId)
    .lt("expires_at", new Date().toISOString());

  await supabase.from("cleaner_session").insert({
    cleaner_id: cleanerId,
    token,
    expires_at: expiresAt.toISOString(),
  });

  return token;
}

export async function validateCleanerSession(token: string) {
  const supabase = createAdminClient();

  const { data: session } = await supabase
    .from("cleaner_session")
    .select("cleaner_id, expires_at")
    .eq("token", token)
    .single();

  if (!session) return null;
  if (new Date(session.expires_at) < new Date()) return null;

  // Sliding renewal: once less than half the duration remains, extend the
  // DB expiry so active cleaners are never logged out. The cookie itself is
  // re-issued on every request by the proxy middleware.
  const remainingMs = new Date(session.expires_at).getTime() - Date.now();
  if (remainingMs < SESSION_DURATION_MS / 2) {
    await supabase
      .from("cleaner_session")
      .update({
        expires_at: new Date(Date.now() + SESSION_DURATION_MS).toISOString(),
      })
      .eq("token", token);
  }

  const { data: cleaner } = await supabase
    .from("cleaner")
    .select("id, name, host_id, is_active, pet_fee_cents")
    .eq("id", session.cleaner_id)
    .single();

  if (!cleaner || !cleaner.is_active) return null;

  return cleaner;
}

export async function deleteCleanerSessions(cleanerId: string) {
  const supabase = createAdminClient();
  await supabase.from("cleaner_session").delete().eq("cleaner_id", cleanerId);
}
