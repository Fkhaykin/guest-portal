import bcrypt from "bcryptjs";
import { createAdminClient } from "@/lib/supabase/admin";

const SESSION_DURATION_MS = 72 * 60 * 60 * 1000; // 72 hours

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

  const { data: cleaner } = await supabase
    .from("cleaner")
    .select("id, name, host_id, is_active")
    .eq("id", session.cleaner_id)
    .single();

  if (!cleaner || !cleaner.is_active) return null;

  return cleaner;
}

export async function deleteCleanerSessions(cleanerId: string) {
  const supabase = createAdminClient();
  await supabase.from("cleaner_session").delete().eq("cleaner_id", cleanerId);
}
