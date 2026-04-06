import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { MapPin, Globe, ExternalLink } from "lucide-react";

const categoryLabels: Record<string, string> = {
  restaurant: "Restaurants",
  attraction: "Attractions",
  activity: "Activities",
  shopping: "Shopping",
  other: "Other",
};

export default async function RecommendationsPage({
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

  const { data: recommendations } = await supabase
    .from("recommendation")
    .select("*")
    .eq("property_id", property.id)
    .order("sort_order");

  // Group by category
  const categories = new Map<string, NonNullable<typeof recommendations>>();
  recommendations?.forEach((rec) => {
    if (!categories.has(rec.category)) categories.set(rec.category, []);
    categories.get(rec.category)!.push(rec);
  });

  const categoryKeys = Array.from(categories.keys());

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">
          Local Recommendations
        </h2>
        <p className="text-muted-foreground">
          Our favorite spots and things to do nearby
        </p>
      </div>

      {categoryKeys.length > 0 ? (
        <Tabs defaultValue={categoryKeys[0]} className="w-full">
          <TabsList className="w-full flex overflow-x-auto">
            {categoryKeys.map((cat) => (
              <TabsTrigger key={cat} value={cat} className="flex-1">
                {categoryLabels[cat] || cat}
              </TabsTrigger>
            ))}
          </TabsList>

          {categoryKeys.map((cat) => (
            <TabsContent key={cat} value={cat} className="space-y-4 mt-4">
              {categories.get(cat)?.map((rec) => (
                <Card key={rec.id}>
                  <CardHeader>
                    <CardTitle className="text-lg">{rec.name}</CardTitle>
                    {rec.description && (
                      <p className="text-muted-foreground text-sm">
                        {rec.description}
                      </p>
                    )}
                  </CardHeader>
                  <CardContent className="flex flex-wrap gap-2">
                    {rec.address && (
                      <Badge variant="outline" className="gap-1">
                        <MapPin className="h-3 w-3" />
                        {rec.address}
                      </Badge>
                    )}
                    {rec.website_url && (
                      <a
                        href={rec.website_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge
                          variant="outline"
                          className="gap-1 cursor-pointer hover:bg-accent"
                        >
                          <Globe className="h-3 w-3" />
                          Website
                        </Badge>
                      </a>
                    )}
                    {rec.map_url && (
                      <a
                        href={rec.map_url}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Badge
                          variant="outline"
                          className="gap-1 cursor-pointer hover:bg-accent"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Directions
                        </Badge>
                      </a>
                    )}
                    {rec.rating && (
                      <Badge variant="secondary">
                        {rec.rating} / 5
                      </Badge>
                    )}
                  </CardContent>
                </Card>
              ))}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <p className="text-muted-foreground">
          No recommendations available yet.
        </p>
      )}
    </div>
  );
}
