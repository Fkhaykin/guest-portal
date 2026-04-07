import { createAdminClient } from "@/lib/supabase/admin";
import twilio from "twilio";

const client = process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
  ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
  : null;

const FROM_NUMBER = process.env.TWILIO_FROM_NUMBER;

/**
 * Notify all active cleaners assigned to a property about a new booking.
 * Silently no-ops if Twilio is not configured or cleaners have no phone.
 */
export async function notifyCleanersOfNewBooking(params: {
  propertyId: string;
  guestName: string;
  checkIn: string;
  checkOut: string;
  numGuests: number;
  propertyName?: string;
}) {
  if (!client || !FROM_NUMBER) {
    console.log("[sms] Twilio not configured, skipping cleaner notification");
    return;
  }

  const supabase = createAdminClient();

  // Find active cleaners assigned to this property who have a phone number
  const { data: assignments } = await supabase
    .from("cleaner_property")
    .select("cleaner_id")
    .eq("property_id", params.propertyId);

  if (!assignments?.length) return;

  const cleanerIds = assignments.map((a) => a.cleaner_id);

  const { data: cleaners } = await supabase
    .from("cleaner")
    .select("id, name, phone")
    .in("id", cleanerIds)
    .eq("is_active", true)
    .not("phone", "is", null);

  if (!cleaners?.length) return;

  // Get property name if not provided
  let propertyName = params.propertyName;
  if (!propertyName) {
    const { data: property } = await supabase
      .from("property")
      .select("name, nickname")
      .eq("id", params.propertyId)
      .single();
    propertyName = property?.nickname || property?.name || "a property";
  }

  const checkIn = new Date(params.checkIn).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
  const checkOut = new Date(params.checkOut).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });

  const message =
    `New booking at ${propertyName}: ${params.guestName}, ` +
    `${checkIn} – ${checkOut}, ${params.numGuests} guest${params.numGuests === 1 ? "" : "s"}.`;

  const results = await Promise.allSettled(
    cleaners.map((cleaner) =>
      client.messages.create({
        to: cleaner.phone!,
        from: FROM_NUMBER,
        body: message,
      })
    )
  );

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "rejected") {
      console.error(
        `[sms] Failed to notify cleaner ${cleaners[i].name}:`,
        result.reason
      );
    }
  }
}
