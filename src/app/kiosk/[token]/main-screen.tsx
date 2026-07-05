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
import { formatShortDate, formatTime } from "./ui";

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

// Menu-board tile. `variant` sets the surface; every icon renders at ONE size
// inside an identical badge, so the grid reads as a consistent set.
type Variant = "light" | "gold" | string; // string = gradient class group
type Tile = {
  label: string;
  description: string;
  icon: LucideIcon;
  variant: Variant;
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
          ? { label: "Update Registration", description: "Edit guests, pets, or vehicles", href: `/p/${slug}/update`, icon: PenLine, variant: "light" }
          : { label: "Register", description: "Register your guests and vehicles", href: `/p/${slug}/register`, icon: ClipboardList, variant: "light" },
        { label: "Extend Your Stay", description: "Add nights — pick dates on a calendar", href: `/p/${slug}/extend-stay`, icon: CalendarPlus, variant: "light" },
        { label: "Tip the Crew", description: "Thank the team that keeps it spotless", screen: { kind: "tip" }, icon: HandCoins, variant: "gold" },
      ]
    : [];

  // Services & Videos only appear when the house actually has content for them.
  const hasServices = (content?.services?.length ?? 0) > 0;
  const hasVideos = (content?.videos?.length ?? 0) > 0;

  const browse: Tile[] = [
    ...(booking
      ? [
          { label: "Add-Ons", description: "Extras & experiences for your stay", href: `/p/${slug}/add-ons`, icon: Gift, variant: "from-orange-500 to-amber-600" } as Tile,
          { label: "Delivery & Rides", description: "Register deliveries and rideshares", href: `/p/${slug}/delivery`, icon: Truck, variant: "from-emerald-500 to-teal-600" } as Tile,
        ]
      : []),
    { label: "Weather", description: "Hourly forecast & live radar", screen: { kind: "weather" }, icon: CloudSun, variant: "from-sky-500 to-blue-700" },
    { label: "Explore", description: "Things to do in the Poconos", screen: { kind: "explore" }, icon: MapPin, variant: "from-lime-500 to-green-700" },
    { label: "Promotions", description: "Guest-exclusive deals", screen: { kind: "promos" }, icon: Tag, variant: "from-rose-500 to-red-700" },
    ...(hasServices
      ? [{ label: "Services", description: "Browse additional services", screen: { kind: "services" }, icon: ShoppingBag, variant: "from-fuchsia-500 to-purple-700" } as Tile]
      : []),
    ...(hasVideos
      ? [{ label: "Videos", description: "How-to guides & welcome tour", screen: { kind: "videos" }, icon: Video, variant: "from-indigo-500 to-violet-700" } as Tile]
      : []),
    { label: "FAQ", description: "Answers about the house", screen: { kind: "faq" }, icon: HelpCircle, variant: "from-cyan-600 to-sky-800" },
    { label: "House Rules", description: "The 8 rules & full policies", screen: { kind: "rules" }, icon: ScrollText, variant: "from-zinc-500 to-zinc-700" },
  ];

  const tiles = [...primary, ...browse];
  const todayWeather = data.weather?.find((w) => w.date === data.today) ?? data.weather?.[0];

  function surface(variant: Variant): string {
    if (variant === "light") return "bg-white text-zinc-900";
    if (variant === "gold") return "bg-amber-400 text-zinc-900";
    return `bg-linear-to-br text-white ${variant} ring-1 ring-white/10`;
  }
  function badge(variant: Variant): string {
    return variant === "light" || variant === "gold" ? "bg-zinc-900/10" : "bg-white/15";
  }

  return (
    <div className="absolute inset-0 flex flex-col">
      {/* Backdrop */}
      {data.photos[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={data.photos[0]}
          alt=""
          className="absolute inset-0 h-full w-full scale-110 object-cover blur-lg brightness-[0.22]"
        />
      )}
      <div className="absolute inset-0 bg-linear-to-b from-zinc-950/70 via-zinc-950/30 to-zinc-950/80" />

      <div className="relative flex h-full flex-col gap-5 p-5 lg:gap-6 lg:p-8">
        {/* Top bar */}
        <div className="flex items-center justify-between gap-4">
          <span className="min-w-0 truncate text-xs font-semibold uppercase tracking-[0.35em] text-white/60 lg:text-sm">
            {data.property.name}
          </span>
          <div className="flex shrink-0 items-center gap-3">
            {todayWeather && (
              <button
                type="button"
                onClick={() => onNavigate({ kind: "weather" })}
                className="flex min-h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-base font-semibold text-white/90 backdrop-blur-md transition-colors hover:bg-white/15 lg:text-lg"
              >
                <span>{todayWeather.emoji}</span>
                {todayWeather.tempMaxF != null && <span>{Math.round(todayWeather.tempMaxF)}°</span>}
              </button>
            )}
            <button
              type="button"
              onClick={onHelp}
              className="flex min-h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-base font-bold text-white backdrop-blur-md transition-colors hover:bg-white/15 lg:text-lg"
            >
              <LifeBuoy className="h-5 w-5" />
              Help
            </button>
            <span className="text-lg font-semibold text-white/80 tabular-nums lg:text-xl">{clock}</span>
          </div>
        </div>

        {/* Greeting */}
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white lg:text-5xl text-balance">
            {headline}
          </h1>
          <p className="mt-1.5 text-lg font-medium text-white/75 lg:mt-2 lg:text-xl">{subline}</p>
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
            return (
              <button
                key={tile.label}
                type="button"
                onClick={() => (tile.screen ? onNavigate(tile.screen) : onHandoff(tile.href!))}
                className={`flex items-center gap-4 rounded-3xl p-5 text-left shadow-lg transition-transform active:scale-[0.97] lg:gap-5 lg:p-6 ${widen} ${surface(tile.variant)}`}
              >
                <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl lg:h-14 lg:w-14 ${badge(tile.variant)}`}>
                  <tile.icon className={ICON} />
                </span>
                <span className="min-w-0">
                  <span className="block text-lg font-extrabold leading-tight lg:text-2xl">{tile.label}</span>
                  <span
                    className={`mt-0.5 hidden text-sm font-medium lg:block lg:text-base ${
                      tile.variant === "light" || tile.variant === "gold" ? "text-zinc-600" : "text-white/80"
                    }`}
                  >
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
