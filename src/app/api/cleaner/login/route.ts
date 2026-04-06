import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  verifyPassword,
  createCleanerSession,
} from "@/lib/cleaner/auth";
import { setSessionCookie } from "@/lib/cleaner/session";

export async function POST(request: Request) {
  let body: { name: string; password: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, password } = body;
  if (!name || !password) {
    return NextResponse.json(
      { error: "Name and password are required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Look up active cleaners by name (case-insensitive)
  const { data: cleaners } = await supabase
    .from("cleaner")
    .select("id, name, password_hash")
    .ilike("name", name)
    .eq("is_active", true);

  if (!cleaners || cleaners.length === 0) {
    // Delay to slow brute force
    await new Promise((r) => setTimeout(r, 500));
    return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
  }

  // Try each match (handles name collisions across hosts)
  for (const cleaner of cleaners) {
    const valid = await verifyPassword(password, cleaner.password_hash);
    if (valid) {
      const token = await createCleanerSession(cleaner.id);
      await setSessionCookie(token);
      return NextResponse.json({ ok: true, cleaner_name: cleaner.name });
    }
  }

  await new Promise((r) => setTimeout(r, 500));
  return NextResponse.json({ error: "Invalid credentials" }, { status: 401 });
}
