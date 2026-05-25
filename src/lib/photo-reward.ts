import type { SupabaseClient } from "@supabase/supabase-js";

export const PHOTO_REWARD_THRESHOLD = 3;

export type RewardEligibility =
  | { eligible: true }
  | { eligible: false; reason: string };

export async function checkPhotoRewardEligibility(
  supabase: SupabaseClient,
  registrationId: string
): Promise<RewardEligibility> {
  const { data: reg } = await supabase
    .from("registration")
    .select("id, check_out_date, property_id, property:property_id(host_id, timezone)")
    .eq("id", registrationId)
    .single();

  if (!reg) return { eligible: false, reason: "Registration not found." };

  const property = reg.property as unknown as { host_id: string; timezone: string | null } | null;
  if (!property) return { eligible: false, reason: "Property not found." };

  const tz = property.timezone || "America/New_York";

  // Checkout is at 11:00 AM property-local. Block if less than 24h away.
  const checkoutMs = localTimestamp(reg.check_out_date as string, "11:00:00", tz);
  if (checkoutMs - Date.now() < 24 * 60 * 60 * 1000) {
    return {
      eligible: false,
      reason: "The free 12:00 PM check-out can only be earned more than 24 hours before check-out.",
    };
  }

  // Block if any other reservation across the host's properties has a paid late_checkout
  // or early_checkin on the same date (cleaner-capacity conflict). Photo-reward late
  // checkouts also count because they're stored as status="paid".
  const { data: hostProperties } = await supabase
    .from("property")
    .select("id")
    .eq("host_id", property.host_id);

  const propertyIds = (hostProperties || []).map((p) => p.id);
  const date = reg.check_out_date as string;

  const [{ data: sameDayCheckouts }, { data: sameDayCheckins }] = await Promise.all([
    supabase
      .from("registration")
      .select("id, property_id, upsells")
      .in("property_id", propertyIds)
      .eq("check_out_date", date)
      .in("status", ["active", "completed"]),
    supabase
      .from("registration")
      .select("id, property_id, upsells")
      .in("property_id", propertyIds)
      .eq("check_in_date", date)
      .in("status", ["active", "completed"]),
  ]);

  // A same-day turnaround at any host property on the check-out date blocks the reward.
  const checkoutPropIds = new Set((sameDayCheckouts || []).map((r) => r.property_id));
  const checkinPropIds = new Set((sameDayCheckins || []).map((r) => r.property_id));
  const hasTurnaround = [...checkoutPropIds].some((pid) => checkinPropIds.has(pid));
  if (hasTurnaround) {
    return {
      eligible: false,
      reason: "There's a same-day turnaround on your check-out day — the free reward isn't available.",
    };
  }

  const otherCheckouts = (sameDayCheckouts || []).filter((r) => r.id !== registrationId);
  const otherCheckins = (sameDayCheckins || []).filter((r) => r.id !== registrationId);

  const hasOtherLateCheckout = otherCheckouts.some((r) => {
    const upsells = (r.upsells as Array<{ type: string; status: string }>) || [];
    return upsells.some((u) => u.type === "late_checkout" && u.status === "paid");
  });
  if (hasOtherLateCheckout) {
    return {
      eligible: false,
      reason: "Another guest already has a late check-out on your check-out day — the free reward isn't available.",
    };
  }

  const hasOtherEarlyCheckin = otherCheckins.some((r) => {
    const upsells = (r.upsells as Array<{ type: string; status: string }>) || [];
    return upsells.some((u) => u.type === "early_checkin" && u.status === "paid");
  });
  if (hasOtherEarlyCheckin) {
    return {
      eligible: false,
      reason: "Another guest already has an early check-in on your check-out day — the free reward isn't available.",
    };
  }

  return { eligible: true };
}

function localTimestamp(dateStr: string, time: string, tz: string): number {
  const naive = new Date(`${dateStr}T${time}Z`).getTime();
  const offsetMinutes = getTzOffsetMinutes(new Date(naive), tz);
  return naive - offsetMinutes * 60_000;
}

function getTzOffsetMinutes(date: Date, tz: string): number {
  const dtf = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    hour12: false,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const parts = dtf.formatToParts(date);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value || "0");
  let hour = get("hour");
  if (hour === 24) hour = 0;
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), hour, get("minute"), get("second"));
  return (asUtc - date.getTime()) / 60000;
}
