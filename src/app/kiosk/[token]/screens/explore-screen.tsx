"use client";

import { Home, MapPin, Star } from "lucide-react";
import { KioskScreenShell, glassButton, glassPanel } from "../ui";
import {
  CATEGORIES,
  COMMUNITIES,
  type Activity,
  type CommunityAmenity,
} from "@/lib/things-to-do-content";

// Kiosk-native "Explore the Poconos" — the same content as the public
// things-to-do page, rebuilt for touch: chip rail jumps to sections, every
// row is a horizontal snap-scroll. No external links anywhere; the kiosk
// never navigates away.

const COMMUNITIES_SECTION_ID = "explore-sec-communities";
const sectionId = (key: string) => `explore-sec-${key}`;

function scrollToSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const snapRow =
  "-mx-6 flex snap-x gap-3 overflow-x-auto px-6 pb-2 lg:-mx-10 lg:px-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const tinyChip =
  "rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/70 ring-1 ring-white/10";

function hideBrokenImage(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

function AmenityCard({ amenity }: { amenity: CommunityAmenity }) {
  return (
    <div className={`w-80 shrink-0 snap-start overflow-hidden ${glassPanel}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={amenity.image}
        alt={amenity.name}
        loading="lazy"
        onError={hideBrokenImage}
        className="h-52 w-full object-cover"
      />
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-base font-bold text-white">{amenity.name}</h4>
          {amenity.featured && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-400/15 px-2.5 py-1 text-xs font-semibold text-amber-300 ring-1 ring-amber-300/30">
              <Star className="h-3 w-3 fill-current" />
              Featured
            </span>
          )}
        </div>
        {amenity.description && (
          <p className="text-sm leading-relaxed text-white/60 line-clamp-2">{amenity.description}</p>
        )}
        {(amenity.tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {amenity.tags!.map((tag) => (
              <span key={tag} className={tinyChip}>
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ActivityCard({ activity }: { activity: Activity }) {
  return (
    <div className={`w-80 shrink-0 snap-start overflow-hidden ${glassPanel}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={activity.image}
        alt={activity.name}
        loading="lazy"
        onError={hideBrokenImage}
        className="h-52 w-full object-cover"
      />
      <div className="flex flex-col gap-2 p-4">
        <h4 className="text-2xl font-extrabold text-white">{activity.name}</h4>
        <p className="text-sm leading-relaxed text-white/60 line-clamp-3">{activity.description}</p>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {activity.distance && (
            <span className="inline-flex items-center gap-1 rounded-full bg-white/10 px-2.5 py-1 text-xs font-medium text-white/80 ring-1 ring-white/10">
              <MapPin className="h-3.5 w-3.5" />
              {activity.distance}
            </span>
          )}
          {activity.tags?.slice(0, 3).map((tag) => (
            <span key={tag} className={tinyChip}>
              {tag}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ExploreScreen({
  community,
  timezone,
  onBack,
}: {
  community: "penn-estates" | "blue-mountain-lake";
  timezone: string;
  onBack: () => void;
}) {
  // Only show the amenities for the community this house actually sits in.
  const communities = COMMUNITIES.filter((c) => c.id === community);

  return (
    <KioskScreenShell
      title="Explore the Poconos"
      subtitle="Community amenities and the best of the mountains — all nearby"
      timezone={timezone}
      onBack={onBack}
    >
      <div className="flex flex-col gap-10 pb-8">
        {/* Category chip rail — taps jump to sections below */}
        <div className={snapRow}>
          <button
            type="button"
            onClick={() => scrollToSection(COMMUNITIES_SECTION_ID)}
            className={`flex min-h-14 shrink-0 snap-start items-center gap-2 whitespace-nowrap px-5 text-base font-semibold text-white ${glassButton}`}
          >
            <Home className="h-5 w-5" />
            Your Community
          </button>
          {CATEGORIES.map((category) => (
            <button
              key={category.key}
              type="button"
              onClick={() => scrollToSection(sectionId(category.key))}
              className={`flex min-h-14 shrink-0 snap-start items-center gap-2 whitespace-nowrap px-5 text-base font-semibold text-white ${glassButton}`}
            >
              <category.icon className="h-5 w-5" />
              {category.title}
            </button>
          ))}
        </div>

        {/* Our Communities */}
        <section id={COMMUNITIES_SECTION_ID} className="flex scroll-mt-4 flex-col gap-8">
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/50 lg:text-sm">
            Your Community
          </p>
          {communities.map((community) => (
            <div key={community.id} className="flex flex-col gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
                  {community.name}
                </h2>
                <p className="mt-1 text-white/60">{community.tagline}</p>
              </div>
              <div className={snapRow}>
                {community.groups.flatMap((group) =>
                  group.items.map((amenity) => (
                    <AmenityCard key={`${community.id}-${group.key}-${amenity.name}`} amenity={amenity} />
                  ))
                )}
              </div>
            </div>
          ))}
        </section>

        {/* One section per category */}
        {CATEGORIES.map((category) => (
          <section
            key={category.key}
            id={sectionId(category.key)}
            className="flex scroll-mt-4 flex-col gap-4"
          >
            <div className="flex items-center gap-4">
              <span
                className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-linear-to-br ${category.gradient}`}
              >
                <category.icon className="h-6 w-6 text-white" />
              </span>
              <div className="min-w-0">
                <h2 className="text-2xl font-bold tracking-tight text-white lg:text-3xl">
                  {category.title}
                </h2>
                <p className="mt-0.5 text-white/60">{category.subtitle}</p>
              </div>
            </div>
            <div className={snapRow}>
              {category.activities.map((activity) => (
                <ActivityCard key={activity.name} activity={activity} />
              ))}
            </div>
          </section>
        ))}
      </div>
    </KioskScreenShell>
  );
}
