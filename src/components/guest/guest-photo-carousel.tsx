"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, ChevronLeft, ChevronRight, MapPin, Clock, Search } from "lucide-react";
import Link from "next/link";

const SESSION_KEY = "guest-portal-session";

type GuestPhoto = {
  id: string;
  url: string;
  caption: string | null;
  guest_name: string | null;
  property_name: string | null;
};

type SessionData = {
  guestName: string;
  reservation: {
    id: string;
    property: { slug: string };
  };
} | null;

function getSession(): SessionData {
  try {
    const raw = sessionStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function EmptyState({ propertySlug }: { propertySlug?: string }) {
  const [session, setSession] = useState<SessionData>(null);
  const [checked, setChecked] = useState(false);

  useEffect(() => {
    setSession(getSession());
    setChecked(true);
  }, []);

  const slug = propertySlug || session?.reservation?.property?.slug;

  return (
    <section className="px-4 sm:px-6 py-10 max-w-6xl mx-auto w-full">
      <Card className="border-dashed border-2 overflow-hidden">
        <CardContent className="flex flex-col items-center text-center gap-4 py-10 px-6">
          <div className="rounded-full bg-primary/10 p-4">
            <Camera className="h-8 w-8 text-primary" />
          </div>
          <div className="space-y-2 max-w-md">
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Guest Photo Album
            </h2>
            <p className="text-muted-foreground text-sm sm:text-base">
              Share photos from your stay and earn a free late check-out!
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Clock className="h-3.5 w-3.5" />
            <span>Upload 3 photos to unlock a complimentary late check-out</span>
          </div>
          {checked && (
            session && slug ? (
              <Link href={`/p/${slug}/photos`}>
                <Button size="lg" className="mt-2">
                  <Camera className="h-4 w-4 mr-2" />
                  Upload Photos
                </Button>
              </Link>
            ) : (
              <Link href="/">
                <Button size="lg" variant="outline" className="mt-2">
                  <Search className="h-4 w-4 mr-2" />
                  Find My Booking
                </Button>
              </Link>
            )
          )}
        </CardContent>
      </Card>
    </section>
  );
}

export function GuestPhotoCarousel({
  propertyId,
  propertySlug,
}: {
  propertyId?: string;
  propertySlug?: string;
}) {
  const [photos, setPhotos] = useState<GuestPhoto[]>([]);
  const [loaded, setLoaded] = useState(false);
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
      setLoaded(true);
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

  if (!loaded) return null;

  if (photos.length === 0) {
    return <EmptyState propertySlug={propertySlug} />;
  }

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
