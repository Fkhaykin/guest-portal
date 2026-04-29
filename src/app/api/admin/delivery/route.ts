import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendDeliveryNotification } from "@/lib/email/send-delivery-notification";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: host } = await admin
    .from("host")
    .select("id")
    .eq("auth_user_id", user.id)
    .single();
  if (!host) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  let body: {
    property_id: string;
    category: "rideshare" | "food_grocery" | "other";
    provider?: string;
    num_cars?: number;
    arrival_date: string;
    has_return?: boolean;
    return_cars?: number;
    return_date?: string;
    notes?: string;
  };

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const {
    property_id,
    category,
    provider,
    num_cars,
    arrival_date,
    has_return,
    return_cars,
    return_date,
    notes,
  } = body;

  if (!property_id || !category || !arrival_date) {
    return NextResponse.json(
      { error: "property_id, category, and arrival_date are required" },
      { status: 400 }
    );
  }

  const { data: property } = await admin
    .from("property")
    .select("id, name, nickname, lot_section, hoa_submission_email, owner_name, owner_phone, owner_email, hoa_type")
    .eq("id", property_id)
    .single();
  if (!property) return NextResponse.json({ error: "Property not found" }, { status: 404 });

  const { data: record, error: insertError } = await admin
    .from("delivery_rideshare")
    .insert({
      property_id,
      category,
      provider: provider || null,
      num_cars: num_cars || 1,
      arrival_date,
      has_return: has_return || false,
      return_cars: return_cars || null,
      return_date: return_date || null,
      notes: notes || null,
    })
    .select("id")
    .single();

  if (insertError) {
    return NextResponse.json({ error: "Failed to save" }, { status: 500 });
  }

  const ALWAYS_NOTIFY = "welcomecenter@pepoa.org";

  const hoaEmails: string[] = property.hoa_submission_email
    ? property.hoa_submission_email
        .split(",")
        .map((e: string) => e.trim())
        .filter(Boolean)
    : [];

  if (!hoaEmails.includes(ALWAYS_NOTIFY)) {
    hoaEmails.push(ALWAYS_NOTIFY);
  }

  const propertyLabel = (property.nickname || property.name || "").toLowerCase();
  const housePassword = propertyLabel.includes("bianca") ? "1764" : "littleleo";

  try {
    const { subject, body: emailBody } = await sendDeliveryNotification({
      to: hoaEmails,
      lotSection: property.lot_section || "N/A",
      category,
      provider: provider || "Other",
      quantity: num_cars || 1,
      arrivalDate: arrival_date,
      ownerName: property.owner_name || "",
      ownerPhone: property.owner_phone || "",
      ownerEmail: property.owner_email || "",
      housePassword,
      hoaType: property.hoa_type || "pepoa",
    });

    await admin
      .from("delivery_rideshare")
      .update({
        email_subject: subject,
        email_body: emailBody,
        email_recipients: hoaEmails,
      })
      .eq("id", record.id);
  } catch {
    // Email failed — record is already saved, return success anyway
  }

  return NextResponse.json({ ok: true, id: record.id });
}
