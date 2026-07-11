"use client";

import { useState } from "react";
import { ChevronRight, Home, MapPin, Star } from "lucide-react";
import { KioskScreenShell, glassPanel } from "../ui";
import {
  CATEGORIES,
  COMMUNITIES,
  type Activity,
  type Category,
  type Community,
  type CommunityAmenity,
} from "@/lib/things-to-do-content";

// Kiosk-native "Explore the Poconos" — a drill-down nested menu instead of one
// long scroll. Level 1: a grid of big category tiles. Level 2: the chosen
// category's activities as a grid. Level 3: a full-screen detail card. The
// shell's single back button walks the hierarchy (Home → Explore → Category).
// No external links anywhere; the kiosk never navigates away.

type CommunityTile = {
  kind: "community";
  community: Community;
  amenities: CommunityAmenity[];
};
type CategoryTile = { kind: "category"; category: Category };
type Tile = CommunityTile | CategoryTile;

const tinyChip =
  "rounded-full bg-(--k-surf-10) px-2.5 py-1 text-xs font-medium text-(--k-fg-70) ring-1 ring-(--k-surf-10)";

function hideBrokenImage(e: React.SyntheticEvent<HTMLImageElement>) {
  e.currentTarget.style.display = "none";
}

/* ---------------------------------------------------------------- */
/*  Level 1 — category menu tiles                                   */
/* ---------------------------------------------------------------- */

function MenuTile({
  gradient,
  icon: Icon,
  title,
  subtitle,
  count,
  onClick,
}: {
  gradient: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  count: number;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group relative flex min-h-44 flex-col justify-between overflow-hidden rounded-3xl bg-linear-to-br ${gradient} p-6 text-left ring-1 ring-white/10 transition-transform active:scale-[0.98]`}
    >
      <div className="absolute inset-0 bg-black/15 transition-colors group-hover:bg-black/5" />
      <div className="relative flex items-start justify-between">
        <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-sm">
          <Icon className="h-7 w-7 text-white" />
        </span>
        <span className="rounded-full bg-black/25 px-3 py-1 text-sm font-semibold text-white/90">
          {count}
        </span>
      </div>
      <div className="relative">
        <h3 className="text-2xl font-extrabold leading-tight text-white drop-shadow-sm">
          {title}
        </h3>
        <p className="mt-1 line-clamp-2 text-sm font-medium text-white/85">{subtitle}</p>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- */
/*  Level 2 — activity / amenity grid cards                         */
/* ---------------------------------------------------------------- */

function GridCard({
  image,
  name,
  blurb,
  distance,
  featured,
  onClick,
}: {
  image: string;
  name: string;
  blurb: string;
  distance?: string;
  featured?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`group flex flex-col overflow-hidden text-left transition-transform active:scale-[0.98] ${glassPanel}`}
    >
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt={name}
          loading="lazy"
          onError={hideBrokenImage}
          className="h-40 w-full object-cover"
        />
        {featured && (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber-400/90 px-2.5 py-1 text-xs font-bold text-amber-950 shadow">
            <Star className="h-3 w-3 fill-current" />
            Featured
          </span>
        )}
        {distance && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/50 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            <MapPin className="h-3.5 w-3.5" />
            {distance}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <div className="flex items-center justify-between gap-2">
          <h4 className="text-lg font-bold text-(--k-fg)">{name}</h4>
          <ChevronRight className="h-5 w-5 shrink-0 text-(--k-fg-50) transition-transform group-hover:translate-x-0.5" />
        </div>
        <p className="line-clamp-2 text-sm leading-relaxed text-(--k-fg-60)">{blurb}</p>
      </div>
    </button>
  );
}

/* ---------------------------------------------------------------- */
/*  Level 3 — full detail                                           */
/* ---------------------------------------------------------------- */

function DetailView({
  image,
  name,
  description,
  distance,
  tags,
}: {
  image: string;
  name: string;
  description: string;
  distance?: string;
  tags?: string[];
}) {
  return (
    <div className={`mx-auto max-w-3xl overflow-hidden ${glassPanel}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={image}
        alt={name}
        onError={hideBrokenImage}
        className="h-72 w-full object-cover lg:h-96"
      />
      <div className="flex flex-col gap-4 p-6 lg:p-8">
        <div className="flex flex-wrap items-center gap-3">
          <h2 className="text-3xl font-extrabold tracking-tight text-(--k-fg) lg:text-4xl">
            {name}
          </h2>
          {distance && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-(--k-surf-10) px-3 py-1.5 text-sm font-semibold text-(--k-fg-80) ring-1 ring-(--k-surf-15)">
              <MapPin className="h-4 w-4" />
              {distance} away
            </span>
          )}
        </div>
        <p className="text-lg leading-relaxed text-(--k-fg-80)">{description}</p>
        {(tags?.length ?? 0) > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {tags!.map((tag) => (
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

/* ---------------------------------------------------------------- */
/*  Screen                                                          */
/* ---------------------------------------------------------------- */

type Selected =
  | { activity: Activity; amenity?: undefined }
  | { amenity: CommunityAmenity; activity?: undefined };

export function ExploreScreen({
  community,
  timezone,
  onBack,
}: {
  community: "penn-estates" | "blue-mountain-lake";
  timezone: string;
  onBack: () => void;
}) {
  const myCommunity = COMMUNITIES.find((c) => c.id === community);
  const communityAmenities =
    myCommunity?.groups.flatMap((g) => g.items) ?? [];

  const tiles: Tile[] = [
    ...(myCommunity
      ? [
          {
            kind: "community" as const,
            community: myCommunity,
            amenities: communityAmenities,
          },
        ]
      : []),
    ...CATEGORIES.map((category) => ({ kind: "category" as const, category })),
  ];

  const [openTile, setOpenTile] = useState<Tile | null>(null);
  const [selected, setSelected] = useState<Selected | null>(null);

  // Hierarchical back: detail → grid → menu → Home.
  let title = "Explore the Poconos";
  let subtitle = "Community amenities and the best of the mountains — all nearby";
  let backLabel = "Home";
  let handleBack = onBack;

  if (openTile) {
    const label =
      openTile.kind === "community" ? openTile.community.name : openTile.category.title;
    title = label;
    subtitle =
      openTile.kind === "community"
        ? openTile.community.tagline
        : openTile.category.subtitle;
    backLabel = "Explore";
    handleBack = () => setOpenTile(null);
  }
  if (selected) {
    const name = selected.activity?.name ?? selected.amenity!.name;
    title = name;
    subtitle = openTile
      ? openTile.kind === "community"
        ? openTile.community.name
        : openTile.category.title
      : "";
    backLabel = "Back";
    handleBack = () => setSelected(null);
  }

  return (
    <KioskScreenShell
      title={title}
      subtitle={subtitle}
      timezone={timezone}
      onBack={handleBack}
      backLabel={backLabel}
    >
      {/* Level 3 — detail */}
      {selected ? (
        selected.activity ? (
          <DetailView
            image={selected.activity.image}
            name={selected.activity.name}
            description={selected.activity.description}
            distance={selected.activity.distance}
            tags={selected.activity.tags}
          />
        ) : (
          <DetailView
            image={selected.amenity.image}
            name={selected.amenity.name}
            description={selected.amenity.description ?? ""}
            tags={selected.amenity.tags}
          />
        )
      ) : openTile ? (
        /* Level 2 — grid of activities / amenities */
        <div className="grid grid-cols-2 gap-4 pb-6 lg:grid-cols-3 lg:gap-5">
          {openTile.kind === "community"
            ? openTile.amenities.map((amenity) => (
                <GridCard
                  key={amenity.name}
                  image={amenity.image}
                  name={amenity.name}
                  blurb={amenity.description ?? ""}
                  featured={amenity.featured}
                  onClick={() => setSelected({ amenity })}
                />
              ))
            : openTile.category.activities.map((activity) => (
                <GridCard
                  key={activity.name}
                  image={activity.image}
                  name={activity.name}
                  blurb={activity.description}
                  distance={activity.distance}
                  onClick={() => setSelected({ activity })}
                />
              ))}
        </div>
      ) : (
        /* Level 1 — category menu */
        <div className="grid grid-cols-2 gap-4 pb-6 lg:grid-cols-3 lg:gap-5">
          {tiles.map((tile) =>
            tile.kind === "community" ? (
              <MenuTile
                key="community"
                gradient={tile.community.gradient}
                icon={Home}
                title="Your Community"
                subtitle={tile.community.name}
                count={tile.amenities.length}
                onClick={() => setOpenTile(tile)}
              />
            ) : (
              <MenuTile
                key={tile.category.key}
                gradient={tile.category.gradient}
                icon={tile.category.icon}
                title={tile.category.title}
                subtitle={tile.category.subtitle}
                count={tile.category.activities.length}
                onClick={() => setOpenTile(tile)}
              />
            )
          )}
        </div>
      )}
    </KioskScreenShell>
  );
}
