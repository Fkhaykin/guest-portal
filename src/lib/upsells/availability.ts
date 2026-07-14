import type { SupabaseClient } from "@supabase/supabase-js";

// Cross-property turnaround availability for the timing upsells (early
// check-in / late check-out), shared by the guest upsell list and the
// automated late-checkout offer. A "same-day turnaround" on date D for
// property P means at least one registration checks out on D AND at least
// one checks in on D for that property. Turnarounds are counted across ALL
// of the host's properties (cleaning-crew capacity, not per-house):
//
//   0-1 turnarounds: freely available
//   2 turnarounds:   max 1 early check-in + 1 late check-out fleet-wide
//   3+ turnarounds:  request-only (no instant purchase)

export type TimingAvailability = {
  available: boolean;
  requestOnly: boolean;
  reason: string | null;
};

async function countTurnaroundsOnDate(
  supabase: SupabaseClient,
  propertyIds: string[],
  date: string
): Promise<number> {
  const { data: checkouts } = await supabase
    .from("registration")
    .select("property_id")
    .in("property_id", propertyIds)
    .eq("check_out_date", date)
    .in("status", ["active", "completed"]);

  const { data: checkins } = await supabase
    .from("registration")
    .select("property_id")
    .in("property_id", propertyIds)
    .eq("check_in_date", date)
    .in("status", ["active", "completed"]);

  const checkoutProps = new Set((checkouts || []).map((r) => r.property_id));
  const checkinProps = new Set((checkins || []).map((r) => r.property_id));

  let count = 0;
  for (const pid of checkoutProps) {
    if (checkinProps.has(pid)) count++;
  }
  return count;
}

async function countPaidUpsellOnDate(
  supabase: SupabaseClient,
  propertyIds: string[],
  excludeRegistrationId: string,
  date: string,
  upsellType: "early_checkin" | "late_checkout",
  dateField: "check_in_date" | "check_out_date"
): Promise<number> {
  const { data: regs } = await supabase
    .from("registration")
    .select("id, upsells")
    .in("property_id", propertyIds)
    .eq(dateField, date)
    .neq("id", excludeRegistrationId)
    .in("status", ["active", "completed"]);

  return (regs || []).filter((r) => {
    const upsells = (r.upsells as Array<{ type: string; status: string }>) || [];
    return upsells.some((u) => u.type === upsellType && u.status === "paid");
  }).length;
}

type AvailabilityParams = {
  propertyIds: string[];
  excludeRegistrationId: string;
};

export async function earlyCheckinAvailability(
  supabase: SupabaseClient,
  { propertyIds, excludeRegistrationId }: AvailabilityParams,
  checkInDate: string
): Promise<TimingAvailability> {
  const turnarounds = await countTurnaroundsOnDate(supabase, propertyIds, checkInDate);

  if (turnarounds >= 3) {
    return {
      available: false,
      requestOnly: true,
      reason:
        "High turnover day — early check-in is subject to availability. Submit a request and we'll let you know on the day of check-in.",
    };
  }
  if (turnarounds === 2) {
    const paidCount = await countPaidUpsellOnDate(
      supabase, propertyIds, excludeRegistrationId, checkInDate, "early_checkin", "check_in_date"
    );
    if (paidCount >= 1) {
      return {
        available: false,
        requestOnly: false,
        reason: "Not available — the early check-in slot for this day has been taken",
      };
    }
  }
  return { available: true, requestOnly: false, reason: null };
}

export async function lateCheckoutAvailability(
  supabase: SupabaseClient,
  { propertyIds, excludeRegistrationId }: AvailabilityParams,
  checkOutDate: string
): Promise<TimingAvailability> {
  const turnarounds = await countTurnaroundsOnDate(supabase, propertyIds, checkOutDate);

  if (turnarounds >= 3) {
    return {
      available: false,
      requestOnly: true,
      reason:
        "High turnover day — late check-out is subject to availability. Submit a request and we'll let you know on the day of check-out.",
    };
  }
  if (turnarounds === 2) {
    const paidCount = await countPaidUpsellOnDate(
      supabase, propertyIds, excludeRegistrationId, checkOutDate, "late_checkout", "check_out_date"
    );
    if (paidCount >= 1) {
      return {
        available: false,
        requestOnly: false,
        reason: "Not available — the late check-out slot for this day has been taken",
      };
    }
  }
  return { available: true, requestOnly: false, reason: null };
}

/** All property ids for a host — the fleet the turnaround caps apply to. */
export async function hostPropertyIds(
  supabase: SupabaseClient,
  hostId: string
): Promise<string[]> {
  const { data } = await supabase.from("property").select("id").eq("host_id", hostId);
  return (data || []).map((p) => p.id);
}
