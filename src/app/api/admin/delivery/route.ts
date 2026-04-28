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
    registration_id: string;
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
    registration_id,
    category,
    provider,
    num_cars,
    arrival_date,
    has_return,
    return_cars,
    return_date,
    notes,
  } = body;

  if (!registration_id || !category || !arrival_date) {
    return NextResponse.json(
      { error: "registration_id, category, and arrival_date are required" },
      { status: 400 }
    );
  }

  const { data: reg } = await admin
    .from("registration")
    .select("id, property_id")
    .eq("id", registration_id)
    .single();
  if (!reg) return NextResponse.json({ error: "Registration not found" }, { status: 404 });

  const { data: property } = await admin
    .from("property")
    .select("lot_section, hoa_submission_email, owner_phone, owner_email, hoa_type")
    .eq("id", reg.property_id)
    .single();

  const { data: record, error: insertError } = await admin
    .from("delivery_rideshare")
    .insert({
      registration_id: reg.id,
      property_id: reg.property_id,
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

  if (property?.hoa_submission_email) {
    const hoaEmails = property.hoa_submission_email
      .split(",")
      .map((e: string) => e.trim())
      .filter(Boolean);

    sendDeliveryNotification({
      to: hoaEmails,
      lotSection: property.lot_section || "N/A",
      category,
      provider: provider || "Other",
      quantity: num_cars || 1,
      arrivalDate: arrival_date,
      ownerPhone: property.owner_phone || "",
      ownerEmail: property.owner_email || "",
      hoaType: property.hoa_type || "pepoa",
    }).catch(() => {});
  }

  return NextResponse.json({ ok: true, id: record.id });
}
