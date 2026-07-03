"use client";

import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Star, Calendar, ArrowRight, Home } from "lucide-react";
import {
  REVIEWS,
  REVIEW_STATS,
  PROPERTY_IMAGES,
  type Review,
} from "@/lib/reviews-data";
import Link from "next/link";

// Show top 20 five-star reviews (diverse property mix)
const MASONRY_REVIEWS = (() => {
  const fiveStars = REVIEWS.filter((r) => r.rating === 5 && r.text.length > 80);
  const picked: Review[] = [];
  const propCount: Record<string, number> = {};
  for (const r of fiveStars) {
    const c = propCount[r.property] || 0;
    if (c >= 4) continue;
    picked.push(r);
    propCount[r.property] = c + 1;
    if (picked.length >= 20) break;
  }
  return picked;
})();

const platformColor: Record<string, string> = {
  Airbnb: "bg-[#FF5A5F]/10 text-[#FF5A5F]",
  VRBO: "bg-[#3B5FD9]/10 text-[#3B5FD9]",
  Google: "bg-emerald-500/10 text-emerald-600",
  Direct: "bg-amber-500/10 text-amber-600",
};

/* Property name → slug mapping (from Supabase) */
const PROPERTY_SLUGS: Record<string, string> = {
  "Lakefront Home w/ Hot Tub, Game Room, Deck, Boats, Fire Pit": "lakefront-home-w-hot-tub-game-room-deck-boats-fire-pit",
  "Lakeview Chalet w/ Hot Tub, Sauna, Decks, Boats, & Fire Pit!": "lakeview-chalet-w-hot-tub-sauna-decks-boats-fire-pit",
  "Lake Adjacent Home w/ Hot Tub, Game Room, Boats, Fenced Yard": "lake-adjacent-home-w-hot-tub-game-room-boats-fenced-yard",
  "Poconos Lakefront with Hot Tub, boats, and more!": "poconos-lakefront-with-hot-tub-boats-and-more",
  "Cozy Lakefront Home w/ Game Room, Hot Tub, Fire Pit, & Boats": "cozy-lakefront-home-w-game-room-hot-tub-fire-pit-boats",
  "Lakefront Mansion w/ 3 Decks, Hot Tub, Boats, & Game Room!": "lakefront-mansion-w-3-decks-hot-tub-boats-game-room",
  "Lakeview Chalet w/ hot tub, sauna, fire pit & decks": "luxury-lakefront-chalet-in-poconos-1-5hrs-from-nyc",
};

function ReviewCard({ review }: { review: Review }) {
  const propertyImage = PROPERTY_IMAGES[review.property];
  const propertySlug = PROPERTY_SLUGS[review.property];
  const bookHref = propertySlug ? `/book/${propertySlug}` : "/#properties";

  return (
    <Card className="border">
      <CardContent className="p-5 flex flex-col">
        {/* Reviewer header */}
        <div className="flex items-center gap-3 mb-3">
          {review.photo ? (
            <img
              src={review.photo}
              alt={review.name}
              className="h-10 w-10 rounded-full object-cover shrink-0"
            />
          ) : (
            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary shrink-0">
              {review.name
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <p className="font-semibold text-sm">{review.name}</p>
              <Badge
                variant="secondary"
                className={`${platformColor[review.platform]} border-0 text-[10px] font-medium shrink-0`}
              >
                {review.platform}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
              <Calendar className="h-3 w-3" />
              {review.date}
            </p>
          </div>
        </div>

        {/* Stars */}
        <div className="flex gap-0.5 mb-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Star
              key={i}
              className={`h-3.5 w-3.5 ${
                i < review.rating
                  ? "fill-amber-400 text-amber-400"
                  : "text-muted-foreground/25"
              }`}
            />
          ))}
        </div>

        {/* Review text */}
        <p className="text-sm text-muted-foreground leading-relaxed">
          &ldquo;{review.text}&rdquo;
        </p>

        {/* Property footer with house image + link */}
        <Link
          href={bookHref}
          className="mt-3 pt-3 border-t flex items-center gap-2.5 group"
        >
          {propertyImage ? (
            <img
              src={propertyImage}
              alt={review.property}
              className="h-8 w-8 rounded object-cover shrink-0"
            />
          ) : (
            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center shrink-0">
              <Home className="h-4 w-4 text-muted-foreground/50" />
            </div>
          )}
          <p className="text-xs text-muted-foreground group-hover:text-foreground transition-colors line-clamp-1 flex-1">
            {review.property}
          </p>
        </Link>
      </CardContent>
    </Card>
  );
}

export function ReviewsCarousel({
  ctaHref,
  ctaLabel = "See for yourself, book now!",
  propertyName,
  propertyNames,
}: {
  ctaHref?: string;
  ctaLabel?: string;
  propertyName?: string;
  /** Match several property-row names at once (old + new rows of one house) */
  propertyNames?: string[];
} = {}) {
  const names = propertyNames ?? (propertyName ? [propertyName] : null);
  const filtered = names
    ? REVIEWS.filter((r) => names.includes(r.property))
    : null;
  const reviews = filtered
    ? filtered.filter((r) => r.text.length > 80).slice(0, 20)
    : MASONRY_REVIEWS;
  const averageRating = filtered?.length
    ? (filtered.reduce((sum, r) => sum + r.rating, 0) / filtered.length).toFixed(2)
    : REVIEW_STATS.averageRating;
  const totalCount = filtered ? filtered.length : REVIEW_STATS.totalCount;

  return (
    <section className="px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
      {/* Header */}
      <div className="space-y-1 mb-6">
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
          <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
          Guest Reviews
        </h2>
        <p className="text-muted-foreground">
          {filtered
            ? `${totalCount} verified guest reviews`
            : `${REVIEW_STATS.totalCount}+ verified guest reviews across all properties`}
        </p>
      </div>

      {/* Rating summary bar */}
      <div className="flex items-center gap-4 mb-8 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold">{averageRating}</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 5 }, (_, i) => (
              <Star
                key={i}
                className="h-4 w-4 fill-amber-400 text-amber-400"
              />
            ))}
          </div>
        </div>
        <Separator orientation="vertical" className="h-8 hidden sm:block" />
        <div className="flex gap-2 flex-wrap">
          <Badge
            variant="secondary"
            className={`${platformColor.Airbnb} border-0 text-xs font-medium`}
          >
            Airbnb · {totalCount} reviews
          </Badge>
          {!filtered && (
            <Badge
              variant="secondary"
              className="bg-muted text-muted-foreground border-0 text-xs font-medium"
            >
              {REVIEW_STATS.propertyCount} properties
            </Badge>
          )}
        </div>
      </div>

      {/* Masonry grid with fade overlay */}
      <div className="relative">
        <div
          className="columns-1 sm:columns-2 lg:columns-3 gap-4 overflow-hidden"
          style={{ maxHeight: 1400 }}
        >
          {reviews.map((review) => (
            <div key={review.id} className="break-inside-avoid mb-4">
              <ReviewCard review={review} />
            </div>
          ))}
        </div>

        {/* Fade overlay + CTA */}
        <div className="absolute inset-x-0 bottom-0 h-72 bg-linear-to-t from-background from-20% via-background/80 to-transparent flex items-end justify-center pb-10">
          <a href={ctaHref || "/#properties"}>
            <Button size="lg" className="gap-2 text-base px-8 shadow-lg">
              {ctaLabel}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </a>
        </div>
      </div>
    </section>
  );
}
