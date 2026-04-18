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
    damage_report?: { description: string; photos: string[] };
    pet_report?: { description: string; count: number; labels: string[]; expected_pet_count: number };
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { registration_id, is_cleaned, is_skipped, fulfilled_upsells, checklist, photos, notes, damage_report, pet_report } = body;
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
    .select("id, property_id, check_in_date, check_out_date, lodgify_booking_id, guest:guest_id(full_name)")
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

  // Create aircover claims if damage or pet discrepancy reported
  const claimsToCreate: Record<string, unknown>[] = [];

  if (damage_report && damage_report.description) {
    claimsToCreate.push({
      registration_id,
      property_id: reg.property_id,
      cleaner_id: cleaner.id,
      claim_type: "damage",
      damage_description: damage_report.description,
      damage_photos: damage_report.photos || [],
    });
  }

  if (pet_report && pet_report.count > 0) {
    const expectedPets = pet_report.expected_pet_count ?? 0;
    const reportedPets = pet_report.count;
    // Create a claim if there's a discrepancy OR if pets were found at all
    // (useful for tracking even when counts match)
    if (reportedPets !== expectedPets || reportedPets > 0) {
      claimsToCreate.push({
        registration_id,
        property_id: reg.property_id,
        cleaner_id: cleaner.id,
        claim_type: "pet_discrepancy",
        pet_description: pet_report.description || null,
        reported_pet_count: reportedPets,
        reported_pet_labels: pet_report.labels || [],
        expected_pet_count: expectedPets,
      });
    }
  }

  if (claimsToCreate.length > 0) {
    const { data: createdClaims } = await supabase
      .from("aircover_claim")
      .insert(claimsToCreate)
      .select("id, claim_type");

    // Send email notification for each new claim
    if (createdClaims && createdClaims.length > 0) {
      try {
        const { data: property } = await supabase
          .from("property")
          .select("name, host_id, slug, listing_urls")
          .eq("id", reg.property_id)
          .single();

        if (property) {
          const { data: host } = await supabase
            .from("host")
            .select("email, full_name")
            .eq("id", property.host_id)
            .single();

          if (host?.email) {
            const { sendAircoverClaimEmail } = await import("@/lib/email/send-aircover-claim");
            const guestName = (reg.guest as unknown as { full_name: string })?.full_name ?? "Unknown Guest";
            const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://guest.summitlakeside.com";
            const portalBookingUrl = `${appUrl}/p/${property.slug}/register`;
            const airbnbUrl = (property.listing_urls as Record<string, string>)?.airbnb || null;

            for (const claim of createdClaims) {
              await sendAircoverClaimEmail({
                to: host.email,
                hostName: host.full_name,
                propertyName: property.name,
                claimType: claim.claim_type,
                claimId: claim.id,
                guestName,
                checkInDate: reg.check_in_date,
                checkOutDate: reg.check_out_date,
                portalBookingUrl,
                airbnbUrl,
              }).catch((err) => {
                console.error("Failed to send aircover claim email:", err);
              });
            }
          }
        }
      } catch (emailErr) {
        console.error("Aircover claim email error:", emailErr);
      }
    }
  }

  return NextResponse.json({ status });
}
