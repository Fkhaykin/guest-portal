import { getBookingById } from "@/lib/lodgify/client";
import { signGuestToken } from "@/lib/guest-token";

/** Registration select that produces a reservation payload identical to
 *  /api/guest/lookup's — the shape saveSession()/register/update expect.
 *  `booking_source` must stay: the register page's Airbnb skip-ID branch
 *  reads it. */
export const registrationSessionSelect = `
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

export interface GuestSessionPayload {
  guest_name: string | null;
  guest_token: string;
  reservation: Record<string, unknown>;
}

/** Build the `{ guest_name, guest_token, reservation }` payload the guest
 *  portal seeds into sessionStorage — mirrors /api/guest/lookup's response
 *  (Lodgify enrichment, cover-image fallback, signed token). `reg` must be a
 *  row fetched with `registrationSessionSelect`. */
export async function buildGuestSessionPayload(
  reg: Record<string, unknown>
): Promise<GuestSessionPayload> {
  const guest = reg.guest as { id: string; full_name: string } | null;
  const { guest: _guest, ...regWithoutGuest } = reg;
  void _guest;

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

  return {
    guest_name: guest?.full_name ?? null,
    guest_token: signGuestToken(reg.id as string),
    reservation: {
      ...regWithoutGuest,
      property: {
        ...prop,
        cover_image_url: propertyImageUrl,
      },
      lodgify: lodgifyDetails,
    },
  };
}
