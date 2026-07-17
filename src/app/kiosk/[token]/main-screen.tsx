"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus,
  Camera,
  ClipboardList,
  GalleryVerticalEnd,
  Gift,
  HandCoins,
  LifeBuoy,
  MapPin,
  PenLine,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Truck,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { KioskContent, KioskData, KioskScreen } from "./types";
import { formatShortDate, formatTime, KioskThemeToggle, useKioskTheme } from "./ui";

function getNightCount(checkIn: string, checkOut: string) {
  const d1 = new Date(checkIn + "T00:00:00");
  const d2 = new Date(checkOut + "T00:00:00");
  return Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
}

function timeOfDayGreeting(tz: string): string {
  const hour = parseInt(
    new Intl.DateTimeFormat("en-US", { timeZone: tz, hour: "2-digit", hourCycle: "h23" }).format(new Date()),
    10
  );
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

// Menu-board tile: a big contextual photo (the house's own listing shots, or a
// curated image) under a bottom-up scrim, with a frosted icon badge and a bold
// label. No colored fills — the photography carries the tile.
type Tile = {
  label: string;
  icon: LucideIcon;
  image?: string;
} & ({ href: string; screen?: never } | { screen: KioskScreen; href?: never });

const ICON = "h-6 w-6 lg:h-7 lg:w-7";

export function MainScreen({
  data,
  content,
  onHandoff,
  onNavigate,
  onHelp,
}: {
  data: KioskData;
  content: KioskContent | null;
  onHandoff: (href: string) => void;
  onNavigate: (screen: KioskScreen) => void;
  onHelp: () => void;
}) {
  const [clock, setClock] = useState("");
  const { theme } = useKioskTheme();
  const tz = data.property.timezone;

  useEffect(() => {
    const tick = () =>
      setClock(new Date().toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" }));
    tick();
    const t = setInterval(tick, 15_000);
    return () => clearInterval(t);
  }, [tz]);

  const booking = data.booking;
  const res = booking?.reservation;
  const slug = res?.property.slug ?? data.property.slug;

  const checkInTime = res?.lodgify?.check_in_time ? formatTime(res.lodgify.check_in_time) : "4:00 PM";
  const checkOutTime = res?.lodgify?.check_out_time ? formatTime(res.lodgify.check_out_time) : "11:00 AM";
  const nights = res ? getNightCount(res.check_in_date, res.check_out_date) : 0;
  const nightsLeft = res ? getNightCount(data.today, res.check_out_date) : 0;

  let headline: string;
  let subline: string;
  switch (data.state) {
    case "arrival_day":
      headline = `Welcome, ${booking!.first_name}!`;
      subline = `Check-in opens at ${checkInTime} · ${nights} night${nights === 1 ? "" : "s"} · check-out ${formatShortDate(res!.check_out_date)}`;
      break;
    case "mid_stay":
      headline = `${timeOfDayGreeting(tz)}, ${booking!.first_name}`;
      subline = `${nightsLeft} night${nightsLeft === 1 ? "" : "s"} to go — check-out is ${formatShortDate(res!.check_out_date)} at ${checkOutTime}`;
      break;
    case "checkout_day":
      headline = `Safe travels, ${booking!.first_name}`;
      subline = `Check-out is today by ${checkOutTime}. Thanks for staying with us!`;
      break;
    default:
      headline = `Welcome to ${data.property.name}`;
      subline = "Tap anything below to explore.";
  }

  // Services & Videos only appear when the house actually has content for them.
  const hasServices = (content?.services?.length ?? 0) > 0;
  const hasVideos = (content?.videos?.length ?? 0) > 0;
  const hasPromos = (content?.promos?.length ?? 0) > 0;

  // Primary actions first (booked guests), then the browse grid.
  const primary: Tile[] = booking
    ? [
        res!.signature_url
          ? { label: "Edit Guests, Pets & Vehicles", href: `/p/${slug}/update`, icon: PenLine, image: "/kiosk-edit-registration.jpg" }
          : { label: "Register", href: `/p/${slug}/register`, icon: ClipboardList, image: "/kiosk-edit-registration.jpg" },
        { label: "Extend Your Stay", href: `/p/${slug}/extend-stay`, icon: CalendarPlus },
        { label: "Tip the Crew", screen: { kind: "tip" }, icon: HandCoins, image: "/kiosk-tip-the-crew.jpg" },
      ]
    : [];

  const browse: Tile[] = [
    ...(booking
      ? [
          { label: "Upgrades", href: `/p/${slug}/add-ons`, icon: Sparkles, image: "/kiosk-upgrades-picnic.jpg" } as Tile,
          { label: "Delivery & Rides", href: `/p/${slug}/delivery`, icon: Truck } as Tile,
        ]
      : []),
    ...(data.house_photo_count > 0
      ? [{ label: "House Album", screen: { kind: "house-album" }, icon: GalleryVerticalEnd } as Tile]
      : []),
    { label: "Explore", screen: { kind: "explore" }, icon: MapPin, image: "/kiosk-explore-bushkill.jpg" },
    ...(hasServices
      ? [{ label: "Services", screen: { kind: "services" }, icon: ShoppingBag } as Tile]
      : []),
    ...(hasVideos
      ? [{ label: "Videos", screen: { kind: "videos" }, icon: Video } as Tile]
      : []),
  ];

  const tiles = [...primary, ...browse];
  const photos = data.photos;
  const todayWeather = data.weather?.find((w) => w.date === data.today) ?? data.weather?.[0];

  return (
    <div className="absolute inset-0 flex flex-col bg-(--k-bg)">
      {/* Photo backdrop + dark scrim only in dark mode; light mode is a clean canvas */}
      {theme === "dark" && data.photos[0] && (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={data.photos[0]}
            alt=""
            className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg brightness-[0.22]"
          />
          <div className="absolute inset-0 bg-linear-to-b from-zinc-950/70 via-zinc-950/30 to-zinc-950/80" />
        </>
      )}

      <div className="relative flex h-full flex-col gap-3 p-4 lg:gap-4 lg:p-5">
        {/* Header — the greeting takes the house name's place; utilities right */}
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-3xl font-extrabold tracking-tight text-(--k-fg) lg:text-4xl">
              {headline}
            </h1>
            <p className="mt-0.5 truncate text-base font-medium text-(--k-fg-75) lg:text-lg">{subline}</p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            {todayWeather && (
              <button
                type="button"
                onClick={() => onNavigate({ kind: "weather" })}
                className="flex min-h-12 items-center gap-2 rounded-full bg-(--k-surf-10) px-5 text-base font-semibold text-(--k-fg-90) backdrop-blur-md transition-colors hover:bg-(--k-surf-15) lg:text-lg"
              >
                <span>{todayWeather.emoji}</span>
                {todayWeather.tempMaxF != null && <span>{Math.round(todayWeather.tempMaxF)}°</span>}
              </button>
            )}
            {/* Photo booth + phone handoff live up here with the utilities — only
                when a guest is checked in, since both need their booking. */}
            {booking && (
              <button
                type="button"
                onClick={() => onNavigate({ kind: "photobooth" })}
                aria-label="Open the photo booth"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-(--k-surf-10) text-(--k-fg) backdrop-blur-md transition-colors hover:bg-(--k-surf-15)"
              >
                <Camera className="h-5 w-5" />
              </button>
            )}
            {booking && (
              <button
                type="button"
                onClick={() => onNavigate({ kind: "phone" })}
                aria-label="Continue on your phone"
                className="flex h-12 w-12 items-center justify-center rounded-full bg-(--k-surf-10) text-(--k-fg) backdrop-blur-md transition-colors hover:bg-(--k-surf-15)"
              >
                <Smartphone className="h-5 w-5" />
              </button>
            )}
            <button
              type="button"
              onClick={onHelp}
              className="flex min-h-12 items-center gap-2 rounded-full bg-(--k-surf-10) px-5 text-base font-bold text-(--k-fg) backdrop-blur-md transition-colors hover:bg-(--k-surf-15) lg:text-lg"
            >
              <LifeBuoy className="h-5 w-5" />
              Help
            </button>
            <KioskThemeToggle className="rounded-full" />
            <span className="text-lg font-semibold text-(--k-fg-80) tabular-nums lg:text-xl">{clock}</span>
          </div>
        </div>

        {/* Menu board — bigger photo tiles, tight gaps, square edges; trailing tiles widen to fill the last row */}
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-2 lg:grid-cols-3">
          {tiles.map((tile, i) => {
            const remainder = tiles.length % 3;
            const isLast = i === tiles.length - 1;
            let widen = "";
            if (remainder === 1 && isLast) widen = "lg:col-span-3";
            else if (remainder === 2 && isLast) widen = "lg:col-span-2";
            const img = tile.image ?? (photos.length ? photos[i % photos.length] : undefined);
            return (
              <button
                key={tile.label}
                type="button"
                onClick={() => (tile.screen ? onNavigate(tile.screen) : onHandoff(tile.href!))}
                className={`group relative flex items-end overflow-hidden text-left transition-transform active:scale-[0.98] ${widen} ${img ? "bg-black" : "bg-(--k-surf-10)"}`}
              >
                {img && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img}
                      alt=""
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-active:scale-105"
                    />
                    <div className="absolute inset-0 bg-linear-to-t from-black/85 via-black/40 to-black/5" />
                  </>
                )}
                <div className="relative flex items-center gap-3 p-5 lg:gap-4 lg:p-6">
                  <span
                    className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl backdrop-blur-md lg:h-14 lg:w-14 ${
                      img ? "bg-white/20 text-white ring-1 ring-white/30" : "bg-(--k-surf-10) text-(--k-fg)"
                    }`}
                  >
                    <tile.icon className={ICON} />
                  </span>
                  <span
                    className={`text-xl font-extrabold leading-tight lg:text-2xl ${
                      img ? "text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.6)]" : "text-(--k-fg)"
                    }`}
                  >
                    {tile.label}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Guest-exclusive deals: a little gift in the corner, not a whole tile. */}
      {hasPromos && (
        <button
          type="button"
          onClick={() => onNavigate({ kind: "promos" })}
          aria-label="Guest-exclusive perks"
          className="absolute bottom-5 right-5 z-20 flex min-h-14 items-center gap-2.5 rounded-full bg-rose-500 px-5 text-base font-bold text-white shadow-xl ring-1 ring-white/20 transition-transform active:scale-[0.96] lg:bottom-8 lg:right-8 lg:text-lg"
        >
          <Gift className="h-6 w-6" />
          Perks
        </button>
      )}
    </div>
  );
}
