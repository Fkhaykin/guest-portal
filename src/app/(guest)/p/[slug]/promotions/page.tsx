import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PromotionCards } from "./promotion-cards";

export default async function PromotionsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) notFound();

  const { data: promotions } = await supabase
    .from("promotion")
    .select("*")
    .eq("property_id", property.id)
    .eq("is_active", true)
    .order("sort_order");

  // Filter out expired promotions
  const now = new Date();
  const activePromos =
    promotions?.filter((p) => {
      if (p.valid_until && new Date(p.valid_until) < now) return false;
      return true;
    }) ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Exclusive Guest Deals
        </h2>
        <p className="text-muted-foreground">
          Special offers just for you — save on your current and future stays
        </p>
      </div>

      {activePromos.length > 0 ? (
        <PromotionCards promotions={activePromos} />
      ) : (
        <p className="text-muted-foreground">
          No promotions available right now.
        </p>
      )}
    </div>
  );
}
