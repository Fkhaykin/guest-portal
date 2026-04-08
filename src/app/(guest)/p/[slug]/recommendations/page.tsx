import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Image from "next/image";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import {
  MapPin,
  Globe,
  Navigation,
  Star,
  UtensilsCrossed,
  Compass,
  CalendarDays,
  ExternalLink,
  Coffee,
  Beer,
  ShoppingBag,
  Waves,
  TreePine,
  Mountain,
  Camera,
  Music,
  Ticket,
  Landmark,
  Bike,
  Fish,
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

/* ---------- category icon mapping ---------- */
const categoryIcons: Record<string, React.ElementType> = {
  restaurant: UtensilsCrossed,
  cafe: Coffee,
  bar: Beer,
  shopping: ShoppingBag,
  activity: Compass,
  attraction: Camera,
  waterfront: Waves,
  hiking: TreePine,
  mountain: Mountain,
  music: Music,
  event: Ticket,
  landmark: Landmark,
  biking: Bike,
  fishing: Fish,
  other: CalendarDays,
};

/* ---------- guide tab config ---------- */
const guideTabs = [
  {
    key: "food",
    label: "Food & Drink",
    icon: UtensilsCrossed,
    categories: ["restaurant", "cafe", "bar", "shopping"],
    emptyMessage: "No food & drink recommendations yet.",
    gradient: "from-orange-500/10 to-amber-500/5",
  },
  {
    key: "activities",
    label: "Activities",
    icon: Compass,
    categories: ["activity", "attraction", "waterfront", "hiking", "mountain", "biking", "fishing", "landmark"],
    emptyMessage: "No activity recommendations yet.",
    gradient: "from-emerald-500/10 to-teal-500/5",
  },
  {
    key: "events",
    label: "Events",
    icon: CalendarDays,
    categories: ["other", "event", "music"],
    emptyMessage: "No event recommendations yet.",
    gradient: "from-violet-500/10 to-purple-500/5",
  },
];

/* ---------- star rating ---------- */
function RatingStars({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={`h-3.5 w-3.5 ${
            i < Math.round(rating)
              ? "fill-amber-400 text-amber-400"
              : "text-muted-foreground/25"
          }`}
        />
      ))}
      <span className="text-xs text-muted-foreground ml-1.5 font-medium">
        {rating.toFixed(1)}
      </span>
    </div>
  );
}

/* ---------- recommendation card ---------- */
function RecommendationCard({ rec }: { rec: Recommendation }) {
  const CategoryIcon = categoryIcons[rec.category] || Compass;

  return (
    <Card className="overflow-hidden transition-all hover:shadow-lg hover:-translate-y-0.5 duration-200 group">
      {/* Image */}
      {rec.image_url ? (
        <div className="relative h-44 w-full overflow-hidden bg-muted">
          <Image
            src={rec.image_url}
            alt={rec.name}
            fill
            className="object-cover transition-transform duration-300 group-hover:scale-105"
            sizes="(max-width: 768px) 100vw, 50vw"
          />
          {/* Category badge overlay */}
          <div className="absolute top-3 left-3">
            <Badge className="bg-black/60 text-white border-0 backdrop-blur-sm gap-1.5 text-xs font-medium">
              <CategoryIcon className="h-3 w-3" />
              {rec.category.charAt(0).toUpperCase() + rec.category.slice(1)}
            </Badge>
          </div>
        </div>
      ) : (
        <div className="relative h-32 w-full bg-linear-to-br from-muted to-muted/50 flex items-center justify-center">
          <CategoryIcon className="h-12 w-12 text-muted-foreground/20" />
          <div className="absolute top-3 left-3">
            <Badge variant="secondary" className="gap-1.5 text-xs font-medium">
              <CategoryIcon className="h-3 w-3" />
              {rec.category.charAt(0).toUpperCase() + rec.category.slice(1)}
            </Badge>
          </div>
        </div>
      )}

      <CardContent className="p-4 space-y-3">
        {/* Name + Rating */}
        <div className="space-y-1.5">
          <h3 className="font-semibold text-base leading-tight line-clamp-1">
            {rec.name}
          </h3>
          {rec.rating && <RatingStars rating={rec.rating} />}
        </div>

        {/* Address */}
        {rec.address && (
          <p className="text-muted-foreground text-xs flex items-start gap-1.5">
            <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span className="line-clamp-2">{rec.address}</span>
          </p>
        )}

        {/* Description */}
        {rec.description && (
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
            {rec.description}
          </p>
        )}

        {/* Action buttons */}
        {(rec.website_url || rec.map_url) && (
          <div className="flex gap-2 pt-1">
            {rec.map_url && (
              <a
                href={rec.map_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="default" size="sm" className="w-full gap-1.5">
                  <Navigation className="h-3.5 w-3.5" />
                  Directions
                </Button>
              </a>
            )}
            {rec.website_url && (
              <a
                href={rec.website_url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
              >
                <Button variant="outline" size="sm" className="w-full gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Website
                </Button>
              </a>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ---------- page ---------- */
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
    .order("sort_order");

  // Group recommendations into guide tabs
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
  const defaultTab =
    guideTabs.find((t) => grouped[t.key].length > 0)?.key ?? guideTabs[0].key;
  const totalCount = recommendations?.length ?? 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10">
            <Compass className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">Local Guide</h2>
            <p className="text-muted-foreground text-sm">
              {totalCount} hand-picked spots near your stay
            </p>
          </div>
        </div>
      </div>

      <Separator />

      {hasAny ? (
        <Tabs defaultValue={defaultTab} className="w-full">
          <TabsList className="w-full grid grid-cols-3 h-11">
            {guideTabs.map((tab) => {
              const Icon = tab.icon;
              const count = grouped[tab.key].length;
              return (
                <TabsTrigger
                  key={tab.key}
                  value={tab.key}
                  className="gap-1.5 text-xs sm:text-sm data-[state=active]:shadow-sm"
                >
                  <Icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                  <span className="sm:hidden">{tab.label.split(" ")[0]}</span>
                  {count > 0 && (
                    <Badge
                      variant="secondary"
                      className="h-5 min-w-5 px-1.5 text-[10px] font-semibold"
                    >
                      {count}
                    </Badge>
                  )}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {guideTabs.map((tab) => (
            <TabsContent key={tab.key} value={tab.key} className="mt-5">
              {grouped[tab.key].length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {grouped[tab.key].map((rec) => (
                    <RecommendationCard key={rec.id} rec={rec} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 text-muted-foreground">
                  <div className={`inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-linear-to-br ${tab.gradient} mb-4`}>
                    <tab.icon className="h-8 w-8 opacity-40" />
                  </div>
                  <p className="font-medium">{tab.emptyMessage}</p>
                  <p className="text-sm mt-1 opacity-70">
                    We&apos;re always adding new places to explore.
                  </p>
                </div>
              )}
            </TabsContent>
          ))}
        </Tabs>
      ) : (
        <div className="text-center py-20 text-muted-foreground">
          <div className="inline-flex items-center justify-center h-20 w-20 rounded-2xl bg-linear-to-br from-muted to-muted/50 mb-5">
            <Compass className="h-10 w-10 opacity-30" />
          </div>
          <p className="text-lg font-medium">No recommendations yet</p>
          <p className="text-sm mt-1">
            Check back soon — we&apos;re curating the best local spots for you.
          </p>
        </div>
      )}

      {/* Footer tip */}
      {hasAny && (
        <div className="text-center py-4">
          <p className="text-xs text-muted-foreground/60">
            Tap &quot;Directions&quot; to open in Google Maps
          </p>
        </div>
      )}
    </div>
  );
}
