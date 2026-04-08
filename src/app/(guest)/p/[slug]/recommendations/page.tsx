import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Globe,
  ExternalLink,
  Star,
  UtensilsCrossed,
  Compass,
  CalendarDays,
} from "lucide-react";

type Recommendation = {
  id: string;
  name: string;
  category: string;
  description: string | null;
  address: string | null;
  website_url: string | null;
  map_url: string | null;
  image_url: string | null;
  rating: number | null;
  sort_order: number;
};

const guideTabs = [
  {
    key: "food",
    label: "Food & Drink",
    icon: UtensilsCrossed,
    categories: ["restaurant", "shopping"],
    emptyMessage: "No food & drink recommendations yet.",
  },
  {
    key: "activities",
    label: "Activities",
    icon: Compass,
    categories: ["activity", "attraction"],
    emptyMessage: "No activity recommendations yet.",
  },
  {
    key: "events",
    label: "Events",
    icon: CalendarDays,
    categories: ["other"],
    emptyMessage: "No event recommendations yet.",
  },
];

function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/30"
          }`}
        />
      ))}
    </div>
  );
}

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-md">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1 min-w-0">
            <h3 className="font-semibold text-base leading-tight">
              {rec.name}
            </h3>
            {rec.address && (
              <p className="text-muted-foreground text-xs flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                <span className="truncate">{rec.address}</span>
              </p>
            )}
          </div>
          {rec.rating && <RatingStars rating={rec.rating} />}
        </div>

        {rec.description && (
          <p className="text-sm text-muted-foreground leading-relaxed">
            {rec.description}
          </p>
        )}

        {(rec.website_url || rec.map_url) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {rec.website_url && (
              <a
                href={rec.website_url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Badge
                  variant="outline"
                  className="gap-1.5 cursor-pointer hover:bg-accent transition-colors text-xs"
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
                  className="gap-1.5 cursor-pointer hover:bg-accent transition-colors text-xs"
                >
                  <ExternalLink className="h-3 w-3" />
                  Get Directions
                </Badge>
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default async function RecommendationsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: property } = await supabase
    .from("property")
    .select("id, name")
    .eq("slug", slug)
    .eq("is_active", true)
    .single();

  if (!property) notFound();

  const { data: recommendations } = await supabase
    .from("recommendation")
    .select("*")
    .eq("property_id", property.id)
    .order("sort_order");

  // Group recommendations into guide tabs by mapping DB categories
  const grouped: Record<string, Recommendation[]> = {};
  for (const tab of guideTabs) {
    grouped[tab.key] = [];
  }
  recommendations?.forEach((rec) => {
    const tab = guideTabs.find((t) => t.categories.includes(rec.category));
    if (tab) {
      grouped[tab.key].push(rec);
    }
  });

  const hasAny = recommendations && recommendations.length > 0;
  // Default to first tab that has recommendations, or just the first tab
  const defaultTab =
    guideTabs.find((t) => grouped[t.key].length > 0)?.key ?? guideTabs[0].key;

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h2 className="text-2xl font-bold tracking-tight">Local Guide</h2>
        <p className="text-muted-foreground">
          Hand-picked favorites and things to do near {property.name}
        </p>
      </div>

      <Separator />

      {hasAny ? (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3">
            {guideTabs.map((tab) => {
              const Icon = tab.icon;
              const count = grouped[tab.key].length;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="gap-1.5 text-xs sm:text-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className="text-muted-foreground ml-0.5">
                      ({count})
                    </span>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {guideTabs.map((tab) => (
            <TabsContent key={tab.key} value={tab.key} className="mt-4">
              {grouped[tab.key].length > 0 ? (
                <div className="grid gap-3">
                  {grouped[tab.key].map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-muted-foreground">
                  <tab.icon className="h-10 w-10 mx-auto mb-3 opacity-30" />
                  <p>{tab.emptyMessage}</p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="text-center py-16 text-muted-foreground">
          <Compass className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="text-lg font-medium">No recommendations yet</p>
          <p className="text-sm mt-1">
            Check back soon — we&apos;re curating the best local spots for you.
          </p>
        </div>
      )}
    </div>
  );
}
