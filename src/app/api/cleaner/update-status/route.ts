import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { validateCleanerSession } from "@/lib/cleaner/auth";
import { getSessionToken } from "@/lib/cleaner/session";

export async function POST(request: Request) {
  const token = await getSessionToken();
  if (!token) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cleaner = await validateCleanerSession(token);
  if (!cleaner) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: {
    registration_id: string;
    is_cleaned?: boolean;
    is_skipped?: boolean;
    fulfilled_upsells?: string[];
    checklist?: { room: string; item: string; checked: boolean }[];
    photos?: { room: string; path: string; uploaded_at: string; note?: string }[];
    notes?: string | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, is_cleaned, is_skipped, fulfilled_upsells, checklist, photos, notes } = body;
  if (!registration_id) {
    return NextResponse.json(
      { error: "registration_id is required" },
      { status: 400 }
    );
  }

  const supabase = createAdminClient();

  // Verify registration belongs to a property assigned to this cleaner
  const { data: assignment } = await supabase
    .from("cleaner_property")
    .select("property_id")
    .eq("cleaner_id", cleaner.id);

  if (!assignment || assignment.length === 0) {
    return NextResponse.json({ error: "No assigned properties" }, { status: 403 });
  }

  const propertyIds = assignment.map((a) => a.property_id);

  const { data: reg } = await supabase
    .from("registration")
    .select("id, property_id, check_out_date")
    .eq("id", registration_id)
    .in("property_id", propertyIds)
    .single();

  if (!reg) {
    return NextResponse.json({ error: "Registration not found" }, { status: 404 });
  }

  // Validate that checkout has passed if marking as cleaned
  if (is_cleaned === true) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkoutDate = new Date(reg.check_out_date + "T00:00:00");

    if (checkoutDate > today) {
      return NextResponse.json(
        { error: "Cannot mark as cleaned before checkout date" },
        { status: 400 }
      );
    }
  }

  // Build upsert payload
  const payload: Record<string, unknown> = {
    registration_id,
    cleaner_id: cleaner.id,
  };

  if (is_cleaned !== undefined) {
    payload.is_cleaned = is_cleaned;
    payload.cleaned_at = is_cleaned ? new Date().toISOString() : null;
  }

  if (fulfilled_upsells !== undefined) {
    payload.fulfilled_upsells = fulfilled_upsells;
  }

  if (checklist !== undefined) {
    payload.checklist = checklist;
  }

  if (photos !== undefined) {
    payload.photos = photos;
  }

  if (is_skipped !== undefined) {
    payload.is_skipped = is_skipped;
  }

  if (notes !== undefined) {
    payload.notes = notes;
  }

  const { data: status, error } = await supabase
    .from("cleaning_status")
    .upsert(payload, { onConflict: "registration_id" })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ status });
}
