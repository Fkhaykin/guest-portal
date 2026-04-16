import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PromotionCards } from "./promotion-cards";
import { Playfair_Display } from "next/font/google";

const playfair = Playfair_Display({
  subsets: ["latin"],
  variable: "--font-playfair",
});

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
    .single();

  if (!property) notFound();

  const { data: promotions } = await supabase
    .from("promotion")
    .select("*")
    .eq("property_id", property.id)
    .eq("is_active", true)
    .order("sort_order");

  const now = new Date();
  const activePromos =
    promotions?.filter((p) => {
      if (p.valid_until && new Date(p.valid_until) < now) return false;
      return true;
    }) ?? [];

  return (
    <div className={`${playfair.variable}`}>
      {/* Editorial header */}
      <div className="mb-10 text-center">
        <p className="text-xs font-medium uppercase tracking-[0.3em] text-muted-foreground">
          Summit Lakeside
        </p>
        <h2
          className="mt-3 text-4xl font-normal italic tracking-tight sm:text-5xl"
          style={{ fontFamily: "var(--font-playfair), serif" }}
        >
          Guest Exclusives
        </h2>
        <div className="mx-auto mt-4 h-px w-16 bg-foreground/20" />
        <p className="mt-4 text-sm text-muted-foreground">
          Book direct. Save more. These offers are reserved for our guests only.
        </p>
      </div>

      {activePromos.length > 0 ? (
        <PromotionCards promotions={activePromos} />
      ) : (
        <p className="text-center text-muted-foreground">
          No promotions available right now.
        </p>
      )}
    </div>
  );
}
