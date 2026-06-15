import { createAdminClient } from "@/lib/supabase/admin";
import type { SegmentFilter } from "@/types/database";

export type SegmentMember = {
  guest_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  last_registration_id: string;
  last_property_id: string;
  last_property_name: string;
  last_property_address: string | null;
  last_check_in: string;
  last_check_out: string;
  stay_count: number;
};

type RawRegistration = {
  id: string;
  property_id: string;
  guest_id: string;
  check_in_date: string;
  check_out_date: string;
  status: string;
  guest: { id: string; full_name: string; email: string | null; phone: string | null } | null;
  property: { id: string; name: string; nickname: string | null; address: string | null; host_id: string } | null;
};

/**
 * Evaluate a segment filter against all completed registrations for a host.
 * Returns one row per matching guest, with their LAST stay metadata + total stay count.
 */
export async function evaluateSegment(
  hostId: string,
  filter: SegmentFilter
): Promise<SegmentMember[]> {
  const supabase = createAdminClient();

  let query = supabase
    .from("registration")
    .select(
      "id, property_id, guest_id, check_in_date, check_out_date, status, " +
        "guest:guest_id(id, full_name, email, phone), " +
        "property:property_id(id, name, nickname, address, host_id)"
    )
    .in("status", ["active", "completed"])
    .order("check_out_date", { ascending: false });

  if (filter.last_stay_older_than_days != null) {
    // Lapsed-guest window is judged on the guest's MOST RECENT stay, so it must see
    // all registrations and filter after the per-guest collapse below.
  } else if (filter.stayed_within_days != null) {
    // Rolling window resolved at evaluation time, so the segment stays current on its own.
    const from = new Date();
    from.setUTCDate(from.getUTCDate() - filter.stayed_within_days);
    query = query.gte("check_out_date", from.toISOString().slice(0, 10));
  } else {
    if (filter.stayed_from) query = query.gte("check_out_date", filter.stayed_from);
    if (filter.stayed_until) query = query.lte("check_out_date", filter.stayed_until);
  }
  if (filter.property_ids && filter.property_ids.length > 0) {
    query = query.in("property_id", filter.property_ids);
  }

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []) as unknown as RawRegistration[];

  // Scope to this host's properties + collapse to one row per guest with stay_count.
  const byGuest = new Map<string, { last: RawRegistration; count: number }>();
  for (const r of rows) {
    const prop = Array.isArray(r.property) ? r.property[0] : r.property;
    if (!prop || prop.host_id !== hostId) continue;
    const guest = Array.isArray(r.guest) ? r.guest[0] : r.guest;
    if (!guest) continue;

    const existing = byGuest.get(r.guest_id);
    if (!existing) {
      byGuest.set(r.guest_id, { last: r, count: 1 });
    } else {
      // Rows are pre-sorted by check_out_date desc, so the first one we saw is the latest.
      existing.count += 1;
    }
  }

  let lapsedCutoff: string | null = null;
  if (filter.last_stay_older_than_days != null) {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - filter.last_stay_older_than_days);
    lapsedCutoff = cutoff.toISOString().slice(0, 10);
  }

  const members: SegmentMember[] = [];
  for (const { last, count } of byGuest.values()) {
    if (filter.min_stays != null && count < filter.min_stays) continue;
    if (filter.max_stays != null && count > filter.max_stays) continue;
    if (lapsedCutoff && last.check_out_date > lapsedCutoff) continue;

    const prop = Array.isArray(last.property) ? last.property[0] : last.property;
    const guest = Array.isArray(last.guest) ? last.guest[0] : last.guest;
    if (!prop || !guest) continue;

    members.push({
      guest_id: guest.id,
      full_name: guest.full_name,
      email: guest.email,
      phone: guest.phone,
      last_registration_id: last.id,
      last_property_id: prop.id,
      last_property_name: prop.nickname || prop.name,
      last_property_address: prop.address,
      last_check_in: last.check_in_date,
      last_check_out: last.check_out_date,
      stay_count: count,
    });
  }

  return members;
}

export async function previewSegment(
  hostId: string,
  filter: SegmentFilter,
  sampleSize = 5
): Promise<{ total: number; reachable_email: number; reachable_sms: number; sample: SegmentMember[] }> {
  const members = await evaluateSegment(hostId, filter);
  return {
    total: members.length,
    reachable_email: members.filter((m) => !!m.email).length,
    reachable_sms: members.filter((m) => !!m.phone).length,
    sample: members.slice(0, sampleSize),
  };
}
