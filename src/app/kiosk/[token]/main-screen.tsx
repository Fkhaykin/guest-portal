"use client";

import { useEffect, useState } from "react";
import {
  CalendarPlus,
  CloudSun,
  ClipboardList,
  Gift,
  HandCoins,
  HelpCircle,
  LifeBuoy,
  MapPin,
  PenLine,
  ScrollText,
  ShoppingBag,
  Tag,
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

// Menu-board tile. Every tile is the same frosted-glass panel with a soft
// colored accent (tinted surface + ring + icon badge); nothing is a stark
// solid fill. Static class strings per accent so Tailwind keeps them.
type AccentKey =
  | "indigo" | "sky" | "amber" | "orange" | "emerald"
  | "cyan" | "lime" | "rose" | "fuchsia" | "violet" | "teal" | "slate";

const ACCENTS: Record<AccentKey, { tile: string; badge: string }> = {
  indigo: { tile: "bg-indigo-500/12 ring-indigo-500/25 dark:bg-indigo-400/12 dark:ring-indigo-400/25", badge: "bg-indigo-500/20 text-indigo-700 dark:bg-indigo-400/20 dark:text-indigo-200" },
  sky: { tile: "bg-sky-500/12 ring-sky-500/25 dark:bg-sky-400/12 dark:ring-sky-400/25", badge: "bg-sky-500/20 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200" },
  amber: { tile: "bg-amber-500/14 ring-amber-500/30 dark:bg-amber-400/14 dark:ring-amber-400/30", badge: "bg-amber-500/25 text-amber-700 dark:bg-amber-400/25 dark:text-amber-200" },
  orange: { tile: "bg-orange-500/12 ring-orange-500/25 dark:bg-orange-400/12 dark:ring-orange-400/25", badge: "bg-orange-500/20 text-orange-700 dark:bg-orange-400/20 dark:text-orange-200" },
  emerald: { tile: "bg-emerald-500/12 ring-emerald-500/25 dark:bg-emerald-400/12 dark:ring-emerald-400/25", badge: "bg-emerald-500/20 text-emerald-700 dark:bg-emerald-400/20 dark:text-emerald-200" },
  cyan: { tile: "bg-cyan-500/12 ring-cyan-500/25 dark:bg-cyan-400/12 dark:ring-cyan-400/25", badge: "bg-cyan-500/20 text-cyan-700 dark:bg-cyan-400/20 dark:text-cyan-200" },
  lime: { tile: "bg-lime-500/14 ring-lime-500/30 dark:bg-lime-400/12 dark:ring-lime-400/25", badge: "bg-lime-500/25 text-lime-700 dark:bg-lime-400/20 dark:text-lime-200" },
  rose: { tile: "bg-rose-500/12 ring-rose-500/25 dark:bg-rose-400/12 dark:ring-rose-400/25", badge: "bg-rose-500/20 text-rose-700 dark:bg-rose-400/20 dark:text-rose-200" },
  fuchsia: { tile: "bg-fuchsia-500/12 ring-fuchsia-500/25 dark:bg-fuchsia-400/12 dark:ring-fuchsia-400/25", badge: "bg-fuchsia-500/20 text-fuchsia-700 dark:bg-fuchsia-400/20 dark:text-fuchsia-200" },
  violet: { tile: "bg-violet-500/12 ring-violet-500/25 dark:bg-violet-400/12 dark:ring-violet-400/25", badge: "bg-violet-500/20 text-violet-700 dark:bg-violet-400/20 dark:text-violet-200" },
  teal: { tile: "bg-teal-500/12 ring-teal-500/25 dark:bg-teal-400/12 dark:ring-teal-400/25", badge: "bg-teal-500/20 text-teal-700 dark:bg-teal-400/20 dark:text-teal-200" },
  slate: { tile: "bg-slate-400/12 ring-slate-400/25 dark:bg-slate-300/12 dark:ring-slate-300/20", badge: "bg-slate-400/20 text-slate-700 dark:bg-slate-300/20 dark:text-slate-200" },
};

type Tile = {
  label: string;
  description: string;
  icon: LucideIcon;
  accent: AccentKey;
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

  // Primary actions first (booked guests), then the browse grid. All one size.
  const primary: Tile[] = booking
    ? [
        res!.signature_url
          ? { label: "Update Registration", description: "Edit guests, pets, or vehicles", href: `/p/${slug}/update`, icon: PenLine, accent: "indigo" }
          : { label: "Register", description: "Register your guests and vehicles", href: `/p/${slug}/register`, icon: ClipboardList, accent: "indigo" },
        { label: "Extend Your Stay", description: "Add nights — pick dates on a calendar", href: `/p/${slug}/extend-stay`, icon: CalendarPlus, accent: "sky" },
        { label: "Tip the Crew", description: "Thank the team that keeps it spotless", screen: { kind: "tip" }, icon: HandCoins, accent: "amber" },
      ]
    : [];

  // Services & Videos only appear when the house actually has content for them.
  const hasServices = (content?.services?.length ?? 0) > 0;
  const hasVideos = (content?.videos?.length ?? 0) > 0;

  const browse: Tile[] = [
    ...(booking
      ? [
          { label: "Add-Ons", description: "Extras & experiences for your stay", href: `/p/${slug}/add-ons`, icon: Gift, accent: "orange" } as Tile,
          { label: "Delivery & Rides", description: "Register deliveries and rideshares", href: `/p/${slug}/delivery`, icon: Truck, accent: "emerald" } as Tile,
        ]
      : []),
    { label: "Weather", description: "Hourly forecast & live radar", screen: { kind: "weather" }, icon: CloudSun, accent: "cyan" },
    { label: "Explore", description: "Things to do in the Poconos", screen: { kind: "explore" }, icon: MapPin, accent: "lime" },
    { label: "Promotions", description: "Guest-exclusive deals", screen: { kind: "promos" }, icon: Tag, accent: "rose" },
    ...(hasServices
      ? [{ label: "Services", description: "Browse additional services", screen: { kind: "services" }, icon: ShoppingBag, accent: "fuchsia" } as Tile]
      : []),
    ...(hasVideos
      ? [{ label: "Videos", description: "How-to guides & welcome tour", screen: { kind: "videos" }, icon: Video, accent: "violet" } as Tile]
      : []),
    { label: "FAQ", description: "Answers about the house", screen: { kind: "faq" }, icon: HelpCircle, accent: "teal" },
    { label: "House Rules", description: "The 8 rules & full policies", screen: { kind: "rules" }, icon: ScrollText, accent: "slate" },
  ];

  const tiles = [...primary, ...browse];
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

      <div className="relative flex h-full flex-col gap-5 p-5 lg:gap-6 lg:p-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.35em] text-(--k-fg-60) lg:text-sm">
            {data.property.name}
          </span>
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

        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-(--k-fg) lg:text-4xl text-balance">
            {headline}
          </h1>
          <p className="mt-1.5 text-lg font-medium text-(--k-fg-75) lg:mt-2 lg:text-xl">{subline}</p>
        </div>

        {/* Menu board — trailing tiles widen so the last row always fills */}
        <div className="grid min-h-0 flex-1 auto-rows-fr grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {tiles.map((tile, i) => {
            const remainder = tiles.length % 4;
            const isLast = i === tiles.length - 1;
            let widen = "";
            if (remainder === 1 && isLast) widen = "lg:col-span-4";
            else if (remainder === 2 && i >= tiles.length - 2) widen = "lg:col-span-2";
            else if (remainder === 3 && isLast) widen = "lg:col-span-2";
            const accent = ACCENTS[tile.accent];
            return (
              <button
                key={tile.label}
                type="button"
                onClick={() => (tile.screen ? onNavigate(tile.screen) : onHandoff(tile.href!))}
                className={`flex items-center gap-4 rounded-3xl p-5 text-left ring-1 backdrop-blur-md transition-transform active:scale-[0.97] lg:gap-5 lg:p-6 ${widen} ${accent.tile}`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl lg:h-14 lg:w-14 ${accent.badge}`}>
                  <tile.icon className={ICON} />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold leading-tight text-(--k-fg) lg:text-xl">{tile.label}</span>
                  <span className="mt-0.5 hidden text-sm font-medium text-(--k-fg-60) lg:block lg:text-base">
                    {tile.description}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
