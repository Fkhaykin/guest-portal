import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(request: Request) {
  // Verify caller is authenticated host
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { property_id: string; signature: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { property_id, signature } = body;
  if (!property_id || !signature || !signature.startsWith("data:image/png;base64,")) {
    return NextResponse.json({ error: "property_id and base64 PNG signature are required" }, { status: 400 });
  }

  // Verify the user owns this property
  const { data: property } = await supabase
    .from("property")
    .select("id")
    .eq("id", property_id)
    .single();

  if (!property) {
    return NextResponse.json({ error: "Property not found or not authorized" }, { status: 404 });
  }

  const admin = createAdminClient();
  const base64 = signature.replace("data:image/png;base64,", "");
  const buffer = Buffer.from(base64, "base64");
  const path = `owner-signatures/${property_id}.png`;

  const { error: uploadError } = await admin.storage
    .from("registrations")
    .upload(path, buffer, { contentType: "image/png", upsert: true });

  if (uploadError) {
    console.error("[upload-owner-signature] Upload failed:", uploadError);
    return NextResponse.json({ error: "Upload failed" }, { status: 500 });
  }

  // Save path to property
  await admin.from("property").update({ owner_signature_url: path }).eq("id", property_id);

  return NextResponse.json({ ok: true, path });
}
