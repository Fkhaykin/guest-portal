import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tag } from "lucide-react";

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
  const activePromos = promotions?.filter((p) => {
    if (p.valid_until && new Date(p.valid_until) < now) return false;
    return true;
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">Promotions</h2>
        <p className="text-muted-foreground">
          Special deals and offers for our guests
        </p>
      </div>

      {activePromos && activePromos.length > 0 ? (
        <div className="grid gap-4">
          {activePromos.map((promo) => (
            <Card key={promo.id}>
              <CardHeader>
                <div className="flex items-start gap-3">
                  <Tag className="h-5 w-5 text-primary mt-0.5" />
                  <div>
                    <CardTitle className="text-lg">{promo.title}</CardTitle>
                    {promo.description && (
                      <p className="text-muted-foreground mt-1">
                        {promo.description}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              {(promo.promo_code || promo.valid_until) && (
                <CardContent className="flex gap-2 flex-wrap">
                  {promo.promo_code && (
                    <Badge variant="secondary" className="text-sm">
                      Code: {promo.promo_code}
                    </Badge>
                  )}
                  {promo.valid_until && (
                    <Badge variant="outline" className="text-sm">
                      Valid until{" "}
                      {new Date(promo.valid_until).toLocaleDateString()}
                    </Badge>
                  )}
                </CardContent>
              )}
            </Card>
          ))}
        </div>
      ) : (
        <p className="text-muted-foreground">No promotions available right now.</p>
      )}
    </div>
  );
}
