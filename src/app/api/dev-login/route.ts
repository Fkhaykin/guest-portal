import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// DEV ONLY - password login for local testing
export async function GET(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not available" }, { status: 404 });
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: "admin@guestportal.com",
    password: "admin123",
  });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 401 });
  }

  const url = new URL(request.url);
  return NextResponse.redirect(`${url.origin}/admin`);
}
