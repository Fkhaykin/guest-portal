"use client";

import { useEffect, useState } from "react";
import {
  CloudSun,
  ClipboardList,
  Gift,
  HelpCircle,
  MapPin,
  PenLine,
  ScrollText,
  ShoppingBag,
  Tag,
  Truck,
  Video,
  type LucideIcon,
} from "lucide-react";
import type { KioskData, KioskScreen } from "./types";
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

// Menu-board tiles: uniform, saturated, giant type — the whole grid fills the
// screen like a self-order kiosk.
type Tile = {
  label: string;
  description: string;
  icon: LucideIcon;
  accent: string; // gradient classes
  featured?: boolean;
} & ({ href: string; screen?: never } | { screen: KioskScreen; href?: never });

export function MainScreen({
  data,
  onHandoff,
  onNavigate,
}: {
  data: KioskData;
  onHandoff: (href: string) => void;
  onNavigate: (screen: KioskScreen) => void;
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

  const registrationTile: Tile | null = booking
    ? res!.signature_url
      ? { label: "Update Registration", description: "Edit guests, pets, or vehicles", href: `/p/${slug}/update`, icon: PenLine, accent: "", featured: true }
      : { label: "Register", description: "Register your guests and vehicles", href: `/p/${slug}/register`, icon: ClipboardList, accent: "", featured: true }
    : null;

  const tiles: Tile[] = [
    ...(registrationTile ? [registrationTile] : []),
    ...(booking
      ? [
          { label: "Add-Ons", description: "Extras & experiences for your stay", href: `/p/${slug}/add-ons`, icon: Gift, accent: "from-amber-500 to-orange-600" } as Tile,
          { label: "Delivery & Rides", description: "Register deliveries and rideshares", href: `/p/${slug}/delivery`, icon: Truck, accent: "from-emerald-500 to-teal-600" } as Tile,
        ]
      : []),
    { label: "Weather", description: "Hourly forecast & live radar", screen: { kind: "weather" }, icon: CloudSun, accent: "from-sky-500 to-blue-700" },
    { label: "Explore", description: "Things to do in the Poconos", screen: { kind: "explore" }, icon: MapPin, accent: "from-lime-500 to-green-700" },
    { label: "Promotions", description: "Guest-exclusive deals", screen: { kind: "promos" }, icon: Tag, accent: "from-rose-500 to-red-700" },
    { label: "Services", description: "Browse additional services", screen: { kind: "services" }, icon: ShoppingBag, accent: "from-fuchsia-500 to-purple-700" },
    { label: "Videos", description: "How-to guides & welcome tour", screen: { kind: "videos" }, icon: Video, accent: "from-indigo-500 to-violet-700" },
    { label: "FAQ", description: "Answers about the house", screen: { kind: "faq" }, icon: HelpCircle, accent: "from-cyan-600 to-sky-800" },
    { label: "House Rules", description: "The 8 rules & full policies", screen: { kind: "rules" }, icon: ScrollText, accent: "from-zinc-500 to-zinc-700" },
  ];

  const todayWeather = data.weather?.find((w) => w.date === data.today) ?? data.weather?.[0];

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
      <div className="absolute inset-0 bg-gradient-to-b from-zinc-950/70 via-zinc-950/30 to-zinc-950/80" />

      <div className="relative flex h-full flex-col gap-5 p-5 lg:gap-6 lg:p-8">
        {/* Top bar */}
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-[0.35em] text-white/60 lg:text-sm">
            {data.property.name}
          </span>
          <div className="flex items-center gap-4">
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
            <span className="text-lg font-semibold text-white/80 tabular-nums lg:text-xl">{clock}</span>
          </div>
        </div>

        {/* Greeting */}
        <div>
          <h1 className="text-5xl font-extrabold tracking-tight text-white lg:text-7xl text-balance">
            {headline}
          </h1>
          <p className="mt-2 text-xl font-medium text-white/75 lg:mt-3 lg:text-2xl">{subline}</p>
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
              className={`group relative flex flex-col justify-between overflow-hidden rounded-3xl p-4 text-left shadow-lg transition-transform active:scale-[0.97] lg:p-6 ${widen} ${
                tile.featured
                  ? "bg-white text-zinc-900"
                  : `bg-gradient-to-br text-white ${tile.accent} ring-1 ring-white/10`
              }`}
            >
              {/* Watermark icon for menu-board pop */}
              <tile.icon
                className={`pointer-events-none absolute -bottom-6 -right-6 h-32 w-32 lg:h-40 lg:w-40 ${
                  tile.featured ? "text-zinc-900/10" : "text-white/15"
                }`}
              />
              <tile.icon className="h-9 w-9 lg:h-12 lg:w-12" />
              <span className="relative">
                <span className="block text-xl font-extrabold leading-tight lg:text-3xl">{tile.label}</span>
                <span
                  className={`mt-1 hidden text-sm font-medium lg:block lg:text-base ${
                    tile.featured ? "text-zinc-600" : "text-white/80"
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
