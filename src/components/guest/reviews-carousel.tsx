"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Star, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { REVIEWS, REVIEW_STATS } from "@/app/home-v2/reviews-data";

// Show top 20 five-star reviews (diverse property mix)
const CAROUSEL_REVIEWS = (() => {
  const fiveStars = REVIEWS.filter((r) => r.rating === 5 && r.text.length > 80);
  const picked: typeof REVIEWS = [];
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

export function ReviewsCarousel() {
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  const reviews = CAROUSEL_REVIEWS;

  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isAutoPlaying) return;
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % reviews.length);
    }, 5000);
  }, [isAutoPlaying, reviews.length]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoPlay]);

  useEffect(() => {
    if (scrollRef.current) {
      const card = scrollRef.current.querySelector("[data-review]");
      if (card) {
        const cardWidth = card.getBoundingClientRect().width + 16;
        scrollRef.current.scrollTo({
          left: current * cardWidth,
          behavior: "smooth",
        });
      }
    }
  }, [current]);

  const go = (dir: -1 | 1) => {
    setCurrent((prev) => (prev + dir + reviews.length) % reviews.length);
    startAutoPlay();
  };

  return (
    <section className="px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Star className="h-6 w-6 fill-amber-400 text-amber-400" />
            Guest Reviews
          </h2>
          <p className="text-muted-foreground">
            {REVIEW_STATS.totalCount}+ verified guest reviews across all properties
          </p>
        </div>
        <div className="hidden sm:flex items-center gap-2">
          <button
            onClick={() => go(-1)}
            className="h-9 w-9 rounded-full border border-input flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            onClick={() => go(1)}
            className="h-9 w-9 rounded-full border border-input flex items-center justify-center hover:bg-accent transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Rating summary bar */}
      <div className="flex items-center gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span className="text-3xl font-bold">{REVIEW_STATS.averageRating}</span>
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
            Airbnb · {REVIEW_STATS.totalCount} reviews
          </Badge>
          <Badge
            variant="secondary"
            className="bg-muted text-muted-foreground border-0 text-xs font-medium"
          >
            {REVIEW_STATS.propertyCount} properties
          </Badge>
        </div>
      </div>

      {/* Review cards carousel */}
      <div className="relative">
        <div
          ref={scrollRef}
          className="flex gap-4 overflow-x-auto snap-x snap-mandatory scrollbar-hide pb-2"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
          onMouseEnter={() => {
            setIsAutoPlaying(false);
            if (intervalRef.current) clearInterval(intervalRef.current);
          }}
          onMouseLeave={() => {
            setIsAutoPlaying(true);
          }}
        >
          {reviews.map((review) => (
            <div
              key={review.id}
              data-review
              className="shrink-0 w-[320px] sm:w-95 snap-start"
            >
              <Card className="h-full border-border/50 hover:border-border transition-colors">
                <CardContent className="p-5 flex flex-col h-full">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-semibold text-primary">
                        {review.name
                          .split(" ")
                          .map((n) => n[0])
                          .join("")
                          .slice(0, 2)}
                      </div>
                      <div>
                        <p className="font-semibold text-sm">{review.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {review.date}
                        </p>
                      </div>
                    </div>
                    <Badge
                      variant="secondary"
                      className={`${platformColor[review.platform]} border-0 text-[10px] font-medium`}
                    >
                      {review.platform}
                    </Badge>
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
                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">
                    &ldquo;{review.text}&rdquo;
                  </p>

                  {/* Property */}
                  <div className="mt-3 pt-3 border-t">
                    <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                      <MapPin className="h-3 w-3 shrink-0" />
                      <span className="line-clamp-1">{review.property}</span>
                    </p>
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {reviews.map((_, i) => (
          <button
            key={i}
            onClick={() => {
              setCurrent(i);
              startAutoPlay();
            }}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === current
                ? "w-6 bg-foreground"
                : "w-1.5 bg-foreground/20 hover:bg-foreground/40"
            }`}
          />
        ))}
      </div>
    </section>
  );
}
