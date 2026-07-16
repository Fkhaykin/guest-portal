// Landing-page prefetch for Deliveries (`/admin/deliveries`).
//
// The page is fully client-rendered and fetches two INDEPENDENT datasets on
// mount — the active property roster and the recent delivery/rideshare history.
// This module runs both in ONE Promise.all so a sidebar hover can warm the
// whole page (both datasets) before the click.
//
// Mirrors src/lib/reservations/prefetch.ts. Keyed as a zero-arg singleton via
// createPrefetcher. The page's post-submit history refresh passes
// { force: true } to bypass and refresh the cache (see page for how it keeps
// the two independent loading flags intact).

import { createClient } from "@/lib/supabase/client";
import { createPrefetcher } from "@/lib/prefetch-cache";

export type Property = {
  id: string;
  name: string;
  nickname: string | null;
};

export type SentDelivery = {
  id: string;
  created_at: string;
  category: "rideshare" | "food_grocery" | "other";
  provider: string | null;
  arrival_date: string;
  email_subject: string | null;
  email_body: string | null;
  email_recipients: string[] | null;
  property: { name: string; nickname: string | null } | null;
};

// Both queries are independent, so run them together. Exact select/eq/order/
// limit mirror the page's original load() + loadHistory().
export async function fetchDeliveries(): Promise<{
  properties: Property[];
  history: SentDelivery[];
}> {
  const supabase = createClient();
  const [propertiesRes, historyRes] = await Promise.all([
    supabase
      .from("property")
      .select("id, name, nickname")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase
      .from("delivery_rideshare")
      .select(
        "id, created_at, category, provider, arrival_date, email_subject, email_body, email_recipients, property:property_id(name, nickname)"
      )
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  if (historyRes.error) console.error("loadHistory error:", historyRes.error);
  return {
    properties: (propertiesRes.data as Property[] | null) ?? [],
    history: (historyRes.data as unknown as SentDelivery[] | null) ?? [],
  };
}

export const deliveriesNav = createPrefetcher(() => "deliveries", fetchDeliveries);

export const prefetchDeliveries = () => deliveriesNav.prefetch();
