import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getBookingById } from "@/lib/lodgify/client";
import { signGuestToken } from "@/lib/guest-token";

export async function POST(request: Request) {
  let body: {
    email?: string;
    phone?: string;
    full_name?: string;
    last_name?: string;
    check_in_date?: string;
    confirmation_code?: string;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { email, phone, full_name, last_name, check_in_date, confirmation_code } = body;

  const supabase = createAdminClient();

  const registrationSelect = `
    id,
    check_in_date,
    check_out_date,
    num_guests,
    notes,
    status,
    signature_url,
    booking_source,
    lodgify_booking_id,
    guest:guest_id (
      id,
      full_name
    ),
    property:property_id (
      id,
      name,
      slug,
      address,
      description,
      cover_image_url,
      timezone,
      lodgify_property_id,
      hoa_type
    )
  `;

  let reg: Record<string, unknown> | null = null;
  let guestName: string | null = null;

  if (confirmation_code) {
    // --- Confirmation code lookup ---
    // Accept either the OTA confirmation code printed on the channel booking
    // (Airbnb/VRBO, e.g. "HMZBYF2B2N") or the numeric Lodgify booking id.
    const code = confirmation_code.trim();
    // Strip anything outside [A-Za-z0-9-] so no LIKE wildcards (% _ *) can leak
    // into the query; real OTA codes are alphanumeric.
    const sanitized = code.replace(/[^A-Za-z0-9-]/g, "");

    // 1) Case-insensitive exact match on the OTA confirmation code.
    //    Order by check-in desc so the tie-break is deterministic: OTA codes are
    //    globally unique per reservation, so >1 match only happens on a rare
    //    duplicate of the same stay — pick the most recent rather than an
    //    arbitrary row (which could mint a token for the wrong reservation).
    let registrations = sanitized
      ? (
          await supabase
            .from("registration")
            .select(registrationSelect)
            .ilike("ota_confirmation_code", sanitized)
            .in("status", ["active", "completed"])
            .order("check_in_date", { ascending: false })
        ).data
      : null;

    // 2) Fall back to the numeric Lodgify booking id.
    if (!registrations || registrations.length === 0) {
      const codeNum = parseInt(code, 10);
      if (!isNaN(codeNum) && String(codeNum) === sanitized) {
        registrations = (
          await supabase
            .from("registration")
            .select(registrationSelect)
            .eq("lodgify_booking_id", codeNum)
            .in("status", ["active", "completed"])
            .order("check_in_date", { ascending: false })
        ).data;
      }
    }

    if (!registrations || registrations.length === 0) {
      return NextResponse.json(
        { error: "No reservation found for that confirmation code." },
        { status: 404 }
      );
    }

    reg = registrations[0];
    const guest = reg.guest as { id: string; full_name: string } | null;
    guestName = guest?.full_name ?? null;
  } else {
    // --- Standard lookup by name/email/phone + check-in date ---
    if (!check_in_date) {
      return NextResponse.json(
        { error: "check_in_date is required" },
        { status: 400 }
      );
    }

    if (!last_name) {
      return NextResponse.json(
        { error: "Last name is required" },
        { status: 400 }
      );
    }

    if (!full_name && !email && !phone) {
      return NextResponse.json(
        { error: "At least one of name, email, or phone is required" },
        { status: 400 }
      );
    }

    // Find candidate guests by each provided identifier with individually
    // selective queries. A single OR over every name word used to turn a
    // one-letter word (Airbnb stores guests as "First L") into ilike '%l%',
    // match over 1000 rows, and get truncated at PostgREST's row cap — the
    // real guest never reached the last-name check below.
    const lastNameClean = last_name.trim().replace(/\.$/, "").replace(/[%_]/g, "");
    const patterns = new Set<string>();
    if (full_name) {
      const firstWord = full_name.trim().split(/\s+/)[0]?.replace(/[%_]/g, "");
      if (firstWord && firstWord.toLowerCase() !== lastNameClean.toLowerCase()) {
        patterns.add(`${firstWord}%`);
      }
    }
    if (lastNameClean) {
      patterns.add(`%${lastNameClean}`);
      patterns.add(`% ${lastNameClean[0]}`);
    }

    const guestSelects: PromiseLike<{
      data: { id: string; full_name: string | null }[] | null;
    }>[] = [...patterns].map((p) =>
      supabase.from("guest").select("id, full_name").ilike("full_name", p).limit(500)
    );
    if (email) {
      guestSelects.push(
        supabase.from("guest").select("id, full_name").ilike("email", email).limit(500)
      );
    }
    if (phone) {
      const phoneDigits = phone.replace(/\D/g, "");
      const variants = [...new Set([phoneDigits, phoneDigits.replace(/^1/, ""), `1${phoneDigits}`])];
      guestSelects.push(
        supabase.from("guest").select("id, full_name").in("phone", variants).limit(500)
      );
    }

    const guestResults = await Promise.all(guestSelects);
    const candidates = new Map<string, { id: string; full_name: string | null }>();
    for (const { data } of guestResults) {
      for (const g of data ?? []) candidates.set(g.id, g);
    }

    if (candidates.size === 0) {
      return NextResponse.json(
        { error: "No reservation found. Please check your details and try again." },
        { status: 404 }
      );
    }

    // Validate last name against guest records. Airbnb truncates names to a
    // last initial ("Sean H"), so a single letter on either side matches any
    // last name starting with it.
    const lastNameLower = lastNameClean.toLowerCase();
    const matchedGuests = [...candidates.values()].filter((g) => {
      const storedLast = (g.full_name || "")
        .trim()
        .replace(/\.$/, "")
        .split(/\s+/)
        .pop()
        ?.toLowerCase();
      if (!storedLast || !lastNameLower) return false;
      if (storedLast === lastNameLower) return true;
      if (storedLast.length === 1 && lastNameLower.startsWith(storedLast)) return true;
      if (lastNameLower.length === 1 && storedLast.startsWith(lastNameLower)) return true;
      return false;
    });

    if (matchedGuests.length === 0) {
      return NextResponse.json(
        { error: "Last name does not match the reservation. Please check and try again." },
        { status: 404 }
      );
    }

    const guestIds = matchedGuests.map((g) => g.id);

    const { data: registrations, error: regError } = await supabase
      .from("registration")
      .select(registrationSelect)
      .in("guest_id", guestIds)
      .eq("check_in_date", check_in_date)
      .in("status", ["active", "completed"]);

    if (regError || !registrations || registrations.length === 0) {
      return NextResponse.json(
        { error: "No reservation found. Please check your details and try again." },
        { status: 404 }
      );
    }

    reg = registrations[0];
    const guest = reg.guest as { id: string; full_name: string } | null;
    guestName = guest?.full_name ?? null;
  }

  // Remove guest join from response (not needed downstream)
  const { guest: _guest, ...regWithoutGuest } = reg;

  // Enrich with Lodgify booking details (check-in/out times, guest breakdown, etc.)
  let lodgifyDetails = null;
  const lodgifyBookingId = reg.lodgify_booking_id as number | null;
  if (lodgifyBookingId) {
    try {
      const booking = await getBookingById(lodgifyBookingId);
      const rawBooking = booking as unknown as Record<string, unknown>;
      const rooms = rawBooking.rooms as Array<{
        guest_breakdown?: { adults: number; children: number; infants: number; pets: number };
        people?: number;
      }> | undefined;

      lodgifyDetails = {
        check_in_time: (rawBooking.check_in as { time?: string })?.time || null,
        check_out_time: (rawBooking.check_out as { time?: string })?.time || null,
        total_amount: rawBooking.total_amount as number | null,
        currency_code: rawBooking.currency_code as string | null,
        source: rawBooking.source as string | null,
        guest_breakdown: rooms?.[0]?.guest_breakdown || null,
      };
    } catch {
      // Non-critical — just skip enrichment
    }
  }

  // Fetch Lodgify property image
  const prop = reg.property as unknown as Record<string, unknown>;
  let propertyImageUrl = prop?.cover_image_url as string | null;
  const lodgifyPropertyId = prop?.lodgify_property_id;
  if (!propertyImageUrl && lodgifyPropertyId) {
    try {
      const propRes = await fetch(`https://api.lodgify.com/v2/properties/${lodgifyPropertyId}`, {
        headers: {
          "X-ApiKey": process.env.LODGIFY_API_KEY!,
          Accept: "application/json",
        },
      });
      if (propRes.ok) {
        const propData = await propRes.json();
        const rawUrl = propData.image_url as string | null;
        propertyImageUrl = rawUrl?.startsWith("//") ? `https:${rawUrl}` : rawUrl;
      }
    } catch {
      // Non-critical
    }
  }

  const regId = reg.id as string;

  return NextResponse.json({
    guest_name: guestName,
    guest_token: signGuestToken(regId),
    reservation: {
      ...regWithoutGuest,
      property: {
        ...prop,
        cover_image_url: propertyImageUrl,
      },
      lodgify: lodgifyDetails,
    },
  });
}
