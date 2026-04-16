"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, ChevronLeft, ChevronRight, MapPin } from "lucide-react";

type GuestPhoto = {
  id: string;
  url: string;
  caption: string | null;
  guest_name: string | null;
  property_name: string | null;
};

export function GuestPhotoCarousel({
  propertyId,
}: {
  propertyId?: string;
}) {
  const [photos, setPhotos] = useState<GuestPhoto[]>([]);
  const [current, setCurrent] = useState(0);
  const [isAutoPlaying, setIsAutoPlaying] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval>>(null);

  useEffect(() => {
    async function load() {
      const params = propertyId ? `?property_id=${propertyId}` : "";
      const res = await fetch(`/api/guest/public-photos${params}`);
      if (res.ok) {
        const data = await res.json();
        setPhotos(data.photos || []);
      }
    }
    load();
  }, [propertyId]);

  const startAutoPlay = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!isAutoPlaying || photos.length === 0) return;
    intervalRef.current = setInterval(() => {
      setCurrent((prev) => (prev + 1) % photos.length);
    }, 4000);
  }, [isAutoPlaying, photos.length]);

  useEffect(() => {
    startAutoPlay();
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [startAutoPlay]);

  useEffect(() => {
    if (scrollRef.current) {
      const card = scrollRef.current.querySelector("[data-photo]");
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
    setCurrent((prev) => (prev + dir + photos.length) % photos.length);
    startAutoPlay();
  };

  if (photos.length === 0) return null;

  return (
    <section className="px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
      <div className="flex items-center justify-between mb-6">
        <div className="space-y-1">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight flex items-center gap-2.5">
            <Camera className="h-6 w-6 text-primary" />
            Guest Photos
          </h2>
          <p className="text-muted-foreground">
            Moments shared by our guests
          </p>
        </div>
        {photos.length > 1 && (
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
        )}
      </div>

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
          {photos.map((photo) => (
            <div
              key={photo.id}
              data-photo
              className="shrink-0 w-[280px] sm:w-[320px] snap-start"
            >
              <Card className="h-full overflow-hidden border-border/50 hover:border-border transition-colors">
                <div className="relative aspect-[4/3]">
                  <img
                    src={photo.url}
                    alt={photo.caption || "Guest photo"}
                    className="absolute inset-0 w-full h-full object-cover"
                  />
                </div>
                <CardContent className="p-4 space-y-2">
                  {photo.caption && (
                    <p className="text-sm line-clamp-2">{photo.caption}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    {photo.guest_name && (
                      <span className="font-medium">
                        — {photo.guest_name.split(" ")[0]}
                      </span>
                    )}
                    {photo.property_name && !propertyId && (
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        <span className="line-clamp-1">{photo.property_name}</span>
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            </div>
          ))}
        </div>
      </div>

      {/* Dots */}
      {photos.length > 1 && (
        <div className="flex justify-center gap-1.5 mt-4">
          {photos.map((_, i) => (
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
      )}
    </section>
  );
}
